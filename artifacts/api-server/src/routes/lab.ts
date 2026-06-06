import { Router, type IRouter } from "express";
import { db, labOrdersTable, patientsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createLabOrderSchema = z.object({
  patientId: z.number().int().positive(),
  labName: z.string().min(1),
  workType: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateLabOrderSchema = z.object({
  status: z.enum(["sent", "received", "delayed", "cancelled"]).optional(),
  labName: z.string().min(1).optional(),
  workType: z.string().min(1).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
  receivedDate: z.string().optional().nullable(),
});

router.get("/lab/orders", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? parseInt(String(req.query.patientId), 10) : undefined;
  const baseQuery = db
    .select({
      id: labOrdersTable.id,
      patientId: labOrdersTable.patientId,
      patientName: patientsTable.name,
      labName: labOrdersTable.labName,
      workType: labOrdersTable.workType,
      status: labOrdersTable.status,
      sentDate: labOrdersTable.sentDate,
      dueDate: labOrdersTable.dueDate,
      receivedDate: labOrdersTable.receivedDate,
      notes: labOrdersTable.notes,
    })
    .from(labOrdersTable)
    .innerJoin(patientsTable, eq(labOrdersTable.patientId, patientsTable.id));

  const rows = patientId
    ? await baseQuery.where(eq(labOrdersTable.patientId, patientId)).orderBy(desc(labOrdersTable.sentDate))
    : await baseQuery.orderBy(desc(labOrdersTable.sentDate));

  res.json(rows);
});

router.post("/lab/orders", async (req, res): Promise<void> => {
  const parsed = createLabOrderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.insert(labOrdersTable).values({
    patientId: parsed.data.patientId,
    labName: parsed.data.labName,
    workType: parsed.data.workType,
    dueDate: parsed.data.dueDate ?? null,
    notes: parsed.data.notes ?? null,
    status: "sent",
  }).returning();

  res.status(201).json(order);
});

router.patch("/lab/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = updateLabOrderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "received" && !parsed.data.receivedDate) {
    updates.receivedDate = new Date();
  }

  const [updated] = await db.update(labOrdersTable).set(updates).where(eq(labOrdersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(updated);
});

router.delete("/lab/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(labOrdersTable).where(eq(labOrdersTable.id, id));
  res.status(204).send();
});

export default router;
