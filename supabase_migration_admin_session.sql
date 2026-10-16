-- Sesi admin: versi sesi untuk membatalkan token admin saat logout.
-- Jalankan di Supabase SQL Editor. Idempoten: aman dijalankan ulang.

alter table public.app_settings add column if not exists admin_session_version int not null default 0;

update public.app_settings
set admin_session_version = coalesce(admin_session_version, 0)
where id = 1;