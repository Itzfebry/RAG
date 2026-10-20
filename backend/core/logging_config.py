"""Central logging configuration for the RAG backend.

Replaces print() based logging with a properly leveled stdlib logging setup.
Import `get_logger` everywhere; call `configure_logging()` once from the app
entrypoint (backend/api/main.py / api/app.py).

Usage:
    from backend.core.logging_config import configure_logging, get_logger

    logger = get_logger(__name__)
    logger.info("Loaded %s knowledge entries", n)
"""

from __future__ import annotations

import logging
import os
import sys

_LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured = False


def configure_logging(level: str | None = None) -> None:
    """Initialize root logging for the backend. Safe to call more than once."""
    global _configured
    if _configured:
        return

    level_name = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    try:
        resolved = getattr(logging, level_name)
    except AttributeError:
        resolved = logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT))

    root = logging.getLogger()
    root.setLevel(resolved)
    root.addHandler(handler)

    # Keep noisy third-party libraries at WARNING regardless of our level.
    for noisy in ("httpx", "httpcore", "openai", "supabase", "postgrest", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.captureWarnings(True)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger for a module. Never reconfigures logging."""
    return logging.getLogger(name)


def log_exception_safely(logger: logging.Logger, message: str, exc: BaseException) -> None:
    """Log an unexpected failure with stack trace — use instead of `except Exception: pass`."""
    logger.exception("%s: %s", message, exc)
