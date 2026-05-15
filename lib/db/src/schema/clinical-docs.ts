import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const consentsTable = pgTable("consents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  type: text("type").notNull(), // 'general', 'surgery', 'implants', etc.
  content: text("content").notNull(),
  signatureData: text("signature_data"), // Base64 signature image
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const galleryTable = pgTable("gallery", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  imageUrl: text("image_url").notNull(), // Base64 or Cloud URL
  category: text("category").notNull().default("evolution"), // 'before', 'after', 'evolution', 'x-ray'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsentSchema = createInsertSchema(consentsTable).omit({ id: true });
export const insertGallerySchema = createInsertSchema(galleryTable).omit({ id: true });

export type Consent = typeof consentsTable.$inferSelect;
export type GalleryItem = typeof galleryTable.$inferSelect;
