import { getMenuContext, getRelevantContext, findProductByName, getProductCount } from '@/lib/rag';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

/** Dev-only RAG trace — inspect retrieval without Supabase. */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  const query = req.nextUrl.searchParams.get('q');
  if (!businessId) return Response.json({ error: 'Missing businessId' });
  if (!query) return Response.json({ error: 'Missing q (query text)' });

  const count = await getProductCount(businessId);
  const direct = await findProductByName(query, businessId);
  const menu = await getMenuContext(query, businessId);
  const detailed = count > 40
    ? await getRelevantContext(query, businessId)
    : null;

  return Response.json({
    productCount: count,
    usesFullMenu: count <= 40,
    directMatches: direct.map(p => ({ id: p.id, name: p.name, price: p.price })),
    menuContext: {
      scope: menu.scope,
      productCount: menu.products.length,
      products: menu.products.map(p => ({ id: p.id, name: p.name, price: p.price })),
    },
    retrievalDebug: detailed?.debug ?? null,
  });
}
