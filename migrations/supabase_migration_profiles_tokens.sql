-- Profil user dan analitik token. Jalankan sekali di Supabase SQL Editor.
-- Idempoten: aman dijalankan ulang.

-- Profil user (nama, tujuan, gaya, gender). Satu baris per user.
create table if not exists public.user_profiles (
  user_id     text primary key,
  profile     jsonb not null default '{}'::jsonb,
  updated_at  text
);

alter table public.user_profiles enable row level security;

-- Pemakaian token per hari dan per owner (user_id atau "trial:<ip>").
create table if not exists public.token_usage (
  day         text not null,
  owner       text not null,
  prompt      bigint not null default 0,
  completion  bigint not null default 0,
  primary key (day, owner)
);

create index if not exists token_usage_owner_idx on public.token_usage (owner);

alter table public.token_usage enable row level security;

-- Budget token harian global (satu baris).
create table if not exists public.token_budget (
  id          int primary key default 1,
  budget      bigint not null default 0,
  updated_at  text
);

insert into public.token_budget (id, budget, updated_at)
values (1, 0, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS'))
on conflict (id) do nothing;

alter table public.token_budget enable row level security;
