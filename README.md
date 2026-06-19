# FounderOS

A personal AI ops team for a solo founder: five agents (CEO, Marketing, Dev, Legal, Sales) +
an Inbox utility. Every output goes to an **approval queue** you review before anything happens.

> Personal use only. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and conventions.

## Quick start

### 1. Database
Create a Supabase project, then run the migration (SQL editor, or `supabase db reset` locally):

```
supabase/migrations/0001_core.sql
```

### 2. Worker
```bash
cd worker
cp .env.example .env     # fill in ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

### 3. Web
```bash
cd web
cp .env.example .env     # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_WORKER_URL
npm install
npm run dev
```

Open the web app, sign in with a magic link, click **Generate → Marketing**, and watch a draft
appear in the queue. Approve / edit / reject it.

## What works out of the box (no Google needed)
- **Marketing** — generate social/newsletter drafts
- **Dev** — paste a stack trace or question, get a spec / debug analysis
- **CEO** — weekly strategy brief synthesized from recent agent activity

## Needs Google OAuth (Gmail/Calendar/Drive)
- **Inbox** (daily brief + reply drafts), **Sales** (follow-ups), **Legal** (Drive contracts)

Add `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` to `worker/.env` to activate these.

## Deploy
- Worker → Railway (`npm run build` / `npm start`)
- Web → Vercel (`npm run build`)
- DB → Supabase (hosted)

Expected cost: ~$20–25/mo (Claude API + ~$5 Railway). Inbox triage dominates.
