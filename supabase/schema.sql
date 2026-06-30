-- ============================================================
-- FastClose AI v2 — Full Schema
-- Run entirely in Supabase SQL Editor
-- ============================================================

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. profiles table (mirrors auth.users, adds role)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'business' check (role in ('business', 'superadmin')),
  created_at timestamptz default now()
);

-- Auto-create profile on new Supabase Auth signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. businesses (now tied to a user)
create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  system_prompt text,
  created_at    timestamptz default now(),
  unique(user_id)
);

-- 4. products
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  description text,
  price       numeric(10,2),
  embedding   vector(1536),
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

-- 5. leads
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  client_phone text not null,
  chat_summary text,
  created_at   timestamptz default now(),
  unique(business_id, client_phone)
);

-- 6. telegram_bots
create table if not exists telegram_bots (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null unique references businesses(id) on delete cascade,
  bot_token    text not null,
  bot_username text,
  webhook_set  boolean default false,
  created_at   timestamptz default now()
);

-- 7. Vector similarity search function
create or replace function match_products (
  query_embedding   vector(1536),
  match_business_id uuid,
  match_count       int default 5
)
returns table (
  id          uuid,
  name        text,
  description text,
  price       numeric,
  metadata    jsonb,
  similarity  float
)
language sql stable as $$
  select
    p.id, p.name, p.description, p.price, p.metadata,
    1 - (p.embedding <=> query_embedding) as similarity
  from products p
  where p.business_id = match_business_id
    and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- 8. Vector index
create index if not exists products_embedding_idx
  on products using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS
alter table profiles      enable row level security;
alter table businesses    enable row level security;
alter table products      enable row level security;
alter table leads         enable row level security;
alter table telegram_bots enable row level security;

create policy "profiles_self"          on profiles      for all    using (auth.uid() = id);
create policy "businesses_owner"       on businesses    for all    using (auth.uid() = user_id);
create policy "businesses_public_read" on businesses    for select using (true);
create policy "products_owner"         on products      for all    using (business_id in (select id from businesses where user_id = auth.uid()));
create policy "products_public_read"   on products      for select using (true);
create policy "leads_owner"            on leads         for all    using (business_id in (select id from businesses where user_id = auth.uid()));
create policy "telegram_bots_owner"    on telegram_bots for all    using (business_id in (select id from businesses where user_id = auth.uid()));

-- After registering, run this to become superadmin:
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'your@email.com';
