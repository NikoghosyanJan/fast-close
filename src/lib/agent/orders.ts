import { prisma } from '@/lib/prisma';
import { sendOrderToTelegram, type ExtractedOrder } from '@/lib/openai';
import type { Prisma } from '@prisma/client';
import { orderTypeToDb } from './session';

export async function persistOrder(
  businessId: string,
  businessName: string,
  order: ExtractedOrder
) {
  const orderType = order.orderType ?? 'delivery';

  const created = await prisma.order.create({
    data: {
      businessId,
      orderType: orderTypeToDb(orderType),
      tableId: order.tableId ?? null,
      customerPhone: order.customerPhone || null,
      deliveryAddress: order.deliveryAddress || null,
      items: order.items as unknown as Prisma.InputJsonValue,
      totalPrice: order.totalPrice,
      status: 'NEW',
    },
  });

  console.log('[Order] saved:', created.id, orderType, order.tableId ? `table=${order.tableId}` : '');

  const tgBot = await prisma.telegramBot.findUnique({
    where: { businessId },
    select: { botToken: true, ownerChatId: true },
  });

  if (tgBot?.ownerChatId) {
    await sendOrderToTelegram(
      tgBot.botToken,
      tgBot.ownerChatId,
      order,
      businessName,
      created.id
    );
  }

  return created;
}
