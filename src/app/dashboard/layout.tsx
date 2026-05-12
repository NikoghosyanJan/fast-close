import { getProfile, getMyBusiness, signOut } from '@/lib/auth-actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Zap, LayoutDashboard, Package, Users, Send, LogOut, ExternalLink } from 'lucide-react';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const business = await getMyBusiness();

  if (!profile) redirect('/auth/login');

  const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/products', label: 'Products', icon: Package },
    { href: '/dashboard/leads', label: 'Leads', icon: Users },
    { href: '/dashboard/telegram', label: 'Telegram Bot', icon: Send },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-card flex flex-col fixed h-full z-20">
        <div className="px-5 py-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
              FastClose<span className="text-primary"> AI</span>
            </span>
          </Link>
        </div>

        {business && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">Your business</p>
            <p className="font-semibold text-sm truncate">{business.name}</p>
            <Link
              href={`/chat/${business.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
            >
              Open chat widget <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}

          {profile.role === 'superadmin' && (
            <Link
              href="/superadmin"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors mt-4"
            >
              <Zap className="w-4 h-4" />
              Superadmin
            </Link>
          )}
        </nav>

        <div className="px-3 pb-4 border-t border-border pt-3">
          <div className="px-3 py-1.5 mb-2">
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-medium">
              {profile.role}
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
