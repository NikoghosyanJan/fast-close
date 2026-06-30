import { extractPhoneNumber } from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import {
  getOrCreateSession,
  handleAgentMessageStream,
  persistOrder,
  type AgentStreamTurnCompleted,
} from '@/lib/agent';
import { NextRequest } from 'next/server';
import { StreamingTextResponse } from 'ai';
import { randomUUID } from 'crypto';
export const dynamic = 'force-dynamic';
type StreamTurnResult = AgentStreamTurnCompleted;

async function runPostTurnSideEffects(
  businessId: string,
  businessName: string,
  lastUserMessage: string,
  chatMessages: { role: string; content: string }[],
  result: StreamTurnResult
) {
  if (result.orderReady) {
    await persistOrder(businessId, businessName, result.orderReady);
  }

  const phone = result.session.customerPhone ?? extractPhoneNumber(lastUserMessage);
  if (phone) {
    const summary = chatMessages.slice(-4)
      .map(m => `${m.role}: ${m.content}`).join('\n');
    await prisma.lead.upsert({
      where: { businessId_clientPhone: { businessId, clientPhone: phone } },
      update: { chatSummary: summary },
      create: { businessId, clientPhone: phone, chatSummary: summary },
    });
  }
}

export async function POST(req: NextRequest) {
  const { messages, businessId, sessionId: clientSessionId } = await req.json();
  if (!businessId) return new Response('Missing businessId', { status: 400 });

  const sessionId = clientSessionId || randomUUID();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, systemPrompt: true },
  });
  if (!business) return new Response('Business not found', { status: 404 });

  const session = await getOrCreateSession(businessId, 'web', sessionId);

  const chatMessages = messages
    .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
    .map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const lastUserMessage = [...chatMessages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === 'user')
    ?.content ?? '';

  try {
    const { stream, completed } = await handleAgentMessageStream({
      businessId,
      businessName: business.name,
      customPrompt: business.systemPrompt,
      session,
      chatMessages,
      lastUserMessage,
      channel: 'web',
    });

    completed
      .then(result => runPostTurnSideEffects(
        businessId,
        business.name,
        lastUserMessage,
        chatMessages,
        result
      ))
      .catch(e => console.error('[Chat post-turn]', e));

    return new StreamingTextResponse(stream);
  } catch (e) {
    console.error('[Chat]', e);
    return new Response(
      'Sorry, something went wrong. Please try again.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
}
