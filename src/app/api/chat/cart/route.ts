import { prisma } from '@/lib/prisma';
import {
  getOrCreateSession,
  updateSession,
  cartTotal,
  normalizeItemNotes,
  isDineIn,
  type SessionSnapshot,
} from '@/lib/agent/session';
import type { CartItem, ConversationPhase } from '@/lib/agent/types';

export const dynamic = 'force-dynamic';

function phaseForCart(session: SessionSnapshot, cart: CartItem[]): ConversationPhase {
  if (cart.length === 0) return 'browsing';
  if (isDineIn(session)) return 'checkout';
  if (session.customerPhone && session.deliveryAddress) return 'checkout';
  return 'ordering';
}

function cartResponse(session: SessionSnapshot) {
  return {
    items: session.cart,
    total: cartTotal(session.cart),
    itemCount: session.cart.reduce((sum, i) => sum + i.quantity, 0),
    orderType: session.orderType,
    phase: session.phase,
  };
}

async function assertBusiness(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
}

/** GET /api/chat/cart?businessId=&sessionId=&tableId? */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get('businessId')?.trim();
  const sessionId = searchParams.get('sessionId')?.trim();
  const tableId = searchParams.get('tableId')?.trim() || null;

  if (!businessId || !sessionId) {
    return Response.json({ error: 'businessId and sessionId required' }, { status: 400 });
  }

  const business = await assertBusiness(businessId);
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  try {
    const session = await getOrCreateSession(businessId, 'web', sessionId, { tableId });
    return Response.json(cartResponse(session));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load cart';
    return Response.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/chat/cart
 * Body: { businessId, sessionId, tableId?, productId, quantity?, notes? }
 * - quantity 0 removes the item
 * - omit quantity to change notes only
 * - notes: string to set, "" or null to clear
 */
export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const businessId = typeof body.businessId === 'string' ? body.businessId.trim() : '';
  const sessionKey = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const tableId = typeof body.tableId === 'string' && body.tableId.trim() ? body.tableId.trim() : null;
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';

  if (!businessId || !sessionKey || !productId) {
    return Response.json(
      { error: 'businessId, sessionId, and productId required' },
      { status: 400 }
    );
  }

  const business = await assertBusiness(businessId);
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const hasQuantity = body.quantity !== undefined && body.quantity !== null;
  const hasNotes = Object.prototype.hasOwnProperty.call(body, 'notes');

  if (!hasQuantity && !hasNotes) {
    return Response.json({ error: 'Provide quantity and/or notes' }, { status: 400 });
  }

  try {
    let session = await getOrCreateSession(businessId, 'web', sessionKey, { tableId });
    let cart = [...session.cart];
    const idx = cart.findIndex(i => i.productId === productId);

    if (idx < 0) {
      return Response.json({ error: 'Item not in cart' }, { status: 404 });
    }

    let next: CartItem = { ...cart[idx] };

    if (hasNotes) {
      const notes = normalizeItemNotes(body.notes);
      if (notes) next = { ...next, notes };
      else {
        const { notes: _removed, ...rest } = next;
        next = rest;
      }
    }

    if (hasQuantity) {
      const quantity = Math.max(0, Math.min(99, Number(body.quantity)));
      if (Number.isNaN(quantity)) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (quantity === 0) {
        cart = cart.filter(i => i.productId !== productId);
      } else {
        next = { ...next, quantity };
        cart[idx] = next;
      }
    } else {
      cart[idx] = next;
    }

    session = await updateSession(session.id, businessId, {
      cart,
      phase: phaseForCart(session, cart),
    });

    console.log('[CartAPI] updated', productId, { hasQuantity, hasNotes, count: cart.length });
    return Response.json(cartResponse(session));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update cart';
    return Response.json({ error: message }, { status: 400 });
  }
}
