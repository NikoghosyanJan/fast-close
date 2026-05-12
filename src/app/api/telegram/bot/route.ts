import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app';

async function setTelegramWebhook(token: string, businessId: string) {
  const webhookUrl = `${APP_URL}/api/telegram/webhook/${businessId}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
  });
  return res.json();
}

async function getBotInfo(token: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return res.json();
}

async function deleteTelegramWebhook(token: string) {
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
}

// GET — fetch current bot for the authenticated user's business
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ bot: null });

  const { data: bot } = await supabase.from('telegram_bots').select('*').eq('business_id', business.id).single();
  return Response.json({ bot: bot ?? null });
}

// POST — connect a new bot token
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { token } = await req.json();
  if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

  // Validate token and get bot info
  const botInfo = await getBotInfo(token);
  if (!botInfo.ok) return Response.json({ error: 'Invalid bot token. Check it in BotFather.' }, { status: 400 });

  // Set webhook
  const webhookResult = await setTelegramWebhook(token, business.id);

  const admin = createAdminClient();
  const { data: bot, error } = await admin.from('telegram_bots')
    .upsert({
      business_id: business.id,
      bot_token: token,
      bot_username: botInfo.result.username,
      webhook_set: webhookResult.ok,
    }, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ bot });
}

// DELETE — remove bot and webhook
export async function DELETE() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { data: bot } = await supabase.from('telegram_bots').select('bot_token').eq('business_id', business.id).single();
  if (bot) await deleteTelegramWebhook(bot.bot_token);

  const admin = createAdminClient();
  await admin.from('telegram_bots').delete().eq('business_id', business.id);
  return Response.json({ success: true });
}
