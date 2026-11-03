-- Dokumen lampiran chat (server-side). Jalankan sekali di Supabase SQL Editor.
-- Isi teks disimpan di sini dan TIDAK pernah dikirim ke client; client hanya
-- memegang doc_id. Retensi 7 hari ditegakkan backend (document_repo.py).
create table if not exists public.user_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  content     text not null,
  char_count  integer not null default 0,
  truncated   boolean not null default false,
  page_count  integer,
  file_type   text not null default '',
  created_at  text not null
);

create index if not exists user_documents_user_idx on public.user_documents (user_id, created_at desc);

-- Dokumen yang terikat ke sesi chat (union; bertahan saat chat dibuka ulang).
alter table public.chat_sessions
  add column if not exists document_ids jsonb not null default '[]'::jsonb;

alter table public.user_documents enable row level security;