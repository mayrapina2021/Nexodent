import Groq, { toFile } from "groq-sdk";
import { db, settingsTable, conversationsTable, messagesTable, patientsTable, aiKnowledgeTable, aiPersonalityTable, quotationsTable, appointmentsTable, treatmentsTable } from "@workspace/db";
import { eq, desc, asc, or, ilike, and, gte } from "drizzle-orm";
import { logger } from "./logger";
import { DEFAULT_CLINIC_ADDRESS } from "./clinic-defaults";
import { buildPatientPanelContext } from "./patient-panel-context";
import { compressSlotsToRanges } from "./slot-ranges";
import { isValidPatientName } from "./patient-name-utils";
import { formatColombianPhone, isValidColombianPhone } from "./conversation-patient-sync";

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
  }
  return _groq;
}

export interface AIActions {
  registerPatient?: {
    name: string;
    phone?: string | null;
    treatment: string;
    notes?: string;
    email?: string;
    age?: number;
  } | null;
  bookAppointment?: { date: string; startTime: string; treatment: string; notes?: string } | null;
  cancelAppointment?: { appointmentId: number } | null;
  rescheduleAppointment?: { appointmentId: number; date: string; startTime: string } | null;
  updatePhone?: { phone: string } | null;
  updateStatus?: { status: "new" | "interested" | "scheduled" | "attended" | "in_treatment" | "completed" } | null;
  sendQuotation?: { quotationId: number } | null;
  sendPaymentReceipt?: { paymentId: number } | null;
  sendConsentLink?: { consentId: number } | null;
}

export interface AIResponse {
  message: string;
  actions: AIActions;
}

interface AIOptions {
  history?: { role: "user" | "assistant"; content: string }[];
  patientName?: string;
  testMode?: boolean;
  availableSlots?: { label: string; slots: string[] }[];
  contactPhone?: string;
}

function getColombiaNow(): { dateStr: string; timeStr: string; dayName: string } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const timeStr = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  const dayName = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
  }).format(now);
  return { dateStr, timeStr, dayName };
}

function to12h(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "p.m." : "a.m.";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function formatAvailableSlotsForPrompt(
  slots?: { label: string; slots: string[] }[],
): string {
  if (!slots?.length) return "";
  const withAvailability = slots.filter((d) => d.slots.length > 0);
  if (!withAvailability.length) {
    return `
HORARIOS DISPONIBLES: No hay cupos libres en los próximos 3 días laborables. Ofrece contactar la clínica o proponer otro día; no inventes horarios.
`;
  }
  const lines = withAvailability.map((d) => {
    const ranges = compressSlotsToRanges(d.slots);
    const humanRanges = ranges
      .map((r) => `${to12h(r.from)} a ${to12h(r.to)}`)
      .join(" · ");
    const internal = ranges
      .map((r) => `${r.from}-${r.to} (inicios posibles 24h: ${r.sampleStarts.slice(0, 4).join(", ")}${r.sampleStarts.length > 4 ? "…" : ""})`)
      .join("; ");
    return `- ${d.label}: bloques ${humanRanges}\n  Referencia interna: ${internal}`;
  });
  return `
HORARIOS DISPONIBLES (para agendar cita nueva o reagendar; NO ejecutar hasta que el paciente confirme):
- Al paciente ofrece SOLO bloques amplios (ej. "de 8:00 a.m. a 11:00 a.m."). Máximo 2 bloques por día en tu mensaje.
- PROHIBIDO listar docenas de horas sueltas (8:00, 8:15, 8:30...) en un solo mensaje.
- Cuando el paciente elija un bloque, pregunta amablemente a qué hora le queda mejor dentro de ese rango.
- Usa fecha YYYY-MM-DD y startTime 24h HH:MM solo si el paciente CONFIRMA explícitamente una hora concreta.
- No inventes horarios fuera de esta lista.
${lines.join("\n")}
`;
}

export async function generateAIResponse(
  conversationId: number | null,
  patientMessage: string,
  opts: AIOptions = {}
): Promise<AIResponse> {
  try {
    const [settings, personality, knowledgeEntries, allTreatments] = await Promise.all([
      db.select().from(settingsTable).limit(1),
      db.select().from(aiPersonalityTable).limit(1),
      db.select().from(aiKnowledgeTable).where(eq(aiKnowledgeTable.active, true)).orderBy(aiKnowledgeTable.category),
      db.select().from(treatmentsTable).where(eq(treatmentsTable.active, true)),
    ]);

    const cfg = settings[0];
    const p = personality[0];
    const clinicName = cfg?.clinicName ?? "Nexodent";
    const clinicAddress = (cfg?.clinicAddress?.trim() || DEFAULT_CLINIC_ADDRESS);
    const clinicPhone = cfg?.clinicPhone?.trim() ?? "";
    const { dateStr: colombiaDate, timeStr: colombiaTime, dayName: colombiaDay } = getColombiaNow();

    let patientContext = "";
    let dataContext = "";
    let contactPhone = opts.contactPhone ?? "";
    let patientRegistered = false;

    if (conversationId && !opts.testMode) {
      const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
      if (conv?.phone && isValidColombianPhone(conv.phone)) {
        contactPhone = formatColombianPhone(conv.phone);
      }
      let patientId = conv?.patientId;

      const potentialPhone = patientMessage.replace(/\D/g, "");
      if (!patientId && potentialPhone.length >= 7) {
        const [pByPhone] = await db.select().from(patientsTable).where(or(
          ilike(patientsTable.phone, `%${potentialPhone}%`),
          eq(patientsTable.phone, potentialPhone)
        )).limit(1);
        if (pByPhone) patientId = pByPhone.id;
      }

      if (patientId) {
        const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);

        if (patient) {
          patientRegistered = true;
          const pData = patient;
          const firstName = pData.name.split(" ")[0];
          patientContext = `\nPACIENTE IDENTIFICADO (patientId ${pData.id}):\n- Nombre: ${pData.name} (llámalo/a "${firstName}")\n- Teléfono: ${pData.phone}\n- Estado pipeline: ${pData.status}`;
          dataContext = await buildPatientPanelContext(patientId, colombiaDate);
        }
      } else if (conv?.phone) {
        const cleanPhone = conv.phone.replace(/\D/g, "");
        const [pByConvPhone] = await db.select().from(patientsTable).where(or(
          eq(patientsTable.phone, conv.phone),
          ilike(patientsTable.phone, `%${cleanPhone.slice(-10)}%`),
        )).limit(1);
        if (pByConvPhone) {
          patientRegistered = true;
          const firstName = pByConvPhone.name.split(" ")[0];
          patientContext = `\nPACIENTE IDENTIFICADO (patientId ${pByConvPhone.id}):\n- Nombre: ${pByConvPhone.name} (llámalo/a "${firstName}")\n- Teléfono: ${pByConvPhone.phone}\n- Estado pipeline: ${pByConvPhone.status}`;
          dataContext = await buildPatientPanelContext(pByConvPhone.id, colombiaDate);
        }
      }
    }

    const treatmentsContext = allTreatments.length > 0 
      ? `\nLISTADO DE TRATAMIENTOS Y PRECIOS BASE:\n${allTreatments.map(t => `- ${t.name}: ${Number(t.price).toLocaleString()} pesos`).join("\n")}\n`
      : "";

    // Knowledge Map
    const KEYWORD_MAP: Record<string, string[]> = {
      "Odontología General — Precios":       ["resina","obturac","caries","sellante","profilaxis","limpieza","higiene","urgencia","calculo","sarro","general","servicios","ofrece","disponibles"],
      "Blanqueamiento Dental — Precios":     ["blanquea","whitening","aclar","diente amarillo","mancha"],
      "Estética Dental — Carillas y Diseño de Sonrisa": ["carilla","diseño de sonrisa","estética","veneers","microdiseño","cerómero","disilicato","sonrisa"],
      "Rehabilitación Oral — Coronas y Prótesis": ["corona","rehabilit","incrustac","nucleo","pilar","puente","recementar","provisional","platino","tradicional","zirconio"],
      "Prótesis Dentales — Precios":         ["prótesis","protesis","acker","dentadura","dientes postizos","base","rebase","gancho"],
      "Implantes Dentales — Precios Completos": ["implante","implan","titanio","prom","pilar","sobredentadura","hibrida","hueso","membrana","seno"],
      "Cirugía Oral — Precios":              ["cirugia","cirugía","extraccion","extracción","exodoncia","muela del juicio","cordal","frenilect","biopsia","capuchon"],
      "Periodoncia — Encías y Soporte Dental": ["encia","encía","periodont","curetaje","gingivect","reborde","injerto","sangra","piorrhea"],
      "Endodoncia — Tratamiento de Conductos": ["endodoncia","conducto","nervio","pulpa","apice","apicectomia","reabsorcion","canal"],
      "Ortodoncia — Planes y Precios":       ["ortodoncia","bracket","aligner","retenedor","mordida","dientes chuecos","torcidos","alinear","aparatos","brace"],
      "Información sobre pagos y política de citas": ["pago","precio","cobro","cuota","financi","cancelar","politica","horario","direccion","ubicacion","costo","valor","cuanto vale","cuanto cuesta","cotizacion","presupuesto"],
    };

    const searchText = (patientMessage + " " + (opts.history ?? []).slice(-3).map(m => m.content).join(" ")).toLowerCase();
    const filteredEntries = knowledgeEntries.filter(entry => {
      if (entry.category === "general") return true;
      const keywords = KEYWORD_MAP[entry.title] ?? [];
      return keywords.some(kw => searchText.includes(kw));
    });

    const entriesToUse = filteredEntries.length > 0 ? filteredEntries : knowledgeEntries.filter(e => e.category === "general");
    const knowledgeSection = `\nARTÍCULOS DE AYUDA:\n${entriesToUse.map(e => `[${e.title}]\n${e.content}`).join("\n\n")}\n`;

    let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
    if (opts.history) {
      conversationHistory = opts.history;
    } else if (conversationId) {
      const pastMessages = await db.select().from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(asc(messagesTable.id))
        .limit(15);
      conversationHistory = pastMessages.filter(m => m.sender === "patient" || m.sender === "ai")
        .map(m => ({ role: m.sender === "patient" ? "user" : "assistant", content: m.content }));
    }

    const assistantName = p?.name ?? "Dante";
    const isFirstContact = conversationHistory.filter((m) => m.role === "assistant").length === 0;

    const personalitySection = p ? `
PERFIL DE PERSONALIDAD (configuración de la clínica):
- Rol: ${p.role}
- Objetivo principal: ${p.mainGoal}
- Tono: ${p.tone}, cálido, empático y muy amable — nunca seco ni robótico
- Idioma: ${p.language}
- Longitud de respuestas preferida: ${p.maxResponseLength}
${p.dontRepeatGreeting ? "- No repitas la presentación completa en cada mensaje; solo la primera vez." : ""}
${p.proactiveQuestions ? "- Haz preguntas proactivas con delicadeza, de a una o dos por mensaje." : ""}
${p.suggestAppointments ? "- Puedes INVITAR a agendar valoración cuando hable de tratamientos o precios, pero primero registra al paciente si no existe." : ""}
${p.escalateKeywords ? `- Si el paciente menciona palabras como: ${p.escalateKeywords}, indica que un asesor humano atenderá pronto.` : ""}
${p.extraInstructions ? `- Instrucciones adicionales: ${p.extraInstructions}` : ""}
` : "";

    const slotsSection = formatAvailableSlotsForPrompt(opts.availableSlots);

    const clinicInfoSection = `
DATOS OFICIALES DEL CONSULTORIO (obligatorio cuando pregunten ubicación):
- Nombre: ${clinicName}
- Dirección exacta: ${clinicAddress}
${clinicPhone ? `- Teléfono: ${clinicPhone}` : ""}
- Horario: Lunes a Sábado, 8:00 a.m. a 6:00 p.m.
REGLA DE UBICACIÓN: Si preguntan dónde están, dirección, dirección exacta, cómo llegar o ubicación, responde con la dirección completa de arriba. NUNCA digas que no puedes dar la dirección. NUNCA inventes otra calle o número distinto.
`;

    const contactSection = contactPhone
      ? `
CONTACTO WHATSAPP ACTUAL:
- Teléfono del chat (usar SIEMPRE para registerPatient; phone: null): ${contactPhone}
- PROHIBIDO pedir el número de teléfono al paciente — ya lo tienes del WhatsApp.
- PROHIBIDO usar el nombre de perfil de WhatsApp (emojis, apodos raros) como nombre del paciente.
`
      : "";

    const registrationSection = patientRegistered
      ? ""
      : `
PACIENTE NO REGISTRADO AÚN — FLUJO OBLIGATORIO ANTES DE AGENDAR:
1. Si es la primera conversación, preséntate como ${assistantName} de ${clinicName} con calidez y empatía.
2. Cuando quiera agendar o consultar tratamiento, recopila con gentileza (de a una o dos preguntas por mensaje):
   - Nombre completo (OBLIGATORIO — debe ser nombre real, no emojis)
   - Motivo o tratamiento de interés (OBLIGATORIO)
   - Opcional si fluye natural: edad, correo
3. Cuando tengas nombre + motivo, usa registerPatient con phone: null y notes con un resumen breve de lo que contó (observaciones).
4. SOLO DESPUÉS de registerPatient puedes ofrecer horarios y usar bookAppointment.
5. PROHIBIDO bookAppointment si el paciente no está registrado.
6. PROHIBIDO agendar antes de tener el nombre real del paciente.
`;

    const firstContactSection = isFirstContact
      ? `
PRIMERA VEZ CON ESTE CONTACTO:
- Preséntate: "Hola, soy ${assistantName}, tu asistente en ${clinicName} 😊" (tono cálido, humano, no corporativo).
- Pregunta en qué puedes ayudarle hoy con genuino interés.
`
      : "";

    const systemPrompt = `Eres ${assistantName}, la asistente oficial de ${clinicName} en Medellín.
Eres una persona real, profesional, muy amable, empática y resolutiva. Hablas con calidez, nunca de forma seca o fría.
HOY: ${colombiaDay} ${colombiaDate}, ${colombiaTime}.
${personalitySection}
${clinicInfoSection}
${contactSection}
${firstContactSection}
${registrationSection}
PAUTAS IMPORTANTES PARA TU COMPORTAMIENTO:
- Tono gentil: usa frases amables ("con gusto", "será un placer", "cuéntame"), valida lo que dice el paciente, evita respuestas cortantes.
- Conversación natural: después de la primera presentación, no repitas "soy ${assistantName}" en cada mensaje.
- Respuestas completas y asesoría: Cuando te pregunten por tratamientos (como implantes, diseños, etc.), lee bien los ARTÍCULOS DE AYUDA. Da una explicación clara y amable.
- Precios y variaciones: Si das un precio, aclara que es "precio base" y puede variar según el caso. Usa "pesos" (ej. "100.000 pesos"). ¡PROHIBIDO el símbolo "$"!
- Citas: Solo después de registrar al paciente, ofrece bloques horarios amplios (ej. "de 9:00 a.m. a 11:00 a.m."). No listes decenas de horas.
- Cuando confirme fecha y hora concreta (sí, listo, me sirve, a las 10...), reserva con bookAppointment.
- Cotizaciones: Si hay presupuestos en DATOS DEL PANEL, resume servicios y totales. Si pide el presupuesto formal/imagen, usa sendQuotation.
- Abonos y recibos: Informa saldos; si pide recibo, usa sendPaymentReceipt con paymentId.
- Consentimientos: Si hay pendiente, usa sendConsentLink.
- REGLA CRÍTICA: Solo información del paciente identificado abajo. NUNCA inventes datos.
- Devoluciones: Indica que un asesor humano lo revisará.
${slotsSection}
ACCESO AL PANEL: Ficha completa del paciente identificado.
- Registra pacientes nuevos con registerPatient cuando tengas nombre real y motivo de consulta.

PACIENTE:${patientContext || "\n(no registrado aún — debes recopilar datos antes de agendar)"}${dataContext}
${treatmentsContext}
${knowledgeSection}

ACCIONES DISPONIBLES (JSON):
- registerPatient: {"name":"Nombre Apellido","phone":null,"treatment":"motivo","notes":"observaciones del chat","email":null,"age":null}
- bookAppointment: {"date":"YYYY-MM-DD","startTime":"HH:MM","treatment":"motivo","notes":"nota"}
- cancelAppointment: {"appointmentId":123}
- rescheduleAppointment: {"appointmentId":123,"date":"YYYY-MM-DD","startTime":"HH:MM"}
- updateStatus: {"status":"interested"}
- sendQuotation: {"quotationId":123}
- sendPaymentReceipt: {"paymentId":456}
- sendConsentLink: {"consentId":789}

REGLA DE AGENDA:
- bookAppointment SOLO si el paciente YA está registrado y confirmó fecha/hora explícitamente.
- NO uses bookAppointment para reagendar; usa rescheduleAppointment.
- Flujo: datos del paciente → registerPatient → ofreces bloques horarios → paciente confirma hora → bookAppointment.
- PROHIBIDO decir "te he agendado" sin bookAppointment en actions.
- PROHIBIDO registerPatient + bookAppointment en el mismo mensaje si aún no tenías el nombre antes en la conversación.

CANCELAR / REAGENDAR: igual que antes — confirmación explícita del paciente.

FORMATO JSON:
{"message":"tu respuesta","actions":{...}}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.slice(-15),
      { role: "user" as const, content: patientMessage },
    ];

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      response_format: { type: "json_object" as const },
      temperature: 0.65,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "{}";
    
    // Robust JSON extraction to prevent SyntaxError if the LLM adds markdown or text
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);

    return {
      message: parsed.message || "",
      actions: {
        registerPatient: parsed.actions?.registerPatient ?? null,
        bookAppointment: parsed.actions?.bookAppointment ?? null,
        cancelAppointment: parsed.actions?.cancelAppointment ?? null,
        rescheduleAppointment: parsed.actions?.rescheduleAppointment ?? null,
        updatePhone: parsed.actions?.updatePhone ?? null,
        updateStatus: parsed.actions?.updateStatus ?? null,
        sendQuotation: parsed.actions?.sendQuotation ?? null,
        sendPaymentReceipt: parsed.actions?.sendPaymentReceipt ?? null,
        sendConsentLink: parsed.actions?.sendConsentLink ?? null,
      },
    };
  } catch (err) {
    logger.error({ err }, "Error AI");
    return {
      message: "Hola, gracias por escribirnos a Nexodent. Cuéntame, ¿en qué puedo ayudarte?",
      actions: {},
    };
  }
}

export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    const file = await toFile(buffer, "audio.ogg");
    const transcription = await getGroq().audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "es",
    });
    return transcription.text;
  } catch (err) {
    logger.error({ err }, "Error STT");
    throw err;
  }
}
