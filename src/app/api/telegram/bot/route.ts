import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app';

async function setWebhook(token: string, businessId: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `${APP_URL}/api/telegram/webhook/${businessId}`, allowed_updates: ['message'] }),
  });
  return res.json();
}

async function getBotInfo(token: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return res.json();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await prisma.business.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!business) return Response.json({ bot: null });
  const bot = await prisma.telegramBot.findUnique({ where: { businessId: business.id } });
  return Response.json({ bot });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await prisma.business.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { token } = await req.json();
  if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

  const botInfo = await getBotInfo(token);
  if (!botInfo.ok) return Response.json({ error: 'Invalid bot token' }, { status: 400 });

  const webhookResult = await setWebhook(token, business.id);

  const bot = await prisma.telegramBot.upsert({
    where: { businessId: business.id },
    update: { botToken: token, botUsername: botInfo.result.username, webhookSet: webhookResult.ok },
    create: { businessId: business.id, botToken: token, botUsername: botInfo.result.username, webhookSet: webhookResult.ok },
  });

  return Response.json({ bot });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await prisma.business.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const bot = await prisma.telegramBot.findUnique({ where: { businessId: business.id } });
  if (bot) {
    await fetch(`https://api.telegram.org/bot${bot.botToken}/deleteWebhook`);
    await prisma.telegramBot.delete({ where: { businessId: business.id } });
  }
  return Response.json({ success: true });
}
