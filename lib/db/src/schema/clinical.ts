import { pgTable, text, serial, timestamp, integer, jsonb, numeric } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull().$type<{ service: string; price: number }[]>(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, approved
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evolutionNotesTable = pgTable("evolution_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("general"),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  doctorName: text("doctor_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const odontogramsTable = pgTable("odontograms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().$type<Record<string, { status: string; notes?: string; surfaces?: string[] }>>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const consentFormsTable = pgTable("consent_forms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content"),
  status: text("status").notNull().default("pending"),
  signatureUrl: text("signature_url"),
  signatureData: text("signature_data"),
  portalToken: text("portal_token"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
