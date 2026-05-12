import { createSupabaseServerClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';
import { Users, Package, Phone, Building2 } from 'lucide-react';

export default async function SuperadminPage() {
  const admin = createAdminClient();

  const [{ data: businesses }, { data: leads }, { data: profiles }] = await Promise.all([
    admin.from('businesses').select('*, profiles(email), products(count), leads(count)').order('created_at', { ascending: false }),
    admin.from('leads').select('*, businesses(name)').order('created_at', { ascending: false }).limit(20),
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
  ]);

  const stats = [
    { label: 'Total Businesses', value: businesses?.length ?? 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Users', value: profiles?.length ?? 0, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Total Leads', value: leads?.length ?? 0, icon: Phone, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Superadmin</h1>
        <p className="text-muted-foreground text-sm mt-1">Full platform overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <div className={`w-9 h-9 ${bg} ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* All businesses */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">All Businesses</h2>
        </div>
        <div className="divide-y divide-border">
          {businesses?.map(b => (
            <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground">{(b.profiles as any)?.email ?? '—'}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Package className="w-3 h-3" />{(b.products as any)?.[0]?.count ?? 0} products</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{(b.leads as any)?.[0]?.count ?? 0} leads</span>
                <a href={`/chat/${b.id}`} target="_blank" className="text-primary hover:underline font-medium">Chat →</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent leads */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Recent Leads</h2>
          <span className="text-xs text-muted-foreground ml-auto">Last 20</span>
        </div>
        <div className="divide-y divide-border">
          {leads?.map(lead => (
            <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{lead.client_phone}</p>
                <p className="text-xs text-muted-foreground">{(lead.businesses as any)?.name}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* All users */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">All Users</h2>
        </div>
        <div className="divide-y divide-border">
          {profiles?.map(p => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between">
              <p className="text-sm">{p.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.role === 'superadmin' ? 'bg-amber-100 text-amber-700' : 'bg-accent text-accent-foreground'}`}>
                {p.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
