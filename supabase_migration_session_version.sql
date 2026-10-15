-- Revoke sesi user (logout / ganti sandi). Jalankan di Supabase SQL Editor (project aplikasi). Aman dijalankan ulang.

alter table app_users add column if not exists session_version int not null default 0;
