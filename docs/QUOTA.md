# Model Kuota (Quota) & Paket Harian

Dokumen ini merangkum bagaimana kuota prompt dihitung, dari mana nilainya
diambil, dan migrasi mana yang wajib dijalankan. Sumber kebenaran kode:
`backend/database/quota_repo.py` (`QuotaMixin`).

## Urutan prioritas (menang dari atas)

1. **`unlimited` flag** — kolom `app_users.unlimited` (tombol *Unlimited* di
   panel admin). Bila `true`, user tidak dibatasi kuota harian.
2. **Grant manual admin** — kolom `app_users.manual_daily_limit` /
   `manual_plan_label` / `manual_expires_at`. Diberikan lewat modal kuota di
   tab Users. `manual_expires_at` kosong = tanpa batas waktu.
3. **Order paid terbaru** — batas dibaca dari `pricing_config.plans` (field
   `prompts`), bukan snapshot saat pembelian. Order dengan `days` yang sudah
   lewat dianggap `expired` (sisa kuota 0).
4. **Kuota default global** — `pricing_config.default_daily_prompts`.

Kolom legacy `max_prompts` / `prompts_used` **tidak lagi** dipakai untuk
gating; nilainya hanya disimpan sebagai riwayat. Karena itu user tanpa paket
paid dianggap tanpa batas bila kuota default global = 0.

## Periode reset

Reset berbasis **hari WIB (Asia/Jakarta)**, bukan scheduler. Kunci baris adalah
`user_daily_quota.quota_day` sehingga pergantian hari hanya mengganti kunci;
row hari sebelumnya tidak dihapus.

## Endpoint terkait

| Endpoint | Fungsi |
|---|---|
| `GET /user/me`, `GET /user/verify` | Status kuota untuk UI chat |
| `GET /admin/users` | Daftar user + status kuota (bulk, 3 query) |
| `POST /admin/users/{id}/quota` | Beri/ubah grant manual (`prompts`, `plan_id?`, `label?`, `days?`) |
| `DELETE /admin/users/{id}/quota` | Hapus grant manual |
| `PATCH /admin/users/{id}` | Termasuk flag `unlimited` |
| `GET /admin/stats`, `GET /admin/token-usage` | Metrik pemakaian hari ini |

## Migrasi wajib (jalankan di Supabase SQL Editor)

Semua idempotent, aman dijalankan berulang:

1. `migrations/supabase_migration_daily_quota.sql` — tabel `user_daily_quota`
   dan periode harian.
2. `migrations/supabase_migration_quota_atomic.sql` — RPC konsumsi kuota
   atomik (mencegah bypass paralel).
3. `migrations/supabase_migration_pricing.sql` — `pricing_config`
   (`plans`, `default_daily_prompts`).
4. `migrations/supabase_migration_unlimited.sql` — kolom `app_users.unlimited`.
5. `migrations/supabase_migration_manual_quota.sql` — kolom grant manual
   (`manual_daily_limit`, `manual_plan_label`, `manual_expires_at`).

Tanpa migrasi 4 & 5, update user yang menyentuh `unlimited` / kuota manual
akan gagal di Supabase dan endpoint mengembalikan error yang menyebut nama
file migrasinya.
