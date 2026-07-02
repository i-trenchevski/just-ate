-- just-ate — database schema.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- Four tables. The first three are personal (row level security means each
-- signed-in user can only ever see their own rows). foods_cache is shared:
-- every Open Food Facts lookup anyone resolves gets written there once, so
-- the same food is never fetched from the internet twice.

-- One row per user: their kcal/macro targets + profile, as one JSON blob.
create table public.targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data    jsonb  not null,
  u       bigint not null default 0   -- ms timestamp of last edit (sync clock)
);

-- One row per user per day. entries = the chat log, numbers baked in.
create table public.days (
  user_id   uuid    not null references auth.users (id) on delete cascade,
  day       text    not null,          -- 'YYYY-MM-DD', matches local keys
  entries   jsonb   not null default '[]',
  completed boolean not null default false,
  u         bigint  not null default 0,
  primary key (user_id, day)
);

-- Foods the user taught the app (manual entries + OFF picks). Deletions are
-- tombstones ({"deleted":true}) so they don't resurrect on other devices.
create table public.custom_foods (
  user_id uuid   not null references auth.users (id) on delete cascade,
  key     text   not null,             -- normalized food name
  food    jsonb  not null,
  u       bigint not null default 0,
  primary key (user_id, key)
);

-- Shared, append-only cache of Open Food Facts results.
create table public.foods_cache (
  key        text primary key,
  food       jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- security
alter table public.targets      enable row level security;
alter table public.days         enable row level security;
alter table public.custom_foods enable row level security;
alter table public.foods_cache  enable row level security;

create policy "own targets"      on public.targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own days"         on public.days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own custom foods" on public.custom_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cache: anyone may read (it's generic nutrition data, nothing personal),
-- signed-in users may add, nobody may change or delete rows from the app.
create policy "cache read"  on public.foods_cache
  for select using (true);

create policy "cache write" on public.foods_cache
  for insert to authenticated with check (true);
