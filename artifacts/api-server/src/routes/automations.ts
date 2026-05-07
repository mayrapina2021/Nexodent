import { Router, type IRouter } from "express";
import { db, automationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateAutomationBody,
  UpdateAutomationBody,
  UpdateAutomationParams,
  DeleteAutomationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/automations", async (_req, res): Promise<void> => {
  const automations = await db.select().from(automationsTable).orderBy(sql`${automationsTable.createdAt} desc`);
  res.json(automations);
});

router.post("/automations", async (req, res): Promise<void> => {
  const parsed = CreateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [automation] = await db.insert(automationsTable).values({ ...parsed.data, active: parsed.data.active ?? true }).returning();
  res.status(201).json(automation);
});

router.put("/automations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAutomationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAutomationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [automation] = await db.update(automationsTable).set(parsed.data as any)
    .where(eq(automationsTable.id, params.data.id)).returning();
  if (!automation) { res.status(404).json({ error: "Automation not found" }); return; }
  res.json(automation);
});

router.delete("/automations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAutomationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(automationsTable).where(eq(automationsTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Automation not found" }); return; }
  res.json({ message: "Automation deleted" });
});

export default router;
