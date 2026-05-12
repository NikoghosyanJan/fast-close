'use server';

import { createSupabaseServerClient, createAdminClient } from './supabase';
import { redirect } from 'next/navigation';

export async function signUp(email: string, password: string, businessName: string) {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  if (data.user) {
    const admin = createAdminClient();

    // Manually upsert the profile to guarantee it exists before inserting the business
    await admin.from('profiles').upsert(
      { id: data.user.id, email },
      { onConflict: 'id' }
    );

    // Retry inserting the business up to 5 times with a short delay
    let bizError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: err } = await admin.from('businesses').insert({
        user_id: data.user.id,
        name: businessName,
      });
      bizError = err;
      if (!bizError) break;
      await new Promise(r => setTimeout(r, 300));
    }

    if (bizError) throw new Error(bizError.message);
  }

  redirect('/dashboard');
}

export async function signIn(email: string, password: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}

export async function getSession() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function getMyBusiness() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return data;
}
