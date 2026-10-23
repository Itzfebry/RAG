-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Grant kuota manual per user dari panel admin.
--
-- Dipakai oleh:
--   POST   /admin/users/{id}/quota  (angka + paket acuan, opsional masa aktif)
--   DELETE /admin/users/{id}/quota  (hapus grant, kembali ke paket/default)
--
-- Semantik (lihat backend/database/quota_repo.py):
--   unlimited flag (paling kuat)
--   > manual grant (3 kolom di bawah)
--   > order paid terbaru (batas dari pricing_config.plans)
--   > default global `pricing_config.default_daily_prompts`
--
-- manual_expires_at NULL = tanpa batas waktu.
-- Idempotent: aman dijalankan berulang di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.app_users
  add column if not exists manual_daily_limit integer;

alter table public.app_users
  add column if not exists manual_plan_label text;

alter table public.app_users
  add column if not exists manual_expires_at text;

-- Tidak ada backfill: user tanpa kolom terisi = tanpa grant manual.