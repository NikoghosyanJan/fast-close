import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase';
import { NextRequest } from 'next/server';

// GET — fetch current business settings
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, system_prompt')
    .eq('user_id', user.id)
    .single();

  return Response.json({ business: business ?? null });
}

// PATCH — update business name and system_prompt
export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, system_prompt } = await req.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from('businesses')
    .update({
      name: name?.trim() || undefined,
      system_prompt: system_prompt?.trim() || null,
    })
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}