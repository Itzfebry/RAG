-- Audit log aksi admin. Jalankan sekali di Supabase SQL Editor.
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  text not null,
  actor       text not null,
  action      text not null,
  target      text,
  detail      text,
  ip          text
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
