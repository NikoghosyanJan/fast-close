import { getMyBusiness } from '@/lib/auth-actions';
import { createSupabaseServerClient } from '@/lib/supabase';
import Link from 'next/link';
import { Package, Users, Send, ArrowRight, MessageSquare } from 'lucide-react';

export default async function DashboardPage() {
  const business = await getMyBusiness();
  const supabase = createSupabaseServerClient();

  let productCount = 0;
  let leadCount = 0;
  let hasTelegramBot = false;

  if (business) {
    const [{ count: pc }, { count: lc }, { data: tg }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', business.id),
      supabase.from('telegram_bots').select('id').eq('business_id', business.id).single(),
    ]);
    productCount = pc ?? 0;
    leadCount = lc ?? 0;
    hasTelegramBot = !!tg;
  }

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="text-3xl font-extrabold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Welcome!</h1>
        <p className="text-muted-foreground">Your business profile is being set up. Please refresh in a moment.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Products / Services', value: productCount, icon: Package, href: '/dashboard/products', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Captured Leads', value: leadCount, icon: Users, href: '/dashboard/leads', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Telegram Bot', value: hasTelegramBot ? 'Active' : 'Not set', icon: Send, href: '/dashboard/telegram', color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
          {business.name}
        </h1>
        <p className="text-muted-foreground mt-1">Here's your AI sales agent overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 ${bg} ${color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            <Package className="w-4 h-4" /> Manage Products
          </Link>
          <Link
            href={`/chat/${business.id}`}
            target="_blank"
            className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition"
          >
            <MessageSquare className="w-4 h-4" /> Open Chat Widget
          </Link>
          <Link
            href="/dashboard/telegram"
            className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition"
          >
            <Send className="w-4 h-4" /> {hasTelegramBot ? 'Manage Telegram' : 'Connect Telegram'}
          </Link>
        </div>
      </div>

      {/* Chat widget URL */}
      <div className="bg-accent/50 border border-accent rounded-2xl p-5">
        <p className="text-sm font-medium text-accent-foreground mb-1">Your chat widget URL</p>
        <code className="text-xs bg-background rounded-lg px-3 py-2 block border border-border">
          {process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/chat/{business.id}
        </code>
        <p className="text-xs text-muted-foreground mt-2">Embed this in your website or share it directly with customers.</p>
      </div>
    </div>
  );
}
