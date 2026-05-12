import { createAdminClient } from '@/lib/supabase';
import ChatInterface from '@/components/chat/ChatInterface';
import { notFound } from 'next/navigation';

interface Props {
  params: { businessId: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', params.businessId)
    .single();

  return {
    title: data ? `Chat with ${data.name}` : 'FastClose AI',
  };
}

export default async function ChatPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', params.businessId)
    .single();

  if (error || !business) {
    notFound();
  }

  return <ChatInterface business={business} />;
}
