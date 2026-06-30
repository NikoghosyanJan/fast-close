'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Phone, MapPin, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
export const dynamic = 'force-dynamic';

interface OrderItem { name: string; quantity: number; price: number; }
interface Order {
  id: string;
  customerPhone: string;
  deliveryAddress: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'NEW' | 'CONFIRMED' | 'PREPARING' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
}

const STATUS_CONFIG = {
  NEW:       { label: 'New',       color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  PREPARING: { label: 'Preparing', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600',      dot: 'bg-red-500' },
};

const NEXT_STATUS: Record<string, string[]> = {
  NEW:       ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
      toast.success(`Order marked as ${STATUS_CONFIG[status as Order['status']].label}`);
    } else {
      toast.error('Failed to update status');
    }
    setUpdating(null);
  };

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);
  const newCount = orders.filter(o => o.status === 'NEW').length;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Orders
            {newCount > 0 && (
              <span className="text-sm bg-blue-500 text-white px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                {newCount} new
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} total orders · refreshes every 30s</p>
        </div>
        <button onClick={fetchOrders} disabled={loading}
          className="flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'NEW', 'CONFIRMED', 'PREPARING', 'DELIVERED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === s
                ? 'bg-primary text-white'
                : 'border border-border hover:bg-muted text-muted-foreground'
            }`}>
            {s === 'ALL' ? `All (${orders.length})` : `${STATUS_CONFIG[s as Order['status']].label} (${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
            Loading orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Orders placed through your AI agent will appear here.
            </p>
          </div>
        ) : (
          filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const nextStatuses = NEXT_STATUS[order.status];
            return (
              <div key={order.id} className={`bg-card border rounded-2xl p-5 space-y-4 ${
                order.status === 'NEW' ? 'border-blue-200 shadow-sm shadow-blue-100' : 'border-border'
              }`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">#{order.id.slice(-8)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />{order.customerPhone}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />{order.deliveryAddress}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-primary">{Number(order.totalPrice).toLocaleString()} AMD</p>
                    <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{item.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                      <span className="font-medium">{(Number(item.price) * item.quantity).toLocaleString()} AMD</span>
                    </div>
                  ))}
                </div>

                {/* Status actions */}
                {nextStatuses.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {nextStatuses.map(s => (
                      <button key={s} onClick={() => updateStatus(order.id, s)}
                        disabled={updating === order.id}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
                          s === 'CANCELLED'
                            ? 'border border-destructive text-destructive hover:bg-destructive/10'
                            : 'bg-primary text-white hover:opacity-90 shadow-sm shadow-primary/25'
                        }`}>
                        {updating === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Mark as {STATUS_CONFIG[s as Order['status']].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
