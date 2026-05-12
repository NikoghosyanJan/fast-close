import { createAdminClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!businessId) return Response.json({ error: 'Missing businessId' });

  const supabase = createAdminClient();

  // Check 1: products exist?
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, embedding')
    .eq('business_id', businessId);

  // Check 2: try a test embedding + vector search
  let ragResult = null;
  let ragError = null;
  try {
    const embedding = await generateEmbedding('test product');
    const { data, error } = await supabase.rpc('match_products', {
      query_embedding: embedding,
      match_business_id: businessId,
      match_count: 5,
    });
    ragResult = data;
    ragError = error;
  } catch (e) {
    ragError = String(e);
  }

  return Response.json({
    productsFound: products?.length ?? 0,
    productsHaveEmbeddings: products?.filter(p => p.embedding !== null).length ?? 0,
    productError: prodError,
    ragResult,
    ragError,
  });
}