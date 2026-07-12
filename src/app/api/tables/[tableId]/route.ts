import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';

async function getOwnedTable(userId: string, tableId: string) {
  const business = await prisma.business.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!business) return null;

  return prisma.table.findFirst({
    where: { id: tableId, businessId: business.id },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await getOwnedTable(session.user.id, params.tableId);
  if (!existing) return Response.json({ error: 'Table not found' }, { status: 404 });

  const body = await req.json();
  const data: { name?: string; number?: number; active?: boolean } = {};

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (body.number != null) {
    const n = Number(body.number);
    if (!Number.isFinite(n) || n < 1) {
      return Response.json({ error: 'Invalid table number' }, { status: 400 });
    }
    data.number = Math.floor(n);
  }
  if (typeof body.active === 'boolean') data.active = body.active;

  try {
    const table = await prisma.table.update({
      where: { id: existing.id },
      data,
    });
    return Response.json({ table });
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && e.code === 'P2002'
      ? 'A table with this number already exists'
      : 'Failed to update table';
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tableId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await getOwnedTable(session.user.id, params.tableId);
  if (!existing) return Response.json({ error: 'Table not found' }, { status: 404 });

  await prisma.table.delete({ where: { id: existing.id } });
  return Response.json({ ok: true });
}
