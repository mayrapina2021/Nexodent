import { pgTable, text, serial, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quotationsTable } from "./clinical";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").references(() => quotationsTable.id).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull(), // 'cash', 'transfer', 'card'
  reference: text("reference"), // Transaction ID or receipt number
  date: timestamp("date").defaultNow().notNull(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
