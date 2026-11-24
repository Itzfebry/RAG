-- ============================================================================
-- Opsional: hapus legacy full-text index + RPC hybrid_search yang tidak dipakai.
-- Backend tidak pernah memanggil hybrid_search / kolom fts (cek: grep backend).
-- Kolom generated tsvector menambah biaya tulis + storage setiap insert.
--
-- Jalankan hanya kalau yakin tidak akan memakai hybrid search.
-- Idempoten.
-- ============================================================================

drop index if exists public.knowledge_embeddings_fts_idx;
alter table public.knowledge_embeddings drop column if exists fts;

do $$
declare _oid oid;
begin
  for _oid in (select oid from pg_proc where proname = 'hybrid_search')
  loop
    execute 'drop function ' || _oid::regprocedure;
  end loop;
end $$;