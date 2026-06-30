import { prisma } from '@/lib/prisma';
import { sendOrderToTelegram, type ExtractedOrder } from '@/lib/openai';
import type { Prisma } from '@prisma/client';

export async function persistOrder(
  businessId: string,
  businessName: string,
  order: ExtractedOrder
) {
  const created = await prisma.order.create({
    data: {
      businessId,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      items: order.items as unknown as Prisma.InputJsonValue,
      totalPrice: order.totalPrice,
      status: 'NEW',
    },
  });

  console.log('[Order] saved:', created.id);

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
