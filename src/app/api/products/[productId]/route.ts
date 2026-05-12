import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { NextRequest } from 'next/server';

// PATCH /api/products/[productId] — update product + regenerate embedding
export async function PATCH(req: NextRequest, { params }: { params: { productId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description, price } = await req.json();
  const embedding = await generateEmbedding([name, description].filter(Boolean).join(' — '));

  const admin = createAdminClient();
  const { error } = await admin.from('products')
    .update({ name, description: description ?? null, price: price ?? null, embedding })
    .eq('id', params.productId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE /api/products/[productId]
export async function DELETE(_req: NextRequest, { params }: { params: { productId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('products').delete().eq('id', params.productId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
