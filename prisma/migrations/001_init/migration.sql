-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'BUSINESS',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Businesses
CREATE TABLE "businesses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "system_prompt" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "businesses_user_id_key" ON "businesses"("user_id");
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Products
CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2),
  "embedding" vector(1536),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Leads
CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "client_phone" TEXT NOT NULL,
  "chat_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leads_business_id_client_phone_key" ON "leads"("business_id", "client_phone");
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Telegram bots
CREATE TABLE "telegram_bots" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "bot_token" TEXT NOT NULL,
  "bot_username" TEXT,
  "webhook_set" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "telegram_bots_business_id_key" ON "telegram_bots"("business_id");
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_business_id TEXT,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  price DECIMAL,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    p.id, p.name, p.description, p.price, p.metadata,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.business_id = match_business_id
    AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- IVFFlat index for fast ANN search
CREATE INDEX products_embedding_idx
  ON products USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Full-text search support ──────────────────────────────────
-- Add tsvector column for BM25-style full-text search
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(metadata::text, '')
    )
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS products_search_vector_idx
  ON products USING GIN (search_vector);

-- ── Hybrid search function (vector + full-text, RRF merge) ────
CREATE OR REPLACE FUNCTION hybrid_search_products(
  query_embedding   vector(1536),
  query_text        TEXT,
  match_business_id TEXT,
  match_count       INT DEFAULT 8,
  rrf_k             INT DEFAULT 60
)
RETURNS TABLE (
  id          TEXT,
  name        TEXT,
  description TEXT,
  price       DECIMAL,
  metadata    JSONB,
  score       FLOAT
)
LANGUAGE SQL STABLE AS $$
  WITH
  -- Vector search results with rank
  vector_ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (ORDER BY p.embedding <=> query_embedding) AS rank
    FROM products p
    WHERE p.business_id = match_business_id
      AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  -- Full-text search results with rank
  fts_ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(p.search_vector, plainto_tsquery('simple', query_text)) DESC
      ) AS rank
    FROM products p
    WHERE p.business_id = match_business_id
      AND p.search_vector @@ plainto_tsquery('simple', query_text)
    ORDER BY ts_rank_cd(p.search_vector, plainto_tsquery('simple', query_text)) DESC
    LIMIT match_count * 2
  ),
  -- Reciprocal Rank Fusion
  rrf AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(1.0 / (rrf_k + v.rank), 0.0) +
      COALESCE(1.0 / (rrf_k + f.rank), 0.0) AS rrf_score
    FROM vector_ranked v
    FULL OUTER JOIN fts_ranked f ON v.id = f.id
  )
  SELECT
    p.id, p.name, p.description, p.price, p.metadata,
    rrf.rrf_score AS score
  FROM rrf
  JOIN products p ON p.id = rrf.id
  ORDER BY rrf.rrf_score DESC
  LIMIT match_count;
$$;
