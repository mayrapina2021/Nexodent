import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const portalTokensTable = pgTable("portal_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  resourceId: integer("resource_id"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
