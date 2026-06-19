-- FounderOS core schema
-- Tables: agents, agent_runs, drafts, agent_memory, memory_log
-- The worker uses the service-role key (bypasses RLS). The web app uses the anon key with an
-- authenticated session; RLS policies below require auth.uid() to be present.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists agents (
  id          text primary key,
  name        text not null,
  model       text not null default 'claude-opus-4-8',
  created_at  timestamptz not null default now()
);

create table if not exists agent_runs (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null references agents(id),
  status        text not null default 'running'
                  check (status in ('running','done','error')),
  trigger       text not null,
  input         jsonb,
  error         text,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10,4),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table if not exists drafts (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references agent_runs(id) on delete set null,
  agent_id      text not null references agents(id),
  kind          text not null,        -- email_reply|social_post|newsletter|brief|spec|debug|contract_draft|risk_review|memory_update
  title         text not null,
  body          text not null,
  body_edited   text,
  meta          jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected','sent','failed')),
  reject_reason text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists agent_memory (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null,          -- 'global' | agent_id
  kind        text not null,          -- profile | preference | fact | goal
  key         text not null,
  content     text not null,
  weight      int not null default 0,
  updated_at  timestamptz not null default now(),
  unique (scope, key)
);

create table if not exists memory_log (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null,
  key         text not null,
  old_content text,
  new_content text,
  source      text not null,          -- manual | run:<id> | reject_feedback
  created_at  timestamptz not null default now()
);

create index if not exists drafts_status_created_idx on drafts (status, created_at desc);
create index if not exists runs_agent_started_idx on agent_runs (agent_id, started_at desc);
create index if not exists memory_scope_idx on agent_memory (scope);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Single-user personal project: any authenticated user (you) gets full access.
-- Tighten to `auth.uid() = '<your-user-id>'` once you know your user id.
-- ---------------------------------------------------------------------------

alter table agents       enable row level security;
alter table agent_runs   enable row level security;
alter table drafts       enable row level security;
alter table agent_memory enable row level security;
alter table memory_log   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['agents','agent_runs','drafts','agent_memory','memory_log']
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);',
      t || '_authenticated_all', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime (so the web queue updates live)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table drafts;

-- ---------------------------------------------------------------------------
-- Seed: the five agents + the inbox utility
-- ---------------------------------------------------------------------------

insert into agents (id, name, model) values
  ('ceo',       'CEO Agent',       'claude-opus-4-8'),
  ('marketing', 'Marketing Agent', 'claude-sonnet-4-6'),
  ('dev',       'Dev Agent',       'claude-sonnet-4-6'),
  ('legal',     'Legal Agent',     'claude-sonnet-4-6'),
  ('sales',     'Sales Agent',     'claude-sonnet-4-6'),
  ('inbox',     'Inbox',           'claude-opus-4-8')
on conflict (id) do nothing;

-- Seed memory: edit these in the Memory tab. Global profile is shared by every agent.
insert into agent_memory (scope, kind, key, content, weight) values
  ('global', 'profile', 'business_overview',
   'TODO: Describe your business in 3-5 sentences — what you build, who it is for, stage, and current top goal. This is shared context for every agent.', 100),
  ('global', 'goal', 'current_goals',
   'TODO: List your top 2-3 goals for this quarter.', 90),
  ('marketing', 'preference', 'brand_voice',
   'TODO: Describe your brand voice (e.g. direct, technical, no hype) and primary channels (e.g. LinkedIn, X, newsletter).', 50),
  ('sales', 'preference', 'positioning',
   'TODO: Your one-line positioning, ICP, and follow-up cadence (e.g. follow up after 3 business days of silence).', 50),
  ('dev', 'fact', 'tech_stack',
   'TODO: Your stack and coding conventions so specs match how you build (e.g. React + TS + Vite + Supabase, Node).', 50),
  ('legal', 'preference', 'contract_prefs',
   'TODO: Jurisdiction, standard terms, and risk tolerance. Reminder: outputs are drafts for your review, not legal advice.', 50)
on conflict (scope, key) do nothing;
