"""Vercel Python function — dipanggil untuk SEMUA request /api/* dan /v1/*.

Routing diatur di `vercel.json` (rewrite platform → `/api/app`):
  /api/:path* → /api/app, /v1/:path* → /api/app

PENTING: function Python non-Next di Vercel TIDAK mendukung catch-all
`[...path]` — pola filename bracket hanya jadi 1 segmen dinamis (fitur
catch-all milik Next.js). Karena itu endpoint function harus path statis
(`api/app.py`) dan semua request dialihkan lewat rewrite platform, buat
filesystem-routes. Rewrite hanya memilih handler; path request ASLI yang
diterima FastAPI — prefix /api/python/* (dipakai frontend) dan /v1/*
dinormalisasi oleh wrapper di bawah ini.
"""
import os
import sys

# Vercel's Python module search path starts at this file's directory; add the
# project root so `backend.*` imports resolve inside the function bundle.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.api.main import app as fastapi_app  # noqa: E402


class _NormalizePath:
    """ASGI wrapper: buang prefix /api/python dan /v1 sebelum FastAPI routing.

    Dev (next dev / uvicorn lokal) sudah me-strip prefix lewat next.config,
    tapi path asli yang sampai ke function via vercel.json rewrite masih
    membawa prefix — buang di sini supaya route FastAPI (/api/*) cocok.
    """

    def __init__(self, app):
        self._app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope["path"]
            if path.startswith("/api/python/"):
                scope["path"] = "/api/" + path[len("/api/python/"):]
            elif path == "/api/python":
                scope["path"] = "/api"
            elif path.startswith("/v1/"):
                scope["path"] = "/api/v1/" + path[len("/v1/"):]
            elif path == "/v1":
                scope["path"] = "/api/v1"
        await self._app(scope, receive, send)


app = _NormalizePath(fastapi_app)

__all__ = ["app"]
