import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { NextRequest } from 'next/server';

// GET /api/products — list all products for the current user's business
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ products: [] });

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, metadata, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  return Response.json({ products: products ?? [] });
}

// POST /api/products — add a single product with embedding
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { name, description, price, metadata } = await req.json();
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  const embedding = await generateEmbedding([name, description].filter(Boolean).join(' — '));

  const admin = createAdminClient();
  const { data, error } = await admin.from('products').insert({
    business_id: business.id, name, description: description ?? null,
    price: price ?? null, embedding, metadata: metadata ?? {},
  }).select('id, name, description, price, metadata, created_at').single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ product: data });
}
