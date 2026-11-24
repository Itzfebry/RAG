# Deploy & migrasi

Ringkas. Semua file SQL di `migrations/` idempoten kecuali yang ditandai.

## Urutan migrasi Supabase

Jalankan di SQL Editor, urut dari atas. Yang bertanda **wajib** baru ada di
deploy terbaru; sisanya sudah ada di project lama.

1. `supabase_migration.sql` - tabel inti (config, knowledge, embeddings, RPC).
2. `supabase_migration_knowledge.sql` - knowledge + RPC `match_knowledge_entries`.
3. `supabase_migration_768.sql` - **hanya jika** pindah ke 768 dim.
   **⚠ Menghapus seluruh isi `knowledge_embeddings`.** Wajib langsung diikuti:
   `python -m backend.tools.reindex_embeddings`.
4. `supabase_migration_rag_settings.sql` - `app_settings.rag_match_count_*` dan
   `rag_match_threshold`.
5. `supabase_migration_embedding_metadata.sql` - **wajib untuk deteksi model**:
   `embedding_model`, `chunker_version`, dan `app_settings.knowledge_version`.
   Tanpa kolom ini backend tetap jalan (insert fallback tanpa metadata), tapi
   `rag_cache` lintas instance tidak bisa diinvalidasi dan campuran model tidak
   terdeteksi.
6. Opsional: `supabase_migration_drop_legacy_fts.sql` - hapus `fts` +
   `hybrid_search()` yang tidak dipanggil runtime. Hanya jika tidak akan
   memakai hybrid search.
7. Migrasi fitur lain (boleh sebelum/sesudah 3-5, tidak saling bergantung):
   `auth_hardening`, `admin_session`, `session_version`, `audit`, `rate_limits`,
   `daily_quota`, `quota_atomic`, `manual_quota`, `free_quota_total`,
   `unlimited`, `pricing`, `profiles_tokens`, `email_otp`, `response_styles`,
   `documents`, `chat_history`, `chat_message_documents`.

Catatan urutan `match_knowledge_entries`: file `knowledge` memakai operator `>=`,
`768` memakai `>` untuk threshold. Definisi yang terakhir dijalankan yang
berlaku; jangan menjalankan ulang `knowledge` setelah `768`.

## Setelah migrasi

1. Cek `EMBEDDING_PROVIDER` + `EMBEDDING_DIM` cocok dengan kolom
   `knowledge_embeddings.embedding`. Backend menolak start bila `hf`/`local`
   (384 dim) dipasang dengan `EMBEDDING_DIM=768`.
2. `python -m backend.tools.reindex_embeddings` setelah ganti model/dimensi.
3. `/api/admin/health` menampilkan `embeddings.models` + `embeddings.mixed`;
   `mixed: true` artinya DB berisi vektor dari lebih dari satu model → reindex
   penuh.