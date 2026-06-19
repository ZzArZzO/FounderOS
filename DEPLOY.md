# Deploying FounderOS

Two deployables + a hosted database:
- **Worker** → Railway (cron + agents + trigger server, always-on)
- **Web** → Vercel (the approval UI)
- **Database** → Supabase (already hosted)

Deploy the worker first so you have its public URL for the web app's `VITE_WORKER_URL`.

---

## 1. Worker → Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick
   `ZzArZzO/FounderOS`.
2. In the service **Settings**, set **Root Directory** to `worker`.
   (Railway reads `worker/railway.json` for the build/start commands.)
3. **Variables** — add:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...        (service_role — server-side only)
   ALLOWED_ORIGIN=https://<your-app>.vercel.app   (set after step 2 below; or leave unset for now)
   # Optional (enables Inbox/Sales/Legal-from-Drive):
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REFRESH_TOKEN=
   ```
   Do **not** set `PORT` — Railway injects it automatically.
4. **Networking** → **Generate Domain**. Copy the URL (e.g. `https://founderos-worker.up.railway.app`).
5. Verify: open `https://<that-domain>/health` → `{"ok":true}`.

## 2. Web → Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import `ZzArZzO/FounderOS`.
2. Set **Root Directory** to `web`. (Framework auto-detects as Vite; `web/vercel.json` adds the
   SPA rewrite so deep links / refreshes work.)
3. **Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...           (anon key — safe for the browser)
   VITE_WORKER_URL=https://<your worker domain from step 1.4>
   ```
4. **Deploy.** Copy the resulting URL (e.g. `https://founderos.vercel.app`).

## 3. Wire them together

1. Back in **Railway**, set `ALLOWED_ORIGIN` to your Vercel URL and redeploy (locks the trigger
   server to your app).
2. In **Supabase → Authentication → URL Configuration**, set **Site URL** to your Vercel URL and
   add it to **Redirect URLs** (so magic-link sign-in returns to the deployed app).

## 4. Smoke test

1. Open your Vercel URL → sign in with the magic link.
2. Click **Marketing** → drafts appear in the queue.
3. Approve one → check the **Runs & cost** tab shows the run + `cost_usd`.

---

## Notes
- **Free tiers:** Vercel (hobby) and Supabase (free) are $0; Railway is usage-based (~$5/mo for a
  small always-on worker). Supabase free pauses after 7 days idle — the worker's daily cron keeps
  it awake.
- **Secrets:** the `service_role` key lives only on Railway, never in Vercel. The Vercel build only
  ever sees the `anon` key.
- **Trigger endpoint:** `POST /run/:agent` has no per-request auth (CORS-limited only). For a
  personal tool that's acceptable; if you want it locked down, add a bearer check in
  `worker/src/server.ts`.
