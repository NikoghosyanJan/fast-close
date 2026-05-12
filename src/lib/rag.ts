import { createAdminClient } from './supabase';
import { generateEmbedding } from './openai';
import type { MatchedProduct } from '@/types';

export async function getRelevantContext(
  query: string,
  businessId: string,
  topK = 5
): Promise<{ products: MatchedProduct[]; contextText: string }> {
  const supabase = createAdminClient();
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    match_business_id: businessId,
    match_count: topK,
  });

  if (error) {
    console.error('[RAG] match_products error:', error);
    return { products: [], contextText: '' };
  }

  const products: MatchedProduct[] = (data ?? []).filter(
    (p: MatchedProduct) => p.similarity > 0.05
  );

  const contextText = products
    .map((p, i) => {
      const price = p.price != null ? `$${Number(p.price).toFixed(2)}` : 'Price on request';
      const meta = p.metadata && Object.keys(p.metadata).length
        ? `\n   Details: ${JSON.stringify(p.metadata)}` : '';
      return `${i + 1}. **${p.name}** — ${price}\n   ${p.description ?? 'No description.'}${meta}`;
    })
    .join('\n\n');

  return { products, contextText };
}
