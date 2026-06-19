# FounderOS

Personal AI ops system for a solo founder. A team of five agents (**CEO, Marketing, Dev,
Legal, Sales**) plus a shared **Inbox** utility handle cognitive overhead. Everything an agent
produces lands in an **approval queue** the founder reviews before anything sends, publishes,
or is acted on. **Agents never act autonomously.** Personal use only — not a product.

## Architecture

Code-orchestrated (the worker is the orchestrator, not an LLM):

```
cron / manual trigger → agent gathers context → Claude call → write draft(s) to queue → STOP
                                                                        ↑
                                          founder reviews in web UI → executor fires side-effect
```

- **worker/** — Railway Node/TS service. Runs cron schedules, the agents (raw `@anthropic-ai/sdk`),
  an Express trigger server, and the approved-draft executor. Uses Supabase **service-role** key.
- **web/** — Vite + React approval UI on Vercel. Uses Supabase **anon** key + your auth session.
- **supabase/** — Postgres schema (drafts queue, agent memory, run log). Source of truth.

The `drafts` table IS the gate: the executor only acts on rows with `status = 'approved'`.

## Commands

Worker (`cd worker`):
- `npm install`
- `npm run dev` — run with tsx (watch), starts cron + trigger server
- `npm run build` / `npm start` — compile + run (Railway uses these)

Web (`cd web`):
- `npm install`
- `npm run dev` — Vite dev server
- `npm run build` — production build (Vercel)

Database (`supabase` CLI from repo root):
- `supabase start` then `supabase db reset` — apply `migrations/0001_core.sql` locally
- Or paste the migration into the Supabase SQL editor for a hosted project.

## Environment

`worker/.env` (see `.env.example`):
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (Gmail/Calendar/Drive — optional until Week 4)
- `PORT` (trigger server, default 8787)

`web/.env` (see `.env.example`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_WORKER_URL` (e.g. http://localhost:8787)

The Gmail/Calendar/Drive MCP servers available inside a Claude session are NOT usable by this
running system — it authenticates to Google itself via a one-time OAuth refresh token.

## File map (worker/src)

- `config.ts` — env + model IDs + per-model pricing (for cost tracking)
- `db.ts` — supabase-js service-role client
- `anthropic.ts` — Anthropic SDK client
- `memory.ts` — `buildSystemPrompt(agentId)`: assembles global + per-agent memory into a single
  cached prefix (`cache_control: ephemeral`). Volatile per-run context goes in the user message.
- `runner.ts` — `runAgent(...)`: one Claude call, writes an `agent_runs` row with token usage +
  `cost_usd`, returns parsed JSON. `generateDrafts(...)` / `insertDrafts(...)` helpers.
- `agents/*.ts` — one file per agent. Each gathers context and emits drafts.
- `google.ts` — googleapis OAuth client + Gmail/Calendar/Drive helpers (lazy; no-op if unconfigured)
- `executor.ts` — acts on approved drafts by `kind` (Gmail draft, Drive save, mark sent)
- `server.ts` — Express; `POST /run/:agent` manual triggers (used by the web "Generate" buttons)
- `worker.ts` — entry: registers cron schedules, starts the executor poll loop + trigger server

## Models (default to the latest)

| Use | Model ID |
|---|---|
| CEO orchestration, inbox brief | `claude-opus-4-8` |
| Drafting (marketing, sales, legal, dev specs, replies) | `claude-sonnet-4-6` |
| Classifiers / cheap reply drafts | `claude-haiku-4-5` |

Use adaptive thinking (`thinking: { type: "adaptive" }`) + `effort` only on Opus work; omit
thinking for cheap drafting. Verify prompt-cache hits via `usage.cache_read_input_tokens > 0`.

## Draft kinds

`email_reply` · `social_post` · `newsletter` · `brief` · `spec` · `debug` · `contract_draft` ·
`risk_review` · `memory_update`. The executor switches on `kind` (see `executor.ts`).

## Adding a new agent

1. Insert a row in `agents` (id, name, model).
2. Add `worker/src/agents/<id>.ts` exporting `run<Id>(input?)` that gathers context and calls
   `generateDrafts(...)` from `runner.ts`.
3. Register it in `agents/index.ts` (the registry the cron + trigger server dispatch through).
4. Add memory rows (`agent_memory`, `scope = '<id>'`) for its role/preferences.

## Conventions

- TypeScript, ESM, `moduleResolution: bundler` (extensionless imports). Small focused files.
- Never let an agent perform a side-effect directly — only `executor.ts` does, only on
  `status='approved'`.
- Immutable updates; validate external data (email/Drive content) before use.
- Keep the memory prefix byte-stable (deterministic order) so prompt caching keeps hitting.

## Security / cost notes

- RLS is enabled; web policies require an authenticated session. The worker bypasses RLS via the
  service-role key — keep that key server-side only, never in `web/`.
- Cost driver is inbox triage. Guardrails: Haiku for drafting, Opus only where needed, prompt
  caching on memory, `max_tokens` discipline. Watch per-run `cost_usd` in the Runs tab.

## Status / roadmap

See `C:\Users\Costa\.claude\plans\dreamy-splashing-perlis.md` for the 6-week plan. MVP shipped:
schema, worker core, all agent stubs, marketing + dev + ceo runnable without Google; inbox /
sales / legal activate once Google creds are set. Approval UI with realtime queue.
