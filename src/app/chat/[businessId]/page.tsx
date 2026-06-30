import { prisma } from '@/lib/prisma';
import ChatInterface from '@/components/chat/ChatInterface';
import { notFound } from 'next/navigation';

interface Props { params: { businessId: string } }

export async function generateMetadata({ params }: Props) {
  const business = await prisma.business.findUnique({ where: { id: params.businessId }, select: { name: true } });
  return { title: business ? `Chat with ${business.name}` : 'FastClose AI' };
}

export default async function ChatPage({ params }: Props) {
  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: { id: true, name: true },
  });
  if (!business) notFound();
  return <ChatInterface business={business} />;
}
