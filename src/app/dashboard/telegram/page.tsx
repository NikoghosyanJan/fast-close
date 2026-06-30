'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Send, CheckCircle2, AlertCircle, Loader2, Trash2, ExternalLink } from 'lucide-react';

interface TelegramBot {
  id: string;
  bot_token: string;
  bot_username: string | null;
  webhook_set: boolean;
}

export default function TelegramPage() {
  const [bot, setBot] = useState<TelegramBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchBot = async () => {
    setLoading(true);
    const res = await fetch('/api/telegram/bot');
    const data = await res.json();
    setBot(data.bot ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchBot(); }, []);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    const res = await fetch('/api/telegram/bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (res.ok) {
      setBot(data.bot);
      setToken('');
      toast.success(`Bot @${data.bot.bot_username} connected!`);
    } else {
      toast.error(data.error ?? 'Failed to connect bot');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove Telegram bot? This will also delete the webhook.')) return;
    setDeleting(true);
    const res = await fetch('/api/telegram/bot', { method: 'DELETE' });
    if (res.ok) {
      setBot(null);
      toast.success('Telegram bot removed');
    } else {
      toast.error('Failed to remove bot');
    }
    setDeleting(false);
  };
  console.log(bot, 'bot')
  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Telegram Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect a Telegram bot — it'll use the same AI + RAG as your web chat widget.</p>
      </div>

      {/* How it works */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">How to create a Telegram bot</h2>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Open Telegram and search for <strong className="text-foreground">@BotFather</strong></li>
          <li>Send <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/newbot</code> and follow the steps</li>
          <li>Copy the bot token (looks like <code className="bg-muted px-1.5 py-0.5 rounded text-xs">123456:ABC-DEF...</code>)</li>
          <li>Paste it below — the webhook is set automatically</li>
        </ol>
        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
          Open BotFather <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {bot ? (
        /* Connected state */
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">@{bot.bot_username ?? 'Unknown'}</p>
              <div className="flex items-center gap-1.5 text-xs">
                {bot.webhook_set ? (
                  <><CheckCircle2 className="w-3 h-3 text-green-500" /><span className="text-green-600">Webhook active</span></>
                ) : (
                  <><AlertCircle className="w-3 h-3 text-amber-500" /><span className="text-amber-600">Webhook not set</span></>
                )}
              </div>
            </div>
          </div>

          <div className="bg-muted rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Bot token (masked)</p>
            <p className="text-sm font-mono">{bot.bot_token.slice(0, 10)}••••••••••••••••</p>
          </div>

          <div className="flex gap-2">
            <a href={`https://t.me/${bot.bot_username}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition">
              <Send className="w-4 h-4" /> Open Bot
            </a>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 border border-destructive text-destructive px-4 py-2 rounded-xl text-sm font-medium hover:bg-destructive/10 transition disabled:opacity-50">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove Bot
            </button>
          </div>
        </div>
      ) : (
        /* Connect form */
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Connect your bot</h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bot Token</label>
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="123456789:ABCDEFghijklmnop-qrstuvwxyz"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button onClick={handleSave} disabled={saving || !token.trim()}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition shadow-md shadow-primary/25">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Send className="w-4 h-4" /> Connect Bot</>}
          </button>
        </div>
      )}
    </div>
  );
}
