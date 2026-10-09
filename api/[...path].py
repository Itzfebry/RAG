"""Vercel Python function — catch-all for /api/*.

File-based Python functions (api/*.py) are Vercel's documented way to run a
Python backend alongside Next.js in one project. Every /api/* request that is
not a Next.js route lands here and is handled by the FastAPI app.

/api/python/:path* is rewritten to /api/:path* by next.config.mjs in prod.
"""
import os
import sys

# Vercel's Python module search path starts at this file's directory; add the
# project root so `backend.*` imports resolve inside the function bundle.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.api.main import app  # noqa: E402

__all__ = ["app"]
