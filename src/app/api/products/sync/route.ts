import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { parseProductInput } from '@/lib/actions';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

  const { raw } = await req.json();
  if (!raw) return Response.json({ error: 'No data provided' }, { status: 400 });

  const products = await parseProductInput(raw);
  const admin = createAdminClient();

  // Clear existing
  await admin.from('products').delete().eq('business_id', business.id);

  let synced = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const embedding = await generateEmbedding([product.name, product.description].filter(Boolean).join(' — '));
      const { error } = await admin.from('products').insert({
        business_id: business.id,
        name: product.name,
        description: product.description ?? null,
        price: product.price ?? null,
        embedding,
        metadata: product.metadata ?? {},
      });
      if (error) errors.push(`${product.name}: ${error.message}`);
      else synced++;
    } catch (e) {
      errors.push(`${product.name}: ${String(e)}`);
    }
  }

  return Response.json({ synced, errors });
}
