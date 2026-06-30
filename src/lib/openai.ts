import OpenAI from 'openai';
import { type ProductFields, normalizeAliases, normalizeCategory } from './products';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Embeddings ────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').trim(),
  });
  return response.data[0].embedding;
}

export function buildProductEmbeddingText(product: ProductFields): string {
  const parts: string[] = [`Name: ${product.name}`];
  const category = normalizeCategory(product.category);
  if (category) parts.push(`Category: ${category}`);
  const aliases = normalizeAliases(product.aliases);
  if (aliases.length) parts.push(`Also known as: ${aliases.join(', ')}`);
  if (product.description) parts.push(product.description);
  if (product.price != null) parts.push(`${product.price} AMD`);
  if (product.metadata && Object.keys(product.metadata).length) {
    parts.push(Object.entries(product.metadata).map(([k, v]) => `${k}: ${v}`).join(', '));
  }
  return parts.join('. ');
}

// ── Language detection ────────────────────────────────────────

export type Lang = 'armenian' | 'russian' | 'english' | 'other';

export function detectLanguage(text: string): Lang {
  if (/[\u0530-\u058F]/.test(text)) return 'armenian';
  if (/[\u0400-\u04FF]/.test(text)) return 'russian';
  const armTranslit = /\b(barev|vonc|inchi|inch|kam|chi|du|yes|mer|vor|te|ha|ayo|cheh|menk|bolor|karogh|uzum|karum|kgna|kapes|gna|ela|ara|jan|aper|bari|lav|vat|inchka|barer|gnum|galis|ktor|gner|ուզ|ուտ|կե|կուզ)\b/i;
  if (armTranslit.test(text)) return 'armenian';
  const rusTranslit = /\b(privet|kak|chto|gde|skolko|est|net|da|nyet|mozhno|nuzhno|hochu|spasibo|pozhaluysta|pochemu|kogda|kakoy|etot|tot|oni|ona|on|my|vy|ya|zakaz|dostavka|adres)\b/i;
  if (rusTranslit.test(text)) return 'russian';
  const latinRatio = (text.match(/[a-zA-Z]/g)?.length ?? 0) / Math.max(text.length, 1);
  if (latinRatio > 0.5) return 'english';
  return 'other';
}

// ── Query translation ─────────────────────────────────────────

export async function translateToEnglish(text: string, lang: Lang): Promise<string> {
  if (lang === 'english') return text;
  const langName = lang === 'armenian' ? 'Armenian (possibly transliterated)'
    : lang === 'russian' ? 'Russian (possibly transliterated)' : 'the detected language';
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0, max_tokens: 200,
    messages: [
      { role: 'system', content: `Translate from ${langName} to English. Output ONLY the translation. Preserve food names, prices, and numbers as-is.` },
      { role: 'user', content: text },
    ],
  });
  return response.choices[0].message.content?.trim() ?? text;
}

// ── Reranker ──────────────────────────────────────────────────

export interface RankedProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  metadata: Record<string, unknown>;
  score?: number;
}

export async function rerankProducts(query: string, products: RankedProduct[], topN = 4): Promise<RankedProduct[]> {
  if (products.length <= topN) return products;
  const catalog = products.map((p, i) =>
    `[${i}] ${p.name}${p.description ? ` — ${p.description}` : ''}${p.price != null ? ` (${p.price})` : ''}`
  ).join('\n');
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', temperature: 0, max_tokens: 100,
    messages: [
      { role: 'system', content: `Return the indices of the ${topN} most relevant products for the query as a JSON array of integers only. No explanation.` },
      { role: 'user', content: `Query: "${query}"\n\nProducts:\n${catalog}` },
    ],
  });
  try {
    const indices: number[] = JSON.parse(response.choices[0].message.content?.trim() ?? '[]');
    return indices.filter(i => i >= 0 && i < products.length).slice(0, topN).map(i => products[i]);
  } catch { return products.slice(0, topN); }
}

// ── Order extraction ──────────────────────────────────────────

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ExtractedOrder {
  items: OrderItem[];
  totalPrice: number;
  customerPhone: string;
  deliveryAddress: string;
}

export async function extractOrderFromConversation(
  messages: { role: string; content: string }[]
): Promise<ExtractedOrder | null> {
  const conversation = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `Extract the confirmed order from this conversation. Return ONLY valid JSON in this exact format:
{
  "items": [{"name": "item name", "quantity": 1, "price": 0.00}],
  "totalPrice": 0.00,
  "customerPhone": "phone number",
  "deliveryAddress": "address"
}
If the order is not yet confirmed by the customer, or phone/address are missing, return null.
Extract prices as numbers. All item names in their original language.`,
      },
      { role: 'user', content: conversation },
    ],
  });

  try {
    const raw = response.choices[0].message.content?.trim() ?? 'null';
    if (raw === 'null') return null;
    return JSON.parse(raw) as ExtractedOrder;
  } catch { return null; }
}

// ── System prompt (restaurant-focused) ───────────────────────
export function buildSystemPrompt(
  businessName: string,
  context: string,
  customPrompt?: string | null,
  menuScope: 'full' | 'relevant' | 'empty' = 'relevant',
  sessionContext?: string | null,
  useTools = false
): string {
  const persona = customPrompt?.trim() || `You are a friendly waiter and ordering assistant for ${businessName}.`;

  const menuHeader =
    menuScope === 'full'
      ? '===== FULL MENU (complete catalog — only these items exist) ====='
      : menuScope === 'relevant'
        ? '===== RELEVANT MENU ITEMS (matched to this question — only mention items listed here) ====='
        : '===== MENU (not loaded — ask customer to try again or call the restaurant) =====';

  const antiHallucination =
    menuScope === 'full'
      ? `- The menu below is the COMPLETE catalog. NEVER mention items not listed.
- If they ask for something not on the list, say honestly we don't carry it and suggest 2–3 real alternatives from the menu.`
      : menuScope === 'relevant'
        ? `- ONLY mention items explicitly listed below. NEVER invent names or prices.
- If the customer asks for a specific item BY NAME and it appears below, confirm we have it and offer to add it.
- If they ask for a specific item that is NOT listed below, do NOT say "we don't have it" — instead say you're showing the closest matches and invite them to ask for the full menu or spell the item name.
- For categories: list only matching items from below; if none match, say so and suggest asking for the full menu.`
        : `- Menu data is unavailable. Apologize and ask them to try again in a moment or call the restaurant. Do not guess items.`;

  const toolInstructions = useTools
    ? `
===== TOOLS (required — cart is server-side) =====
You have tools to manage orders. You MUST call tools for cart changes — never claim items were added without calling add_to_cart.
- search_menu — find items and product_ids before adding unfamiliar items
- add_to_cart — when customer wants to order (use exact product_id from menu/search)
- update_cart_item — change quantity; quantity 0 removes item
- get_cart — check current order before summarizing
- set_delivery_info — save phone and/or address when customer provides them
- confirm_order — ONLY after customer explicitly says yes/confirm to the final summary
Never invent product_ids. Only use ids from search_menu results or the menu block below.
`
    : '';

  const confirmStep = '7. CONFIRM — after customer confirms the summary, call confirm_order tool, then thank them warmly.';

  const buildOrderStep = '5. BUILD ORDER — use add_to_cart / update_cart_item tools when customer orders; use get_cart before summarizing.';

  return `${persona}
${toolInstructions}
===== LANGUAGE =====
Reply in the SAME language as the customer's LAST message.
- Armenian (script or translit: barev, inch, kam, uzum) → Armenian script
- Russian (Cyrillic or translit: privet, skolko, zakaz) → Russian Cyrillic
- English → English
Use exact item names and prices from the menu block below.

===== ANTI-HALLUCINATION =====
${antiHallucination}

===== YOUR ROLE (human waiter) =====
1. GREET warmly on first message; be concise and helpful, not robotic.
2. ANSWER the specific question — don't dump the whole menu unless they ask for everything.
3. HELP CHOOSE — if unsure, ask one preference question, then suggest 2–3 items FROM THE MENU ONLY.
4. CROSS-SELL once per order — when they pick a main, suggest ONE natural add-on FROM THE MENU (drink, side, dessert).
${buildOrderStep}
6. CHECKOUT — when done ordering, ask for phone + delivery address, show summary with total from cart, ask confirmation.
${confirmStep}

===== RULES =====
- Show prices in AMD clearly.
- Short messages — 2–4 sentences usually enough.
- Redirect off-topic questions gently back to ordering.

${sessionContext ? `${sessionContext}\n\n` : ''}${menuHeader}
${context || 'Menu is being updated. Please check back soon or call us directly.'}
===== END MENU =====`;
}

// ── Phone extraction ──────────────────────────────────────────

export function extractPhoneNumber(text: string): string | null {
  const patterns = [
    /\+?374[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{3}/,
    /\+?374[\s\-]?\d{2}[\s\-]?\d{6}/,
    /0\d{2}[\s\-]?\d{3}[\s\-]?\d{3}/,
    /0\d{2}[\s\-]?\d{6}/,
    /\+?[1-9]\d{0,2}[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/,
    /\+?[1-9]\d{6,14}/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const digits = match[0].replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) return digits;
    }
  }
  return null;
}

// ── Telegram order notification ───────────────────────────────

export async function sendOrderToTelegram(
  botToken: string,
  chatId: number | string,
  order: ExtractedOrder,
  businessName: string,
  orderId: string
): Promise<void> {
  const itemLines = order.items
    .map(i => `  • ${i.name} x${i.quantity} — ${Number(i.price).toLocaleString()} AMD`)
    .join('\n');

  const text = `🆕 *New Order — ${businessName}*

📦 *Items:*
${itemLines}

💰 *Total:* ${Number(order.totalPrice).toLocaleString()} AMD
📞 *Phone:* ${order.customerPhone}
📍 *Address:* ${order.deliveryAddress}
🆔 *Order ID:* \`${orderId}\`

_Received via FastClose AI_`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}
