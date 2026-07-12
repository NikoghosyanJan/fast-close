-- FastClose AI — Migration 006: Dine-in tables + order type
-- Run in Neon SQL Editor (safe to re-run — idempotent)

DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('DELIVERY', 'DINE_IN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tables" (
  "id"          TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "number"      INTEGER NOT NULL,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "tables"
    ADD CONSTRAINT "tables_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tables_business_id_number_key" ON "tables"("business_id", "number");
CREATE INDEX IF NOT EXISTS "tables_business_id_idx" ON "tables"("business_id");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_type" "OrderType" NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "table_id" TEXT;
ALTER TABLE "orders" ALTER COLUMN "customer_phone" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "delivery_address" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_table_id_fkey"
    FOREIGN KEY ("table_id") REFERENCES "tables"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "orders_table_id_idx" ON "orders"("table_id");
CREATE INDEX IF NOT EXISTS "orders_order_type_idx" ON "orders"("order_type");

ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "order_type" "OrderType" NOT NULL DEFAULT 'DELIVERY';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "table_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "chat_sessions"
    ADD CONSTRAINT "chat_sessions_table_id_fkey"
    FOREIGN KEY ("table_id") REFERENCES "tables"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "chat_sessions_table_id_idx" ON "chat_sessions"("table_id");
