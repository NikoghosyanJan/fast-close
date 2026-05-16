'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, Zap, Info } from 'lucide-react';

interface BusinessSettings {
  id: string;
  name: string;
  system_prompt: string | null;
}

const PROMPT_TEMPLATES = [
  {
    label: 'Retail store',
    value: `You are a friendly sales assistant for {business_name}.

Business info:
- Working hours: Mon–Sat 9:00–20:00, Sun 10:00–18:00
- Address: 123 Main Street, Yerevan
- Delivery: Free delivery on orders over 10,000 AMD, 1–2 business days
- Payment: Cash, card, online transfer
- Returns: Within 14 days with receipt

Help customers find the right product, answer questions about availability, pricing, and delivery. Always be polite and concise.`,
  },
  {
    label: 'Restaurant / café',
    value: `You are a helpful assistant for {business_name}.

Business info:
- Working hours: Daily 10:00–23:00
- Address: 45 Republic Square, Yerevan
- Reservations: Call +374 XX XXX XXX or write here
- Delivery: Via our website, 30–45 min
- Menu: Available on our website

Help customers with menu questions, reservations, and delivery orders.`,
  },
  {
    label: 'Service business',
    value: `You are a professional assistant for {business_name}.

Business info:
- Working hours: Mon–Fri 9:00–18:00
- Address: Yerevan, Armenia
- Consultations: Free initial consultation
- Response time: We reply within 2 hours during business hours

Answer questions about our services and pricing. For complex questions or to book an appointment, collect the customer's phone number.`,
  },
  {
    label: 'Online store',
    value: `You are a helpful sales assistant for {business_name}.

Business info:
- We operate 100% online — orders via website or this chat
- Delivery: Across Armenia in 1–3 business days, Yerevan same-day available
- Payment: Card, cash on delivery, bank transfer
- Returns: 14-day return policy, no questions asked
- Support: Available 9:00–21:00 daily

Help customers choose products, check availability, and place orders.`,
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/business/settings')
      .then(r => r.json())
      .then(data => {
        if (data.business) {
          setSettings(data.business);
          setName(data.business.name);
          setSystemPrompt(data.business.system_prompt ?? '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/business/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, system_prompt: systemPrompt }),
    });
    if (res.ok) {
      toast.success('Settings saved!');
    } else {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Business Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize how your AI agent presents your business to customers.
        </p>
      </div>

      {/* Business name */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold">Business Name</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your business name"
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* System prompt */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">AI Agent Instructions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Tell your AI agent who it is, your business hours, address, delivery info, policies — anything customers ask about.
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="flex gap-3 bg-accent/50 border border-accent rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            This prompt is added on top of the product catalog. Write in any language. The AI will use this info when customers ask about hours, location, delivery, returns, etc.
          </p>
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {PROMPT_TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => setSystemPrompt(t.value.replace('{business_name}', name || 'our business'))}
                className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted hover:border-primary/30 transition-colors font-medium"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={14}
          maxLength={500}
          placeholder={`Example:\nYou are a helpful assistant for ${name || 'our store'}.\n\nBusiness hours: Mon–Sat 9:00–20:00\nAddress: 123 Main St, Yerevan\nDelivery: Free over 10,000 AMD\nReturns: 14-day policy\n\nAlways be friendly and reply in the customer's language.`}
          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed font-mono"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {systemPrompt.length} characters
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition shadow-md shadow-primary/25"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save settings</>
            }
          </button>
        </div>
      </div>

      {/* Preview */}
      {systemPrompt && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">What your AI agent sees</h2>
          </div>
          <div className="bg-muted rounded-xl p-4 text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {systemPrompt}
            {'\n\n'}
            {'[+ your product catalog is automatically appended below this]'}
          </div>
        </div>
      )}
    </div>
  );
}