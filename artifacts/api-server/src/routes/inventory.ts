import { Router, type IRouter } from "express";
import { db, suppliesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// Listar insumos
router.get("/inventory/supplies", async (req, res): Promise<void> => {
  const supplies = await db.select().from(suppliesTable)
    .orderBy(asc(suppliesTable.name));
  res.json(supplies);
});

// Crear insumo
router.post("/inventory/supplies", async (req, res): Promise<void> => {
  const data = req.body;
  const [supply] = await db.insert(suppliesTable).values(data).returning();
  res.status(201).json(supply);
});

// Actualizar insumo
router.put("/inventory/supplies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const data = req.body;
  const [updated] = await db.update(suppliesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(suppliesTable.id, id))
    .returning();
  res.json(updated);
});

export default router;
