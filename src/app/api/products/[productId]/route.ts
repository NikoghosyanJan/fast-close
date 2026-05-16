import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { generateEmbedding, buildProductEmbeddingText } from '@/lib/openai';
import { NextRequest } from 'next/server';

// PATCH — update product and regenerate rich embedding
export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description, price, metadata } = await req.json();

  // Regenerate embedding with all fields
  const embeddingText = buildProductEmbeddingText({ name, description, price, metadata });
  const embedding = await generateEmbedding(embeddingText);

  const admin = createAdminClient();
  const { error } = await admin
    .from('products')
    .update({
      name,
      description: description ?? null,
      price: price ?? null,
      metadata: metadata ?? {},
      embedding,
    })
    .eq('id', params.productId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { productId: string } }
) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('products').delete().eq('id', params.productId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
