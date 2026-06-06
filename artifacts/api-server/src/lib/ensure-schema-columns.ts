import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/** Añade columnas y tablas nuevas sin romper producción (CREATE IF NOT EXISTS). */
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

  await db.execute(sql`ALTER TABLE evolution_notes ADD COLUMN IF NOT EXISTS note_type TEXT DEFAULT 'general'`);
  await db.execute(sql`ALTER TABLE evolution_notes ADD COLUMN IF NOT EXISTS subjective TEXT`);
  await db.execute(sql`ALTER TABLE evolution_notes ADD COLUMN IF NOT EXISTS objective TEXT`);
  await db.execute(sql`ALTER TABLE evolution_notes ADD COLUMN IF NOT EXISTS assessment TEXT`);
  await db.execute(sql`ALTER TABLE evolution_notes ADD COLUMN IF NOT EXISTS plan TEXT`);

  await db.execute(sql`ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS content TEXT`);
  await db.execute(sql`ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS signature_data TEXT`);
  await db.execute(sql`ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS portal_token TEXT`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS periodontograms (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_plans (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
      treatment_name TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      down_payment INTEGER NOT NULL DEFAULT 0,
      installment_count INTEGER NOT NULL,
      installment_amount INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      start_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_plan_installments (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
      installment_number INTEGER NOT NULL,
      due_date DATE NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
      paid_at TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portal_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      resource_id INTEGER,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lab_orders (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      lab_name TEXT NOT NULL,
      work_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      sent_date TIMESTAMP NOT NULL DEFAULT NOW(),
      due_date DATE,
      received_date TIMESTAMP,
      notes TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS consents (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      signature_data TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS gallery (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'evolution',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  logger.info("Columnas y tablas de esquema verificadas");
}
