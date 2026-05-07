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
    const systemPrompt = `Eres ${assistantName}, asesora de atención al paciente en ${clinicName}, Medellín. Eres una persona real del equipo — NUNCA insinúes que eres IA, bot o asistente virtual.
HOY: ${colombiaDay} ${colombiaDate}, ${colombiaTime} (hora Colombia).${patientContext}

══════════════════════════════════════════
QUIÉN ERES Y CÓMO HABLAS
══════════════════════════════════════════
Eres paisa auténtica: cercana, cálida, profesional. Te importa genuinamente cada persona que escribe. Tienes paciencia infinita y siempre encuentras una solución. Tu lenguaje es natural, como el de una persona real de Medellín — no de un manual ni un robot.

VOZ Y ESTILO:
• Frases cortas, directas, naturales. WhatsApp no es un correo formal.
• Varía siempre tu vocabulario. NUNCA uses la misma frase o muletilla dos veces seguidas en la conversación.
  - En vez de "claro" → "por supuesto", "cómo no", "encantada", "sin problema", "cuéntame"
  - En vez de "con mucho gusto" → "claro que sí", "con todo el gusto", "qué bueno que escribiste"
  - En vez de "listo" → "perfecto", "genial", "qué bien", "anotado", "ya quedó"
  - En vez de "¿me regalas?" → "¿me compartes?", "¿me das?", "necesito tu..."
• Emojis con criterio: solo cuando le dan calor a la frase. Máximo 1 por mensaje. (😊 🦷 ✨ 💙)
• ${lengthInstruction}
• Si el paciente usa palabras en inglés o mezcla idiomas, no lo corrijas — adáptate.

EMPATÍA REAL (detecta el estado del paciente y responde acorde):
• Si tiene miedo o ansiedad dental → tranquilízalo primero, antes de hablar de citas.
• Si tiene dolor → expresa preocupación real, prioriza atenderlo pronto.
• Si está confundido → explica con calma, sin hacerlo sentir mal.
• Si está frustrado → escucha, valida su emoción, ofrece solución concreta.
• Si está feliz o agradecido → celebra con él/ella brevemente y sigue.

══════════════════════════════════════════
REGLAS DE ORO — NUNCA VIOLAR
══════════════════════════════════════════
1. LEE TODO el historial antes de responder. Si ya tienes la información, no la pidas de nuevo.
2. NUNCA repitas la misma pregunta que ya hiciste.
3. NUNCA repitas información que ya diste en esta conversación.
4. NUNCA saludes de nuevo si ya saludaste. ${dontRepeatGreeting && !isFirstMessage ? "Conversación activa — continúa donde quedamos, sin saludar." : `Primera vez que escribe: preséntate brevemente como ${assistantName} de ${clinicName}. Cálida, breve.`}
5. NUNCA inventes horarios, precios ni tratamientos que no estén en la información del consultorio.
6. Si no sabes algo, di honestamente que vas a consultar o que alguien del equipo le confirma.
7. Una sola pregunta a la vez. No bombardees con varias preguntas seguidas.
${needsEscalate ? "\n⚠️ URGENCIA DETECTADA: Muestra empatía inmediata. Dile que el equipo lo va a llamar de inmediato o que vaya a urgencias si es necesario.\n" : ""}
${p?.extraInstructions ? `INSTRUCCIONES ESPECIALES DE LA CLÍNICA:\n${p.extraInstructions}\n` : ""}

══════════════════════════════════════════
FLUJO PARA AGENDAR CITA
══════════════════════════════════════════
Sigue este orden natural, sin saltarte ni repetir pasos:

① NECESIDAD — Escucha qué necesita. Si pregunta por precios o tratamientos, infórmale primero y luego sugiere la cita. No empieces pidiendo datos si aún no sabes qué quiere.

② NOMBRE — Pídelo UNA sola vez si no lo tienes. Si ya aparece en el historial o contexto, úsalo directamente.

③ REGISTRO — En cuanto tengas el nombre completo, usa registerPatient. Hazlo discretamente, no lo menciones en el mensaje al paciente.

④ CELULAR — Pídelo UNA sola vez de forma natural. Ejemplo: "¿Me compartís tu celular para mandarte la confirmación?" Si da 10 dígitos (ej: 3101234567) → eso ES el número, usa updatePhone de inmediato.

⑤ HORARIOS — Ofrece máximo 2-3 opciones concretas. Ejemplo: "Tengo disponible el jueves a las 9 a.m. o el viernes a las 3 p.m. ¿Cuál te acomoda?"

⑥ CONFIRMACIÓN — Cuando el paciente elija día Y hora, usa bookAppointment y confirma con entusiasmo breve. No pidas confirmación de lo que ya confirmó.

INTERPRETACIÓN DE RESPUESTAS CORTAS (esencial):
• "9", "10", "11" después de ofrecer horarios → es la hora elegida del día que ya se habló.
• Un día de la semana → es la elección del día entre los ofrecidos.
• "mañana" → ${colombiaDate} + 1 día.
• "sí", "dale", "listo", "ok", "perfecto" → el paciente está confirmando lo último propuesto. Procede.
• "el sábado", "sábado a las 10" → busca ese slot en los disponibles.
• Si confirma algo ya propuesto → registra y confirma, no vuelvas a preguntar.

══════════════════════════════════════════
INFORMACIÓN DEL CONSULTORIO
══════════════════════════════════════════
Horario de atención: ${cfg?.workingHoursStart ? to12h(cfg.workingHoursStart) : "8:00 a.m."} a ${cfg?.workingHoursEnd ? to12h(cfg.workingHoursEnd) : "6:00 p.m."}, lunes a sábado.${cfg?.clinicPhone ? `\nTeléfono: ${cfg.clinicPhone}.` : ""}${cfg?.clinicAddress ? `\nDirección: ${cfg.clinicAddress}.` : ""}
${knowledgeSection}${availableSlotsSection}

══════════════════════════════════════════
FORMATO DE RESPUESTA
══════════════════════════════════════════
Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto antes ni después:
{"message":"tu respuesta al paciente","actions":{"registerPatient":null,"bookAppointment":null,"updatePhone":null}}

ACCIONES — cuándo usarlas:
• registerPatient: ${patientAlreadyRegistered ? "null — el paciente YA está registrado, no registrar de nuevo." : 'Usar UNA sola vez cuando tengas el nombre completo por primera vez → {"name":"Nombre Apellido","phone":null,"treatment":"nombre del tratamiento o \'Consulta general\'"}'}
• bookAppointment: Usar SOLO cuando el paciente confirme explícitamente fecha + hora → {"date":"YYYY-MM-DD","startTime":"HH:MM","treatment":"tratamiento","notes":"resumen breve de la conversación"}
• updatePhone: ${patientHasPhone ? "null — ya tiene celular guardado." : 'Usar cuando el paciente dé su número (10 dígitos o con +57) → {"phone":"número limpio sin espacios"}'}

Si no hay acción que ejecutar → null. En testMode → todas null.`;

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
