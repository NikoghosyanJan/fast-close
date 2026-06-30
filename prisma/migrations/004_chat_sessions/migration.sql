-- FastClose AI — Migration 004: Chat sessions (cart + phase state)
-- Run in Neon SQL Editor after migration 003

CREATE TYPE "SessionChannel" AS ENUM ('WEB', 'TELEGRAM');

CREATE TYPE "ConversationPhase" AS ENUM (
  'GREETING',
  'BROWSING',
  'ORDERING',
  'CHECKOUT',
  'CONFIRMED'
);

CREATE TABLE "chat_sessions" (
  "id"                TEXT NOT NULL,
  "business_id"       TEXT NOT NULL,
  "channel"           "SessionChannel" NOT NULL,
  "external_key"      TEXT NOT NULL,
  "phase"             "ConversationPhase" NOT NULL DEFAULT 'BROWSING',
  "cart"              JSONB NOT NULL DEFAULT '[]',
  "customer_phone"    TEXT,
  "delivery_address"  TEXT,
  "messages"          JSONB NOT NULL DEFAULT '[]',
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "chat_sessions_business_channel_external_key"
  ON "chat_sessions"("business_id", "channel", "external_key");

CREATE INDEX "chat_sessions_business_id_idx" ON "chat_sessions"("business_id");
