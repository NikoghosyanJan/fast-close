/** Shared product field helpers for CRUD + embeddings. */

export interface ProductFields {
  name: string;
  description?: string | null;
  category?: string | null;
  aliases?: string[] | string | null;
  price?: number | null;
  metadata?: Record<string, unknown>;
}

export function normalizeAliases(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input.map(String).map(s => s.trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeCategory(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  return s.length > 0 ? s : null;
}
