-- Parameter RAG yang bisa diatur dari admin. Jalankan sekali di Supabase SQL Editor.
-- Idempoten: aman dijalankan ulang. Nilai default sama dengan default kode.

alter table public.app_settings add column if not exists rag_match_count_short int;
alter table public.app_settings add column if not exists rag_match_count_long int;
alter table public.app_settings add column if not exists rag_match_threshold double precision;

update public.app_settings
set
  rag_match_count_short = coalesce(rag_match_count_short, 6),
  rag_match_count_long = coalesce(rag_match_count_long, 8)
where id = 1;
