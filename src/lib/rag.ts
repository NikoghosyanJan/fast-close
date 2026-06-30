import { prisma } from './prisma';
import {
  generateEmbedding,
  detectLanguage,
  translateToEnglish,
  type Lang,
} from './openai';
import { extractSearchPhrases } from './agent/text';
import { extractCategoryHint, categorySearchTerms } from './agent/category';
import {
  FULL_MENU_PRODUCT_THRESHOLD,
  RELEVANT_CONTEXT_MAX_PRODUCTS,
  HYBRID_SEARCH_TOP_K,
} from './agent/constants';
import type { MenuContextResult, MenuContextScope } from './agent/types';

// ── Types ─────────────────────────────────────────────────────

export interface MatchedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  aliases: string[];
  price: number | null;
  metadata: Record<string, unknown>;
  score?: number;
}

export interface RetrievalDebug {
  lang: Lang;
  retrievalQuery: string;
  embeddingQuery: string;
  ftsQuery: string;
  directMatchNames: string[];
  hybridCount: number;
  finalCount: number;
  scope: MenuContextScope;
}

// ── Format context for LLM ────────────────────────────────────

export function formatProductContext(products: MatchedProduct[]): string {
  if (!products.length) return '';
  return products
    .map((p, i) => {
      const price = p.price != null
        ? Number(p.price).toLocaleString()
        : 'Price on request';
      const meta = p.metadata && Object.keys(p.metadata).length
        ? '\n  ' + Object.entries(p.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '';
      const desc = p.description ? `\n  ${p.description}` : '';
      const cat = p.category ? `\n  Category: ${p.category}` : '';
      const als = p.aliases.length ? `\n  Aliases: ${p.aliases.join(', ')}` : '';
      return `[${i + 1}] id:${p.id} | ${p.name}\n  Price: ${price} AMD${cat}${als}${desc}${meta}`;
    })
    .join('\n\n');
}

function mapProductRow(p: {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  aliases?: string[] | unknown;
  price: unknown;
  metadata: unknown;
  score?: number;
}): MatchedProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category ?? null,
    aliases: Array.isArray(p.aliases) ? p.aliases.map(String) : [],
    price: p.price != null ? Number(p.price) : null,
    metadata: (p.metadata as Record<string, unknown>) ?? {},
    score: p.score,
  };
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  aliases: true,
  price: true,
  metadata: true,
} as const;

async function attachProductFields(
  products: MatchedProduct[],
  businessId: string
): Promise<MatchedProduct[]> {
  if (!products.length) return products;

  const ids = products.map(p => p.id);
  const rows = await prisma.product.findMany({
    where: { businessId, id: { in: ids } },
    select: PRODUCT_SELECT,
  });
  const byId = new Map(rows.map(r => [r.id, r]));

  return products.map(p => {
    const row = byId.get(p.id);
    if (!row) return p;
    return mapProductRow({ ...row, score: p.score });
  });
}

// ── Direct name / description match (deterministic, no vectors) ─

export async function findProductByName(
  lastMessage: string,
  businessId: string
): Promise<MatchedProduct[]> {
  const phrases = extractSearchPhrases(lastMessage);
  if (!phrases.length) return [];

  console.log('[RAG] direct match phrases:', phrases);

  const orClauses = phrases.map(
    (_, i) => `(
      name ILIKE '%' || $${i + 2} || '%'
      OR COALESCE(description, '') ILIKE '%' || $${i + 2} || '%'
      OR COALESCE(category, '') ILIKE '%' || $${i + 2} || '%'
      OR COALESCE(array_to_string(aliases, ' '), '') ILIKE '%' || $${i + 2} || '%'
    )`
  );
  const sql = `
    SELECT DISTINCT ON (id) id, name, description, category, aliases, price::float, metadata, 1.0 AS score
    FROM products
    WHERE business_id = $1
      AND (${orClauses.join(' OR ')})
    ORDER BY id
    LIMIT 8
  `;

  const rows = await prisma.$queryRawUnsafe<
    { id: string; name: string; description: string | null; category: string | null; aliases: string[]; price: number; metadata: unknown; score: number }[]
  >(sql, businessId, ...phrases);

  const products = rows.map(mapProductRow);
  console.log('[RAG] direct matches:', products.map(p => p.name));
  return products;
}

/** Category browse — ILIKE match on category column + synonyms. */
export async function findProductsByCategory(
  businessId: string,
  categoryHint: string
): Promise<MatchedProduct[]> {
  const terms = categorySearchTerms(categoryHint);
  const orClauses = terms.map(
    (_, i) => `COALESCE(category, '') ILIKE '%' || $${i + 2} || '%'`
  );
  const sql = `
    SELECT id, name, description, category, aliases, price::float, metadata, 1.0 AS score
    FROM products
    WHERE business_id = $1
      AND (${orClauses.join(' OR ')})
    ORDER BY name ASC
    LIMIT 12
  `;

  const rows = await prisma.$queryRawUnsafe<
    { id: string; name: string; description: string | null; category: string | null; aliases: string[]; price: number; metadata: unknown; score: number }[]
  >(sql, businessId, ...terms);

  const products = rows.map(mapProductRow);
  console.log('[RAG] category matches:', categoryHint, products.map(p => p.name));
  return products;
}

// ── Build retrieval query from conversation history ───────────

function buildRetrievalQuery(
  lastMessage: string,
  messages?: { role: string; content: string }[]
): string {
  if (!messages || messages.length <= 1) return lastMessage;
  const recentUserMessages = [...messages]
    .reverse()
    .filter(m => m.role === 'user')
    .slice(0, 3)
    .reverse()
    .map(m => m.content);
  return recentUserMessages.join(' ').replace(/\n/g, ' ').trim();
}

function mergeProducts(
  primary: MatchedProduct[],
  extra: MatchedProduct[],
  pinnedIds: Set<string>
): MatchedProduct[] {
  const byId = new Map<string, MatchedProduct>();
  for (const p of extra) byId.set(p.id, { ...p, score: (p.score ?? 0) + 1000 });
  for (const p of primary) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const aPin = pinnedIds.has(a.id) ? 1 : 0;
    const bPin = pinnedIds.has(b.id) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return (b.score ?? 0) - (a.score ?? 0);
  });
  return merged;
}

function takeTopProducts(
  products: MatchedProduct[],
  pinnedIds: Set<string>,
  max: number
): MatchedProduct[] {
  const pinned = products.filter(p => pinnedIds.has(p.id));
  const rest = products.filter(p => !pinnedIds.has(p.id));
  const slots = Math.max(max - pinned.length, 0);
  return [...pinned, ...rest.slice(0, slots)];
}

async function hybridSearch(
  embeddingVector: string,
  ftsQuery: string,
  businessId: string,
  topK: number
): Promise<MatchedProduct[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; description: string | null; price: number; metadata: unknown; score: number }[]
    >(
      `SELECT id, name, description, price::float, metadata, score
       FROM hybrid_search_products($1::vector, $2, $3, $4, 60)`,
      embeddingVector,
      ftsQuery,
      businessId,
      topK
    );
    const mapped = rows.map(r => mapProductRow({ ...r, category: null, aliases: [] }));
    return attachProductFields(mapped, businessId);
  } catch (e) {
    console.warn('[RAG] hybrid_search failed, falling back to vector-only:', e);
    const rows = await prisma.$queryRawUnsafe<
      { id: string; name: string; description: string | null; category: string | null; aliases: string[]; price: number; metadata: unknown; score: number }[]
    >(
      `SELECT id, name, description, category, aliases, price::float, metadata,
              1 - (embedding <=> $1::vector) AS score
       FROM products
       WHERE business_id = $2
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > 0.05
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      embeddingVector,
      businessId,
      topK
    );
    return rows.map(mapProductRow);
  }
}

export async function getRelevantContext(
  query: string,
  businessId: string,
  messages?: { role: string; content: string }[]
): Promise<MenuContextResult & { debug: RetrievalDebug }> {
  const lang = detectLanguage(query);
  const retrievalQuery = buildRetrievalQuery(query, messages);

  const directMatches = await findProductByName(query, businessId);
  const pinnedIds = new Set(directMatches.map(p => p.id));

  const embeddingQuery = retrievalQuery;
  const ftsQuery = retrievalQuery;
  let englishQuery: string | undefined;
  if (lang !== 'english') {
    englishQuery = await translateToEnglish(retrievalQuery, lang);
    console.log(`[RAG] lang=${lang} retrieval="${retrievalQuery}" english="${englishQuery}"`);
  }

  const embedding = await generateEmbedding(embeddingQuery);
  let rows = await hybridSearch(
    `[${embedding.join(',')}]`,
    ftsQuery,
    businessId,
    HYBRID_SEARCH_TOP_K
  );

  if (englishQuery && englishQuery !== retrievalQuery) {
    const enEmbedding = await generateEmbedding(englishQuery);
    const enRows = await hybridSearch(
      `[${enEmbedding.join(',')}]`,
      englishQuery,
      businessId,
      HYBRID_SEARCH_TOP_K
    );
    rows = mergeProducts(rows, enRows, new Set());
  }

  const merged = mergeProducts(rows, directMatches, pinnedIds);

  if (!merged.length) {
    console.log('[RAG] no results found');
    return {
      products: [],
      contextText: '',
      scope: 'empty',
      directMatchIds: [],
      debug: {
        lang,
        retrievalQuery,
        embeddingQuery,
        ftsQuery,
        directMatchNames: [],
        hybridCount: 0,
        finalCount: 0,
        scope: 'empty',
      },
    };
  }

  const products = takeTopProducts(merged, pinnedIds, RELEVANT_CONTEXT_MAX_PRODUCTS);
  console.log(
    `[RAG] final ${products.length} products (pinned: ${pinnedIds.size}):`,
    products.map(p => p.name)
  );

  return {
    products,
    contextText: formatProductContext(products),
    scope: 'relevant',
    directMatchIds: Array.from(pinnedIds),
    debug: {
      lang,
      retrievalQuery,
      embeddingQuery,
      ftsQuery,
      directMatchNames: directMatches.map(p => p.name),
      hybridCount: rows.length,
      finalCount: products.length,
      scope: 'relevant',
    },
  };
}

export async function getAllProducts(
  businessId: string
): Promise<MenuContextResult> {
  const rows = await prisma.product.findMany({
    where: { businessId },
    select: PRODUCT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  const products = rows.map(p => mapProductRow({ ...p, score: 1 }));

  return {
    products,
    contextText: formatProductContext(products),
    scope: 'full',
    directMatchIds: [],
  };
}

export async function getProductCount(businessId: string): Promise<number> {
  return prisma.product.count({ where: { businessId } });
}

export async function getMenuContext(
  lastUserMessage: string,
  businessId: string,
  options: {
    forceFullMenu?: boolean;
    category?: string | null;
    messages?: { role: string; content: string }[];
  } = {}
): Promise<MenuContextResult> {
  const count = await getProductCount(businessId);
  const categoryHint = options.category ?? extractCategoryHint(lastUserMessage);

  if (categoryHint && !options.forceFullMenu) {
    const categoryProducts = await findProductsByCategory(businessId, categoryHint);
    if (categoryProducts.length > 0) {
      console.log(`[RAG] category context: ${categoryHint} (${categoryProducts.length} items)`);
      return {
        products: categoryProducts,
        contextText: formatProductContext(categoryProducts),
        scope: 'relevant',
        directMatchIds: [],
      };
    }
  }

  const useFull =
    options.forceFullMenu === true ||
    (count > 0 && count <= FULL_MENU_PRODUCT_THRESHOLD);

  if (useFull) {
    console.log(`[RAG] full menu (${count} products)`);
    return getAllProducts(businessId);
  }

  if (count === 0) {
    return {
      products: [],
      contextText: '',
      scope: 'empty',
      directMatchIds: [],
    };
  }

  const result = await getRelevantContext(
    lastUserMessage,
    businessId,
    options.messages
  );
  return {
    products: result.products,
    contextText: result.contextText,
    scope: result.scope,
    directMatchIds: result.directMatchIds,
  };
}
