-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Kolom flag `unlimited` per user (tombol Unlimited panel admin)
--
-- Latar belakang:
-- - Backend memakai flag `unlimited` di tabel app_users (quota_repo.py
--   QuotaMixin._is_unlimited) untuk akses tanpa batas per user.
-- - Tanpa kolom ini, set request admin_update_user yang menyentuh
--   `unlimited` gagal di Supabase (error kolom, di-log sebagai warning),
--   update_user() mengembalikan None, dan endpoint /admin/users/{id} crash:
--   AttributeError: 'NoneType' object has no attribute 'get'.
--
-- Idempotent: aman dijalankan berulang di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.app_users
  add column if not exists unlimited boolean not null default false;

-- Nilai lama max_prompts = 0 tidak lagi berarti unlimited (lihat
-- pricing_ui). Set true hanya bila admin memang menandainya dari panel.
-- (Tidak ada data backfill otomatis; flag mulai false untuk semua user.)
