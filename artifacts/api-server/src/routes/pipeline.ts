import { Router, type IRouter } from "express";
import { db, patientsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

export const PIPELINE_STAGES = [
  { id: "new", label: "Nuevo", color: "bg-blue-500" },
  { id: "contacted", label: "Contactado", color: "bg-cyan-500" },
  { id: "scheduled", label: "Cita agendada", color: "bg-amber-500" },
  { id: "attended", label: "Asistió", color: "bg-emerald-500" },
  { id: "in_treatment", label: "En tratamiento", color: "bg-violet-500" },
  { id: "won", label: "Cerrado", color: "bg-green-600" },
  { id: "lost", label: "Perdido", color: "bg-slate-400" },
] as const;

const updateStageSchema = z.object({
  patientId: z.number().int().positive(),
  status: z.enum(["new", "contacted", "scheduled", "attended", "in_treatment", "won", "lost"]),
});

router.get("/pipeline", async (_req, res): Promise<void> => {
  const patients = await db
    .select({
      id: patientsTable.id,
      name: patientsTable.name,
      phone: patientsTable.phone,
      treatment: patientsTable.treatment,
      status: patientsTable.status,
      treatmentPrice: patientsTable.treatmentPrice,
      lastVisit: patientsTable.lastVisit,
      createdAt: patientsTable.createdAt,
    })
    .from(patientsTable)
    .orderBy(sql`${patientsTable.createdAt} DESC`);

  const stages = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    patients: patients.filter((p) => {
      const s = p.status || "new";
      if (stage.id === "new") return s === "new" || !PIPELINE_STAGES.some((st) => st.id === s);
      return s === stage.id;
    }),
    count: patients.filter((p) => {
      const s = p.status || "new";
      if (stage.id === "new") return s === "new" || !PIPELINE_STAGES.some((st) => st.id === s);
      return s === stage.id;
    }).length,
  }));

  const totalValue = patients.reduce((sum, p) => sum + (p.treatmentPrice ?? 0), 0);
  const wonValue = patients
    .filter((p) => p.status === "won" || p.status === "in_treatment")
    .reduce((sum, p) => sum + (p.treatmentPrice ?? 0), 0);

  res.json({ stages, stats: { totalPatients: patients.length, totalValue, wonValue } });
});

router.patch("/pipeline/stage", async (req, res): Promise<void> => {
  const parsed = updateStageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(patientsTable)
    .set({ status: parsed.data.status })
    .where(eq(patientsTable.id, parsed.data.patientId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Patient not found" }); return; }
  res.json(updated);
});

export default router;
