import Groq from "groq-sdk";
import { db, settingsTable, conversationsTable, messagesTable, patientsTable, aiKnowledgeTable, aiPersonalityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
  }
  return _groq;
}

export interface AIActions {
  registerPatient?: { name: string; phone?: string | null; treatment: string } | null;
  bookAppointment?: { date: string; startTime: string; treatment: string; notes?: string } | null;
  updatePhone?: { phone: string } | null;
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
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "p.m." : "a.m.";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export async function generateAIResponse(
  conversationId: number | null,
  patientMessage: string,
  opts: AIOptions = {}
): Promise<AIResponse> {
  const fallback: AIResponse = {
    message: "Gracias por escribirnos. En un momentico te responde alguien del equipo.",
    actions: {},
  };

  try {
    const [settings, personality, knowledgeEntries] = await Promise.all([
      db.select().from(settingsTable).limit(1),
      db.select().from(aiPersonalityTable).limit(1),
      db.select().from(aiKnowledgeTable).where(eq(aiKnowledgeTable.active, true)).orderBy(aiKnowledgeTable.category),
    ]);

    const cfg = settings[0];
    const p = personality[0];
    const clinicName = cfg?.clinicName ?? "Dientes Fijos Medellín";
    const { dateStr: colombiaDate, timeStr: colombiaTime, dayName: colombiaDay } = getColombiaNow();

    let patientContext = "";
    let patientAlreadyRegistered = false;
    let patientHasPhone = false;
    if (conversationId && !opts.testMode) {
      const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
      if (conv?.patientId) {
        patientAlreadyRegistered = true;
        const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, conv.patientId));
        if (patient) {
          const firstName = patient.name.split(" ")[0];
          patientHasPhone = !!(patient.phone && !patient.phone.startsWith("+57") && patient.phone.length <= 12);
          patientContext = `\nPACIENTE REGISTRADO:\n- Nombre: ${patient.name} (llámalo/a "${firstName}")\n- Teléfono guardado: ${patient.phone}${patientHasPhone ? " (ya tiene celular propio)" : " (solo tiene número de WhatsApp — aún necesitamos su celular de contacto)"}\n- Tratamiento: ${patient.treatment ?? "sin especificar"}\n- Estado: ${patient.status}`;
        }
      } else if (conv?.patientName) {
        patientContext = `\nNombre del contacto: ${conv.patientName} (aún no registrado como paciente).`;
      }
    } else if (opts.patientName) {
      patientContext = `\nEstás hablando con: ${opts.patientName}.`;
    }

    // Smart knowledge filtering: only load entries relevant to this conversation
    // to avoid enormous prompts that burn tokens on the free plan
    const KEYWORD_MAP: Record<string, string[]> = {
      "Odontología General — Precios":       ["resina","obturac","caries","sellante","profilaxis","limpieza","higiene","urgencia","calculo","sarro","general"],
      "Blanqueamiento Dental — Precios":     ["blanquea","whitening","aclar","diente amarillo","mancha"],
      "Estética Dental — Carillas y Diseño de Sonrisa": ["carilla","diseño de sonrisa","estética","veneers","microdiseño","cerómero","disilicato","sonrisa"],
      "Rehabilitación Oral — Coronas y Prótesis": ["corona","rehabilit","incrustac","nucleo","pilar","puente","recementar","provisional","platino","tradicional","zirconio"],
      "Prótesis Dentales — Precios":         ["prótesis","protesis","acker","dentadura","dientes postizos","base","rebase","gancho"],
      "Implantes Dentales — Precios Completos": ["implante","implan","titanio","prom","pilar","sobredentadura","hibrida","hueso","membrana","seno"],
      "Cirugía Oral — Precios":              ["cirugia","cirugía","extraccion","extracción","exodoncia","muela del juicio","cordal","frenilect","biopsia","capuchon"],
      "Periodoncia — Encías y Soporte Dental": ["encia","encía","periodont","curetaje","gingivect","reborde","injerto","sangra","piorrhea"],
      "Endodoncia — Tratamiento de Conductos": ["endodoncia","conducto","nervio","pulpa","apice","apicectomia","reabsorcion","canal"],
      "Ortodoncia — Planes y Precios":       ["ortodoncia","bracket","aligner","retenedor","mordida","dientes chuecos","dientes torcidos","alinear","aparatos","brace"],
      "Información sobre pagos y política de citas": ["pago","precio","cobro","cuota","financi","cancelar","politica","horario","direccion","ubicacion","costo","valor","cuanto vale","cuánto vale","cuanto cuesta","cuánto cuesta"],
    };

    const searchText = [
      patientMessage,
      ...(opts.history ?? []).slice(-4).map(m => m.content),
    ].join(" ").toLowerCase();

    // Always include "general" entries; include tarifario entries only if relevant
    const filteredEntries = knowledgeEntries.filter(entry => {
      if (entry.category === "general") return true;
      const keywords = KEYWORD_MAP[entry.title] ?? [];
      return keywords.some(kw => searchText.includes(kw));
    });

    // If nothing matched, include the general/payments entry as fallback context
    const entriesToUse = filteredEntries.length > 0 ? filteredEntries : knowledgeEntries.filter(e => e.category === "general");

    let knowledgeSection = "";
    if (entriesToUse.length > 0) {
      const items = entriesToUse.map(e => `[${e.title}]\n${e.content}`).join("\n\n");
      knowledgeSection = `\n━━━ INFORMACIÓN DEL CONSULTORIO ━━━\n${items}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
    let isNewSession = false;

    if (opts.history) {
      conversationHistory = opts.history;
      isNewSession = conversationHistory.filter(m => m.role === "assistant").length === 0;
    } else if (conversationId) {
      const pastMessages = await db.select().from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(messagesTable.sentAt)
        .limit(20);

      const SESSION_GAP_MS = 4 * 60 * 60 * 1000;
      const lastMsg = pastMessages[pastMessages.length - 1];
      const timeSinceLast = lastMsg?.sentAt ? Date.now() - new Date(lastMsg.sentAt).getTime() : Infinity;
      isNewSession = pastMessages.length === 0 || timeSinceLast > SESSION_GAP_MS;

      conversationHistory = pastMessages
        .filter(m => m.sender === "patient" || m.sender === "ai" || m.sender === "agent")
        .map(m => ({
          role: m.sender === "patient" ? "user" as const : "assistant" as const,
          content: m.content,
        }));
    }

    const isFirstMessage = isNewSession;
    const dontRepeatGreeting = p?.dontRepeatGreeting ?? true;

    const lengthGuide: Record<string, string> = {
      corta: "Máximo 2 oraciones por respuesta. Directa y natural, como chat de WhatsApp real.",
      media: "2-3 oraciones. Sin rodeos.",
      larga: "Responde con detalle cuando sea necesario.",
    };
    const lengthInstruction = lengthGuide[p?.maxResponseLength ?? "corta"] ?? lengthGuide.corta;

    const escalateKeywords = (p?.escalateKeywords ?? "emergencia,urgencia,dolor fuerte,accidente,hemorragia")
      .split(",").map(k => k.trim()).filter(Boolean);
    const needsEscalate = escalateKeywords.some(kw =>
      patientMessage.toLowerCase().includes(kw.toLowerCase())
    );

    let availableSlotsSection = "";
    if (opts.availableSlots && opts.availableSlots.length > 0) {
      const hasSlots = opts.availableSlots.some(d => d.slots.length > 0);
      if (hasSlots) {
        availableSlotsSection = `\n\nHORARIOS DISPONIBLES (usa SOLO estos):`;
        for (const { label, slots } of opts.availableSlots) {
          if (slots.length > 0) {
            availableSlotsSection += `\n• ${label}: ${slots.slice(0, 6).map(s => to12h(s)).join(" / ")}`;
          }
        }
        availableSlotsSection += `\n⚠️ Son las ${colombiaTime}. No ofrezcas horas pasadas.`;
      } else {
        availableSlotsSection = `\n\nNo hay cupos disponibles para hoy/mañana. Sugiere otra fecha.`;
      }
    }

    const assistantName = p?.name ?? "Andrea";

    const greetingInstruction = isFirstMessage
      ? `PRIMER MENSAJE - OBLIGATORIO: Siempre menciona "Dientes Fijos Medellin" por nombre. Ejemplo: "Hola mi amor! Bienvenido(a) a Dientes Fijos Medellin, soy ${assistantName}, tu asistente. En que te puedo ayudar hoy?" - Si ya dijo que quiere, respondele pero SI menciona el nombre del consultorio.`
      : `Conversacion activa - NO te presentes de nuevo. Continua con calidez paisa. Saludo de retorno: "Hola nuevamente mi amor! Que bacano que escribiste. En que te ayudo?"`;

    const systemPrompt = `Eres ${assistantName}, asistente oficial de ${clinicName}, Medellin. Eres una persona real del equipo paisa - NUNCA digas que eres IA, bot o asistente virtual.
HOY: ${colombiaDay} ${colombiaDate}, ${colombiaTime} (Colombia).${patientContext}

IDENTIDAD - ANDREA, PAISA DE MEDELLIN
Eres Andrea: una mujer paisa calida, berraca, muy atenta y con mucho amor por lo que hace. Hablas como paisa autentica, no como un robot.

PERSONALIDAD PAISA:
- Cercana y cantadita - como una amiga de confianza que trata a cada paciente con carino real
- Usas terminos de carino variados (nunca el mismo dos veces): "mi amor", "corazon", "querido/a", "amor"
- Voseo antioqueno moderado y natural: "Que querets saber?", "Contame", "No te preocupes"
- Expresiones paisas naturales (varialas): "De una" (listo), "Bacano/a" (genial), "Listo pues" (perfecto), "Con todo el gusto", "Hagale pues", "Que pena" (lo siento)
- MUY HOSPITALARIA: cada persona se siente bienvenida como en familia
- PROFESIONAL pero CERCANA - nunca fria, nunca robotica
- NUNCA exageres los modismos - suenas natural, no forzada

SALUDO - REGLA CRITICA:
${greetingInstruction}
${needsEscalate ? "URGENCIA PAISA: Ay mi amor, que pena que estes asi, vamos a ayudarte de una. El equipo te va a atender lo mas pronto posible." : ""}

ESTILO DE RESPUESTA - OBLIGATORIO:
- Paisa autentica: calida, cercana, con carino genuino
- Emojis moderados: maximo 2 por mensaje
- ${lengthInstruction}
- Varia vocabulario: "listo" = de una/bacano/perfecto. "claro" = con todo el gusto/como no mi amor. "me regalas" = me compartes/me das/me contas

PROHIBIDO:
- Linea fria o seca
- Tono tecnico o de manual
- Inventar precios o horarios
- Preguntar algo ya respondido
- Mas de una pregunta a la vez
- Exagerar modismos

EMPATIA PAISA:
- Dolor: "Ay mi amor, que pena que estes asi, vamos a ayudarte de una."
- Miedo: "Tranquilo/a mi amor, aca te tratamos con mucho cuidado. Nuestro equipo es muy berraco."
- Confusion: "No te preocupes, con mucho gusto te explico todo."
- Frustracion: "Que pena lo que paso. Vamos a buscarle solucion de una."
- Agradecimiento: "Que bacano! Con todo el gusto, para eso estamos."
${p?.extraInstructions ? `\nINSTRUCCIONES ESPECIALES:\n${p.extraInstructions}\n` : ""}

FLUJO DE AGENDAMIENTO (en orden):
1. NECESIDAD - Escucha primero. Si pregunta precios, informa con calidez e invita a agendar.
2. NOMBRE - Pidelo UNA sola vez. Ej: "Me compartes tu nombre completo, mi amor?"
3. REGISTRO - Al tener nombre completo usa registerPatient (discreto, no lo menciones).
4. MOTIVO - Si no quedo claro, pregunta por el tratamiento.
5. HORARIOS - Ofrece max 3-4 opciones concretas: "Listo pues [Nombre], tenemos: hoy 1pm, manana 10am, viernes 3pm. Cual te acomoda?"
6. CELULAR - Pidelo UNA vez luego de confirmar horario.
7. CONFIRMACION - Al confirmar fecha + hora, usa bookAppointment: "De una! Tu cita quedo agendada para el [dia] a las [hora]. Te esperamos!"

INTERPRETACION INTELIGENTE:
- "9", "10", "3" con horarios en contexto = hora elegida del dia ya discutido
- Nombre de dia = eleccion del dia ofrecido
- "manana" = dia siguiente a HOY (${colombiaDate})
- "si", "dale", "listo", "ok", "de una" = confirma lo ultimo propuesto

INFORMACION DEL CONSULTORIO:
Horario: ${cfg?.workingHoursStart ? to12h(cfg.workingHoursStart) : "8:00 a.m."} a ${cfg?.workingHoursEnd ? to12h(cfg.workingHoursEnd) : "6:00 p.m."}, lunes a sabado.${cfg?.clinicPhone ? ` Tel: ${cfg.clinicPhone}.` : ""}${cfg?.clinicAddress ? ` Dir: ${cfg.clinicAddress}.` : ""}
${knowledgeSection}${availableSlotsSection}

FORMATO DE RESPUESTA - CRITICO:
Responde UNICAMENTE con JSON valido. Sin markdown, sin texto antes ni despues:
{"message":"tu respuesta al paciente","actions":{"registerPatient":null,"bookAppointment":null,"updatePhone":null}}

ACCIONES:
- registerPatient: ${patientAlreadyRegistered ? "null - paciente YA registrado." : "{\"name\":\"Nombre Apellido\",\"phone\":null,\"treatment\":\"tratamiento o Consulta general\"} - SOLO la primera vez que tengas nombre completo."}
- bookAppointment: {"date":"YYYY-MM-DD","startTime":"HH:MM","treatment":"tratamiento","notes":"resumen"} - SOLO cuando confirme fecha Y hora.
- updatePhone: ${patientHasPhone ? "null - ya tiene celular guardado." : "{\"phone\":\"numero sin espacios\"} - cuando de su celular (10 digitos o +57...)."}

Sin accion clara = null. testMode = todas null.`;

    const messages = [
      ...conversationHistory.slice(-20),
      { role: "user" as const, content: patientMessage },
    ];

    const requestParams = {
      messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
      response_format: { type: "json_object" as const },
      max_tokens: p?.maxResponseLength === "larga" ? 700 : p?.maxResponseLength === "media" ? 500 : 350,
      temperature: 0.65,
      top_p: 0.9,
    };

    function parseRetryAfterMs(errMsg: string, fallbackMs = 3000): number {
      const match = errMsg.match(/try again in ([\d.]+)s/i);
      if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
      return fallbackMs;
    }

    async function callWithRetry(model: string, attempt = 0): Promise<Groq.Chat.ChatCompletion> {
      try {
        return await getGroq().chat.completions.create({ model, ...requestParams });
      } catch (err: any) {
        if (err?.status === 429 && attempt < 2) {
          const waitMs = parseRetryAfterMs(err?.message ?? "", 3000);
          logger.warn({ model, attempt, waitMs }, "Rate limit (TPM) — esperando para reintentar");
          await new Promise(r => setTimeout(r, waitMs));
          return callWithRetry(model, attempt + 1);
        }
        throw err;
      }
    }

    const MODEL_CHAIN = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
    ];

    let completion;
    let lastErr: any;
    for (const model of MODEL_CHAIN) {
      try {
        completion = await callWithRetry(model);
        if (model !== MODEL_CHAIN[0]) {
          logger.warn({ model }, "Usando modelo de respaldo");
        }
        break;
      } catch (err: any) {
        lastErr = err;
        if (err?.status === 429) {
          logger.warn({ model }, "Modelo agotado (429), probando siguiente");
          continue;
        }
        throw err;
      }
    }
    if (!completion) throw lastErr;

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "";

    let parsed: { message?: string; actions?: AIActions } = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      logger.warn({ rawContent }, "Groq JSON parse failed, using raw as message");
      return { message: rawContent || fallback.message, actions: {} };
    }

    return {
      message: parsed.message?.trim() || fallback.message,
      actions: {
        registerPatient: parsed.actions?.registerPatient ?? null,
        bookAppointment: parsed.actions?.bookAppointment ?? null,
        updatePhone: parsed.actions?.updatePhone ?? null,
      },
    };
  } catch (err) {
    logger.error({ err }, "Error generando respuesta IA con Groq");
    return fallback;
  }
}
