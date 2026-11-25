"""Jalankan SQL ke Supabase via Management API (butuh SUPABASE_ACCESS_TOKEN).

Pakai:  python tools/supabase_sql.py "select 1"
        python tools/supabase_sql.py --file migrations/xxx.sql
"""
from __future__ import annotations

import argparse
import contextlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> dict[str, str]:
    vals: dict[str, str] = {}
    for name in (".env", ".env.local"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            vals.setdefault(k.strip(), v)
    return vals


def api_query(ref: str, token: str, sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode("utf-8", "replace")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return body


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sql", nargs="?", help="SQL inline")
    ap.add_argument("--file", help="File .sql yang dijalankan")
    args = ap.parse_args()

    env = load_env()
    ref = env["SUPABASE_URL"].replace("https://", "").split(".")[0]
    token = env["SUPABASE_ACCESS_TOKEN"]

    if args.file:
        sql = (ROOT / args.file).read_text(encoding="utf-8")
    elif args.sql:
        sql = args.sql
    else:
        print("butuh SQL atau --file", file=sys.stderr)
        return 2

    try:
        out = api_query(ref, token, sql)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')}", file=sys.stderr)
        return 1
    text = json.dumps(out, indent=2, ensure_ascii=False) if not isinstance(out, str) else out
    # Windows console default (cp1252) tidak bisa mencetak teks non-latin.
    with contextlib.suppress(Exception):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
