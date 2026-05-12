import { openai, buildSystemPrompt, extractPhoneNumber } from '@/lib/openai';
import { getRelevantContext } from '@/lib/rag';
import { createAdminClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';

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

  const lastUserMessage = [...messages].reverse()
    .find((m: { role: string; content: string }) => m.role === 'user')?.content ?? '';

  const { contextText } = await getRelevantContext(lastUserMessage, businessId);
  const systemPrompt = buildSystemPrompt(business.name, contextText);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    temperature: 0.4,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  });

  // Lead capture (non-blocking)
  const allUserText = messages.filter((m: { role: string }) => m.role === 'user')
    .map((m: { content: string }) => m.content).join(' ');
  const phone = extractPhoneNumber(allUserText);
  if (phone) {
    const summary = messages.slice(-6)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n');
    supabase.from('leads').upsert(
      { business_id: businessId, client_phone: phone, chat_summary: summary },
      { onConflict: 'business_id,client_phone' }
    ).then(({ error }) => { if (error) console.error('[Lead]', error.message); });
  }

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
