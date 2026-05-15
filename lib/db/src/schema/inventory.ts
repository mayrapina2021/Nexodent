import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const suppliesTable = pgTable("supplies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"), // Guantes, Resinas, Anestesia, etc.
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(5),
  unit: text("unit").notNull().default("unidades"), // cajas, paquetes, etc.
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
