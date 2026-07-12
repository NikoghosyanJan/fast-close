'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, X, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartItem } from '@/lib/agent/types';

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  busy?: boolean;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateNotes: (productId: string, notes: string) => void;
  onRemove: (productId: string) => void;
}

export default function CartSheet({
  open,
  onClose,
  items,
  total,
  busy,
  onUpdateQuantity,
  onUpdateNotes,
  onRemove,
}: CartSheetProps) {
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setEditingNotesId(null);
      setDraftNotes('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const startEditNotes = (item: CartItem) => {
    setEditingNotesId(item.productId);
    setDraftNotes(item.notes ?? '');
  };

  const saveNotes = (productId: string) => {
    onUpdateNotes(productId, draftNotes.trim());
    setEditingNotesId(null);
    setDraftNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close cart"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-sheet-title"
        className="relative z-10 flex max-h-[85svh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
          <div>
            <h2 id="cart-sheet-title" className="text-base font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              Your order
            </h2>
            <p className="text-xs text-muted-foreground">
              {items.length === 0
                ? 'Cart is empty'
                : `${items.reduce((s, i) => s + i.quantity, 0)} item${items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Ask the waiter to add something from the menu.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map(item => (
                <li
                  key={item.productId}
                  className="rounded-xl border border-border/70 bg-background px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.unitPrice.toLocaleString()} AMD each
                      </p>
                      {item.notes && editingNotesId !== item.productId && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {(item.unitPrice * item.quantity).toLocaleString()} AMD
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border bg-card">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label="Decrease quantity"
                        onClick={() =>
                          item.quantity <= 1
                            ? onRemove(item.productId)
                            : onUpdateQuantity(item.productId, item.quantity - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center text-foreground disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={busy || item.quantity >= 99}
                        aria-label="Increase quantity"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-foreground disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEditNotes(item)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition',
                        item.notes
                          ? 'border-primary/30 bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                      {item.notes ? 'Edit note' : 'Add note'}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemove(item.productId)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {editingNotesId === item.productId && (
                    <div className="mt-3 space-y-2">
                      <input
                        autoFocus
                        value={draftNotes}
                        onChange={e => setDraftNotes(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveNotes(item.productId);
                          if (e.key === 'Escape') {
                            setEditingNotesId(null);
                            setDraftNotes('');
                          }
                        }}
                        maxLength={500}
                        placeholder="e.g. no onion, extra sauce…"
                        disabled={busy}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveNotes(item.productId)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Save note
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingNotesId(null);
                            setDraftNotes('');
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-primary tabular-nums">
              {total.toLocaleString()} AMD
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {items.length > 0 ? 'Continue chatting' : 'Back to chat'}
          </button>
          {items.length > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Tell the waiter when you&apos;re ready to confirm the order.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
