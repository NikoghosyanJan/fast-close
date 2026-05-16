import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a 1536-dim embedding.
 * We enrich the text before embedding so similarity search works better.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').trim(),
  });
  return response.data[0].embedding;
}

/**
 * Build a rich embedding string for a product.
 * Include all fields so queries like "cheap keyboard" or "blue headphones" match.
 */
export function buildProductEmbeddingText(product: {
  name: string;
  description?: string | null;
  price?: number | null;
  metadata?: Record<string, unknown>;
}): string {
  const parts = [product.name];
  if (product.description) parts.push(product.description);
  if (product.price != null) parts.push(`price ${product.price}`);
  if (product.metadata && Object.keys(product.metadata).length) {
    const metaStr = Object.entries(product.metadata)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(metaStr);
  }
  return parts.join('. ');
}

/**
 * System prompt — strict, multilingual, grounded.
 */
export function buildSystemPrompt(
  businessName: string,
  context: string,
  customPrompt?: string | null
): string {
  const persona = customPrompt?.trim()
    || `You are a helpful sales assistant for ${businessName}.`;

  return `${persona}

===== LANGUAGE INSTRUCTIONS =====
You MUST reply in the same language the customer is writing in.
- If they write in Armenian script (Բ, Հ, etc.) → reply in Armenian
- If they write in Armenian transliteration (barev, vonc, inch, ko, du, yes, mer, vor, kam, chi, ha, te) → reply in Armenian script
- If they write in Russian Cyrillic (П, С, etc.) → reply in Russian
- If they write in Russian transliteration (privet, kak, skolko, est, net, da, nyet, chto, gde) → reply in Russian Cyrillic
- If they write in English → reply in English
Translate ALL product info from the catalog into the customer's language when answering.

===== BEHAVIOR RULES =====
1. You are a product expert. Answer questions about products confidently using the catalog below.
2. If asked "what do you have" or "show me products" — list ALL products from the catalog below, briefly.
3. If asked about a specific product — give full details: name, price, description.
4. If a product exists in the catalog but the customer asks about it in a different way (e.g. transliteration or another language) — still answer correctly.
5. NEVER say "I don't have information" if the product IS in the catalog below. Read it carefully.
6. Only say you can't help if the topic is completely outside the catalog. Then ask for their phone number.
7. Be friendly, short, and clear. No long paragraphs.

===== PRODUCT CATALOG =====
${context || 'The catalog is currently empty. Ask for the customer\'s phone number so a specialist can help.'}
===== END OF CATALOG =====`;
}

/**
 * Detect phone number in text.
 */
export function extractPhoneNumber(text: string): string | null {
  // Must start with optional + then a digit, end with a digit.
  // Allows spaces, dashes, dots, parentheses in between.
  const phoneRegex = /\+?[\d][\d\s\-().]{5,}[\d]/g;
  const matches = text.match(phoneRegex);
  if (!matches) return null;

  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return digits; // return normalized digits-only string
    }
  }
  return null;
}