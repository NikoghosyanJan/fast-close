import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await req.json();
  const validStatuses = ['NEW', 'CONFIRMED', 'PREPARING', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data: { status },
  });

  return Response.json({ order: { ...order, totalPrice: Number(order.totalPrice) } });
}
