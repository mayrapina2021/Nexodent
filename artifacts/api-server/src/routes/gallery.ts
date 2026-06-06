import { Router, type IRouter } from "express";
import { db, galleryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createGallerySchema = z.object({
  patientId: z.number().int().positive(),
  imageUrl: z.string().min(1),
  category: z.enum(["before", "after", "evolution", "x-ray"]).default("evolution"),
  notes: z.string().optional().nullable(),
});

router.get("/gallery/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const items = await db.select().from(galleryTable)
    .where(eq(galleryTable.patientId, patientId))
    .orderBy(desc(galleryTable.createdAt));
  res.json(items);
});

router.post("/gallery", async (req, res): Promise<void> => {
  const parsed = createGallerySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(galleryTable).values(parsed.data).returning();
  res.status(201).json(item);
});

router.delete("/gallery/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(galleryTable).where(eq(galleryTable.id, id));
  res.status(204).send();
});

export default router;
