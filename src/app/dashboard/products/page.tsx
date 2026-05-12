'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Upload, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Bulk sync state
  const [showSync, setShowSync] = useState(false);
  const [syncInput, setSyncInput] = useState('');

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', description: '', price: '' });

  // New product form
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '' });

  const fetchProducts = async () => {
    setLoading(true);
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        toast.success('Product deleted');
      } else {
        toast.error('Failed to delete');
      }
    });
  };

  const handleEdit = (p: Product) => {
    setEditId(p.id);
    setEditData({ name: p.name, description: p.description ?? '', price: p.price?.toString() ?? '' });
  };

  const handleEditSave = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          description: editData.description,
          price: editData.price ? parseFloat(editData.price) : null,
        }),
      });
      if (res.ok) {
        await fetchProducts();
        setEditId(null);
        toast.success('Product updated & re-embedded');
      } else {
        toast.error('Update failed');
      }
    });
  };

  const handleAdd = () => {
    if (!newProduct.name.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          price: newProduct.price ? parseFloat(newProduct.price) : null,
        }),
      });
      if (res.ok) {
        await fetchProducts();
        setNewProduct({ name: '', description: '', price: '' });
        setShowAdd(false);
        toast.success('Product added & embedded');
      } else {
        toast.error('Failed to add product');
      }
    });
  };

  const handleBulkSync = () => {
    if (!syncInput.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: syncInput }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProducts();
        setSyncInput('');
        setShowSync(false);
        toast.success(`Synced ${data.synced} products`);
      } else {
        toast.error(data.error ?? 'Sync failed');
      }
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Products & Services</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} items · all searchable by your AI agent</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSync(!showSync)}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition"
          >
            <Upload className="w-4 h-4" />
            {showSync ? 'Hide' : 'Bulk Sync'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Bulk sync panel */}
      {showSync && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Bulk Sync (JSON or plain text)</h3>
            <button onClick={() => setShowSync(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <textarea
            value={syncInput}
            onChange={e => setSyncInput(e.target.value)}
            rows={8}
            placeholder={'[{"name": "Product A", "description": "...", "price": 99}]'}
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground">⚠️ This will replace ALL existing products for your business.</p>
          <button
            onClick={handleBulkSync}
            disabled={isPending || !syncInput.trim()}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Sync & Embed All
          </button>
        </div>
      )}

      {/* Add product form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">New Product</h3>
            <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))}
              placeholder="Product name *" className="col-span-2 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))}
              placeholder="Description" className="col-span-2 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={newProduct.price} onChange={e => setNewProduct(p => ({...p, price: e.target.value}))}
              type="number" placeholder="Price" className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={handleAdd} disabled={isPending || !newProduct.name.trim()}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add & Embed
          </button>
        </div>
      )}

      {/* Products list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading products…</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No products yet. Add one above or use Bulk Sync.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {products.map(p => (
              <div key={p.id} className="px-5 py-4">
                {editId === p.id ? (
                  <div className="space-y-2">
                    <input value={editData.name} onChange={e => setEditData(d => ({...d, name: e.target.value}))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <input value={editData.description} onChange={e => setEditData(d => ({...d, description: e.target.value}))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Description" />
                    <div className="flex items-center gap-2">
                      <input value={editData.price} onChange={e => setEditData(d => ({...d, price: e.target.value}))}
                        type="number" placeholder="Price" className="w-32 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      <button onClick={() => handleEditSave(p.id)} disabled={isPending}
                        className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditId(null)} className="flex items-center gap-1 border border-border px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {p.price != null && (
                        <span className="text-sm font-semibold text-primary">${Number(p.price).toFixed(2)}</span>
                      )}
                      <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} disabled={isPending}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
