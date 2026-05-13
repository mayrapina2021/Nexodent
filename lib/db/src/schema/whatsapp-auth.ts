import { pgTable, text } from "drizzle-orm/pg-core";

export const whatsappAuthTable = pgTable("whatsapp_auth", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type WhatsappAuth = typeof whatsappAuthTable.$inferSelect;
