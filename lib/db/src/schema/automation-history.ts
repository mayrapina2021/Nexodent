import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { automationsTable } from "./automations";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";

export const automationHistoryTable = pgTable("automation_history", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").references(() => automationsTable.id, { onDelete: "cascade" }).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id, { onDelete: "cascade" }).notNull(),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  status: text("status").notNull(), // 'sent', 'failed'
});
