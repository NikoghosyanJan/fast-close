import { prisma } from '@/lib/prisma';
import ChatInterface from '@/components/chat/ChatInterface';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: { businessId: string; tableId: string };
}

export async function generateMetadata({ params }: Props) {
  const [business, table] = await Promise.all([
    prisma.business.findUnique({ where: { id: params.businessId }, select: { name: true } }),
    prisma.table.findFirst({
      where: { id: params.tableId, businessId: params.businessId, active: true },
      select: { name: true, number: true },
    }),
  ]);
  if (!business || !table) return { title: 'FastClose AI' };
  return { title: `${table.name} · ${business.name}` };
}

export default async function TableChatPage({ params }: Props) {
  const [business, table] = await Promise.all([
    prisma.business.findUnique({
      where: { id: params.businessId },
      select: { id: true, name: true },
    }),
    prisma.table.findFirst({
      where: { id: params.tableId, businessId: params.businessId, active: true },
      select: { id: true, name: true, number: true },
    }),
  ]);

  if (!business || !table) notFound();

  return (
    <ChatInterface
      business={business}
      table={{ id: table.id, name: table.name, number: table.number }}
    />
  );
}
