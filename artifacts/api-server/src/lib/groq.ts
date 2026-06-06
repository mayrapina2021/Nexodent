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

type TreatmentRow = { name: string; price: string | number };

const TREATMENT_TOPIC_KEYWORDS: { tags: string[]; keywords: string[] }[] = [
  { tags: ["profilaxis", "limpieza"], keywords: ["profilaxis", "limpieza", "higiene"] },
  { tags: ["valoracion", "diagnostico"], keywords: ["valoracion", "valoración", "diagnostico", "diagnóstico", "consulta inicial"] },
  { tags: ["implante"], keywords: ["implante", "implan"] },
  { tags: ["blanqueamiento"], keywords: ["blanquea", "whitening", "aclar"] },
  { tags: ["carilla", "sonrisa"], keywords: ["carilla", "sonrisa", "estetica", "estética"] },
  { tags: ["ortodoncia"], keywords: ["ortodoncia", "bracket", "frenillo", "alineador"] },
  { tags: ["corona"], keywords: ["corona", "zirconio"] },
  { tags: ["endodoncia"], keywords: ["endodoncia", "conducto", "nervio"] },
  { tags: ["extraccion"], keywords: ["extraccion", "extracción", "exodoncia"] },
  { tags: ["resina"], keywords: ["resina", "caries", "obturac"] },
  { tags: ["detartraje"], keywords: ["detartraje", "sarro", "calculo", "cálculo"] },
];

function combinedSearchText(message: string, history: { role: string; content: string }[]): string {
  const recent = history.slice(-6).map((m) => m.content).join(" ");
  return `${message} ${recent}`.toLowerCase();
}

function wantsFullServiceCatalog(text: string): boolean {
  return /(?:qué servicios|que servicios|qué ofrecen|que ofrecen|qué tratamientos|que tratamientos|todos los servicios|catálogo|catalogo|lista de servicios)/.test(text);
}

function buildRelevantTreatmentsContext(
  allTreatments: TreatmentRow[],
  searchText: string,
): string {
  if (!allTreatments.length) return "";

  if (wantsFullServiceCatalog(searchText)) {
    const sample = allTreatments.slice(0, 5).map((t) => `- ${t.name}: ${Number(t.price).toLocaleString()} pesos`).join("\n");
    return `
REFERENCIA INTERNA (el paciente pidió catálogo — resume en 2-3 líneas, NO copies esta lista completa):
${sample}
…y otros tratamientos según necesidad.
`;
  }

  const matchedTags = new Set<string>();
  for (const { tags, keywords } of TREATMENT_TOPIC_KEYWORDS) {
    if (keywords.some((kw) => searchText.includes(kw))) {
      tags.forEach((t) => matchedTags.add(t));
    }
  }

  if (matchedTags.size === 0) {
    if (/\b(presupuesto|cotizaci[oó]n|precio|costo|cu[aá]nto)\b/.test(searchText)) {
      return `
REFERENCIA PRECIOS: El paciente pide presupuesto. Menciona SOLO los servicios que él ya nombró en la conversación. Si no ha dicho cuáles, pregúntale cuáles necesita — NO listes todo el catálogo.
`;
    }
    return "";
  }

  const filtered = allTreatments.filter((t) => {
    const n = t.name.toLowerCase();
    return [...matchedTags].some((tag) => n.includes(tag));
  }).slice(0, 4);

  if (!filtered.length) return "";

  return `
REFERENCIA INTERNA — precios base (usa SOLO lo que el paciente preguntó; no menciones otros tratamientos):
${filtered.map((t) => `- ${t.name}: ${Number(t.price).toLocaleString()} pesos`).join("\n")}
`;
}

function buildRelevantKnowledgeSection(
  entries: { title: string; category: string; content: string }[],
  searchText: string,
): string {
  if (!entries.length) return "";

  if (wantsFullServiceCatalog(searchText)) {
    const tarifario = entries.filter((e) => e.category === "tarifario").slice(0, 2);
    const general = entries.filter((e) => e.category === "general").slice(0, 1);
    const picked = [...general, ...tarifario];
    if (!picked.length) return "";
    return `\nARTÍCULOS DE AYUDA (resumir al paciente, no copiar listas):\n${picked.map((e) => `[${e.title}]\n${e.content}`).join("\n\n")}\n`;
  }

  const TOPIC_MAP: { keywords: string[]; titleHints: string[] }[] = [
    { keywords: ["implante", "implan", "titanio"], titleHints: ["implante"] },
    { keywords: ["profilaxis", "limpieza", "resina", "caries", "sellante", "detartraje", "urgencia"], titleHints: ["odontologia general", "general - precios"] },
    { keywords: ["blanquea", "whitening"], titleHints: ["blanqueamiento"] },
    { keywords: ["carilla", "sonrisa", "estetica", "estética"], titleHints: ["estetica", "estética"] },
    { keywords: ["corona", "rehabilit", "protesis", "prótesis"], titleHints: ["rehabilitacion", "protesis", "prótesis"] },
    { keywords: ["ortodoncia", "bracket", "frenillo"], titleHints: ["ortodoncia"] },
    { keywords: ["endodoncia", "conducto"], titleHints: ["endodoncia"] },
    { keywords: ["extraccion", "extracción", "cirugia", "cirugía"], titleHints: ["cirugia", "cirugía"] },
    { keywords: ["encia", "encía", "periodont"], titleHints: ["periodoncia"] },
    { keywords: ["pago", "financi", "cuota", "politica", "cancelar cita", "horario", "direccion", "dirección", "ubicacion", "ubicación"], titleHints: ["pagos", "politica", "general"] },
  ];

  const matched: typeof entries = [];
  for (const { keywords, titleHints } of TOPIC_MAP) {
    if (!keywords.some((kw) => searchText.includes(kw))) continue;
    for (const entry of entries) {
      const titleLower = entry.title.toLowerCase();
      if (titleHints.some((hint) => titleLower.includes(hint)) && !matched.includes(entry)) {
        matched.push(entry);
      }
    }
  }

  if (matched.length > 0) {
    return `\nARTÍCULOS DE AYUDA (solo lo relevante a esta pregunta — resume, no copies listas largas):\n${matched.slice(0, 2).map((e) => `[${e.title}]\n${e.content}`).join("\n\n")}\n`;
  }

  if (/\b(presupuesto|cotizaci[oó]n)\b/.test(searchText)) {
    return `\nARTÍCULOS DE AYUDA: Para presupuestos, usa DATOS DEL PANEL si hay presupuestos guardados; si no, pregunta qué servicios necesita — no des catálogo completo.\n`;
  }

  if (/\b(direccion|dirección|ubicacion|ubicación|donde están|dónde están|como llegar|cómo llegar)\b/.test(searchText)) {
    const general = entries.find((e) => e.category === "general");
    if (general) {
      return `\nARTÍCULOS DE AYUDA:\n[${general.title}]\n${general.content}\n`;
    }
  }

  return "";
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

    const searchText = combinedSearchText(patientMessage, conversationHistory);
    const treatmentsContext = buildRelevantTreatmentsContext(allTreatments, searchText);
    const knowledgeSection = buildRelevantKnowledgeSection(knowledgeEntries, searchText);

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
${p.proactiveQuestions ? "- Una sola pregunta de seguimiento por mensaje, breve y al punto." : ""}
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

    const systemPrompt = `Eres ${assistantName}, el asistente oficial de ${clinicName} en Medellín.
Eres cercano, natural, servicial y profesional — como un recepcionista amable por WhatsApp, no un folleto publicitario.
HOY: ${colombiaDay} ${colombiaDate}, ${colombiaTime}.
${personalitySection}
${clinicInfoSection}
${contactSection}
${firstContactSection}
${registrationSection}
REGLAS DE CONVERSACIÓN (PRIORIDAD MÁXIMA):
- BREVEDAD: Máximo 2-4 oraciones cortas por mensaje. Es WhatsApp, no un email.
- ENFOQUE: Responde SOLO lo que el paciente preguntó o confirmó en este turno. Nada más.
- PROHIBIDO listar todos los servicios/tratamientos salvo que diga explícitamente "qué servicios tienen", "qué ofrecen" o similar.
- PROHIBIDO repetir precios, listas o explicaciones que YA diste en mensajes anteriores — lee el historial con atención.
- PROHIBIDO mencionar tratamientos que el paciente no pidió (ej. no hables de implantes si preguntó profilaxis).
- CONFIRMACIONES: Si dice "sí", "ok", "hazlo", "?" o algo breve, interpreta según TU último mensaje y avanza el tema (confirmar cita, incluir tratamientos en la cita, dar total, etc.). NUNCA respondas con un catálogo de servicios.
- Si hay CITA PRÓXIMA en DATOS DEL PANEL, úsala (fecha, hora, tratamiento) — no inventes ni ignores.
- Tono cálido pero conciso: una validación breve + la respuesta + un cierre amable de UNA línea (ej. "¿Te ayudo con algo más?").
- Precios: Solo los servicios que pidió. Di "precio base" y que puede variar. Usa "pesos", nunca "$".
- Presupuesto: Si pide presupuesto de servicios concretos, da solo esos con total estimado. Si hay presupuesto en DATOS DEL PANEL, úsalo. Si no especificó servicios, pregúntale cuáles necesita.
- Citas: Bloques horarios amplios (máx. 2 por día). Cuando confirme hora concreta, usa bookAppointment.
- Cotizaciones formales: sendQuotation. Recibos: sendPaymentReceipt. Consentimientos: sendConsentLink.
- Solo datos del paciente identificado abajo. NUNCA inventes información.
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
      temperature: 0.55,
      max_tokens: 380,
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
      message: "Hola, gracias por escribirnos a Nexodent 😊 Cuéntame, ¿en qué puedo ayudarte hoy? Estoy aquí para lo que necesites.",
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
