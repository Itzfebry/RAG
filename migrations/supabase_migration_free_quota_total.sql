-- ═════════════════════════════════════════════════════════════════════════
-- Migration: Kuota gratis TOTAL (non-subscriber) — tanpa reset harian.
--
-- Prinsip:
-- - TIDAK mengubah tabel/kolom lama. Data kuota harian tetap.
-- - Non-subscriber memakai kunci periode tetap `free-total` pada tabel
--   `user_daily_quota` (bukan tanggal WIB), jadi pemakaian TIDAK pernah reset
--   dan terakumulasi seumur akun.
-- - Subscriber tetap memakai `consume_daily_prompt` (reset harian WIB).
-- - Kedua RPC baru bersifat ATOMIK (single statement), aman untuk request paralel.
--
-- Jalankan di Supabase SQL Editor SETELAH `supabase_migration_daily_quota.sql`.
-- ══════════════════════════════════════════════════════════════════════════

-- Kolom kuota gratis TOTAL di pricing_config. Sebelumnya tidak ada di skema,
-- sehingga simpan pengaturan dari panel admin gagal (fallback lokal saja).
alter table public.pricing_config
  add column if not exists default_daily_prompts int not null default 10;

-- Konsumsi 1 prompt untuk kuota gratis kumulatif (kunci `free-total`).
create or replace function public.consume_total_prompt(p_user_id text, p_limit int)
returns boolean
language plpgsql
as $$
declare
  v int;
begin
  if p_user_id is null or p_limit is null then
    return false;
  end if;
  with up as (
    insert into public.user_daily_quota (user_id, quota_day, prompts_used, updated_at)
    values (p_user_id, 'free-total', 1, (now() at time zone 'Asia/Jakarta')::text)
    on conflict (user_id, quota_day)
      do update set prompts_used = public.user_daily_quota.prompts_used + 1,
                    updated_at   = (now() at time zone 'Asia/Jakarta')::text
      where public.user_daily_quota.prompts_used + 1 <= p_limit
    returning prompts_used
  )
  select 1 from up into v;
  return v is not null;
end;
$$;

-- Refund 1 prompt pada kuota gratis kumulatif. Counter tidak pernah negatif.
create or replace function public.refund_total_prompt(p_user_id text)
returns void
language sql
as $$
  update public.user_daily_quota
     set prompts_used = greatest(prompts_used - 1, 0),
         updated_at   = (now() at time zone 'Asia/Jakarta')::text
   where user_id   = p_user_id
     and quota_day = 'free-total'
     and prompts_used > 0;
$$;