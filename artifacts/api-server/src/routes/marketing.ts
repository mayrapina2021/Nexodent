import { Router, type IRouter } from "express";
import { db, patientsTable } from "@workspace/db";
import { eq, sql, gte } from "drizzle-orm";
import { getWhatsAppSock, phoneToJid } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getColombiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

router.get("/marketing/inactive-patients", async (req, res): Promise<void> => {
  const days = parseInt(String(req.query.days ?? "90"), 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const patients = await db
    .select({
      id: patientsTable.id,
      name: patientsTable.name,
      phone: patientsTable.phone,
      lastVisit: patientsTable.lastVisit,
      status: patientsTable.status,
    })
    .from(patientsTable)
    .where(sql`(${patientsTable.lastVisit} IS NULL OR ${patientsTable.lastVisit} < ${cutoff})`)
    .orderBy(sql`${patientsTable.lastVisit} ASC NULLS FIRST`)
    .limit(100);

  res.json(patients);
});

router.get("/marketing/birthdays", async (_req, res): Promise<void> => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const patients = await db.select({
    id: patientsTable.id,
    name: patientsTable.name,
    phone: patientsTable.phone,
  }).from(patientsTable)
    .where(sql`false`);

  res.json({ month, day, patients, message: "Agregue fecha de nacimiento al esquema de pacientes para activar cumpleaños." });
});

router.post("/marketing/reactivate", async (req, res): Promise<void> => {
  const { patientIds, message } = req.body as { patientIds: number[]; message?: string };
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    res.status(400).json({ error: "patientIds required" });
    return;
  }

  const defaultMsg = "¡Hola! Le escribimos desde Nexodent. Hace tiempo no nos visita y queremos invitarle a su control odontológico. ¿Le gustaría agendar una cita?";
  const text = message ?? defaultMsg;

  const sock = getWhatsAppSock();
  if (!sock) {
    res.status(503).json({ error: "WhatsApp no conectado" });
    return;
  }

  const patients = await db.select().from(patientsTable)
    .where(sql`${patientsTable.id} IN (${sql.join(patientIds.map((id) => sql`${id}`), sql`, `)})`);

  const results: { patientId: number; sent: boolean; error?: string }[] = [];

  for (const p of patients) {
    try {
      const jid = phoneToJid(p.phone);
      await sock.sendMessage(jid, { text });
      results.push({ patientId: p.id, sent: true });
    } catch (err) {
      logger.error({ err, patientId: p.id }, "Reactivation message failed");
      results.push({ patientId: p.id, sent: false, error: String(err) });
    }
  }

  res.json({ sent: results.filter((r) => r.sent).length, total: results.length, results });
});

router.get("/marketing/stats", async (_req, res): Promise<void> => {
  const today = getColombiaToday();
  const monthStart = today.slice(0, 8) + "01";

  const [inactive] = await db.select({ count: sql<number>`count(*)::int` }).from(patientsTable)
    .where(sql`(${patientsTable.lastVisit} IS NULL OR ${patientsTable.lastVisit} < ${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)})`);

  const [newThisMonth] = await db.select({ count: sql<number>`count(*)::int` }).from(patientsTable)
    .where(gte(patientsTable.createdAt, new Date(monthStart)));

  const [lostLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(patientsTable)
    .where(eq(patientsTable.status, "lost"));

  res.json({
    inactivePatients: inactive?.count ?? 0,
    newPatientsThisMonth: newThisMonth?.count ?? 0,
    lostLeads: lostLeads?.count ?? 0,
  });
});

export default router;
