import { randomBytes } from "crypto";
import { db, quotationsTable, paymentsTable, consentFormsTable, patientsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AIActions } from "./groq";
import { getWhatsAppSock, phoneToJid } from "./whatsapp";
import { generateQuotationImage } from "./quotation-image";
import { generatePaymentReceiptImage } from "./payment-receipt-image";
import { computeBalance, signedPaymentAmount } from "./billing-utils";
import { savePortalToken } from "../routes/portal";
import { consentSignUrl, getCrmBaseUrl } from "./consent-utils";
import { logger } from "./logger";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  nequi: "Nequi",
  daviplata: "Daviplata",
  otro: "Otro",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  abono: "Abono",
  pago_completo: "Pago completo",
  anticipo: "Anticipo",
};

async function ensureConsentPortalToken(form: typeof consentFormsTable.$inferSelect): Promise<string> {
  if (form.portalToken) return form.portalToken;
  const token = randomBytes(32).toString("hex");
  await db.update(consentFormsTable).set({ portalToken: token }).where(eq(consentFormsTable.id, form.id));
  await savePortalToken(token, form.patientId, "consent", form.id);
  return token;
}

async function resolvePatientId(patientId: number | null, formattedPhone: string): Promise<number | null> {
  if (patientId) return patientId;
  const [p] = await db.select().from(patientsTable).where(eq(patientsTable.phone, formattedPhone));
  return p?.id ?? null;
}

export async function processAISendDocuments(
  patientId: number | null,
  formattedPhone: string,
  jid: string,
  actions: AIActions,
): Promise<{ sent: string[]; errors: string[] }> {
  const sent: string[] = [];
  const errors: string[] = [];
  const sock = getWhatsAppSock();
  if (!sock) return { sent, errors: ["WhatsApp no conectado"] };

  const pid = await resolvePatientId(patientId, formattedPhone);
  if (!pid) return { sent, errors: ["Paciente no identificado"] };

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, pid));
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!patient) return { sent, errors: ["Paciente no encontrado"] };

  const clinicName = settings?.clinicName ?? "Nexodent";
  const clinicAddress = settings?.clinicAddress ?? "";

  if (actions.sendQuotation?.quotationId) {
    try {
      const [q] = await db.select().from(quotationsTable)
        .where(eq(quotationsTable.id, actions.sendQuotation.quotationId));
      if (!q || q.patientId !== pid) {
        errors.push("Presupuesto no pertenece al paciente");
      } else {
        const imageBuffer = await generateQuotationImage({
          clinicName,
          patientName: patient.name,
          items: q.items as { service: string; price: number }[],
          total: q.total,
        });
        const caption = `*📄 PRESUPUESTO - ${clinicName}*\n\nEstimado(a) *${patient.name}*, adjuntamos su presupuesto #${q.id}.`;
        await sock.sendMessage(jid, { image: imageBuffer, caption });
        sent.push(`presupuesto #${q.id}`);
      }
    } catch (err) {
      logger.error({ err }, "Error enviando presupuesto por IA");
      errors.push("Error enviando presupuesto");
    }
  }

  if (actions.sendPaymentReceipt?.paymentId) {
    try {
      const [payment] = await db.select().from(paymentsTable)
        .where(eq(paymentsTable.id, actions.sendPaymentReceipt.paymentId));
      if (!payment || payment.patientId !== pid) {
        errors.push("Pago no pertenece al paciente");
      } else if (payment.paymentType === "devolucion") {
        errors.push("No se envían recibos de devolución");
      } else {
        let quotationTotal: number | null = null;
        let quotationPaid: number | null = null;
        let quotationBalance: number | null = null;
        if (payment.quotationId) {
          const [quote] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, payment.quotationId));
          if (quote) {
            quotationTotal = quote.total;
            const allPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.patientId, pid));
            quotationPaid = allPayments
              .filter((p) => p.quotationId === payment.quotationId && p.paymentType !== "devolucion")
              .reduce((s, p) => s + signedPaymentAmount(p.amount, p.paymentType), 0);
            quotationBalance = computeBalance(quote.total, quotationPaid);
          }
        }

        const imageBuffer = await generatePaymentReceiptImage({
          clinicName,
          clinicAddress,
          patientName: patient.name,
          paymentDate: payment.paymentDate,
          treatmentName: payment.treatmentName,
          concept: payment.concept,
          amount: payment.amount,
          paymentMethod: PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod,
          paymentType: PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType,
          quotationId: payment.quotationId,
          quotationTotal,
          quotationPaid,
          quotationBalance,
          expectedTotal: payment.expectedTotal,
          treatmentPaid: null,
          treatmentBalance: null,
        });

        const caption = `*🧾 RECIBO DE ABONO - ${clinicName}*\n\nHola *${patient.name}*, adjuntamos su comprobante del ${payment.paymentDate.split("-").reverse().join("/")}.`;
        await sock.sendMessage(jid, { image: imageBuffer, caption });
        sent.push(`recibo pago #${payment.id}`);
      }
    } catch (err) {
      logger.error({ err }, "Error enviando recibo por IA");
      errors.push("Error enviando recibo");
    }
  }

  if (actions.sendConsentLink?.consentId) {
    try {
      const [form] = await db.select().from(consentFormsTable)
        .where(eq(consentFormsTable.id, actions.sendConsentLink.consentId));
      if (!form || form.patientId !== pid) {
        errors.push("Consentimiento no pertenece al paciente");
      } else if (form.status === "signed") {
        errors.push("Consentimiento ya firmado");
      } else {
        const token = await ensureConsentPortalToken(form);
        const link = consentSignUrl(token)!;
        await sock.sendMessage(jid, {
          text: `*${clinicName}*\n\nEstimado(a) *${patient.name}*, le enviamos su consentimiento informado (${form.type}) para firma digital:\n\n${link}\n\nVálido 7 días.`,
        });
        sent.push(`consentimiento #${form.id}`);
      }
    } catch (err) {
      logger.error({ err }, "Error enviando consentimiento por IA");
      errors.push("Error enviando consentimiento");
    }
  }

  return { sent, errors };
}
