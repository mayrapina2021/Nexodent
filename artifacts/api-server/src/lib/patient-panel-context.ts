import {
  db,
  patientsTable,
  quotationsTable,
  appointmentsTable,
  paymentsTable,
  consentFormsTable,
  evolutionNotesTable,
  paymentPlansTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { summarizePatientBilling, signedPaymentAmount } from "./billing-utils";

function to12h(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "p.m." : "a.m.";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Carga todo el contexto del panel para un paciente — solo datos de ESE paciente. */
export async function buildPatientPanelContext(patientId: number, colombiaDate: string): Promise<string> {
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);
  if (!patient) return "";

  const [quotes, appointments, payments, consents, notes, plans] = await Promise.all([
    db.select().from(quotationsTable).where(eq(quotationsTable.patientId, patientId)).orderBy(desc(quotationsTable.createdAt)).limit(5),
    db.select().from(appointmentsTable).where(eq(appointmentsTable.patientId, patientId)).orderBy(desc(appointmentsTable.date)).limit(8),
    db.select().from(paymentsTable).where(eq(paymentsTable.patientId, patientId)).orderBy(desc(paymentsTable.paymentDate)).limit(10),
    db.select().from(consentFormsTable).where(eq(consentFormsTable.patientId, patientId)).orderBy(desc(consentFormsTable.createdAt)).limit(5),
    db.select().from(evolutionNotesTable).where(eq(evolutionNotesTable.patientId, patientId)).orderBy(desc(evolutionNotesTable.createdAt)).limit(3),
    db.select().from(paymentPlansTable).where(eq(paymentPlansTable.patientId, patientId)).orderBy(desc(paymentPlansTable.createdAt)).limit(3),
  ]);

  const paidByQuotation = new Map<number, number>();
  for (const p of payments) {
    if (p.quotationId && p.paymentType !== "devolucion") {
      paidByQuotation.set(p.quotationId, (paidByQuotation.get(p.quotationId) ?? 0) + signedPaymentAmount(p.amount, p.paymentType));
    }
  }

  const billing = summarizePatientBilling(
    quotes.map((q) => ({ id: q.id, total: q.total, items: q.items as { service: string; price: number }[] })),
    payments,
    paidByQuotation,
    patient.treatmentPrice,
  );

  let ctx = "\n━━━ DATOS DEL PANEL (SOLO ESTE PACIENTE — no compartas datos de otros) ━━━";
  ctx += `\nFICHA: cédula ${patient.cedula ?? "N/A"} | email ${patient.email ?? "N/A"} | tratamiento ${patient.treatment ?? "N/A"} | última visita ${patient.lastVisit ?? "N/A"}`;
  if (patient.diagnosis) ctx += `\nDIAGNÓSTICO: ${patient.diagnosis.slice(0, 400)}`;
  if (patient.medicalHistory) ctx += `\nPLAN DE TRATAMIENTO: ${patient.medicalHistory.slice(0, 400)}`;
  if (patient.notes) ctx += `\nNOTAS: ${patient.notes.slice(0, 200)}`;

  if (quotes.length > 0) {
    ctx += "\nPRESUPUESTOS (usa quotationId para enviar imagen con sendQuotation):";
    for (const q of quotes) {
      const items = (q.items as { service: string; price: number }[]).map((it) => `- ${it.service}: ${Number(it.price).toLocaleString()} pesos`).join("\n");
      ctx += `\n#${q.id} (${q.status}):\n${items}\nTOTAL: ${Number(q.total).toLocaleString()} pesos`;
    }
  }

  const abonos = payments.filter((p) => p.paymentType !== "devolucion");
  if (abonos.length > 0) {
    ctx += "\nABONOS/PAGOS (usa paymentId para enviar recibo con sendPaymentReceipt; NO enviar devoluciones):";
    for (const p of abonos.slice(0, 5)) {
      ctx += `\n- paymentId ${p.id} | ${p.paymentDate} | ${p.treatmentName ?? p.concept ?? "Abono"} | ${Number(p.amount).toLocaleString()} pesos (${p.paymentMethod})`;
    }
    ctx += `\nRESUMEN FACTURACIÓN: pagado ${billing.totalPaid.toLocaleString()} pesos | saldo ${billing.remainingDebt.toLocaleString()} pesos`;
  }

  const upcoming = appointments
    .filter((a) => (a.status === "scheduled" || a.status === "confirmed") && a.date >= colombiaDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  if (appointments.length > 0) {
    ctx += "\nCITAS (appointmentId para cancelar/reagendar):";
    if (upcoming.length > 0) {
      ctx += "\nPRÓXIMAS:";
      for (const a of upcoming) {
        ctx += `\n- appointmentId ${a.id} | ${a.date} ${to12h(a.startTime)} | ${a.treatment} (${a.status})`;
      }
    }
    const other = appointments.filter((a) => !upcoming.some((u) => u.id === a.id));
    if (other.length > 0) {
      ctx += "\nHISTORIAL:";
      for (const a of other.slice(0, 3)) {
        ctx += `\n- appointmentId ${a.id} | ${a.date} ${to12h(a.startTime)} | ${a.treatment} (${a.status})`;
      }
    }
  }

  if (consents.length > 0) {
    ctx += "\nCONSENTIMIENTOS (sendConsentLink con consentId para enviar link de firma):";
    for (const c of consents) {
      ctx += `\n- consentId ${c.id} | ${c.type} | ${c.status}${c.status === "pending" ? " (pendiente firma)" : ""}`;
    }
  }

  if (notes.length > 0) {
    ctx += "\nEVOLUCIÓN CLÍNICA RECIENTE:";
    for (const n of notes) {
      ctx += `\n- ${n.createdAt.toISOString().slice(0, 10)}: ${n.content.slice(0, 120)}${n.content.length > 120 ? "..." : ""}`;
    }
  }

  if (plans.length > 0) {
    ctx += "\nPLANES DE PAGO:";
    for (const pl of plans) {
      ctx += `\n- planId ${pl.id} | ${pl.treatmentName} | ${pl.status} | total ${pl.totalAmount.toLocaleString()} | ${pl.installmentCount} cuotas de ${pl.installmentAmount.toLocaleString()}`;
    }
  }

  return ctx;
}
