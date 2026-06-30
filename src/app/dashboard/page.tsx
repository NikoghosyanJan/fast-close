import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Users, Send, ArrowRight, MessageSquare, ShoppingBag } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login');

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: {
      _count: { select: { products: true, leads: true, orders: true } },
      telegramBot: { select: { id: true } },
      orders: {
        where: { status: 'NEW' },
        select: { id: true },
        take: 10,
      },
    },
  });

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="text-3xl font-extrabold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Welcome!</h1>
        <p className="text-muted-foreground">Setting up your account… please refresh in a moment.</p>
      </div>
    );
  }

  const newOrdersCount = business.orders.length;

  const stats = [
    { label: 'Menu Items', value: business._count.products, icon: Package, href: '/dashboard/products', color: 'text-blue-600', bg: 'bg-blue-50' },
    {
      label: 'Orders',
      value: business._count.orders,
      badge: newOrdersCount > 0 ? `${newOrdersCount} new` : null,
      icon: ShoppingBag,
      href: '/dashboard/orders',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    { label: 'Captured Leads', value: business._count.leads, icon: Users, href: '/dashboard/leads', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Telegram Bot', value: business.telegramBot ? 'Active' : 'Not set', icon: Send, href: '/dashboard/telegram', color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>{business.name}</h1>
        <p className="text-muted-foreground mt-1">Your AI ordering agent overview.</p>
      </div>

      {newOrdersCount > 0 && (
        <Link href="/dashboard/orders" className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 hover:shadow-sm transition">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-800">
              {newOrdersCount} new order{newOrdersCount > 1 ? 's' : ''} waiting
            </p>
            <p className="text-xs text-blue-600">Tap to view and manage</p>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-500" />
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, badge, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 ${bg} ${color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold flex items-center gap-2">
              {value}
              {badge && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">{badge}</span>}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/products" className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition">
            <Package className="w-4 h-4" /> Manage Menu
          </Link>
          <Link href={`/chat/${business.id}`} target="_blank" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition">
            <MessageSquare className="w-4 h-4" /> Open Chat Widget
          </Link>
          <Link href="/dashboard/telegram" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition">
            <Send className="w-4 h-4" /> {business.telegramBot ? 'Manage Telegram' : 'Connect Telegram'}
          </Link>
          <Link href="/dashboard/orders" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition">
            <ShoppingBag className="w-4 h-4" /> View Orders
          </Link>
        </div>
      </div>

      <div className="bg-accent/50 border border-accent rounded-2xl p-5">
        <p className="text-sm font-medium text-accent-foreground mb-1">Your ordering widget URL</p>
        <code className="text-xs bg-background rounded-lg px-3 py-2 block border border-border">
          {process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/chat/{business.id}
        </code>
        <p className="text-xs text-muted-foreground mt-2">Share with customers or embed on your website.</p>
      </div>
    </div>
  );
}
