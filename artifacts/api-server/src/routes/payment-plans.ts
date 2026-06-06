import { Router, type IRouter } from "express";
import { db, paymentPlansTable, paymentPlanInstallmentsTable, patientsTable } from "@workspace/db";
import { eq, desc, and, lte } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createPlanSchema = z.object({
  patientId: z.number().int().positive(),
  quotationId: z.number().int().positive().optional().nullable(),
  treatmentName: z.string().min(1),
  totalAmount: z.number().int().positive(),
  downPayment: z.number().int().nonnegative().default(0),
  installmentCount: z.number().int().min(1).max(60),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).default("monthly"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable(),
});

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextDueDate(startDate: string, frequency: string, installmentNumber: number): string {
  const intervals: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30 };
  const days = (intervals[frequency] ?? 30) * installmentNumber;
  return addDays(startDate, days);
}

router.get("/payment-plans", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? parseInt(String(req.query.patientId), 10) : undefined;
  const baseQuery = db
    .select({
      id: paymentPlansTable.id,
      patientId: paymentPlansTable.patientId,
      patientName: patientsTable.name,
      quotationId: paymentPlansTable.quotationId,
      treatmentName: paymentPlansTable.treatmentName,
      totalAmount: paymentPlansTable.totalAmount,
      downPayment: paymentPlansTable.downPayment,
      installmentCount: paymentPlansTable.installmentCount,
      installmentAmount: paymentPlansTable.installmentAmount,
      frequency: paymentPlansTable.frequency,
      startDate: paymentPlansTable.startDate,
      status: paymentPlansTable.status,
      notes: paymentPlansTable.notes,
      createdAt: paymentPlansTable.createdAt,
    })
    .from(paymentPlansTable)
    .innerJoin(patientsTable, eq(paymentPlansTable.patientId, patientsTable.id));

  const plans = patientId
    ? await baseQuery.where(eq(paymentPlansTable.patientId, patientId)).orderBy(desc(paymentPlansTable.createdAt))
    : await baseQuery.orderBy(desc(paymentPlansTable.createdAt));

  res.json(plans);
});

router.get("/payment-plans/:id/installments", async (req, res): Promise<void> => {
  const planId = parseInt(req.params.id, 10);
  const installments = await db.select().from(paymentPlanInstallmentsTable)
    .where(eq(paymentPlanInstallmentsTable.planId, planId))
    .orderBy(paymentPlanInstallmentsTable.installmentNumber);
  res.json(installments);
});

router.post("/payment-plans", async (req, res): Promise<void> => {
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const remaining = parsed.data.totalAmount - parsed.data.downPayment;
  const installmentAmount = Math.ceil(remaining / parsed.data.installmentCount);

  const [plan] = await db.insert(paymentPlansTable).values({
    patientId: parsed.data.patientId,
    quotationId: parsed.data.quotationId ?? null,
    treatmentName: parsed.data.treatmentName,
    totalAmount: parsed.data.totalAmount,
    downPayment: parsed.data.downPayment,
    installmentCount: parsed.data.installmentCount,
    installmentAmount,
    frequency: parsed.data.frequency,
    startDate: parsed.data.startDate,
    notes: parsed.data.notes ?? null,
    status: "active",
  }).returning();

  const installmentRows = Array.from({ length: parsed.data.installmentCount }, (_, i) => ({
    planId: plan.id,
    installmentNumber: i + 1,
    dueDate: nextDueDate(parsed.data.startDate, parsed.data.frequency, i + 1),
    amount: installmentAmount,
    status: "pending" as const,
  }));

  await db.insert(paymentPlanInstallmentsTable).values(installmentRows);
  res.status(201).json(plan);
});

router.patch("/payment-plans/installments/:id/pay", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const paymentId = req.body.paymentId ? parseInt(String(req.body.paymentId), 10) : null;

  const [updated] = await db.update(paymentPlanInstallmentsTable)
    .set({ status: "paid", paymentId, paidAt: new Date() })
    .where(eq(paymentPlanInstallmentsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Installment not found" }); return; }

  const pending = await db.select().from(paymentPlanInstallmentsTable)
    .where(and(
      eq(paymentPlanInstallmentsTable.planId, updated.planId),
      eq(paymentPlanInstallmentsTable.status, "pending"),
    ));

  if (pending.length === 0) {
    await db.update(paymentPlansTable).set({ status: "completed" }).where(eq(paymentPlansTable.id, updated.planId));
  }

  res.json(updated);
});

router.get("/payment-plans/overdue", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = await db
    .select({
      installmentId: paymentPlanInstallmentsTable.id,
      planId: paymentPlanInstallmentsTable.planId,
      installmentNumber: paymentPlanInstallmentsTable.installmentNumber,
      dueDate: paymentPlanInstallmentsTable.dueDate,
      amount: paymentPlanInstallmentsTable.amount,
      patientId: paymentPlansTable.patientId,
      patientName: patientsTable.name,
      treatmentName: paymentPlansTable.treatmentName,
    })
    .from(paymentPlanInstallmentsTable)
    .innerJoin(paymentPlansTable, eq(paymentPlanInstallmentsTable.planId, paymentPlansTable.id))
    .innerJoin(patientsTable, eq(paymentPlansTable.patientId, patientsTable.id))
    .where(and(
      eq(paymentPlanInstallmentsTable.status, "pending"),
      lte(paymentPlanInstallmentsTable.dueDate, today),
      eq(paymentPlansTable.status, "active"),
    ));

  res.json(overdue);
});

export default router;
