import { prisma } from '@/lib/prisma';
import { Building2, Users, Package, ShoppingBag } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function SuperadminPage() {
  const [businesses, users, orderCount] = await Promise.all([
    prisma.business.findMany({
      include: {
        user: { select: { email: true } },
        _count: { select: { products: true, orders: true, tables: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.order.count(),
  ]);

  const stats = [
    { label: 'Total Businesses', value: businesses.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Users', value: users.length, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Total Orders', value: orderCount, icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Superadmin</h1>
        <p className="text-muted-foreground text-sm mt-1">Full platform overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <div className={`w-9 h-9 ${bg} ${color} rounded-xl flex items-center justify-center mb-3`}><Icon className="w-4 h-4" /></div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">All Businesses</h2>
        </div>
        <div className="divide-y divide-border">
          {businesses.map(b => (
            <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.user.email}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Package className="w-3 h-3" />{b._count.products}</span>
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{b._count.orders}</span>
                <a href={`/chat/${b.id}`} target="_blank" className="text-primary hover:underline font-medium">Chat →</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">All Users</h2>
        </div>
        <div className="divide-y divide-border">
          {users.map(u => (
            <div key={u.id} className="px-5 py-3 flex items-center justify-between">
              <p className="text-sm">{u.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'SUPERADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-accent text-accent-foreground'}`}>
                {u.role.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
