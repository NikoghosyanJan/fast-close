# Setup Guide

## Prerequisites
- Node.js 18+
- A Neon account (neon.tech) — free tier is fine
- An OpenAI API key with billing enabled

## 1. Database (Neon)

1. console.neon.tech → create project (region near Armenia: eu-central-1 recommended)
2. Dashboard → Connection string → copy the **pooled** connection string for production, or **direct** connection string for local dev (avoids occasional pooler connection errors during development)
3. Dashboard → Extensions → enable `vector`
4. SQL Editor → run these files **in exact numeric order**:
   - `prisma/migrations/001_init/migration.sql`
   - `prisma/migrations/002_hybrid_search/migration.sql`
   - `prisma/migrations/003_orders/migration.sql`

If more migration folders exist beyond 003, run them in order too — check `prisma/migrations/` for the current list.

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:
- `DATABASE_URL` — from Neon, must end in `?sslmode=require`
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `OPENAI_API_KEY` — from platform.openai.com/api-keys
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev (used to build the Telegram webhook URL, so it must be a publicly reachable URL once you connect Telegram — use ngrok locally if testing Telegram)

## 3. Install & run

```bash
npm install
npm run db:generate
npm run dev
```

## 4. First account

1. Go to `/auth/register`, create an account (this also creates your `Business` row)
2. To make yourself superadmin, run in Neon SQL Editor:
   ```sql
   UPDATE users SET role = 'SUPERADMIN' WHERE email = 'your@email.com';
   ```

## 5. Add a test menu

`/dashboard/products` → Bulk Sync → paste JSON like:

```json
[
  { "name": "Ավանդական Սպաս", "description": "Մածունով, ձավարով և թարմ դաղձով եփված ավանդական հայկական տաք ապուր", "price": 1200 },
  { "name": "Պաստա Կարբոնարա", "description": "Սպագետի, խրթխրթան բեկոն, ձվի դեղնուց, պարմեզան և սև պղպեղ", "price": 3400 }
]
```

This regenerates embeddings for every item. Use this same flow whenever debugging RAG — having a known, small, fixed test menu makes bugs reproducible.

## 6. Telegram (optional, for testing the bot channel)

1. Telegram → @BotFather → `/newbot` → copy token
2. `/dashboard/telegram` → paste token → Connect
3. **Required extra step**: open your new bot in Telegram and send it any message — this registers your `chat_id` so order notifications can reach you
4. For local testing, the webhook needs a public URL — run `ngrok http 3000`, set `NEXT_PUBLIC_APP_URL` to the ngrok URL, reconnect the bot from the dashboard

## Common errors and fixes

**`Can't reach database server at ...-pooler...`**
Switch `DATABASE_URL` to the direct (non-pooler) connection string from Neon, or add `&pgbouncer=true&connect_timeout=15` to the pooled one.

**`No database host or connection string was set, ... (host: localhost, user: yourname)`**
`DATABASE_URL` isn't being read. Confirm `.env.local` exists in the project root (not a subfolder), confirm the variable name is exactly `DATABASE_URL`, restart the dev server fully (kill it, don't just save a file).

**`Failed to find Server Action "..."`**
Stale `.next` cache after editing server action files while the dev server was running. Fix: `rm -rf .next && npm run dev`.

**`Module not found: Can't resolve '@supabase/ssr'`**
A leftover file from before the Supabase → Neon migration still imports it. Search the codebase for `supabase` and delete/update any matching files — they're stale (see PROJECT_CONTEXT.md ADR notes).
