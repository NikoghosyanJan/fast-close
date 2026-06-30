# FastClose AI — Project Context

> Read this file first. It explains what this project is, the current architecture, known bugs, and how to work on it effectively with Cursor.

## What This Is

FastClose AI is a B2B SaaS platform for restaurants/fastfood businesses in Armenia. It provides an AI ordering agent that:
- Knows the restaurant's full menu (RAG-powered)
- Chats with customers in Armenian, Russian, or English (auto-detected, including transliteration)
- Acts as a waiter: answers questions, helps choose, cross-sells, takes the order
- Collects phone + delivery address, confirms the order with total price
- Saves the order to the restaurant's dashboard and notifies them via Telegram
- Works on a web chat widget AND as a Telegram bot

Target customer: small-to-medium restaurants/cafés in Armenia who can't afford 24/7 phone/chat staff.

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + custom design tokens (no full shadcn, hand-rolled components)
- **Database**: Neon Postgres (serverless) with pgvector extension
- **ORM**: Prisma (standard client, NOT the Neon serverless adapter — see ADR below)
- **Auth**: NextAuth v5 (Credentials provider, bcrypt password hashing, JWT sessions)
- **AI**: OpenAI — `gpt-4o-mini` (chat), `text-embedding-3-small` (embeddings), `gpt-3.5-turbo` (reranking)
- **Deployment target**: Vercel

## Architecture Decision Records (important — don't undo these)

### ADR-1: Standard Prisma client, not @prisma/adapter-neon
We tried the Neon serverless driver adapter (`@prisma/adapter-neon` + `@neondatabase/serverless` + `ws`). It caused `DATABASE_URL` to not be read correctly in Next.js Server Actions (fell back to localhost). **Fix: use the standard `PrismaClient` with a normal `DATABASE_URL` connection string + `?sslmode=require`.** Neon works fine with vanilla Prisma — the adapter is only needed for edge runtimes, which we don't use.

### ADR-2: Multi-tenant via Business.userId
Each `User` owns exactly one `Business` (`@unique` on `Business.userId`). All products/leads/orders/telegram bots belong to a `Business`. Public chat routes (`/chat/[businessId]`) don't require auth — businessId in the URL is the tenant key. Dashboard routes require `auth()` session + ownership check.

### ADR-3: RAG pipeline — hybrid search + rerank
Query flow: `detectLanguage()` (regex, free) → `translateToEnglish()` (gpt-4o-mini, only if non-English) → `generateEmbedding()` → `hybrid_search_products()` Postgres function (vector + full-text BM25 merged via Reciprocal Rank Fusion) → `findProductByName()` direct match safety net → `rerankProducts()` (gpt-3.5-turbo picks best 3-4) → feed to chat.

**This pipeline currently has an active bug** — see "Known Issues" below.

### ADR-4: Order flow via tagged completion
The AI is instructed to append a literal `[ORDER_CONFIRMED]` string to its response when the customer confirms an order. The chat route checks for this tag in the streamed response, then makes a second GPT call (`extractOrderFromConversation`) to pull structured order data (items, total, phone, address) and saves it to the `Order` table. This is a deliberate two-pass design: pass 1 (streaming) talks to the customer naturally, pass 2 (non-streaming, triggered by the tag) extracts structured data reliably.

## Known Issues (active, unresolved)

### 🔴 BUG: AI hallucinates "item doesn't exist" for items that DO exist in the menu
**Symptom**: Customer asks about "Ավանդական Սպաս" (a real menu item) in Armenian, AI responds "we don't have that" and lists unrelated items instead.

**What's been tried**:
- Tightened the system prompt anti-hallucination rules (`buildSystemPrompt` in `src/lib/openai.ts`)
- Added `findProductByName()` direct-match fallback in `src/lib/rag.ts`, merged into results after hybrid search
- Narrowed `CATALOG_INTENT` regex in `src/app/api/chat/route.ts` so category questions don't always dump the full menu

**Still failing after the above fixes.** Suspected root causes to investigate (in priority order):
1. `findProductByName` searches using `retrievalQuery` (untranslated, original language) but the menu items are stored in Armenian — need to verify Postgres `contains` + `mode: 'insensitive'` works correctly with Armenian Unicode characters (U+0530–U+058F). Test directly in Prisma Studio / SQL.
2. Mixed-language queries like `"Ավանդական Սպաս uneq?"` (Armenian script + Latin transliteration in the same string) may confuse `detectLanguage()` or `translateToEnglish()` — log and inspect what `englishQuery` actually becomes for this exact input.
3. The reranker (`rerankProducts`, gpt-3.5-turbo) might be dropping the correct match even when hybrid search + direct match both return it. Add a console.log of `rows` right before reranking and `reranked` right after, compare.
4. Possible that `hybrid_search_products()` Postgres function (migration 002) silently fails and falls back to vector-only (there's a try/catch around it in `getRelevantContext` — check terminal logs for `[RAG] hybrid_search failed, falling back to vector-only`).

**Debugging approach**: All steps already have `console.log('[RAG] ...')` statements. Next session should reproduce the bug, capture full terminal output, and trace exactly which step drops the correct product.

### 🟡 UX issue: AI sometimes dumps full menu when it shouldn't
Was over-broad in an earlier `CATALOG_INTENT` regex (matched too many phrases). Narrowed since, but worth re-testing with various phrasings to make sure specific questions ("do you have soup?") go through RAG (returns 1-4 relevant items) rather than `getAllProducts()` (returns everything).

## Database Schema (Prisma)

See `prisma/schema.prisma`. Key models: `User`, `Business` (1:1 with User), `Product` (has `embedding vector(1536)` — Unsupported type, raw SQL needed to write/read it), `Lead`, `Order` (status enum: NEW → CONFIRMED → PREPARING → DELIVERED, or CANCELLED), `TelegramBot` (stores `ownerChatId` for sending order notifications).

Migrations are in `prisma/migrations/00X_name/migration.sql` — these are **hand-written raw SQL**, not Prisma-generated. Run them manually in Neon's SQL Editor in numeric order. `prisma db push` will NOT pick up the `vector` column, `hybrid_search_products()` function, or `search_vector` generated column correctly — always use the raw SQL migrations for schema changes.

## File Map — Where Things Live

```
src/
├── lib/
│   ├── prisma.ts          Prisma client singleton (standard client, see ADR-1)
│   ├── auth.ts             NextAuth v5 config (Credentials provider)
│   ├── auth-actions.ts     signUp/signIn/signOut/getProfile/getMyBusiness server actions
│   ├── openai.ts           ALL AI logic: embeddings, language detection, translation,
│   │                       reranking, system prompt, phone extraction, order extraction,
│   │                       Telegram order notification
│   ├── rag.ts              RAG pipeline: getRelevantContext, getAllProducts,
│   │                       findProductByName (direct match safety net)
│   └── actions.ts          parseProductInput (JSON/text → product array for bulk sync)
├── middleware.ts            Route protection (dashboard/superadmin require auth)
├── app/
│   ├── auth/login|register/page.tsx       Auth pages
│   ├── dashboard/
│   │   ├── layout.tsx       Sidebar nav
│   │   ├── page.tsx         Overview (stats, new orders alert)
│   │   ├── products/page.tsx Product CRUD + bulk sync
│   │   ├── orders/page.tsx   Order management (status updates)
│   │   ├── leads/page.tsx    Captured leads list
│   │   ├── telegram/page.tsx Connect Telegram bot
│   │   └── settings/page.tsx Business name + system prompt editor
│   ├── superadmin/           Platform-wide view (all businesses/users/leads)
│   ├── chat/[businessId]/page.tsx   Public chat widget (no auth)
│   └── api/
│       ├── chat/route.ts                 Main chat endpoint (streaming, order detection)
│       ├── products/route.ts             GET/POST products
│       ├── products/[productId]/route.ts PATCH/DELETE product
│       ├── products/sync/route.ts        Bulk sync (clears + re-embeds all)
│       ├── orders/route.ts               GET orders
│       ├── orders/[orderId]/route.ts     PATCH order status
│       ├── business/settings/route.ts    GET/PATCH business settings
│       ├── telegram/bot/route.ts         Connect/disconnect Telegram bot
│       └── telegram/webhook/[businessId]/route.ts  Telegram message handler
└── components/chat/ChatInterface.tsx     Web chat UI (streaming, useChat hook)
```

## Environment Variables

See `.env.local.example`. Required: `DATABASE_URL` (Neon, must include `?sslmode=require`), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`.

## Commands

```bash
npm run dev          # local dev server
npm run db:generate  # regenerate Prisma client after schema.prisma changes
npm run db:studio    # Prisma Studio — inspect data visually, useful for RAG debugging
```

There is no `db:push` workflow for this project — schema changes go through hand-written SQL files in `prisma/migrations/`, run manually in Neon's SQL Editor, because of the vector column and custom Postgres functions.

## Conventions

- Server Actions (`'use server'`) are used for auth and simple mutations. API routes (`route.ts`) are used for anything called from client-side `fetch()` (products CRUD, orders, telegram, chat).
- All AI/RAG logic lives in `src/lib/openai.ts` and `src/lib/rag.ts` — keep it there, don't scatter prompt strings across route files.
- Armenian/Russian transliteration detection is regex-based in `detectLanguage()` — when adding new transliteration keywords, add them to the existing word lists rather than creating new detection functions.
- Money is stored as `Decimal` in Postgres/Prisma but cast to `number` (`Number(x)`) before sending to the frontend — Decimal doesn't serialize to JSON cleanly.
- Tailwind: no `bg-white`/`text-black` hardcoded — always use the CSS variable tokens (`bg-card`, `text-foreground`, `bg-primary`, etc.) defined in `globals.css` `:root`.

## What To Build Next (after fixing the RAG bug)

Not yet started, in rough priority order based on past conversation:
1. Fix the hallucination bug above — this blocks real usage
2. Order editing (currently can only change status, not edit items after creation)
3. Analytics on dashboard overview (revenue per day, popular items)
4. Multi-location support (one business, multiple branches/menus)
5. Voice AI channel (phone calls) — was discussed and deferred, full architecture already designed (ask the user for the voice architecture conversation if needed, or treat as a fresh scope)
