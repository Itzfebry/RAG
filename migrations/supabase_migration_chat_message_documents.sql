-- Lampiran dokumen per pesan chat. Jalankan sekali di Supabase SQL Editor.
-- Menyimpan doc_id yang menempel pada tiap pesan agar chip lampiran tetap
-- tampil saat chat dibuka kembali. Backend tetap berjalan (fallback JSON lokal)
-- sebelum kolom ini ada.
alter table public.chat_messages
  add column if not exists document_ids jsonb not null default '[]'::jsonb;
