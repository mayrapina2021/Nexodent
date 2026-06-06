import { Router, type IRouter } from "express";
import { db, portalTokensTable, patientsTable, consentFormsTable, quotationsTable, appointmentsTable, settingsTable, treatmentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import { addMinutes, APPOINTMENT_SLOT_INTERVAL_MINUTES } from "../lib/appointment-time";

const router: IRouter = Router();

const CONSENT_TEMPLATES: Record<string, string> = {
  general: "Autorizo el tratamiento odontológico descrito por el profesional, habiendo recibido información sobre riesgos, beneficios y alternativas.",
  extraccion: "Autorizo la extracción dental indicada, comprendiendo los riesgos asociados al procedimiento.",
  implante: "Autorizo la colocación de implante dental, habiendo recibido información sobre el procedimiento, cuidados y posibles complicaciones.",
  endodoncia: "Autorizo el tratamiento de endodoncia, comprendiendo que puede requerir sesiones adicionales.",
};

async function savePortalToken(token: string, patientId: number, type: string, resourceId?: number, daysValid = 7) {
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
  await db.insert(portalTokensTable).values({ token, patientId, type, resourceId: resourceId ?? null, expiresAt });
  return token;
}

function getColombiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function validateToken(token: string, type: string) {
  const [row] = await db.select().from(portalTokensTable)
    .where(and(eq(portalTokensTable.token, token), eq(portalTokensTable.type, type)));
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return row;
}

const bookSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().nullable(),
  treatment: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional().nullable(),
});

const signConsentSchema = z.object({
  signatureData: z.string().min(10),
});

// ── Public: available slots for booking ──────────────────────────────────────
router.get("/portal/available-slots", async (req, res): Promise<void> => {
  const dateStr = typeof req.query.date === "string" ? req.query.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "date required YYYY-MM-DD" });
    return;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  const openTime = settings?.workingHoursStart ?? "08:00";
  const closeTime = settings?.workingHoursEnd ?? "18:00";

  const existing = await db.select({ startTime: appointmentsTable.startTime })
    .from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.date, dateStr),
      sql`${appointmentsTable.status} NOT IN ('cancelled')`,
    ));

  const booked = new Set(existing.map((a) => a.startTime));
  const slots: string[] = [];
  let current = openTime;
  while (current < closeTime) {
    if (!booked.has(current)) slots.push(current);
    current = addMinutes(current, APPOINTMENT_SLOT_INTERVAL_MINUTES);
  }
  res.json({ date: dateStr, slots });
});

router.get("/portal/treatments", async (_req, res): Promise<void> => {
  const treatments = await db.select({ name: treatmentsTable.name, price: treatmentsTable.price }).from(treatmentsTable);
  res.json(treatments);
});

router.post("/portal/book", async (req, res): Promise<void> => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let [patient] = await db.select().from(patientsTable).where(eq(patientsTable.phone, parsed.data.phone));
  if (!patient) {
    [patient] = await db.insert(patientsTable).values({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      treatment: parsed.data.treatment,
      status: "scheduled",
    }).returning();
  }

  const endTime = addMinutes(parsed.data.startTime, 30);
  const [appt] = await db.insert(appointmentsTable).values({
    patientId: patient.id,
    treatment: parsed.data.treatment,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime,
    status: "scheduled",
    notes: parsed.data.notes ?? "Agendado vía portal online",
  }).returning();

  await db.update(patientsTable).set({ status: "scheduled" }).where(eq(patientsTable.id, patient.id));
  res.status(201).json({ appointment: appt, patientId: patient.id });
});

// ── Consent signing via token ────────────────────────────────────────────────
router.get("/portal/consent/:token", async (req, res): Promise<void> => {
  const row = await validateToken(req.params.token, "consent");
  if (!row) { res.status(404).json({ error: "Link inválido o expirado" }); return; }

  const [form] = await db.select().from(consentFormsTable).where(eq(consentFormsTable.id, row.resourceId!));
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, row.patientId!));
  if (!form || !patient) { res.status(404).json({ error: "Consentimiento no encontrado" }); return; }

  res.json({
    form: { id: form.id, type: form.type, content: form.content, status: form.status },
    patient: { name: patient.name },
  });
});

router.post("/portal/consent/:token/sign", async (req, res): Promise<void> => {
  const row = await validateToken(req.params.token, "consent");
  if (!row) { res.status(404).json({ error: "Link inválido o expirado" }); return; }

  const parsed = signConsentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(consentFormsTable)
    .set({ status: "signed", signatureData: parsed.data.signatureData, signedAt: new Date() })
    .where(eq(consentFormsTable.id, row.resourceId!))
    .returning();

  await db.update(portalTokensTable).set({ usedAt: new Date() }).where(eq(portalTokensTable.token, req.params.token));
  res.json(updated);
});

// ── Quotation view via token ─────────────────────────────────────────────────
router.get("/portal/quotation/:token", async (req, res): Promise<void> => {
  const row = await validateToken(req.params.token, "quotation");
  if (!row) { res.status(404).json({ error: "Link inválido o expirado" }); return; }

  const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, row.resourceId!));
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, row.patientId!));
  if (!quotation || !patient) { res.status(404).json({ error: "Presupuesto no encontrado" }); return; }

  res.json({ quotation, patient: { name: patient.name, phone: patient.phone } });
});

// ── Admin: generate portal links ─────────────────────────────────────────────
router.post("/portal/generate-link", async (req, res): Promise<void> => {
  const { patientId, type, resourceId } = req.body;
  if (!patientId || !type) { res.status(400).json({ error: "patientId and type required" }); return; }

  const token = randomBytes(32).toString("hex");
  await savePortalToken(token, patientId, type, resourceId);

  const baseUrl = process.env.CRM_URL ?? "https://nexodentbot.web.app";
  const paths: Record<string, string> = {
    consent: `/portal/consent/${token}`,
    quotation: `/portal/presupuesto/${token}`,
    booking: `/portal/agendar`,
  };

  res.json({ token, url: `${baseUrl}${paths[type] ?? `/portal/${type}/${token}`}` });
});

export { CONSENT_TEMPLATES, savePortalToken };
export default router;
