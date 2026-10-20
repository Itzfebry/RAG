"""Facade `DatabaseService` — agregasi seluruh repo domain.

Public API tidak berubah; seluruh method lama tetap tersedia di sini.
State runtime (supabase_client, LOCAL_DATA_DIR, helper JSON lokal) tetap
diekspos dari module ini supaya monkeypatch pada module berjalan seperti semula.
"""

# Prelude versi lama: coba import via paket `backend`, fallback bare, lalu
# path-append untuk konteks eksekusi tidak biasa.
try:
    from backend.database.analytics_repo import UsageMixin
    from backend.database.billing_repo import BillingMixin
    from backend.database.cache import config_cache
    from backend.database.chat_repo import ChatMixin
    from backend.database.core import (
        LOCAL_DATA_DIR,
        _counter_lock,
        _read_local_json,
        _write_local_json,
        logger,
        supabase_client,
    )
    from backend.database.knowledge_repo import KnowledgeMixin
    from backend.database.rate_limit_repo import RateLimitMixin
    from backend.database.settings_repo import (
        RAG_SETTING_DEFAULTS,
        ConfigMixin,
        _clamp_rag_settings,
        _rag_settings_from_row,
    )
    from backend.database.trial_repo import TrialMixin
    from backend.database.users_repo import UsersMixin
except ImportError:
    try:
        from database.analytics_repo import UsageMixin  # type: ignore
        from database.billing_repo import BillingMixin  # type: ignore
        from database.cache import config_cache  # type: ignore
        from database.chat_repo import ChatMixin  # type: ignore
        from database.core import (  # type: ignore
            LOCAL_DATA_DIR,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )
        from database.knowledge_repo import KnowledgeMixin  # type: ignore
        from database.rate_limit_repo import RateLimitMixin  # type: ignore
        from database.settings_repo import (  # type: ignore
            RAG_SETTING_DEFAULTS,
            ConfigMixin,
            _clamp_rag_settings,
            _rag_settings_from_row,
        )
        from database.trial_repo import TrialMixin  # type: ignore
        from database.users_repo import UsersMixin  # type: ignore
    except ImportError:
        # Final fallback for unusual execution contexts
        import os
        import sys

        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from database.analytics_repo import UsageMixin  # type: ignore
        from database.billing_repo import BillingMixin  # type: ignore
        from database.cache import config_cache  # type: ignore
        from database.chat_repo import ChatMixin  # type: ignore
        from database.core import (  # type: ignore
            LOCAL_DATA_DIR,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )
        from database.knowledge_repo import KnowledgeMixin  # type: ignore
        from database.rate_limit_repo import RateLimitMixin  # type: ignore
        from database.settings_repo import (  # type: ignore
            RAG_SETTING_DEFAULTS,
            ConfigMixin,
            _clamp_rag_settings,
            _rag_settings_from_row,
        )
        from database.trial_repo import TrialMixin  # type: ignore
        from database.users_repo import UsersMixin  # type: ignore


class DatabaseService(
    ConfigMixin,
    KnowledgeMixin,
    RateLimitMixin,
    TrialMixin,
    UsersMixin,
    ChatMixin,
    BillingMixin,
    UsageMixin,
):
    """Facade: agregasi seluruh repo domain. Public API tidak berubah."""


__all__ = [
    "LOCAL_DATA_DIR",
    "RAG_SETTING_DEFAULTS",
    "DatabaseService",
    "_clamp_rag_settings",
    "_counter_lock",
    "_rag_settings_from_row",
    "_read_local_json",
    "_write_local_json",
    "config_cache",
    "logger",
    "supabase_client",
]
