import { db, automationsTable, automationHistoryTable, patientsTable, appointmentsTable } from "@workspace/db";
import { eq, and, gt, lt, lte, gte, sql, isNull } from "drizzle-orm";
import { getWhatsAppSock } from "./whatsapp";
import { logger } from "./logger";

export async function runAutomations() {
  const sock = getWhatsAppSock();
  if (!sock) return;

  const activeAutomations = await db.select().from(automationsTable).where(eq(automationsTable.active, true));

  for (const auto of activeAutomations) {
    try {
      if (auto.trigger === "appointment_reminder") {
        await processAppointmentReminders(auto, sock);
      } else if (auto.trigger === "new_patient_welcome") {
        await processWelcomeMessages(auto, sock);
      }
    } catch (err) {
      logger.error({ err, automationId: auto.id }, "Error ejecutando automatización");
    }
  }
}

async function processAppointmentReminders(auto: any, sock: any) {
  const delayHours = auto.delayHours ?? 24;
  const now = new Date();
  const targetDate = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  
  // Buscar citas en la ventana de tiempo (aprox +/- 30 min del target)
  const windowStart = new Date(targetDate.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetDate.getTime() + 30 * 60 * 1000);

  const appointments = await db.select({
    id: appointmentsTable.id,
    date: appointmentsTable.date,
    startTime: appointmentsTable.startTime,
    patientId: appointmentsTable.patientId,
    patientName: patientsTable.name,
    patientPhone: patientsTable.phone,
    treatment: appointmentsTable.treatment,
  })
  .from(appointmentsTable)
  .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
  .where(and(
    eq(appointmentsTable.status, "scheduled"),
    // Filtro simple por fecha para optimizar
    eq(appointmentsTable.date, targetDate.toISOString().split("T")[0])
  ));

  for (const appt of appointments) {
    // Verificar si ya se envió para esta cita y esta automatización
    const [alreadySent] = await db.select()
      .from(automationHistoryTable)
      .where(and(
        eq(automationHistoryTable.automationId, auto.id),
        eq(automationHistoryTable.appointmentId, appt.id)
      ));

    if (alreadySent) continue;

    // Formatear mensaje
    const message = auto.message
      .replace("{nombre}", appt.patientName)
      .replace("{fecha}", appt.date)
      .replace("{hora}", appt.startTime)
      .replace("{tratamiento}", appt.treatment);

    const jid = `${appt.patientPhone.replace(/\D/g, "")}@s.whatsapp.net`;
    
    try {
      await sock.sendMessage(jid, { text: message });
      await db.insert(automationHistoryTable).values({
        automationId: auto.id,
        patientId: appt.patientId,
        appointmentId: appt.id,
        status: "sent",
      });
      await db.update(automationsTable)
        .set({ executionCount: sql`${automationsTable.executionCount} + 1` })
        .where(eq(automationsTable.id, auto.id));
      
      logger.info({ jid, automationId: auto.id }, "Recordatorio enviado");
    } catch (err) {
      logger.error({ err, jid }, "Error enviando recordatorio");
    }
  }
}

async function processWelcomeMessages(auto: any, sock: any) {
  const delayHours = auto.delayHours ?? 0;
  const now = new Date();
  const targetCreatedBefore = new Date(now.getTime() - delayHours * 60 * 60 * 1000);

  const patients = await db.select().from(patientsTable).where(lte(patientsTable.createdAt, targetCreatedBefore));

  for (const p of patients) {
    const [alreadySent] = await db.select()
      .from(automationHistoryTable)
      .where(and(
        eq(automationHistoryTable.automationId, auto.id),
        eq(automationHistoryTable.patientId, p.id),
        isNull(automationHistoryTable.appointmentId)
      ));

    if (alreadySent) continue;

    const message = auto.message.replace("{nombre}", p.name);
    const jid = `${p.phone.replace(/\D/g, "")}@s.whatsapp.net`;

    try {
      await sock.sendMessage(jid, { text: message });
      await db.insert(automationHistoryTable).values({
        automationId: auto.id,
        patientId: p.id,
        status: "sent",
      });
      await db.update(automationsTable)
        .set({ executionCount: sql`${automationsTable.executionCount} + 1` })
        .where(eq(automationsTable.id, auto.id));
      
      logger.info({ jid, automationId: auto.id }, "Mensaje de bienvenida enviado");
    } catch (err) {
      logger.error({ err, jid }, "Error enviando bienvenida");
    }
  }
}

export function startAutomationsEngine() {
  // Ejecutar cada 15 minutos
  setInterval(() => {
    runAutomations().catch(err => logger.error({ err }, "Error en motor de automatizaciones"));
  }, 15 * 60 * 1000);
  
  // Ejecutar una vez al inicio después de un breve delay
  setTimeout(() => {
    runAutomations().catch(err => logger.error({ err }, "Error en motor de automatizaciones inicial"));
  }, 10000);
}
