import { prisma } from '@/lib/prisma';
import { extractPhoneNumber } from '@/lib/openai';
import {
  getOrCreateSession,
  handleAgentMessage,
  persistOrder,
  updateSession,
} from '@/lib/agent';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { businessId: string } }) {
  const { businessId } = params;
  const body = await req.json();
  const message = body?.message;
  if (!message?.text) return Response.json({ ok: true });

  const chatId: number = message.chat.id;
  const userText: string = message.text;
  const externalKey = String(chatId);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, systemPrompt: true },
  });
  if (!business) return Response.json({ ok: true });

  const bot = await prisma.telegramBot.findUnique({
    where: { businessId },
    select: { botToken: true, ownerChatId: true },
  });
  if (!bot) return Response.json({ ok: true });

  const token = bot.botToken;

  if (!bot.ownerChatId) {
    await prisma.telegramBot.update({
      where: { businessId },
      data: { ownerChatId: externalKey },
    });
  }

  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });

  const session = await getOrCreateSession(businessId, 'telegram', externalKey);
  const history = [...session.messages, { role: 'user' as const, content: userText }];
  const recentHistory = history.slice(-14);

  const result = await handleAgentMessage({
    businessId,
    businessName: business.name,
    customPrompt: business.systemPrompt,
    session,
    chatMessages: recentHistory,
    lastUserMessage: userText,
    channel: 'telegram',
  });

  const updatedHistory = [...recentHistory, { role: 'assistant' as const, content: result.reply }].slice(-20);
  await updateSession(session.id, businessId, { messages: updatedHistory });

  if (result.orderReady) {
    try {
      await persistOrder(businessId, business.name, result.orderReady);
    } catch (e) {
      console.error('[TG Order] error:', e);
    }
  }

  const phone = result.session.customerPhone ?? extractPhoneNumber(userText);
  if (phone) {
    await prisma.lead.upsert({
      where: { businessId_clientPhone: { businessId, clientPhone: phone } },
      update: { chatSummary: `[Telegram]\n${updatedHistory.map(m => `${m.role}: ${m.content}`).join('\n')}` },
      create: { businessId, clientPhone: phone, chatSummary: `[Telegram]\nuser: ${userText}` },
    });
  }

  const chunks = result.reply.match(/[\s\S]{1,4000}/g) ?? [result.reply];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown' }),
    });
  }

  return Response.json({ ok: true });
}
