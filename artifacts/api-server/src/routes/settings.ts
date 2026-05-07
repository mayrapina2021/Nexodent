import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    const [created] = await db.insert(settingsTable).values({}).returning();
    res.json({ ...created, workingDays: created.workingDays.split(",") });
    return;
  }
  res.json({ ...settings, workingDays: settings.workingDays.split(",") });
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (Array.isArray(parsed.data.workingDays)) {
    updateData.workingDays = parsed.data.workingDays.join(",");
  }

  const [existing] = await db.select().from(settingsTable).limit(1);
  if (!existing) {
    const [created] = await db.insert(settingsTable).values(updateData as any).returning();
    res.json({ ...created, workingDays: created.workingDays.split(",") });
    return;
  }
  const [updated] = await db.update(settingsTable).set(updateData as any).returning();
  res.json({ ...updated, workingDays: updated.workingDays.split(",") });
});

export default router;
