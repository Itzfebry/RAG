-- Login/daftar via email OTP (tanpa sandi).
-- Jalankan di Supabase SQL Editor (project aplikasi). Aman dijalankan ulang.

alter table app_users add column if not exists email text;
alter table app_users add column if not exists email_verified boolean not null default false;

create unique index if not exists app_users_email_key on app_users (lower(email)) where email is not null;

create table if not exists email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null default 'login',
  code_hash text not null,
  attempts int not null default 0,
  display_name text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists email_otps_email_purpose_idx on email_otps (lower(email), purpose, created_at desc);
