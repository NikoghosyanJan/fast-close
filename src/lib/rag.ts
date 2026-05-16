import { createAdminClient } from './supabase';
import { generateEmbedding } from './openai';
import type { MatchedProduct } from '@/types';

/**
 * Build a smart query for embedding from the conversation.
 * Instead of just the last message, we combine the last few messages
 * so "tell me more about it" still retrieves the right product.
 */
function buildRetrievalQuery(
  messages: { role: string; content: string }[]
): string {
  // Take last 4 messages (2 turns) for context-aware retrieval
  const recent = messages.slice(-4);
  return recent
    .map((m) => m.content)
    .join(' ')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Format products into a clean catalog string for the LLM.
 * No markdown bold — plain structured text the model reads reliably.
 */
function formatContext(products: MatchedProduct[]): string {
  return products
    .map((p, i) => {
      const price =
        p.price != null
          ? `${Number(p.price).toLocaleString()}`
          : 'Price on request';

      const meta =
        p.metadata && Object.keys(p.metadata).length
          ? '\n  ' +
          Object.entries(p.metadata)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          : '';

      const desc = p.description
        ? `\n  ${p.description}`
        : '';

      return `[${i + 1}] ${p.name}\n  Price: ${price}${desc}${meta}`;
    })
    .join('\n\n');
}

/**
 * Main RAG function.
 * - Uses full conversation context for retrieval (not just last message)
 * - Returns ALL products above a very low threshold
 * - Always fetches more candidates (topK=8) then filters
 */
export async function getRelevantContext(
  query: string,
  businessId: string,
  topK = 8,
  messages?: { role: string; content: string }[]
): Promise<{ products: MatchedProduct[]; contextText: string }> {
  const supabase = createAdminClient();

  // Build a richer query if we have conversation history
  const retrievalQuery = messages && messages.length > 1
    ? buildRetrievalQuery(messages)
    : query;

  const embedding = await generateEmbedding(retrievalQuery);

  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    match_business_id: businessId,
    match_count: topK,
  });

  if (error) {
    console.error('[RAG] match_products error:', error);
    return { products: [], contextText: '' };
  }

  // Very low threshold — we'd rather include a slightly irrelevant product
  // than miss a relevant one. The LLM decides what's useful.
  const products: MatchedProduct[] = (data ?? []).filter(
    (p: MatchedProduct) => p.similarity > 0.05
  );

  if (products.length === 0) {
    return { products: [], contextText: '' };
  }

  const contextText = formatContext(products);
  return { products, contextText };
}

/**
 * Fetch ALL products for a business (used for "what do you have" queries).
 */
export async function getAllProducts(
  businessId: string
): Promise<{ products: MatchedProduct[]; contextText: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, metadata')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return { products: [], contextText: '' };
  }

  const products = data.map((p) => ({ ...p, similarity: 1 })) as MatchedProduct[];
  const contextText = formatContext(products);
  return { products, contextText };
}
