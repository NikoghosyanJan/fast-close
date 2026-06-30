import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!business) return Response.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json({
    orders: orders.map(o => ({
      ...o,
      totalPrice: Number(o.totalPrice),
      items: o.items,
    })),
  });
}
