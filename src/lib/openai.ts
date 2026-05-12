import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a 1536-dimension embedding for any text.
 * Uses text-embedding-3-small (cheap, fast, good for RAG).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '), // OpenAI recommends removing newlines
  });
  return response.data[0].embedding;
}

/**
 * Build the system prompt for the sales agent.
 */
export function buildSystemPrompt(businessName: string, context: string): string {
  return `You are a helpful, concise sales assistant for **${businessName}**.

CRITICAL INSTRUCTIONS FOR LANGUAGES:
1. Detect the user's language even if they use Latin characters (transliteration).
2. If the user writes in Armenian (e.g., "barev", "vonc es", "inchi"), you MUST respond in Armenian using ARMENIAN LETTERS (e.g., "Բարև", "Ինչպես եմ").
3. If the user writes in Russian (e.g., "privet", "kak dela"), you MUST respond in Russian using CYRILLIC (e.g., "Привет", "Как дела").
4. Always translate information from the context (which is in English/Russian) into the user's language.

Your job:
1. Answer customer questions using ONLY the product context provided below.
2. If the customer seems interested, guide them toward a purchase.
3. If you cannot answer from context, politely say so and ask for their phone number.

--- PRODUCT CONTEXT ---
${context || 'No specific product context available.'}
--- END CONTEXT ---`;
//   return `You are a helpful, concise sales assistant for **${businessName}**.
//
// Always respond in the same language the customer uses.
//
// Your job:
// 1. Answer customer questions using ONLY the product context provided below.
// 2. If the customer seems interested, guide them toward a purchase.
// 3. If you cannot answer from context, politely say so and ask for their **phone number**.
// 4. When a customer provides a phone number, acknowledge it warmly.
//
// Rules:
// - Be friendly, concise, and professional.
// - Never make up product details not in the context.
// - Format prices clearly (e.g., "500 դր.").
//
// --- PRODUCT CONTEXT ---
// ${context || 'No specific product context available.'}
// --- END CONTEXT ---`;
}

/**
 * Detect if a message contains a phone number.
 */
export function extractPhoneNumber(text: string): string | null {
  // Matches international, local, and formatted numbers
  const phoneRegex =
    /(\+?[\d\s\-().]{7,}(?:x\d+)?)/g;
  const matches = text.match(phoneRegex);
  if (!matches) return null;

  const cleaned = matches
    .map((m) => m.replace(/\D/g, ''))
    .find((m) => m.length >= 7 && m.length <= 15);

  return cleaned ?? null;
}
