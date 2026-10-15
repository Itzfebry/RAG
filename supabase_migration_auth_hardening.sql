-- Auth hardening: kolom lengkap untuk app_users (register, Google OAuth, session versioning).
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang (idempoten).

alter table app_users add column if not exists provider text default 'manual';
alter table app_users add column if not exists email text;
alter table app_users add column if not exists email_verified boolean not null default false;
alter table app_users add column if not exists session_version int not null default 0;

create unique index if not exists app_users_email_key on app_users (lower(email)) where email is not null;
