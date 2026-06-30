-- FastClose AI — Migration 003: Orders
-- Run in Neon SQL Editor

CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'PREPARING', 'DELIVERED', 'CANCELLED');

CREATE TABLE "orders" (
  "id"               TEXT NOT NULL,
  "business_id"      TEXT NOT NULL,
  "customer_phone"   TEXT NOT NULL,
  "delivery_address" TEXT NOT NULL,
  "items"            JSONB NOT NULL,
  "total_price"      DECIMAL(10,2) NOT NULL,
  "status"           "OrderStatus" NOT NULL DEFAULT 'NEW',
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "orders_business_id_idx" ON "orders"("business_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- Add owner_chat_id to telegram_bots for order notifications
ALTER TABLE telegram_bots ADD COLUMN IF NOT EXISTS "owner_chat_id" TEXT;
