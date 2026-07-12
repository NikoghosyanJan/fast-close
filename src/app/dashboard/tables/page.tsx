'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, RefreshCw, QrCode, Copy, ExternalLink,
  Pencil, Check, X, Armchair,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface TableRow {
  id: string;
  name: string;
  number: number;
  active: boolean;
  createdAt: string;
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [qrTableId, setQrTableId] = useState<string | null>(null);

  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || '');

  const fetchTables = async () => {
    setLoading(true);
    const [tablesRes, bizRes] = await Promise.all([
      fetch('/api/tables'),
      fetch('/api/business/settings'),
    ]);
    const tablesData = await tablesRes.json();
    const bizData = await bizRes.json();
    setTables(tablesData.tables ?? []);
    if (bizData.business?.id) setBusinessId(bizData.business.id);
    setLoading(false);
  };

  useEffect(() => { fetchTables(); }, []);

  const tableUrl = (tableId: string) =>
    businessId ? `${appUrl}/chat/${businessId}/table/${tableId}` : '';

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          number: newNumber ? parseInt(newNumber, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Table created');
        setNewName('');
        setNewNumber('');
        setShowAdd(false);
        await fetchTables();
      } else {
        toast.error(data.error || 'Failed to create table');
      }
    });
  };

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          number: parseInt(editNumber, 10),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Table updated');
        setEditId(null);
        await fetchTables();
      } else {
        toast.error(data.error || 'Update failed');
      }
    });
  };

  const handleToggleActive = (t: TableRow) => {
    startTransition(async () => {
      const res = await fetch(`/api/tables/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !t.active }),
      });
      if (res.ok) {
        setTables(prev => prev.map(x => x.id === t.id ? { ...x, active: !t.active } : x));
        toast.success(t.active ? 'Table deactivated' : 'Table activated');
      } else {
        toast.error('Failed to update');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this table? Existing orders keep their table label.')) return;
    startTransition(async () => {
      const res = await fetch(`/api/tables/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTables(prev => prev.filter(t => t.id !== id));
        if (qrTableId === id) setQrTableId(null);
        toast.success('Table deleted');
      } else {
        toast.error('Failed to delete');
      }
    });
  };

  const copyUrl = async (tableId: string) => {
    const url = tableUrl(tableId);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  const selected = tables.find(t => t.id === qrTableId);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>
            Tables
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create café tables and print QR codes. Guests scan to order with your AI waiter — no phone or address needed.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTables} disabled={loading}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> Add table
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm">New table</p>
          <div className="flex flex-wrap gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name (e.g. Table 5, Terrace A)"
              className="flex-1 min-w-[200px] border border-border rounded-xl px-3 py-2 text-sm bg-background"
            />
            <input
              value={newNumber}
              onChange={e => setNewNumber(e.target.value)}
              placeholder="Number (auto)"
              type="number"
              min={1}
              className="w-28 border border-border rounded-xl px-3 py-2 text-sm bg-background"
            />
            <button onClick={handleAdd} disabled={isPending || !newName.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              Create
            </button>
            <button onClick={() => setShowAdd(false)}
              className="border border-border px-4 py-2 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-3">
          {loading ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground text-sm">
              Loading tables…
            </div>
          ) : tables.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Armchair className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No tables yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first table to generate a QR code for dine-in ordering.
              </p>
            </div>
          ) : (
            tables.map(t => (
              <div key={t.id}
                className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${
                  qrTableId === t.id ? 'border-primary' : 'border-border'
                } ${!t.active ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-sm">
                  {t.number}
                </div>
                <div className="flex-1 min-w-0">
                  {editId === t.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="border border-border rounded-lg px-2 py-1 text-sm bg-background flex-1 min-w-[140px]" />
                      <input value={editNumber} onChange={e => setEditNumber(e.target.value)} type="number" min={1}
                        className="border border-border rounded-lg px-2 py-1 text-sm bg-background w-20" />
                      <button onClick={() => handleSaveEdit(t.id)} className="text-primary p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground p-1"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.active ? 'Active' : 'Inactive'} · #{t.number}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQrTableId(t.id)} title="Show QR"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button onClick={() => copyUrl(t.id)} title="Copy link"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Copy className="w-4 h-4" />
                  </button>
                  {businessId && (
                    <a href={tableUrl(t.id)} target="_blank" rel="noreferrer" title="Open chat"
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => {
                    setEditId(t.id);
                    setEditName(t.name);
                    setEditNumber(String(t.number));
                  }} title="Edit"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(t)} title={t.active ? 'Deactivate' : 'Activate'}
                    className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted">
                    {t.active ? 'Off' : 'On'}
                  </button>
                  <button onClick={() => handleDelete(t.id)} title="Delete"
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-8">
          <p className="font-semibold text-sm mb-3">QR code</p>
          {selected && businessId ? (
            <div className="space-y-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/tables/${selected.id}/qr`}
                alt={`QR for ${selected.name}`}
                className="w-full max-w-[220px] mx-auto rounded-xl border border-border bg-card"
              />
              <p className="font-medium text-sm">{selected.name}</p>
              <p className="text-xs text-muted-foreground break-all">{tableUrl(selected.id)}</p>
              <a
                href={`/api/tables/${selected.id}/qr`}
                download={`table-${selected.number}-qr.png`}
                className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium"
              >
                Download PNG
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select a table’s QR icon to preview and download the code for printing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
