import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { id: true, name: true, systemPrompt: true },
  });
  return Response.json({ business });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, system_prompt } = await req.json();
  await prisma.business.update({
    where: { userId: session.user.id },
    data: { name: name?.trim() || undefined, systemPrompt: system_prompt?.trim() || null },
  });
  return Response.json({ success: true });
}