import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/** Añade columnas nuevas sin romper producción (CREATE IF NOT EXISTS). */
export async function ensureSchemaColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS cedula TEXT`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood TEXT`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source TEXT`);
  await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS city TEXT`);
  await db.execute(sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS observations TEXT`);
  await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT`);
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`);
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT`);
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_data TEXT`);
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_msg_id TEXT`);
  await db.execute(sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS ai_bot_enabled BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS expected_total INTEGER`);
  logger.info("Columnas de esquema verificadas");
}
