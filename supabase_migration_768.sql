-- ============================================================================
-- Migrasi dimensi embedding: vector(384) → vector(768)
-- Alasan: gemini-embedding-2 (MRL) — 768 direkomendasikan Google (768/1536/3072),
--         MTEB 67.99 vs 68.17@1536 (selisih ~0.2%), storage hemat 75% vs 3072.
-- Jalankan di Supabase SQL Editor (project xxwyhcdlifthahkvatka). Idempoten.
--
-- URUTAN WAJIB:
--   1. Jalankan file ini.
--   2. python -m backend.reindex_embeddings   (embed ulang semua chunk)
--   3. Restart backend.
-- ============================================================================

-- 1) Drop index vektor lama — harus sebelum ganti tipe kolom.
--    Filter "(embedding" supaya index pkey "(id)" ikut tersaring aman.
do $$
declare idx record;
begin
  for idx in
    select indexname from pg_indexes
    where tablename = 'knowledge_embeddings'
      and indexdef ilike '%(embedding%'
  loop
    execute format('drop index if exists %I', idx.indexname);
  end loop;
end $$;

-- 2) Kosongkan vektor lama — cast 384→768 tidak valid, dan memang wajib
--    reindex penuh dengan model baru.
delete from knowledge_embeddings;

-- 3) Ganti dimensi kolom (tabel sudah kosong, aman).
alter table knowledge_embeddings
  alter column embedding type vector(768);

-- 4) Bangun ulang index HNSW cosine — tabel kosong, instan.
create index if not exists knowledge_embeddings_vector_idx
  on knowledge_embeddings using hnsw (embedding vector_cosine_ops);

-- 5) Signature RPC ikut 768 — PostgREST strict-cast parameter vector.
--    Return type fungsi live beda dari definisi lama, jadi Postgres menolak
--    CREATE OR REPLACE (error 42P13) — drop dulu sesuai hint resminya, lalu
--    buat ulang. "if exists" membuat langkah ini idempoten.
drop function if exists match_knowledge_entries(vector, double precision, integer);
drop function if exists match_knowledge_entries(vector, real, integer);

create or replace function match_knowledge_entries (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 5
)
returns table (
  id uuid,
  entry_id uuid,
  content_chunk text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ke.id,
    ke.entry_id,
    ke.content_chunk,
    1 - (ke.embedding <=> query_embedding) as similarity
  from knowledge_embeddings ke
  join knowledge_entries k on k.id = ke.entry_id
  where k.is_active = true
    and 1 - (ke.embedding <=> query_embedding) > match_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
end;
$$;
