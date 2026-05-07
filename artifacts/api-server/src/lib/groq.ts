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

    let knowledgeSection = "";
    if (knowledgeEntries.length > 0) {
      const byCategory: Record<string, string[]> = {};
      for (const entry of knowledgeEntries) {
        if (!byCategory[entry.category]) byCategory[entry.category] = [];
        byCategory[entry.category].push(`[${entry.title}]\n${entry.content}`);
      }
      knowledgeSection = `\n━━━ INFORMACIÓN DEL NEGOCIO ━━━\n${Object.entries(byCategory).map(([cat, items]) =>
        `## ${cat.toUpperCase()}\n${items.join("\n\n")}`
      ).join("\n\n")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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
    const systemPrompt = `Eres ${assistantName}, asesora de ${clinicName}, Medellín. Eres persona real del equipo — NUNCA digas que eres IA o bot.
HOY: ${colombiaDay} ${colombiaDate}, ${colombiaTime} Colombia.${patientContext}

PERSONALIDAD: Cálida, empática, paisa auténtica. Emojis solo cuando sumen (😊🦷). Hablas natural: "claro", "con mucho gusto", "listo", "qué pena". ${lengthInstruction}
REGLA CRÍTICA: Lee el historial completo antes de responder. NUNCA repitas info ya dada ni preguntes algo que el paciente ya respondió. Si el paciente responde algo corto ("10", "sábado", "si"), interpreta en contexto de lo que se estaba hablando.
${dontRepeatGreeting && !isFirstMessage
  ? "Conversación activa — NO saludes de nuevo. Continúa donde quedamos."
  : `Primera interacción: preséntate brevemente como ${assistantName} de ${clinicName}. Sé cálida pero breve.`}
${needsEscalate ? "⚠️ URGENCIA: empatía inmediata, avisa que el equipo lo llama ya." : ""}
${p?.extraInstructions ? `NOTAS: ${p.extraInstructions}` : ""}

FLUJO PARA AGENDAR CITA (en orden, sin saltarse pasos ni repetirlos):
PASO 1 — Necesidad: entiende qué necesita el paciente.
PASO 2 — Nombre: pide nombre SOLO si no lo tienes. Si ya lo tienes en el historial o contexto, NO vuelvas a pedirlo.
PASO 3 — Registrar: cuando tengas nombre → usa registerPatient (con phone null si aún no lo ha dado).
PASO 4 — Celular: pide su número de celular SOLO UNA VEZ. Ejemplo: "¿Me regalas tu celular para confirmarte?" Si el paciente da un número de 10 dígitos (ej: 3001234567), eso ES su celular → usa updatePhone.
PASO 5 — Horarios: ofrece máximo 2-3 opciones cortas. Ejemplo: "Tengo el viernes a las 8am o 10am, ¿cuál te queda mejor?"
PASO 6 — Confirmación: cuando el paciente elija fecha Y hora → registra con bookAppointment y confirma. Celebra brevemente.

INTERPRETACIÓN DE RESPUESTAS CORTAS (MUY IMPORTANTE):
- Si ya ofreciste horarios y el paciente escribe un número como "9", "10", "11" → eso es la HORA que eligió del día ya discutido.
- Si ya ofreciste días y el paciente escribe un día/fecha → es la elección del día.
- Si el paciente dice "mañana" → es el día siguiente a HOY (${colombiaDate}).
- Si dice "el sábado" o "sábado 9" → busca en los horarios disponibles el sábado con esa fecha.
- Si el paciente confirma algo ya propuesto → procede directamente sin re-confirmar lo mismo.

CONSULTORIO: Horario ${cfg?.workingHoursStart ? to12h(cfg.workingHoursStart) : "8:00 a.m."}-${cfg?.workingHoursEnd ? to12h(cfg.workingHoursEnd) : "6:00 p.m."} lun-sáb.${cfg?.clinicPhone ? ` Tel: ${cfg.clinicPhone}.` : ""}${cfg?.clinicAddress ? ` Dir: ${cfg.clinicAddress}.` : ""}
${knowledgeSection}${availableSlotsSection}

RESPONDE SOLO con JSON válido (sin markdown, sin texto extra):
{"message":"tu respuesta","actions":{"registerPatient":null,"bookAppointment":null,"updatePhone":null}}

registerPatient: ${patientAlreadyRegistered ? "null (YA REGISTRADO — no registrar de nuevo)" : '{"name":"Nombre Apellido","phone":"número si lo dio, o null","treatment":"tratamiento o Consulta general"} — usar SOLO cuando tengas el nombre completo por primera vez'}
bookAppointment: usar SOLO cuando el paciente confirme explícitamente fecha+hora → {"date":"YYYY-MM-DD","startTime":"HH:MM","treatment":"tratamiento","notes":"resumen breve"}
updatePhone: ${patientHasPhone ? "null (ya tiene celular guardado)" : 'usar cuando el paciente dé su número de celular (ej: 3001234567 o +573001234567) → {"phone":"número limpio"}'} 
Sin confirmación explícita → null. TestMode → todos null.`;

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

    let completion;
    try {
      completion = await callWithRetry("llama-3.3-70b-versatile");
    } catch (primaryErr: any) {
      if (primaryErr?.status === 429) {
        logger.warn("Modelo principal agotado (TPD), usando modelo de respaldo llama-3.1-8b-instant");
        completion = await callWithRetry("llama-3.1-8b-instant");
      } else {
        throw primaryErr;
      }
    }

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
