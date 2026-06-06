import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { quotationsTable } from "./clinical";
import { paymentsTable } from "./billing";

export const paymentPlansTable = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  quotationId: integer("quotation_id").references(() => quotationsTable.id, { onDelete: "set null" }),
  treatmentName: text("treatment_name").notNull(),
  totalAmount: integer("total_amount").notNull(),
  downPayment: integer("down_payment").notNull().default(0),
  installmentCount: integer("installment_count").notNull(),
  installmentAmount: integer("installment_amount").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentPlanInstallmentsTable = pgTable("payment_plan_installments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => paymentPlansTable.id, { onDelete: "cascade" }),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  paymentId: integer("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at"),
});
