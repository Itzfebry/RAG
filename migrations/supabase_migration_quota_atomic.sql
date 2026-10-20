-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Operasi kuota ATOMIK di sisi database
--
-- Perbaikan dua race condition:
-- 1. Trial per-IP: sebelumnya read-then-write dua langkah (get -> check ->
--    increment terpisah), N request paralel bisa semua lolos gate sebelum
--    ada yang increment. Sekarang cek-batas+increment jadi SATU statement.
-- 2. Legacy prompts_used: sebelumnya get_user -> +1 -> update (read-modify-
--    write). Dua request paralel bisa saling menimpa (lost update). Sekarang
--    increment dilakukan di SQL, bukan di aplikasi.
-- ══════════════════════════════════════════════════════════════════════════

-- Konsumsi 1 trial prompt untuk IP, atomik cek-batas+inkrement.
-- Return true : kuota trial terpakai.
-- Return false: batas trial IP ini sudah habis (counter tidak berubah).
create or replace function public.consume_trial_prompt(p_ip text, p_limit int)
returns boolean
language plpgsql
as $$
declare
  v int;
begin
  if p_ip is null or p_limit is null then
    return false;
  end if;
  with up as (
    insert into public.trial_usage (ip, used, updated_at)
    values (p_ip, 1, (now() at time zone 'Asia/Jakarta')::text)
    on conflict (ip)
      do update set used     = public.trial_usage.used + 1,
                    updated_at = (now() at time zone 'Asia/Jakarta')::text
      where public.trial_usage.used + 1 <= p_limit
    returning used
  )
  select 1 from up into v;
  return v is not null;
end;
$$;

-- Refund 1 trial prompt pada IP (provider gagal/tidak menjawab).
-- Guard used > 0 memastikan counter tidak pernah negatif.
create or replace function public.refund_trial_prompt(p_ip text)
returns void
language sql
as $$
  update public.trial_usage
     set used       = greatest(used - 1, 0),
         updated_at = (now() at time zone 'Asia/Jakarta')::text
   where ip = p_ip
     and used > 0;
$$;

-- Increment kuota terpakai user (legacy max_prompts) ATOMIK di SQL.
-- Menghilangkan lost update dari read-modify-write di aplikasi.
create or replace function public.increment_prompt_usage(p_user_id uuid)
returns void
language sql
as $$
  update public.app_users
     set prompts_used = prompts_used + 1,
         updated_at   = (now() at time zone 'Asia/Jakarta')::text
   where id = p_user_id;
$$;
