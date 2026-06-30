import { openai, extractPhoneNumber } from '@/lib/openai';
import type { MatchedProduct } from '@/lib/rag';
import type { CartItem, ConversationPhase } from './types';
import {
  type SessionSnapshot,
  updateSession,
  cartTotal,
} from './session';

interface CartSyncResult {
  cart: CartItem[];
  phase: ConversationPhase;
  customerPhone: string | null;
  deliveryAddress: string | null;
}

function validateCartItems(
  cart: CartItem[],
  products: MatchedProduct[],
  businessId: string
): CartItem[] {
  const byId = new Map(products.map(p => [p.id, p]));
  const validated: CartItem[] = [];

  for (const item of cart) {
    const product = byId.get(item.productId);
    if (!product) {
      console.warn('[CartSync] dropped unknown productId:', item.productId);
      continue;
    }
    validated.push({
      productId: product.id,
      name: product.name,
      quantity: Math.max(1, Math.min(99, Math.round(item.quantity))),
      unitPrice: product.price != null ? Number(product.price) : item.unitPrice,
    });
  }

  return validated;
}

function inferPhase(
  cart: CartItem[],
  phone: string | null,
  address: string | null,
  orderConfirmed: boolean
): ConversationPhase {
  if (orderConfirmed) return 'confirmed';
  if (cart.length === 0) return 'browsing';
  if (phone && address) return 'checkout';
  if (cart.length > 0) return 'ordering';
  return 'browsing';
}

/**
 * Sync cart + phase from the latest turn (Step 2 bridge until tool calling in Step 3).
 * Validates productIds against the menu products shown this turn.
 */
export async function syncSessionAfterTurn(params: {
  session: SessionSnapshot;
  userMessage: string;
  assistantMessage: string;
  menuProducts: MatchedProduct[];
  businessId: string;
}): Promise<SessionSnapshot> {
  const { session, userMessage, assistantMessage, menuProducts, businessId } = params;
  const orderConfirmed = assistantMessage.includes('[ORDER_CONFIRMED]');

  const catalog = menuProducts
    .map(p => `- id:${p.id} | ${p.name} | ${p.price != null ? p.price : 'N/A'} AMD`)
    .join('\n');

  const currentCart = session.cart
    .map(c => `- ${c.name} x${c.quantity} (id:${c.productId})`)
    .join('\n') || '(empty)';

  let synced: CartSyncResult | null = null;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `Update the order session from the latest customer/assistant exchange.
Return ONLY valid JSON:
{
  "cart": [{"productId": "uuid", "name": "exact menu name", "quantity": 1, "unitPrice": 0}],
  "phase": "browsing|ordering|checkout|confirmed",
  "customerPhone": "digits or null",
  "deliveryAddress": "string or null"
}
Rules:
- cart must ONLY contain items the customer agreed to order in this conversation
- productId MUST be from the menu catalog below
- unitPrice MUST match catalog price
- merge with current cart: add new items, update quantities, remove if customer cancelled
- set customerPhone/deliveryAddress when customer provided them (keep existing if not changed)
- phase: browsing=no cart; ordering=cart with items; checkout=collecting phone/address; confirmed=order finalized`,
        },
        {
          role: 'user',
          content: `Current cart:\n${currentCart}

Current phone: ${session.customerPhone ?? 'none'}
Current address: ${session.deliveryAddress ?? 'none'}

Menu catalog (only valid productIds):
${catalog || '(no products loaded)'}

Customer: ${userMessage}
Assistant: ${assistantMessage.replace('[ORDER_CONFIRMED]', '').trim()}`,
        },
      ],
    });

    const raw = response.choices[0].message.content?.trim() ?? '';
    synced = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, '')) as CartSyncResult;
  } catch (e) {
    console.error('[CartSync] extraction failed:', e);
  }

  const phoneFromMessage = extractPhoneNumber(userMessage);
  let cart = synced?.cart ? validateCartItems(synced.cart, menuProducts, businessId) : session.cart;
  let customerPhone = synced?.customerPhone ?? session.customerPhone;
  let deliveryAddress = synced?.deliveryAddress ?? session.deliveryAddress;

  if (phoneFromMessage) customerPhone = phoneFromMessage;

  // Keep cart if sync returned empty but we had items and user didn't clear
  if (synced?.cart && synced.cart.length === 0 && session.cart.length > 0 && !orderConfirmed) {
    const clearIntent = /\b(cancel|clear|empty|չեմ|չի|no order|отмен)\b/i.test(userMessage);
    if (!clearIntent) cart = session.cart;
  }

  const phase = synced?.phase && !orderConfirmed
    ? synced.phase
    : inferPhase(cart, customerPhone, deliveryAddress, orderConfirmed);

  console.log('[CartSync] cart:', cart.map(c => `${c.name}x${c.quantity}`), 'phase:', phase);

  return updateSession(session.id, businessId, {
    cart,
    phase,
    customerPhone,
    deliveryAddress,
  });
}

export { cartTotal };
