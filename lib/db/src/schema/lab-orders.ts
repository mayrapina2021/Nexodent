import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const labOrdersTable = pgTable("lab_orders", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  labName: text("lab_name").notNull(),
  workType: text("work_type").notNull(), // 'crown', 'bridge', 'denture', etc.
  status: text("status").notNull().default("sent"), // 'sent', 'received', 'delayed', 'cancelled'
  sentDate: timestamp("sent_date").defaultNow().notNull(),
  dueDate: date("due_date"),
  receivedDate: timestamp("received_date"),
  notes: text("notes"),
});

export const insertLabOrderSchema = createInsertSchema(labOrdersTable).omit({ id: true });
export type InsertLabOrder = z.infer<typeof insertLabOrderSchema>;
export type LabOrder = typeof labOrdersTable.$inferSelect;
