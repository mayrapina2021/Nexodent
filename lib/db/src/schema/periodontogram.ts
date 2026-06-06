import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export type PeriodontalSite = { pd: number; bop: boolean };
export type PeriodontalToothData = {
  sites: PeriodontalSite[];
  mobility: number;
  recession?: number;
  notes?: string;
};

export const periodontogramsTable = pgTable("periodontograms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().$type<Record<string, PeriodontalToothData>>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
