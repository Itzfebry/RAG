-- Fitur pricing: konfigurasi paket + order manual (QRIS / transfer). Jalankan sekali di Supabase SQL Editor.
-- Idempoten: aman dijalankan ulang.

-- Konfigurasi pricing (satu baris). plans disimpan sebagai jsonb.
create table if not exists public.pricing_config (
  id                    int primary key default 1,
  plans                 jsonb not null default '[]'::jsonb,
  payment_qris          text,
  payment_instructions  text,
  contact               text,
  order_note            text,
  updated_at            text
);

insert into public.pricing_config (id, plans, updated_at)
values (1, '[]'::jsonb, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS'))
on conflict (id) do nothing;

alter table public.pricing_config enable row level security;

-- Order paket prompt. status: pending -> paid | cancelled.
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  plan_id       text not null,
  plan_label    text,
  prompts       int not null default 0,
  amount        bigint not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  note          text,
  proof         text,
  created_at    text not null,
  paid_at       text,
  confirmed_by  text,
  updated_at    text
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;