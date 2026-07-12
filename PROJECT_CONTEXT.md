# FastClose AI — Project Context

> Read this file first. It explains what this project is, the current architecture, known bugs, and how to work on it effectively with Cursor.

## What This Is

FastClose AI is a B2B SaaS platform for restaurants/fastfood/cafés in Armenia. It provides an AI ordering agent that:
- Knows the restaurant's full menu (RAG-powered)
- Chats with customers in Armenian, Russian, or English (auto-detected, including transliteration)
- Acts as a waiter: answers questions, helps choose, cross-sells, takes the order
- Supports **delivery** (phone + address) and **dine-in** (table QR — no phone/address)
- Saves orders to the restaurant dashboard and notifies owners via Telegram
- Works on a web chat widget, table QR pages, and as a Telegram bot

Target customer: small-to-medium restaurants/cafés in Armenia who can't afford 24/7 phone/chat staff.

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + custom design tokens (no full shadcn, hand-rolled components)
- **Database**: Neon Postgres (serverless) with pgvector extension
- **ORM**: Prisma (standard client, NOT the Neon serverless adapter — see ADR below)
- **Auth**: NextAuth v5 (Credentials provider, bcrypt password hashing, JWT sessions)
- **AI**: OpenAI — `gpt-4o-mini` (chat + tools), `text-embedding-3-small` (embeddings), `gpt-3.5-turbo` (reranking)
- **QR**: `qrcode` package (PNG generation for table links)
- **Deployment target**: Vercel

## Architecture Decision Records (important — don't undo these)

### ADR-1: Standard Prisma client, not @prisma/adapter-neon
We tried the Neon serverless driver adapter (`@prisma/adapter-neon` + `@neondatabase/serverless` + `ws`). It caused `DATABASE_URL` to not be read correctly in Next.js Server Actions (fell back to localhost). **Fix: use the standard `PrismaClient` with a normal `DATABASE_URL` connection string + `?sslmode=require`.** Neon works fine with vanilla Prisma — the adapter is only needed for edge runtimes, which we don't use.

### ADR-2: Multi-tenant via Business.userId
Each `User` owns exactly one `Business` (`@unique` on `Business.userId`). All products/orders/tables/telegram bots/chat sessions belong to a `Business`. Public chat routes (`/chat/[businessId]` and `/chat/[businessId]/table/[tableId]`) don't require auth — businessId in the URL is the tenant key. Dashboard routes require `auth()` session + ownership check.

### ADR-3: RAG pipeline — hybrid search + rerank
Query flow: `detectLanguage()` (regex, free) → `translateToEnglish()` (gpt-4o-mini, only if non-English) → `generateEmbedding()` → `hybrid_search_products()` Postgres function (vector + full-text BM25 merged via Reciprocal Rank Fusion) → `findProductByName()` direct match safety net → `rerankProducts()` (gpt-3.5-turbo picks best 3-4) → feed to chat.

**This pipeline currently has an active bug** — see "Known Issues" below.

### ADR-4: Order flow via agent tools (not tagged completion)
Orders are created through the tool-calling agent in `src/lib/agent/`:
1. Intent router (regex) picks allowed tools for the turn
2. Optional pre-actions (e.g. auto-save phone for delivery)
3. Streaming LLM loop with tools: `search_menu`, `add_to_cart`, `update_cart_item`, `get_cart`, `set_delivery_info` (delivery only), `confirm_order`
4. Cart + phone/address/table live on `ChatSession` (server source of truth)
5. `confirm_order` → `orderFromSession` → `persistOrder` → Telegram notify

Legacy helpers `extractOrderFromConversation` / `[ORDER_CONFIRMED]` still exist in `openai.ts` but are **not** on the hot path.

### ADR-5: Dine-in via table QR
Businesses manage `Table` rows in `/dashboard/tables` and download a QR that points to `/chat/[businessId]/table/[tableId]`. That session is `orderType: DINE_IN` with `tableId` set. Checkout does **not** collect phone or address; the order stores `tableId` (+ display name). Delivery chat at `/chat/[businessId]` is unchanged.

### ADR-6: Plain-text streaming for web chat
`useChat` uses `streamProtocol: 'text'`. The agent streams **plain UTF-8 tokens** to the client (not the AI SDK data-stream protocol). Do not wrap replies in `OpenAIStream` for this path — that caused literal `\n` / broken markdown in the UI.

## Known Issues (active, unresolved)

### 🔴 BUG: AI hallucinates "item doesn't exist" for items that DO exist in the menu
**Symptom**: Customer asks about "Ավանդական Սպաս" (a real menu item) in Armenian, AI responds "we don't have that" and lists unrelated items instead.

**What's been tried**:
- Tightened the system prompt anti-hallucination rules (`buildSystemPrompt` in `src/lib/openai.ts`)
- Added `findProductByName()` direct-match fallback in `src/lib/rag.ts`, merged into results after hybrid search
- Narrowed catalog-intent handling so category questions don't always dump the full menu

**Still failing after the above fixes.** Suspected root causes to investigate (in priority order):
1. `findProductByName` + Armenian Unicode / Postgres `contains` insensitive matching
2. Mixed-language queries confusing `detectLanguage()` / `translateToEnglish()`
3. Reranker dropping a correct hybrid/direct match
4. `hybrid_search_products()` failing and falling back to vector-only

**Debugging approach**: Reproduce with a real Armenian product name, capture every `[RAG]` console.log, and find which step drops the product. Do not add more prompt/regex patches as a first response.

### 🟡 UX issue: AI sometimes dumps full menu when it shouldn't
Worth re-testing after RAG fixes.

## Database Schema (Prisma)

See `prisma/schema.prisma`. Key models:
- `User`, `Business` (1:1 with User)
- `Product` (embedding `vector(1536)`, category, aliases)
- `Table` (per-business numbered tables for dine-in QR)
- `Order` (`orderType` DELIVERY | DINE_IN, optional `tableId`, optional phone/address for dine-in)
- `ChatSession` (cart, phase, orderType, tableId, phone/address)
- `TelegramBot` (`ownerChatId` for order notifications)

**Leads were removed** (migration 007). Orders are the source of truth for customer activity.

Migrations are in `prisma/migrations/00X_name/migration.sql` — **hand-written raw SQL**, run manually in Neon's SQL Editor in numeric order. Do not rely on `prisma db push` (vector column + custom functions).

| # | Purpose |
|---|---------|
| 001 | Init (users, businesses, products, leads [legacy], telegram, vector) |
| 002 | Hybrid search function |
| 003 | Orders + owner_chat_id |
| 004 | Chat sessions |
| 005 | Product category + aliases |
| 006 | Dine-in tables + OrderType + nullable phone/address |
| 007 | Drop `leads` table |

## File Map — Where Things Live

```
src/
├── lib/
│   ├── prisma.ts              Prisma client singleton (ADR-1)
│   ├── auth.ts / auth-actions.ts
│   ├── openai.ts              Embeddings, language, translation, rerank,
│   │                          buildSystemPrompt, phone extract, Telegram notify
│   ├── rag.ts                 getRelevantContext, getAllProducts, findProductByName
│   ├── products.ts            category/alias helpers
│   ├── actions.ts             parseProductInput for bulk sync
│   └── agent/                 Tool-calling order agent (orchestrator, tools,
│                              session, orders, intent-router, run-agent streaming)
├── components/
│   ├── chat/ChatInterface.tsx     Web + table chat UI
│   └── dashboard/DashboardNav.tsx Active sidebar nav
├── middleware.ts
├── app/
│   ├── auth/login|register/
│   ├── dashboard/
│   │   ├── layout.tsx         Sidebar + auth
│   │   ├── page.tsx           Overview
│   │   ├── products/          Menu CRUD + bulk sync
│   │   ├── tables/            Table CRUD + QR download
│   │   ├── orders/            Order status management
│   │   ├── telegram/          Connect bot
│   │   └── settings/          Name + system prompt
│   ├── superadmin/            Platform-wide businesses/users/orders
│   ├── chat/[businessId]/                 Delivery/public widget
│   ├── chat/[businessId]/table/[tableId]/ Dine-in QR chat
│   └── api/
│       ├── chat/route.ts
│       ├── products/…  orders/…  tables/…  business/settings/
│       └── telegram/bot + webhook/[businessId]
```

## Environment Variables

See `.env.local.example`. Required: `DATABASE_URL` (Neon, must include `?sslmode=require`), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`.

## Commands

```bash
npm run dev          # local dev server
npm run db:generate  # regenerate Prisma client after schema.prisma changes
npm run db:studio    # Prisma Studio — inspect data visually
```

## Conventions

- Server Actions for auth/simple mutations; API routes for client `fetch()` CRUD and chat.
- All AI prompt construction in `src/lib/openai.ts`; retrieval in `src/lib/rag.ts`; agent tools/orchestration in `src/lib/agent/`.
- Every query on tenant data must be scoped by `businessId`.
- Set `temperature` and `max_tokens` explicitly on every OpenAI call; log meaningful `[Module]` steps.
- Money: `Decimal` in DB → `Number(x)` before JSON to the frontend.
- Tailwind: use CSS variable tokens (`bg-card`, `text-foreground`, `bg-primary`, …) — never hardcode hex / `bg-white` / `text-black`.
- Chat-facing text: prose-first, no markdown tables/headings (bold OK).

## Manual test checklist (after RAG / order / table changes)

1. Ask for the full menu
2. Ask about a real item by exact Armenian name
3. Ask using Latin transliteration
4. Ask about a category with zero matches (honest "we don't have that")
5. Place a **delivery** order through confirmation → `/dashboard/orders` + Telegram
6. Create a table, open QR/chat URL, place a **dine-in** order (no phone/address) → order shows table

## What To Build Next

1. Fix the RAG hallucination bug (blocks real usage)
2. Order editing (items after creation)
3. Analytics on dashboard overview
4. Multi-location support
5. Voice AI channel (deferred; architecture discussed separately)
