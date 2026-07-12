'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Zap, Loader2, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import CartSheet from './CartSheet';
import type { CartItem } from '@/lib/agent/types';

interface Props {
  business: { id: string; name: string };
  table?: { id: string; name: string; number: number };
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

function getOrCreateSessionId(businessId: string, tableId?: string): string {
  const key = tableId ? `fc_session_${businessId}_table_${tableId}` : `fc_session_${businessId}`;
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function ChatInterface({ business, table }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(() =>
    typeof window !== 'undefined' ? getOrCreateSessionId(business.id, table?.id) : ''
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartState>({ items: [], total: 0, itemCount: 0 });
  const [cartBusy, setCartBusy] = useState(false);

  const welcome = table
    ? `Welcome to **${business.name}**. You're seated at **${table.name}**. I'm your AI waiter — what would you like to order?`
    : `Welcome to **${business.name}**. I can help with the menu and take your order. What are you in the mood for?`;

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: {
      businessId: business.id,
      sessionId,
      ...(table ? { tableId: table.id } : {}),
    },
    streamProtocol: 'text',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: welcome,
      },
    ],
  });

  const fetchCart = useCallback(async () => {
    if (!sessionId) return;
    const params = new URLSearchParams({
      businessId: business.id,
      sessionId,
    });
    if (table?.id) params.set('tableId', table.id);

    try {
      const res = await fetch(`/api/chat/cart?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCart({
        items: Array.isArray(data.items) ? data.items : [],
        total: Number(data.total) || 0,
        itemCount: Number(data.itemCount) || 0,
      });
    } catch {
      /* ignore transient fetch errors */
    }
  }, [business.id, sessionId, table?.id]);

  const patchCart = useCallback(
    async (productId: string, patch: { quantity?: number; notes?: string | null }) => {
      if (!sessionId) return;
      setCartBusy(true);
      try {
        const res = await fetch('/api/chat/cart', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            sessionId,
            ...(table ? { tableId: table.id } : {}),
            productId,
            ...patch,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setCart({
            items: Array.isArray(data.items) ? data.items : [],
            total: Number(data.total) || 0,
            itemCount: Number(data.itemCount) || 0,
          });
        }
      } finally {
        setCartBusy(false);
      }
    },
    [business.id, sessionId, table]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Refresh cart after the agent finishes a turn (tools may have changed it)
  useEffect(() => {
    if (!isLoading) fetchCart();
  }, [isLoading, fetchCart, messages.length]);

  useEffect(() => {
    if (cartOpen) fetchCart();
  }, [cartOpen, fetchCart]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-shell flex h-[100svh] flex-col">
      <header className="z-10 border-b border-border/60 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {business.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="landing-dot inline-block h-1.5 w-1.5 rounded-sm bg-primary" />
              {table ? `${table.name} · AI waiter` : 'AI ordering · Online'}
            </p>
          </div>
          {table && (
            <span className="shrink-0 rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {table.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={cart.itemCount > 0 ? `Open cart, ${cart.itemCount} items` : 'Open cart'}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground transition hover:bg-muted"
          >
            <ShoppingBag className="h-4 w-4" />
            {cart.itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cart.itemCount > 99 ? '99+' : cart.itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-5">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const showTime = idx === messages.length - 1 || messages[idx + 1]?.role !== msg.role;

            return (
              <div
                key={msg.id}
                className={cn(
                  'chat-message-enter flex flex-col gap-1',
                  isUser ? 'items-end' : 'items-start'
                )}
              >
                {!isUser && (
                  <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                    Waiter
                  </span>
                )}
                <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                  <MessageContent content={msg.content} />
                </div>
                {showTime && (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    {formatTime(msg.createdAt ?? new Date())}
                  </span>
                )}
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="chat-message-enter flex flex-col items-start gap-1">
              <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Waiter
              </span>
              <div className="chat-bubble-ai flex items-center gap-1.5 py-3.5 px-4">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border/50 bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 shadow-sm"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about the menu or place an order…"
              disabled={isLoading}
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !sessionId}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
                input.trim() && !isLoading && sessionId
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Powered by <span className="font-semibold text-primary">FastClose</span>
          </p>
        </div>
      </div>

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        total={cart.total}
        busy={cartBusy}
        onUpdateQuantity={(productId, quantity) => patchCart(productId, { quantity })}
        onUpdateNotes={(productId, notes) => patchCart(productId, { notes })}
        onRemove={productId => patchCart(productId, { quantity: 0 })}
      />
    </div>
  );
}

function normalizeChatText(raw: string): string {
  let text = raw;
  if (text.includes('\\n') && !text.includes('\n')) {
    text = text.replace(/\\n/g, '\n');
  }
  text = text.replace(/^#{1,6}\s+/gm, '');
  return text;
}

function MessageContent({ content }: { content: string }) {
  const text = normalizeChatText(content);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return (
          <span key={i}>
            {part.split('\n').map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}
