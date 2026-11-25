-- Alur discovery publik (pivot ITZ AI -> agensi jasa AI/web/mobile).
-- Jalankan sekali di Supabase SQL Editor. Idempoten: aman dijalankan ulang.
--
-- Isi:
--   1. Tabel discovery_briefs - hasil sesi discovery + kontak klien (lead).
--   2. Kolom baru app_settings untuk parameter discovery & perbandingan RAG.
--
-- Catatan: percakapan discovery TIDAK disimpan per turn (mahal di serverless).
-- Transcript dikirim client sekali saat menyimpan brief dan disimpan sebagai jsonb.

create table if not exists public.discovery_briefs (
  id              uuid primary key default gen_random_uuid(),
  session_key     text not null,
  name            text,
  contact_channel text,
  contact_value   text,
  summary         text,
  brief           jsonb not null default '{}'::jsonb,
  transcript      jsonb not null default '[]'::jsonb,
  -- Pipeline follow-up: new -> contacted -> quoted -> won | lost
  status          text not null default 'new',
  notes           text,
  turn_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists discovery_briefs_created_idx on public.discovery_briefs (created_at desc);
create index if not exists discovery_briefs_session_idx on public.discovery_briefs (session_key);
create index if not exists discovery_briefs_status_idx on public.discovery_briefs (status);

alter table public.discovery_briefs enable row level security;

-- Parameter discovery (semua bisa di-override dari app_settings; nilai di sini
-- hanya default supaya baris id=1 lengkap).
alter table public.app_settings add column if not exists discovery_max_turns int;
alter table public.app_settings add column if not exists discovery_ip_per_min int;
alter table public.app_settings add column if not exists discovery_ip_per_day int;
alter table public.app_settings add column if not exists rag_threshold_low double precision;
alter table public.app_settings add column if not exists rag_threshold_high double precision;

update public.app_settings
set
  discovery_max_turns   = coalesce(discovery_max_turns, 10),
  discovery_ip_per_min  = coalesce(discovery_ip_per_min, 12),
  discovery_ip_per_day  = coalesce(discovery_ip_per_day, 60),
  rag_threshold_low     = coalesce(rag_threshold_low, 0.55),
  rag_threshold_high    = coalesce(rag_threshold_high, 0.67)
where id = 1;
