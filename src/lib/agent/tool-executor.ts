import { prisma } from '@/lib/prisma';
import { getMenuContext, formatProductContext } from '@/lib/rag';
import { extractPhoneNumber } from '@/lib/openai';
import {
  type SessionSnapshot,
  updateSession,
  cartTotal,
  orderFromSession,
  isDineIn,
} from './session';
import type { CartItem, ConversationPhase } from './types';
import type { AgentToolName } from './tools';
import type { ExtractedOrder } from '@/lib/openai';

export interface ToolExecutionResult {
  output: Record<string, unknown>;
  session: SessionSnapshot;
  orderReady: ExtractedOrder | null;
}

export interface ToolContext {
  businessId: string;
  session: SessionSnapshot;
  chatMessages: { role: string; content: string }[];
}

async function getProductForBusiness(businessId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true, price: true },
  });
}

function cartPayload(session: SessionSnapshot) {
  return {
    items: session.cart,
    total: cartTotal(session.cart),
    phone: session.customerPhone,
    address: session.deliveryAddress,
    orderType: session.orderType,
    tableId: session.tableId,
    tableName: session.tableName,
    tableNumber: session.tableNumber,
    phase: session.phase,
  };
}

function phaseForCart(session: SessionSnapshot, cart: CartItem[]): ConversationPhase {
  if (cart.length === 0) return 'browsing';
  if (isDineIn(session)) return 'checkout';
  if (session.customerPhone && session.deliveryAddress) return 'checkout';
  return 'ordering';
}

export async function executeAgentTool(
  toolName: AgentToolName,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  const { businessId } = ctx;
  let session = ctx.session;
  let orderReady: ExtractedOrder | null = null;

  console.log('[Tool]', toolName, args);

  switch (toolName) {
    case 'search_menu': {
      const query = String(args.query ?? '');
      const fullMenu = args.full_menu === true;
      const category = args.category != null ? String(args.category) : undefined;
      const menu = await getMenuContext(query, businessId, {
        forceFullMenu: fullMenu,
        category: category ?? null,
        messages: ctx.chatMessages,
      });
      return {
        output: {
          success: true,
          scope: menu.scope,
          count: menu.products.length,
          products: menu.products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            aliases: p.aliases,
            description: p.description,
          })),
          formatted: formatProductContext(menu.products),
        },
        session,
        orderReady: null,
      };
    }

    case 'add_to_cart': {
      const productId = String(args.product_id ?? '');
      const quantity = Math.max(1, Math.min(99, Number(args.quantity ?? 1)));
      const product = await getProductForBusiness(businessId, productId);

      if (!product) {
        return {
          output: { success: false, error: 'Product not found. Use search_menu to find valid product_id.' },
          session,
          orderReady: null,
        };
      }

      const unitPrice = product.price != null ? Number(product.price) : 0;
      const cart = [...session.cart];
      const idx = cart.findIndex(i => i.productId === productId);

      if (idx >= 0) {
        cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + quantity };
      } else {
        cart.push({
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice,
        });
      }

      session = await updateSession(session.id, businessId, {
        cart,
        phase: phaseForCart(session, cart),
      });

      return {
        output: { success: true, message: `Added ${product.name} x${quantity}`, cart: cartPayload(session) },
        session,
        orderReady: null,
      };
    }

    case 'update_cart_item': {
      const productId = String(args.product_id ?? '');
      const quantity = Math.max(0, Math.min(99, Number(args.quantity ?? 0)));
      let cart = [...session.cart];
      const idx = cart.findIndex(i => i.productId === productId);

      if (idx < 0) {
        return {
          output: { success: false, error: 'Item not in cart' },
          session,
          orderReady: null,
        };
      }

      if (quantity === 0) {
        cart = cart.filter(i => i.productId !== productId);
      } else {
        cart[idx] = { ...cart[idx], quantity };
      }

      session = await updateSession(session.id, businessId, {
        cart,
        phase: phaseForCart(session, cart),
      });

      return {
        output: { success: true, cart: cartPayload(session) },
        session,
        orderReady: null,
      };
    }

    case 'get_cart': {
      return {
        output: { success: true, cart: cartPayload(session) },
        session,
        orderReady: null,
      };
    }

    case 'set_delivery_info': {
      if (isDineIn(session)) {
        return {
          output: {
            success: false,
            error: 'Dine-in orders do not need phone or address. Proceed to confirm_order after summarizing the cart.',
            cart: cartPayload(session),
          },
          session,
          orderReady: null,
        };
      }

      const phoneArg = args.phone != null ? String(args.phone) : null;
      const addressArg = args.address != null ? String(args.address).trim() : null;
      const phone = phoneArg ? (extractPhoneNumber(phoneArg) ?? phoneArg.replace(/\D/g, '')) : session.customerPhone;
      const address = addressArg || session.deliveryAddress;

      session = await updateSession(session.id, businessId, {
        customerPhone: phone,
        deliveryAddress: address,
        phase: phaseForCart({ ...session, customerPhone: phone, deliveryAddress: address }, session.cart),
      });

      return {
        output: {
          success: true,
          phone: session.customerPhone,
          address: session.deliveryAddress,
          cart: cartPayload(session),
        },
        session,
        orderReady: null,
      };
    }

    case 'confirm_order': {
      const order = orderFromSession(session);
      if (!order) {
        const missing: string[] = [];
        if (session.cart.length === 0) missing.push('cart_items');
        if (isDineIn(session)) {
          if (!session.tableId) missing.push('table');
        } else {
          if (!session.customerPhone) missing.push('phone');
          if (!session.deliveryAddress) missing.push('address');
        }
        return {
          output: {
            success: false,
            error: 'Order incomplete',
            missing,
            cart: cartPayload(session),
          },
          session,
          orderReady: null,
        };
      }

      session = await updateSession(session.id, businessId, { phase: 'confirmed' });
      orderReady = order;

      return {
        output: {
          success: true,
          order: {
            items: order.items,
            totalPrice: order.totalPrice,
            customerPhone: order.customerPhone,
            deliveryAddress: order.deliveryAddress,
            orderType: order.orderType,
            tableId: order.tableId,
            tableName: order.tableName,
            tableNumber: order.tableNumber,
          },
        },
        session,
        orderReady,
      };
    }

    default:
      return {
        output: { success: false, error: `Unknown tool: ${toolName}` },
        session,
        orderReady: null,
      };
  }
}
