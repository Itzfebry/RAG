-- ============================================================================
-- Metadata model embedding + versi chunker, dan knowledge_version untuk cache.
-- Jalankan di Supabase SQL Editor. Idempoten.
--
-- Kenapa: tanpa kolom ini, DB bisa berisi vektor dari dua model sekaligus
-- (mis. reindex parsial setelah ganti .env) tanpa cara mendeteksinya; dan
-- instance serverless tidak tahu index knowledge sudah berubah.
--
-- knowledge_version ada di app_settings; backend tetap jalan tanpa migrasi ini
-- (insert fallback tanpa kolom metadata), tapi deteksi model jadi tidak ada.
-- ============================================================================

alter table knowledge_embeddings add column if not exists embedding_model text;
alter table knowledge_embeddings add column if not exists chunker_version text;

create index if not exists knowledge_embeddings_model_idx
  on knowledge_embeddings (embedding_model);

alter table app_settings add column if not exists knowledge_version integer not null default 0;
