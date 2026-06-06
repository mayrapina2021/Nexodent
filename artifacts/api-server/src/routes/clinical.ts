import { Router, type IRouter } from "express";
import { db, quotationsTable, evolutionNotesTable, patientsTable, settingsTable, odontogramsTable, consentFormsTable, periodontogramsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { savePortalToken } from "./portal";
import {
  CreateEvolutionNoteBody,
  CreateQuotationBody,
  ListEvolutionNotesParams,
  ListQuotationsQueryParams,
} from "@workspace/api-zod";
import { getWhatsAppSock, phoneToJid } from "../lib/whatsapp";
import { logger } from "../lib/logger";
import { generateQuotationImage } from "../lib/quotation-image";


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

  const body = req.body as Record<string, unknown>;
  const noteType = body.noteType === "soap" ? "soap" : "general";
  const values = {
    ...parsed.data,
    noteType,
    subjective: typeof body.subjective === "string" ? body.subjective : null,
    objective: typeof body.objective === "string" ? body.objective : null,
    assessment: typeof body.assessment === "string" ? body.assessment : null,
    plan: typeof body.plan === "string" ? body.plan : null,
    content: noteType === "soap"
      ? [body.subjective, body.objective, body.assessment, body.plan].filter(Boolean).join("\n\n")
      : parsed.data.content,
  };

  const [note] = await db.insert(evolutionNotesTable).values(values).returning();
  res.status(201).json(note);
});

// Odontograma
router.get("/clinical/odontogram/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const [odontogram] = await db.select().from(odontogramsTable)
    .where(eq(odontogramsTable.patientId, patientId));
  
  if (!odontogram) {
    res.json({ patientId, data: {}, updatedAt: new Date() });
    return;
  }
  res.json(odontogram);
});

router.put("/clinical/odontogram/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const { data } = req.body;
  
  const [existing] = await db.select().from(odontogramsTable).where(eq(odontogramsTable.patientId, patientId));
  
  if (existing) {
    const [updated] = await db.update(odontogramsTable)
      .set({ data, updatedAt: new Date() })
      .where(eq(odontogramsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(odontogramsTable)
      .values({ patientId, data })
      .returning();
    res.status(201).json(created);
  }
});

// Consentimientos
router.get("/clinical/consent/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const forms = await db.select().from(consentFormsTable)
    .where(eq(consentFormsTable.patientId, patientId))
    .orderBy(desc(consentFormsTable.createdAt));
  res.json(forms);
});

const CONSENT_TEXT: Record<string, string> = {
  general: "Autorizo el tratamiento odontológico indicado, habiendo recibido información sobre riesgos y beneficios.",
  extraccion: "Autorizo la extracción dental, comprendiendo los riesgos del procedimiento.",
  implante: "Autorizo la colocación de implante dental con la información recibida.",
  endodoncia: "Autorizo el tratamiento de endodoncia indicado.",
};

router.post("/clinical/consent", async (req, res): Promise<void> => {
  const { patientId, type, sendWhatsApp } = req.body;
  const token = randomBytes(32).toString("hex");
  const content = CONSENT_TEXT[type] ?? CONSENT_TEXT.general;

  const [form] = await db.insert(consentFormsTable)
    .values({ patientId, type, content, status: "pending", portalToken: token })
    .returning();

  await savePortalToken(token, patientId, "consent", form.id);

  if (sendWhatsApp) {
    try {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
      const [settings] = await db.select().from(settingsTable).limit(1);
      const sock = getWhatsAppSock();
      if (patient && sock) {
        const baseUrl = process.env.CRM_URL ?? "https://nexodentbot.web.app";
        const link = `${baseUrl}/portal/consent/${token}`;
        const clinicName = settings?.clinicName ?? "Nexodent";
        const jid = phoneToJid(patient.phone);
        await sock.sendMessage(jid, {
          text: `*${clinicName}*\n\nEstimado(a) *${patient.name}*, le enviamos su consentimiento informado para firma digital:\n\n${link}\n\nEl enlace es válido por 7 días.`,
        });
      }
    } catch (err) {
      logger.error({ err }, "Error enviando consentimiento por WhatsApp");
    }
  }

  const baseUrl = process.env.CRM_URL ?? "https://nexodentbot.web.app";
  res.status(201).json({ ...form, signUrl: `${baseUrl}/portal/consent/${token}` });
});

// Periodontograma
router.get("/clinical/periodontogram/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const [record] = await db.select().from(periodontogramsTable).where(eq(periodontogramsTable.patientId, patientId));
  if (!record) { res.json({ patientId, data: {}, updatedAt: new Date() }); return; }
  res.json(record);
});

router.put("/clinical/periodontogram/:patientId", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.patientId, 10);
  const { data } = req.body;
  const [existing] = await db.select().from(periodontogramsTable).where(eq(periodontogramsTable.patientId, patientId));

  if (existing) {
    const [updated] = await db.update(periodontogramsTable)
      .set({ data, updatedAt: new Date() })
      .where(eq(periodontogramsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(periodontogramsTable).values({ patientId, data }).returning();
    res.status(201).json(created);
  }
});

// Presupuestos
router.get("/clinical/quotations", async (req, res): Promise<void> => {
  try {
    const patientId = req.query.patientId ? parseInt(String(req.query.patientId), 10) : undefined;
    const conditions = patientId ? eq(quotationsTable.patientId, patientId) : undefined;

    const rows = await db.select({
      id: quotationsTable.id,
      patientId: quotationsTable.patientId,
      patientName: patientsTable.name,
      items: quotationsTable.items,
      total: quotationsTable.total,
      status: quotationsTable.status,
      observations: quotationsTable.observations,
      createdAt: quotationsTable.createdAt,
    }).from(quotationsTable)
      .innerJoin(patientsTable, eq(quotationsTable.patientId, patientsTable.id))
      .where(conditions)
      .orderBy(desc(quotationsTable.createdAt));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /clinical/quotations fallback");
    const patientId = req.query.patientId ? parseInt(String(req.query.patientId), 10) : undefined;
    const base = sql`SELECT q.id, q.patient_id as "patientId", p.name as "patientName", q.items, q.total, q.status, q.created_at as "createdAt" FROM quotations q INNER JOIN patients p ON q.patient_id = p.id`;
    const result = patientId
      ? await db.execute(sql`${base} WHERE q.patient_id = ${patientId} ORDER BY q.created_at DESC`)
      : await db.execute(sql`${base} ORDER BY q.created_at DESC`);
    res.json((result.rows as Record<string, unknown>[]).map((r) => ({ ...r, observations: null })));
  }
});

router.post("/clinical/quotations", async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  
  const { sendToWhatsApp, ...data } = parsed.data;
  const observations = typeof req.body.observations === "string" ? req.body.observations.trim() || null : null;
  const [quotation] = await db.insert(quotationsTable).values({ ...data, observations }).returning();
  
  if (sendToWhatsApp && quotation) {
    try {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, data.patientId));
      const [settings] = await db.select().from(settingsTable).limit(1);
      if (patient) {
        const sock = getWhatsAppSock();
        const jid = phoneToJid(patient.phone);
        const clinicName = settings?.clinicName ?? "Nexodent";
        
        logger.info({ jid, patientName: patient.name }, "Generando imagen de presupuesto profesional");

        if (sock) {
          const imageBuffer = await generateQuotationImage({
            clinicName,
            patientName: patient.name,
            items: data.items,
            total: data.total
          });

          const caption = `*📄 PRESUPUESTO - ${clinicName}*\n\nEstimado(a) *${patient.name}*, adjuntamos su presupuesto solicitado. Quedamos atentos a cualquier duda.`;
          
          await sock.sendMessage(jid, { image: imageBuffer, caption });
          await db.update(quotationsTable).set({ status: "sent" }).where(eq(quotationsTable.id, quotation.id));
          logger.info({ id: quotation.id }, "Presupuesto enviado como IMAGEN");
        }
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
      if (patient) {
        const sock = getWhatsAppSock();
        const jid = phoneToJid(patient.phone);
        const clinicName = settings?.clinicName ?? "Nexodent";
        
        if (sock) {
          const imageBuffer = await generateQuotationImage({
            clinicName,
            patientName: patient.name,
            items: quotation.items,
            total: quotation.total
          });

          const caption = `*📄 PRESUPUESTO ACTUALIZADO - ${clinicName}*\n\nEstimado(a) *${patient.name}*, adjuntamos su presupuesto actualizado con los cambios realizados.`;
          
          await sock.sendMessage(jid, { image: imageBuffer, caption });
          await db.update(quotationsTable).set({ status: "sent" }).where(eq(quotationsTable.id, id));
          logger.info({ id }, "Presupuesto actualizado enviado como IMAGEN");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error enviando presupuesto actualizado por WhatsApp");
    }
  }
  
  res.json(quotation);
});


router.delete("/clinical/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(quotationsTable).where(eq(quotationsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Quotation not found" }); return; }
  res.json({ message: "Presupuesto eliminado correctamente" });
});

export default router;
