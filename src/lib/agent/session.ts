import { prisma } from '@/lib/prisma';
import type { ConversationPhase, CartItem } from './types';
import type { ConversationPhase as DbPhase, SessionChannel } from '@prisma/client';

export interface SessionSnapshot {
  id: string;
  businessId: string;
  channel: 'web' | 'telegram';
  externalKey: string;
  phase: ConversationPhase;
  cart: CartItem[];
  customerPhone: string | null;
  deliveryAddress: string | null;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const PHASE_TO_DB: Record<ConversationPhase, DbPhase> = {
  greeting: 'GREETING',
  browsing: 'BROWSING',
  ordering: 'ORDERING',
  checkout: 'CHECKOUT',
  confirmed: 'CONFIRMED',
};

const PHASE_FROM_DB: Record<DbPhase, ConversationPhase> = {
  GREETING: 'greeting',
  BROWSING: 'browsing',
  ORDERING: 'ordering',
  CHECKOUT: 'checkout',
  CONFIRMED: 'confirmed',
};

function parseCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CartItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as CartItem).productId === 'string' &&
      typeof (item as CartItem).name === 'string' &&
      typeof (item as CartItem).quantity === 'number' &&
      typeof (item as CartItem).unitPrice === 'number'
  );
}

function parseMessages(raw: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .slice(-20);
}

function toSnapshot(row: {
  id: string;
  businessId: string;
  channel: SessionChannel;
  externalKey: string;
  phase: DbPhase;
  cart: unknown;
  customerPhone: string | null;
  deliveryAddress: string | null;
  messages: unknown;
}): SessionSnapshot {
  return {
    id: row.id,
    businessId: row.businessId,
    channel: row.channel === 'WEB' ? 'web' : 'telegram',
    externalKey: row.externalKey,
    phase: PHASE_FROM_DB[row.phase],
    cart: parseCart(row.cart),
    customerPhone: row.customerPhone,
    deliveryAddress: row.deliveryAddress,
    messages: parseMessages(row.messages),
  };
}

export async function getOrCreateSession(
  businessId: string,
  channel: 'web' | 'telegram',
  externalKey: string
): Promise<SessionSnapshot> {
  const dbChannel: SessionChannel = channel === 'web' ? 'WEB' : 'TELEGRAM';

  const existing = await prisma.chatSession.findUnique({
    where: {
      businessId_channel_externalKey: {
        businessId,
        channel: dbChannel,
        externalKey,
      },
    },
  });

  if (existing) return toSnapshot(existing);

  const created = await prisma.chatSession.create({
    data: {
      businessId,
      channel: dbChannel,
      externalKey,
      phase: 'BROWSING',
      cart: [],
      messages: [],
    },
  });

  console.log('[Session] created:', created.id, channel, externalKey);
  return toSnapshot(created);
}

export async function updateSession(
  sessionId: string,
  businessId: string,
  updates: {
    phase?: ConversationPhase;
    cart?: CartItem[];
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    messages?: { role: 'user' | 'assistant'; content: string }[];
  }
): Promise<SessionSnapshot> {
  const data: Record<string, unknown> = {};
  if (updates.phase) data.phase = PHASE_TO_DB[updates.phase];
  if (updates.cart) data.cart = updates.cart;
  if (updates.customerPhone !== undefined) data.customerPhone = updates.customerPhone;
  if (updates.deliveryAddress !== undefined) data.deliveryAddress = updates.deliveryAddress;
  if (updates.messages) data.messages = updates.messages.slice(-20);

  const row = await prisma.chatSession.update({
    where: { id: sessionId, businessId },
    data,
  });

  return toSnapshot(row);
}

/** Clear cart and delivery info after a successful order. */
export async function resetSessionAfterOrder(
  sessionId: string,
  businessId: string
): Promise<SessionSnapshot> {
  return updateSession(sessionId, businessId, {
    cart: [],
    phase: 'confirmed',
    customerPhone: null,
    deliveryAddress: null,
  });
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function formatSessionContext(session: SessionSnapshot): string {
  const lines: string[] = [
    '===== ORDER SESSION (server-side — source of truth) =====',
    `Phase: ${session.phase}`,
  ];

  if (session.cart.length === 0) {
    lines.push('Cart: empty');
  } else {
    lines.push('Cart:');
    session.cart.forEach((item, i) => {
      lines.push(
        `  ${i + 1}. ${item.name} x${item.quantity} — ${item.unitPrice.toLocaleString()} AMD each (productId: ${item.productId})`
      );
    });
    lines.push(`Cart total: ${cartTotal(session.cart).toLocaleString()} AMD`);
  }

  if (session.customerPhone) lines.push(`Phone on file: ${session.customerPhone}`);
  if (session.deliveryAddress) lines.push(`Address on file: ${session.deliveryAddress}`);

  lines.push(
    'Cart is managed via tools (add_to_cart, update_cart_item, get_cart).',
    '===== END SESSION ====='
  );

  return lines.join('\n');
}

export function orderFromSession(session: SessionSnapshot): {
  items: { name: string; quantity: number; price: number }[];
  totalPrice: number;
  customerPhone: string;
  deliveryAddress: string;
} | null {
  if (
    session.cart.length === 0 ||
    !session.customerPhone?.trim() ||
    !session.deliveryAddress?.trim()
  ) {
    return null;
  }

  return {
    items: session.cart.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
    })),
    totalPrice: cartTotal(session.cart),
    customerPhone: session.customerPhone,
    deliveryAddress: session.deliveryAddress,
  };
}
