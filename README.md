# ⚡ FastClose AI

> RAG-powered AI sales agent SaaS. Deploy a product-aware chatbot that answers customer questions and captures leads automatically.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url> fastclose-ai
cd fastclose-ai
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role) |
| `OPENAI_API_KEY` | platform.openai.com/api-keys |

### 3. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Paste and run the entire contents of `supabase/schema.sql`
4. Verify tables: `businesses`, `products`, `leads` are created

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Design tokens + styles
│   ├── not-found.tsx
│   ├── admin/
│   │   └── upload/page.tsx       # Product catalog ingestion
│   ├── api/
│   │   └── chat/route.ts         # Streaming chat + lead capture
│   └── chat/
│       └── [businessId]/page.tsx # Public chat interface
├── components/
│   └── chat/
│       └── ChatInterface.tsx     # WhatsApp-style chat UI
└── lib/
    ├── supabase.ts               # DB clients
    ├── openai.ts                 # Embeddings + prompts
    ├── rag.ts                    # Vector similarity search
    ├── actions.ts                # Server actions (sync, CRUD)
    └── utils.ts
```

---

## 🔑 Key Features

### RAG Pipeline
1. User message → `text-embedding-3-small` → 1536-dim vector
2. `match_products()` SQL function → cosine similarity search via pgvector
3. Top 3-5 products → injected into system prompt
4. GPT-4o-mini streams response

### Lead Capture
- Every user message is scanned for phone numbers
- On detection → `leads` table upsert (no duplicates per business)
- Non-blocking (doesn't delay chat response)

### Admin Sync
- JSON array or plain text input
- Auto-clears old products before inserting new ones
- Per-product embedding generation with error isolation

---

## 🌐 Deployment (Vercel)

```bash
npm install -g vercel
vercel
```

Add all env variables in Vercel Dashboard → Settings → Environment Variables.

---

## 🗂 Database Schema

```sql
businesses  (id, name, system_prompt, created_at)
products    (id, business_id, name, description, price, embedding[1536], metadata, created_at)
leads       (id, business_id, client_phone, chat_summary, created_at)
```

Vector search via `match_products(query_embedding, business_id, count)` RPC.

---

## 📱 Usage

| URL | Purpose |
|---|---|
| `/` | Landing page |
| `/admin/upload` | Upload product catalog |
| `/chat/[businessId]` | Public customer chat widget |

---

## 🔧 Extending

- **Multi-language**: swap system prompt language per business
- **WhatsApp integration**: pipe `/api/chat` into Twilio/WABA
- **Analytics**: query `leads` table for pipeline metrics
- **Auth**: add Supabase Auth to protect `/admin/*` routes
