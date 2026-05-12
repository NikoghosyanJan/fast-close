import { getProfile, signOut } from '@/lib/auth-actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Zap, Building2, LogOut, LayoutDashboard } from 'lucide-react';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'superadmin') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 border-r border-border bg-card flex flex-col fixed h-full z-20">
        <div className="px-5 py-4 border-b border-border">
          <Link href="/superadmin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
              Super<span className="text-amber-500">admin</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link href="/superadmin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Building2 className="w-4 h-4" /> Businesses & Leads
          </Link>
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <LayoutDashboard className="w-4 h-4" /> My Dashboard
          </Link>
        </nav>
        <div className="px-3 pb-4 border-t border-border pt-3">
          <p className="px-3 py-1 text-xs text-muted-foreground truncate">{profile.email}</p>
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 ml-60 p-8">{children}</main>
    </div>
  );
}
