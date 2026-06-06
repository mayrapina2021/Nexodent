import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function ensurePaymentsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
      treatment_name TEXT,
      expected_total INTEGER,
      amount INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'efectivo',
      payment_type TEXT NOT NULL DEFAULT 'abono',
      concept TEXT,
      notes TEXT,
      payment_date DATE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS patient_id INTEGER`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS quotation_id INTEGER`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS treatment_name TEXT`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS expected_total INTEGER`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo'`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'abono'`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept TEXT`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'method') THEN
        UPDATE payments SET payment_method = COALESCE(payment_method, method) WHERE method IS NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'date') THEN
        UPDATE payments SET payment_date = COALESCE(payment_date, (date AT TIME ZONE 'UTC')::date) WHERE date IS NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference') THEN
        UPDATE payments SET notes = COALESCE(notes, reference) WHERE reference IS NOT NULL AND notes IS NULL;
      END IF;
    END $$
  `);

  await db.execute(sql`
    UPDATE payments p SET patient_id = q.patient_id
    FROM quotations q
    WHERE p.quotation_id = q.id AND p.patient_id IS NULL
  `);

  await db.execute(sql`
    UPDATE payments SET patient_id = (SELECT id FROM patients ORDER BY id LIMIT 1)
    WHERE patient_id IS NULL AND EXISTS (SELECT 1 FROM patients LIMIT 1)
  `);

  await db.execute(sql`UPDATE payments SET payment_date = COALESCE(payment_date, CURRENT_DATE) WHERE payment_date IS NULL`);
  await db.execute(sql`UPDATE payments SET payment_method = COALESCE(payment_method, 'efectivo') WHERE payment_method IS NULL`);
  await db.execute(sql`UPDATE payments SET payment_type = COALESCE(payment_type, 'abono') WHERE payment_type IS NULL`);

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount' AND data_type = 'numeric'
      ) THEN
        ALTER TABLE payments ALTER COLUMN amount TYPE INTEGER USING ROUND(amount)::integer;
      END IF;
    END $$
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_patient_id_idx ON payments(patient_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_quotation_id_idx ON payments(quotation_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_payment_date_idx ON payments(payment_date)`);
  logger.info("Tabla payments verificada y migrada");
}
