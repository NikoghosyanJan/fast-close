'use server';

import { normalizeAliases, normalizeCategory, type ProductFields } from './products';

export async function parseProductInput(raw: string): Promise<ProductFields[]> {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((item: Record<string, unknown>) => ({
      name: String(item.name ?? 'Unnamed Product'),
      description: item.description != null ? String(item.description) : undefined,
      price: item.price != null ? Number(item.price) : undefined,
      category: normalizeCategory(item.category),
      aliases: normalizeAliases(item.aliases),
      metadata: (item.metadata as Record<string, unknown>) ?? {},
    }));
  }
  const blocks = trimmed.split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n');
    return {
      name: lines[0] ?? 'Unnamed Product',
      description: lines.slice(1).join(' ').trim() || undefined,
    };
  });
}
