import { createAdminClient } from '@/lib/supabase';
import { openai, buildSystemPrompt, extractPhoneNumber } from '@/lib/openai';
import { getRelevantContext } from '@/lib/rag';
import { NextRequest } from 'next/server';

// Telegram sends updates to this webhook endpoint
export async function POST(req: NextRequest, { params }: { params: { businessId: string } }) {
  const { businessId } = params;
  const body = await req.json();

  // Only handle text messages
  const message = body?.message;
  if (!message?.text) return Response.json({ ok: true });

  const chatId = message.chat.id;
  const userText: string = message.text;

  const admin = createAdminClient();

  // Get business + bot token
  const { data: business } = await admin.from('businesses').select('id, name, system_prompt').eq('id', businessId).single();
  if (!business) return Response.json({ ok: true });

  const { data: botRow } = await admin.from('telegram_bots').select('bot_token').eq('business_id', businessId).single();
  if (!botRow) return Response.json({ ok: true });

  const token = botRow.bot_token;

  // Send "typing..." action
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // RAG context
  const { contextText } = await getRelevantContext(userText, businessId);
  const systemPrompt = buildSystemPrompt(business.name, contextText);

  // Call GPT
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
  });

  const reply = completion.choices[0].message.content ?? "Sorry, I couldn't process that.";

  // Send reply to Telegram
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'Markdown' }),
  });

  // Lead capture — check for phone number
  const phone = extractPhoneNumber(userText);
  if (phone) {
    await admin.from('leads').upsert(
      {
        business_id: businessId,
        client_phone: phone,
        chat_summary: `[Telegram] user: ${userText}\nassistant: ${reply}`,
      },
      { onConflict: 'business_id,client_phone' }
    );
  }

  return Response.json({ ok: true });
}
