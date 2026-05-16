import { createAdminClient } from '@/lib/supabase';
import { openai, buildSystemPrompt } from '@/lib/openai';
import { getRelevantContext } from '@/lib/rag';
import { NextRequest } from 'next/server';

// ── Fixed extractPhoneNumber (same fix as chat/route.ts) ──────
// Old regex matched pure whitespace/punctuation — now requires
// the match to start AND end with a digit.
function extractPhoneNumber(text: string): string | null {
  const phoneRegex = /\+?[\d][\d\s\-().]{5,}[\d]/g;
  const matches = text.match(phoneRegex);
  if (!matches) return null;
  for (const match of matches) {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return digits;
    }
  }
  return null;
}

// In-memory store for Telegram conversation history (per chat_id)
// For production, store this in Redis or Supabase
const conversationHistory = new Map<number, { role: 'user' | 'assistant'; content: string }[]>();

export async function POST(req: NextRequest, { params }: { params: { businessId: string } }) {
  const { businessId } = params;
  const body = await req.json();

  const message = body?.message;
  if (!message?.text) return Response.json({ ok: true });

  const chatId: number = message.chat.id;
  const userText: string = message.text;

  const admin = createAdminClient();

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, system_prompt')
    .eq('id', businessId)
    .single();
  if (!business) return Response.json({ ok: true });

  const { data: botRow } = await admin
    .from('telegram_bots')
    .select('bot_token')
    .eq('business_id', businessId)
    .single();
  if (!botRow) return Response.json({ ok: true });

  const token = botRow.bot_token;

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  // Build conversation history for this chat
  const history = conversationHistory.get(chatId) ?? [];
  history.push({ role: 'user', content: userText });

  // Keep last 10 messages to avoid token overflow
  const recentHistory = history.slice(-10);

  // RAG on the latest user message
  const { contextText } = await getRelevantContext(userText, businessId);
  const systemPrompt = buildSystemPrompt(business.name, contextText, business.system_prompt);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
    ],
  });

  const reply = completion.choices[0].message.content ?? "Sorry, I couldn't process that.";

  // Save assistant reply to history
  history.push({ role: 'assistant', content: reply });
  conversationHistory.set(chatId, history.slice(-20));

  // Send reply — split if over Telegram's 4096 char limit
  const chunks = reply.match(/[\s\S]{1,4000}/g) ?? [reply];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown' }),
    });
  }

  // ── Fixed lead capture ────────────────────────────────────────
  // Scan ALL user messages in history, not just the current one.
  // A user might have sent their number 2-3 messages ago.
  const allUserText = recentHistory
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  const phone = extractPhoneNumber(allUserText);

  console.log('[Telegram Lead] scanning:', allUserText.slice(0, 200));
  console.log('[Telegram Lead] extracted phone:', phone);

  if (phone) {
    const summary = recentHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const { error } = await admin.from('leads').upsert(
      {
        business_id: businessId,
        client_phone: phone,
        chat_summary: `[Telegram]\n${summary}`,
      },
      { onConflict: 'business_id,client_phone' }
    );

    if (error) {
      console.error('[Telegram Lead] upsert failed:', error.message, error.details);
    } else {
      console.log('[Telegram Lead] saved successfully:', phone);
    }
  }

  return Response.json({ ok: true });
}