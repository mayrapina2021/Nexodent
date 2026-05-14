import { Router, type IRouter } from "express";
import { db, quotationsTable, evolutionNotesTable, patientsTable, settingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateEvolutionNoteBody,
  CreateQuotationBody,
  ListEvolutionNotesParams,
  ListQuotationsQueryParams,
} from "@workspace/api-zod";
import { getWhatsAppSock } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Evolución
router.get("/clinical/evolution/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const notes = await db.select().from(evolutionNotesTable)
    .where(eq(evolutionNotesTable.patientId, patientId))
    .orderBy(desc(evolutionNotesTable.createdAt));
  res.json(notes);
});

router.post("/clinical/evolution", async (req, res): Promise<void> => {
  const parsed = CreateEvolutionNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [note] = await db.insert(evolutionNotesTable).values(parsed.data).returning();
  res.status(201).json(note);
});

// Presupuestos
router.get("/clinical/quotations", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? parseInt(String(req.query.patientId), 10) : undefined;
  const conditions = patientId ? eq(quotationsTable.patientId, patientId) : undefined;
  
  const rows = await db.select({
    id: quotationsTable.id,
    patientId: quotationsTable.patientId,
    patientName: patientsTable.name,
    items: quotationsTable.items,
    total: quotationsTable.total,
    status: quotationsTable.status,
    createdAt: quotationsTable.createdAt,
  }).from(quotationsTable)
    .innerJoin(patientsTable, eq(quotationsTable.patientId, patientsTable.id))
    .where(conditions)
    .orderBy(desc(quotationsTable.createdAt));
  
  res.json(rows);
});

router.post("/clinical/quotations", async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  
  const { sendToWhatsApp, ...data } = parsed.data;
  const [quotation] = await db.insert(quotationsTable).values(data).returning();
  
  if (sendToWhatsApp) {
    try {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, data.patientId));
      const [settings] = await db.select().from(settingsTable).limit(1);
      const sock = getWhatsAppSock();
      
      if (sock && patient) {
        const jid = `${patient.phone.replace(/\D/g, "")}@s.whatsapp.net`;
        const clinicName = settings?.clinicName ?? "Dientes Fijos Medellín";
        
        // Formatear mensaje profesional
        let text = `*📄 PRESUPUESTO - ${clinicName}*\n\n`;
        text += `Estimado(a) *${patient.name}*,\nAdjuntamos el detalle del plan de tratamiento recomendado:\n\n`;
        
        data.items.forEach((item: any) => {
          text += `▪️ ${item.service}: *$${item.price.toLocaleString()}*\n`;
        });
        
        text += `\n*TOTAL ESTIMADO: $${data.total.toLocaleString()}*\n\n`;
        text += `_Este presupuesto es informativo. Si tienes dudas, contáctanos._`;
        
        await sock.sendMessage(jid, { text });
        await db.update(quotationsTable).set({ status: "sent" }).where(eq(quotationsTable.id, quotation.id));
      }
    } catch (err) {
      logger.error({ err }, "Error enviando presupuesto por WhatsApp");
    }
  }
  
  res.status(201).json(quotation);
});

router.patch("/clinical/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = CreateQuotationBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  
  const { sendToWhatsApp, ...data } = parsed.data as any;
  const [quotation] = await db.update(quotationsTable).set(data).where(eq(quotationsTable.id, id)).returning();
  
  if (sendToWhatsApp && quotation) {
    try {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, quotation.patientId));
      const [settings] = await db.select().from(settingsTable).limit(1);
      const sock = getWhatsAppSock();
      
      if (sock && patient) {
        const jid = `${patient.phone.replace(/\D/g, "")}@s.whatsapp.net`;
        const clinicName = settings?.clinicName ?? "Dientes Fijos Medellín";
        
        let text = `*📄 PRESUPUESTO ACTUALIZADO - ${clinicName}*\n\n`;
        text += `Estimado(a) *${patient.name}*,\nAdjuntamos el detalle del plan de tratamiento actualizado:\n\n`;
        
        quotation.items.forEach((item: any) => {
          text += `▪️ ${item.service}: *$${item.price.toLocaleString()}*\n`;
        });
        
        text += `\n*TOTAL ESTIMADO: $${quotation.total.toLocaleString()}*\n\n`;
        text += `_Este presupuesto es informativo. Si tienes dudas, contáctanos._`;
        
        await sock.sendMessage(jid, { text });
        await db.update(quotationsTable).set({ status: "sent" }).where(eq(quotationsTable.id, id));
      }
    } catch (err) {
      logger.error({ err }, "Error enviando presupuesto actualizado por WhatsApp");
    }
  }
  
  res.json(quotation);
});

export default router;

