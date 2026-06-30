-- ============================================================
-- FastClose AI — Migration 002: Hybrid Search
-- Run this in Neon SQL Editor if you already ran migration 001
-- ============================================================

-- 1. Add tsvector column for full-text search (auto-generated)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(metadata::text, '')
    )
  ) STORED;

-- 2. GIN index for fast full-text lookups
CREATE INDEX IF NOT EXISTS products_search_vector_idx
  ON products USING GIN (search_vector);

-- 3. Hybrid search function: vector + full-text via RRF
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
  fts_ranked AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          p.search_vector,
          plainto_tsquery('simple', query_text)
        ) DESC
      ) AS rank
    FROM products p
    WHERE p.business_id = match_business_id
      AND p.search_vector @@ plainto_tsquery('simple', query_text)
    LIMIT match_count * 2
  ),
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
