# SignalDesk

AI-powered financial & political intelligence platform. Ingests news from structured APIs, stores and indexes articles, and (future) extracts entities/topics and generates investor-facing implications.

## Tech stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Prisma** + **PostgreSQL** (Supabase or Neon)
- **ShadCN-style** UI tokens (Radix, CVA, tailwind-merge)
- **Vercel** deployment

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database**
   - Create a PostgreSQL database (e.g. [Supabase](https://supabase.com) or [Neon](https://neon.tech)).
   - Copy `.env.example` to `.env` and set `DATABASE_URL`.

3. **Generate Prisma client and push schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run dev**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Core features (MVP)

### News ingestion

**POST /api/news/ingest**

Body:
```json
{
  "articles": [
    {
      "sourceName": "Reuters",
      "title": "Fed signals rate hold",
      "summary": "Summary text...",
      "url": "https://...",
      "publishedAt": "2025-01-15T12:00:00Z",
      "externalId": "optional-id"
    }
  ]
}
```

- Creates or reuses a `Source` by name/slug.
- Inserts new `Article` rows (skips duplicates when `externalId` matches).
- Returns `{ ok, created, skipped, total }`.

### Articles API

**GET /api/articles?page=1&limit=20&sourceId=...&q=...**

Returns paginated articles with source and pagination. Use `q` to search in title/summary (case-insensitive), and `sourceId` to filter by source.

### Sources API

**GET /api/sources** — Returns all sources (for dashboard filter dropdown).

### AI analysis

**POST /api/articles/[id]/analyze** — Extracts entities/topics and generates investor-facing implications using OpenAI (requires `OPENAI_API_KEY`). Updates the article in place.

### Dashboard

**/dashboard** — Intelligence feed with search (title/summary), source filter, and article cards showing entities, topics, and implications when available.

## Next steps (from spec)

- Full-text search (PostgreSQL)
- NLP: entity/topic extraction (OpenAI or HuggingFace)
- Implications generation (LLM)
- Embeddings + pgvector for semantic clustering
