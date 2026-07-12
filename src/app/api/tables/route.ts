import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

async function getBusiness(userId: string) {
  return prisma.business.findUnique({ where: { userId }, select: { id: true } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ tables: [] });

  const tables = await prisma.table.findMany({
    where: { businessId: business.id },
    orderBy: { number: 'asc' },
  });

  return Response.json({ tables });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getBusiness(session.user.id);
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  let number = Number(body.number);

  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  if (!Number.isFinite(number) || number < 1) {
    const max = await prisma.table.aggregate({
      where: { businessId: business.id },
      _max: { number: true },
    });
    number = (max._max.number ?? 0) + 1;
  }

  try {
    const table = await prisma.table.create({
      data: {
        businessId: business.id,
        name,
        number: Math.floor(number),
        active: body.active !== false,
      },
    });
    return Response.json({ table }, { status: 201 });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && e.code === 'P2002'
      ? 'A table with this number already exists'
      : 'Failed to create table';
    return Response.json({ error: msg }, { status: 400 });
  }
}
