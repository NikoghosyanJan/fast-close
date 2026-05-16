import { openai, buildSystemPrompt, extractPhoneNumber } from '@/lib/openai';
import { getRelevantContext, getAllProducts } from '@/lib/rag';
import { createAdminClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Keywords that mean "show me everything you have"
const CATALOG_INTENT_PATTERNS = [
  /what (do you have|can you offer|products|items|services)/i,
  /show (me|us) (everything|all|your products|your items)/i,
  /list (your |all |the )?(products|items|services|catalog)/i,
  /what('s| is) (available|in stock|on offer)/i,
  /ի՞նչ ունե/i,          // Armenian: "what do you have"
  /ի՞նչ կա/i,            // Armenian: "what is there"
  /что у вас/i,           // Russian: "what do you have"
  /что есть/i,            // Russian: "what is there"
  /покажите все/i,        // Russian: "show everything"
  /inchi uni/i,           // Armenian transliteration
  /inchi ka/i,
  /chto u vas/i,          // Russian transliteration
];

function isCatalogRequest(message: string): boolean {
  return CATALOG_INTENT_PATTERNS.some((p) => p.test(message));
}
async function saveLead(
  supabase: ReturnType<typeof import('@/lib/supabase').createAdminClient>,
  businessId: string,
  messages: { role: string; content: string }[]
) {
  const allUserText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  const phone = extractPhoneNumber(allUserText);

  // Debug: log what we're working with
  console.log('[Lead] scanning text:', allUserText.slice(0, 200));
  console.log('[Lead] extracted phone:', phone);

  if (!phone) return;

  const summary = messages
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const { error } = await supabase
    .from('leads')
    .upsert(
      { business_id: businessId, client_phone: phone, chat_summary: summary },
      { onConflict: 'business_id,client_phone' }
    );

  if (error) {
    console.error('[Lead] upsert failed:', error.message, error.details);
  } else {
    console.log('[Lead] saved successfully for phone:', phone);
  }
}

export async function POST(req: NextRequest) {
  const { messages, businessId } = await req.json();
  if (!businessId) return new Response('Missing businessId', { status: 400 });

  const supabase = createAdminClient();

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, system_prompt')
    .eq('id', businessId)
    .single();

  if (bizError || !business) return new Response('Business not found', { status: 404 });

  const lastUserMessage: string = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === 'user')?.content ?? '';

  // Smart retrieval: if user wants catalog → return all products
  // Otherwise → vector similarity search with conversation context
  const { contextText } =
    isCatalogRequest(lastUserMessage)
      ? await getAllProducts(businessId)
      : await getRelevantContext(lastUserMessage, businessId, 8, messages);

  const systemPrompt = buildSystemPrompt(
    business.name,
    contextText,
    business.system_prompt
  );

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    temperature: 0.2,  // Low = factual, minimal hallucination
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  });

  // Lead capture — scan all user messages for phone number (non-blocking)
  await saveLead(supabase, businessId, messages);


  const stream = OpenAIStream(response as any);
  return new StreamingTextResponse(stream);
}
