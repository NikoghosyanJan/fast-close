-- FastClose AI — Migration 005: Product category + aliases (better RAG)
-- Run in Neon SQL Editor after migration 004

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS products_business_category_idx ON products (business_id, category);

-- Recreate search_vector to index category + aliases
DROP INDEX IF EXISTS products_search_vector_idx;
ALTER TABLE products DROP COLUMN IF EXISTS search_vector;

ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(array_to_string(aliases, ' '), '') || ' ' ||
      coalesce(metadata::text, '')
    )
  ) STORED;

CREATE INDEX products_search_vector_idx ON products USING GIN (search_vector);
