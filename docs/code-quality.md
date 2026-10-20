# Panduan Kualitas Kode & Tooling

Project ini memakai otomatisasi lint/format/test agar gaya kode konsisten dan
regresi tertangkap lebih awal. Panduan tambahan resep investasi (Perpustakaan)
mantap — mulai dari sini kalau ragu.

## Python (backend)

Tool: **ruff** (lint + formatter), **pytest**, **coverage**.

```bash
python -m ruff check .            # lint
python -m ruff check . --fix      # lint + autofix
python -m ruff format .           # format
python -m ruff format --check .   # verifikasi format (dipakai CI)
python -m pytest backend/tests -q # test
```

Konfigurasi ada di `pyproject.toml`. Aturan aktif: pycodestyle, pyflakes,
isort, bugbear, pyupgrade, simplify, comprehensions, ruff-specific.

Catatan penting:

- `B008` dimatikan karena idiom `Depends()` FastAPI butuh call di default arg.
- `E501` dimatikan karena formatter sudah menangani panjang baris.
- Hindari `except Exception: pass` baru — pakai `contextlib.suppress(Exception)`
  atau log errornya (`from backend.core.logging_config import get_logger`).

## Logging

Ganti kebiasaan `print()`. Gunakan:

```python
from backend.core.logging_config import configure_logging, get_logger

logger = get_logger(__name__)
logger.info("Loaded %s entries", n)
```

`configure_logging()` dipanggil satu kali dari `backend/api/main.py`.
Level diatur via env `LOG_LEVEL` (default `INFO`). Library berisik
(httpx/openai/supabase) dipaksa `WARNING`.

## Frontend (Next.js)

Tool: **ESLint** (flat config), **Prettier**, **tsc**.

```bash
npm run lint          # eslint .
npm run lint:fix      # eslint . --fix
npm run format        # prettier --write .
npm run format:check  # prettier --check .
npm run check         # lint + format:check sekaligus
```

Konfigurasi: `eslint.config.mjs`, `.prettierrc.json`.

Known limitations:

- TypeScript sengaja dipin `^6.0.3` — typescript-eslint belum mendukung
  TypeScript 7.x / 6.1+. Aktifkan `eslint-config-next/typescript` again
  setelah supporting typescript-eslint tersedia (lihat komentar di config).
- Dua aturan React baru diturunkan ke `warn` sampai Tahap 3 merefaktor
  targetnya: `react-hooks/set-state-in-effect`, `react-hooks/refs`
  (~12 lokasi: `app/chat/page.tsx`, `components/ui/orbital-sphere.tsx`,
  dll.). Promosikan kembali ke `error` setelah diperbaiki.

## Dependencies

- Python: dipin dengan `~=` di `requirements.txt` (reproducible, patch update
  boleh). Bump manual lalu jalankan test.
- Frontend: `package-lock.json` + `npm ci` di CI.

## Git hooks (pre-commit)

```bash
pip install pre-commit
pre-commit install                 # aktifkan di repo ini
pre-commit run --all-files         # jalankan sekali di seluruh repo
```

Hook: ruff (check+format), trailing-whitespace, EOF-fixer, check-YAML/JSON,
merge-conflict, prettier untuk file TS/CSS/JSON frontend.

## CI

`.github/workflows/ci.yml` menjalankan dua job di setiap push/PR:
1. Python — ruff check, format check, pytest.
2. Frontend — eslint, prettier check, `tsc --noEmit`.

## Roadmap ke 10/10 (tahap berikutnya)

- [x] Tahap 2 — Backend (selesai):
      print() → logger (68 titik), `enforce_rate_limit` helper (28 boilerplate
      dihapus), layering fix (0 akses supabase langsung di API), `db.py`
      dipecah jadi 9 module mixin + facade (1.559 → 105 baris), `agent.py`
      stream helper ekstraksi, +18 test refactor (total 134).
- [x] Tahap 3 — Frontend (selesai):
      `fetchApi<T>` helper (64 → 2 raw fetch; sisanya SSE/blob), 0 `any`
      di app+components+lib dengan `lib/api-types.ts` shared types,
      `AdminPanel.tsx` (4.389 baris) dipecah menjadi 4 hooks, 11 tab
      komponen, 2 modal — sisa 735 baris shell.
