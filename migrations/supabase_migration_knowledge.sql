-- Knowledge base (RAG): tabel + RPC semantic search.
-- Rekap definisi yang selama ini hanya hidup di DB live (tidak ada file migrasinya),
-- sehingga project Supabase baru bisa dibuat ulang dari repo.
-- Jalankan di Supabase SQL Editor. Idempoten - aman dijalankan ulang.

create extension if not exists vector;

-- ── Tabel ───────────────────────────────────────────────────────────────────

create table if not exists public.knowledge_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        varchar(50) unique not null,
  name        varchar(100) not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.knowledge_entries (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.knowledge_categories(id) on delete cascade,
  title       varchar(200) not null,
  content     text not null,
  tags        text[] default '{}',
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- embedding = Gemini gemini-embedding-2 (768 dim). Lihat supabase_migration_768.sql.
create table if not exists public.knowledge_embeddings (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid references public.knowledge_entries(id) on delete cascade,
  chunk_index   int not null default 0,
  content_chunk text not null,
  embedding     vector(768),
  created_at    timestamptz default now()
);

-- Full-text search (generated column). Dibiarkan idempoten agar tidak error
-- kalau kolomnya sudah dibuat oleh skema lama.
alter table public.knowledge_embeddings
  add column if not exists fts tsvector
  generated always as (to_tsvector('indonesian', content_chunk)) stored;

-- ── Index ───────────────────────────────────────────────────────────────────

create index if not exists knowledge_embeddings_vector_idx
  on public.knowledge_embeddings using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_embeddings_fts_idx
  on public.knowledge_embeddings using gin (fts);

create index if not exists knowledge_entries_category_idx
  on public.knowledge_entries (category_id);

-- ── RLS (service role only; frontend tidak memakai Supabase langsung) ───────

alter table public.knowledge_categories enable row level security;
alter table public.knowledge_entries    enable row level security;
alter table public.knowledge_embeddings enable row level security;

-- ── Seed kategori default (tanpa menimpa milik user) ────────────────────────

insert into public.knowledge_categories (slug, name, description) values
  ('technical_knowledge', 'Technical Knowledge', 'Owner technical skills, tools, and stack'),
  ('projects', 'Projects', 'Owner project context, goals, and details'),
  ('experience', 'Experience', 'Work and domain experience context'),
  ('preferences', 'Preferences', 'Personal and workflow preferences'),
  ('custom_topics', 'Custom Topics', 'Additional custom knowledge topics')
on conflict (slug) do nothing;

-- ── RPC: semantic search (dipakai backend/knowledge/knowledge_service.py) ───
-- Hapus semua overload dulu supaya tidak muncul PGRST203 (duplikat signature).

do $$
declare _oid oid;
begin
  for _oid in (select oid from pg_proc where proname = 'match_knowledge_entries')
  loop
    execute 'drop function ' || _oid::regprocedure;
  end loop;
end $$;

create function public.match_knowledge_entries(
  query_embedding vector(768),
  match_threshold float default 0.25,
  match_count     int   default 5
)
returns table (
  id            uuid,
  entry_id      uuid,
  content_chunk text,
  similarity    float
)
language sql stable
as $$
  select
    ke.id,
    ke.entry_id,
    ke.content_chunk,
    1 - (ke.embedding <=> query_embedding) as similarity
  from public.knowledge_embeddings ke
  join public.knowledge_entries en on en.id = ke.entry_id
  where en.is_active = true
    and ke.embedding is not null
    and 1 - (ke.embedding <=> query_embedding) >= match_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RPC: hybrid search (legacy - ada di DB live, tidak dipanggil backend) ───

do $$
declare _oid oid;
begin
  for _oid in (select oid from pg_proc where proname = 'hybrid_search')
  loop
    execute 'drop function ' || _oid::regprocedure;
  end loop;
end $$;

create function public.hybrid_search(
  query_text       text,
  query_embedding  vector(768),
  match_count      int   default 5,
  semantic_weight  float default 0.5,
  keyword_weight   float default 0.5
)
returns table (
  entry_id      uuid,
  content_chunk text,
  score         float
)
language plpgsql
as $$
begin
  return query
  with semantic_results as (
    select ke.entry_id, ke.content_chunk,
           1 - (ke.embedding <=> query_embedding) as similarity,
           row_number() over (order by ke.embedding <=> query_embedding) as rank
    from public.knowledge_embeddings ke
    join public.knowledge_entries en on en.id = ke.entry_id
    where en.is_active = true and ke.embedding is not null
    order by ke.embedding <=> query_embedding
    limit 20
  ),
  keyword_results as (
    select ke.entry_id, ke.content_chunk,
           ts_rank(ke.fts, plainto_tsquery('indonesian', query_text)) as rank_score,
           row_number() over (order by ts_rank(ke.fts, plainto_tsquery('indonesian', query_text)) desc) as rank
    from public.knowledge_embeddings ke
    join public.knowledge_entries en on en.id = ke.entry_id
    where en.is_active = true
      and ke.fts @@ plainto_tsquery('indonesian', query_text)
    order by rank_score desc
    limit 20
  )
  select
    coalesce(s.entry_id, k.entry_id) as entry_id,
    coalesce(s.content_chunk, k.content_chunk) as content_chunk,
    (coalesce(semantic_weight / (s.rank + 60), 0)
     + coalesce(keyword_weight / (k.rank + 60), 0)) as score
  from semantic_results s
  full outer join keyword_results k on s.entry_id = k.entry_id
  order by score desc
  limit match_count;
end;
$$;
