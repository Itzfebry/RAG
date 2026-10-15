-- Riwayat chat user login. Jalankan sekali di Supabase SQL Editor.
-- Retensi 7 hari dan batas 3 chat per user ditegakkan di backend (db.py).
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null default 'Chat baru',
  created_at  text not null,
  updated_at  text not null
);

create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  text not null
);

create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
