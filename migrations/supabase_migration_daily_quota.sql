-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Kuota prompt harian (periode berbasis Asia/Jakarta)
--
-- Prinsip:
-- - TIDAK mengubah pricing_config, orders, maupun app_users (data lama aman).
-- - Pemakaian harian dicatat pada tabel baru `user_daily_quota` per
--   (user_id, quota_day). Row lama dibiarkan tetap ada sebagai catatan
--   penggunaan; pergantian hari cukup pindah kunci, tanpa update massal.
-- - `consume_daily_prompt` memotong kuota secara ATOMIK (single statement) —
--   request paralel tidak bisa melewati batas.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_daily_quota (
  user_id text not null,
  quota_day text not null,            -- tanggal WIB YYYY-MM-DD
  prompts_used integer not null default 0,
  updated_at text,
  primary key (user_id, quota_day)
);

create index if not exists idx_user_daily_quota_day
  on public.user_daily_quota (quota_day);

-- Tanggal WIB saat ini (satu sumber kebenaran periode kuota).
create or replace function public.wib_today()
returns text
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date::text;
$$;

-- Konsumsi 1 prompt untuk periode hari ini, atomik.
-- Return true  : kuota terpakai (counter bertambah, tidak pernah bisa negatif).
-- Return false : kuota periode ini sudah habis (counter tidak berubah).
create or replace function public.consume_daily_prompt(p_user_id text, p_limit int)
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
    values (p_user_id, public.wib_today(), 1, (now() at time zone 'Asia/Jakarta')::text)
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

-- Refund 1 prompt pada periode berjalan (mis. provider gagal menjawab).
-- Guard prompts_used > 0 memastikan counter tidak pernah negatif.
create or replace function public.refund_daily_prompt(p_user_id text)
returns void
language sql
as $$
  update public.user_daily_quota
     set prompts_used = greatest(prompts_used - 1, 0),
         updated_at   = (now() at time zone 'Asia/Jakarta')::text
   where user_id   = p_user_id
     and quota_day = public.wib_today()
     and prompts_used > 0;
$$;

-- Titik-batas token harian dikenali secara per-model (identifikasi model).
alter table public.token_usage
  add column if not exists models jsonb not null default '{}'::jsonb;
