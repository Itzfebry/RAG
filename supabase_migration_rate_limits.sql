-- Rate limit / lockout terpusat agar konsisten lintas instance (Vercel serverless).
-- Jalankan di Supabase SQL Editor. Idempoten: aman dijalankan ulang.

create table if not exists public.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- Tambah 1 hitungan secara atomik. Reset jendela bila sudah lewat.
-- Return: count (hitungan dalam jendela ini), reset_in (detik sampai jendela reset).
create or replace function public.bump_rate_limit(p_key text, p_window int)
returns table(count int, reset_in int)
language plpgsql
as $$
declare
  v_count int;
  v_start timestamptz;
begin
  if p_window is null or p_window < 1 then
    p_window := 60;
  end if;

  insert into public.rate_limits(key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window)
          then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window)
          then now()
          else public.rate_limits.window_start
        end
  returning public.rate_limits.count, public.rate_limits.window_start
  into v_count, v_start;

  return query
    select v_count,
           greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window) - now()))))::int;
end;
$$;