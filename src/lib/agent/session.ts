import { prisma } from '@/lib/prisma';
import type { ConversationPhase, CartItem } from './types';
import type { ConversationPhase as DbPhase, SessionChannel, OrderType as DbOrderType } from '@prisma/client';

export type OrderMode = 'delivery' | 'dine_in';

export interface SessionSnapshot {
  id: string;
  businessId: string;
  channel: 'web' | 'telegram';
  externalKey: string;
  orderType: OrderMode;
  tableId: string | null;
  tableName: string | null;
  tableNumber: number | null;
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

function orderTypeFromDb(t: DbOrderType): OrderMode {
  return t === 'DINE_IN' ? 'dine_in' : 'delivery';
}

function orderTypeToDb(t: OrderMode): DbOrderType {
  return t === 'dine_in' ? 'DINE_IN' : 'DELIVERY';
}

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

type SessionRow = {
  id: string;
  businessId: string;
  channel: SessionChannel;
  externalKey: string;
  orderType: DbOrderType;
  tableId: string | null;
  phase: DbPhase;
  cart: unknown;
  customerPhone: string | null;
  deliveryAddress: string | null;
  messages: unknown;
  table?: { id: string; name: string; number: number } | null;
};

function toSnapshot(row: SessionRow): SessionSnapshot {
  return {
    id: row.id,
    businessId: row.businessId,
    channel: row.channel === 'WEB' ? 'web' : 'telegram',
    externalKey: row.externalKey,
    orderType: orderTypeFromDb(row.orderType),
    tableId: row.tableId,
    tableName: row.table?.name ?? null,
    tableNumber: row.table?.number ?? null,
    phase: PHASE_FROM_DB[row.phase],
    cart: parseCart(row.cart),
    customerPhone: row.customerPhone,
    deliveryAddress: row.deliveryAddress,
    messages: parseMessages(row.messages),
  };
}

const sessionInclude = {
  table: { select: { id: true, name: true, number: true } },
} as const;

export function isDineIn(session: SessionSnapshot): boolean {
  return session.orderType === 'dine_in';
}

export async function getOrCreateSession(
  businessId: string,
  channel: 'web' | 'telegram',
  externalKey: string,
  options?: { tableId?: string | null }
): Promise<SessionSnapshot> {
  const dbChannel: SessionChannel = channel === 'web' ? 'WEB' : 'TELEGRAM';
  const tableId = options?.tableId ?? null;

  const existing = await prisma.chatSession.findUnique({
    where: {
      businessId_channel_externalKey: {
        businessId,
        channel: dbChannel,
        externalKey,
      },
    },
    include: sessionInclude,
  });

  if (existing) {
    // If this session was opened via a table QR, keep/refresh dine-in binding.
    if (tableId && (existing.tableId !== tableId || existing.orderType !== 'DINE_IN')) {
      const updated = await prisma.chatSession.update({
        where: { id: existing.id },
        data: { tableId, orderType: 'DINE_IN' },
        include: sessionInclude,
      });
      return toSnapshot(updated);
    }
    return toSnapshot(existing);
  }

  if (tableId) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId, active: true },
      select: { id: true },
    });
    if (!table) {
      throw new Error('Table not found');
    }
  }

  const created = await prisma.chatSession.create({
    data: {
      businessId,
      channel: dbChannel,
      externalKey,
      phase: 'BROWSING',
      cart: [],
      messages: [],
      orderType: tableId ? 'DINE_IN' : 'DELIVERY',
      tableId,
    },
    include: sessionInclude,
  });

  console.log('[Session] created:', created.id, channel, externalKey, tableId ? `table=${tableId}` : 'delivery');
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
    include: sessionInclude,
  });

  return toSnapshot(row);
}

/** Clear cart after a successful order. Keep table binding for dine-in so they can order again. */
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
    `Order mode: ${session.orderType}`,
  ];

  if (isDineIn(session)) {
    const tableLabel =
      session.tableName ??
      (session.tableNumber != null ? `Table ${session.tableNumber}` : 'unknown table');
    lines.push(`Dine-in table: ${tableLabel} (tableId: ${session.tableId ?? 'n/a'})`);
    lines.push('This is a TABLE order — do NOT ask for delivery address or phone.');
  }

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

  if (!isDineIn(session)) {
    if (session.customerPhone) lines.push(`Phone on file: ${session.customerPhone}`);
    if (session.deliveryAddress) lines.push(`Address on file: ${session.deliveryAddress}`);
  }

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
  orderType: OrderMode;
  tableId: string | null;
  tableName: string | null;
  tableNumber: number | null;
} | null {
  if (session.cart.length === 0) return null;

  if (isDineIn(session)) {
    if (!session.tableId) return null;
    const tableLabel =
      session.tableName ??
      (session.tableNumber != null ? `Table ${session.tableNumber}` : 'Table');
    return {
      items: session.cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
      totalPrice: cartTotal(session.cart),
      customerPhone: '',
      deliveryAddress: tableLabel,
      orderType: 'dine_in',
      tableId: session.tableId,
      tableName: session.tableName,
      tableNumber: session.tableNumber,
    };
  }

  if (!session.customerPhone?.trim() || !session.deliveryAddress?.trim()) {
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
    orderType: 'delivery',
    tableId: null,
    tableName: null,
    tableNumber: null,
  };
}

export { orderTypeToDb };
