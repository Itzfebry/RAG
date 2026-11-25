"""Selaraskan persona ITZ AI di database dengan persona konsultan agensi.

Menulis ulang baris config yang menentukan karakter jawaban ITZ AI:
ai_identity, ai_personality, communication_settings, system_instructions,
plus menambahkan gaya respons "Konsultan Bisnis" ke response_styles.

Sumber nilainya `backend/database/settings_repo.PERSONA_DEFAULTS` dan
`KONSULTAN_STYLE`, jadi fallback offline dan data produksi tidak menyimpang.

Jalankan:  python -m backend.seed_consultant_persona
"""

try:
    from backend.database.db import DatabaseService
    from backend.database.settings_repo import KONSULTAN_STYLE, PERSONA_DEFAULTS
except ImportError:
    from database.db import DatabaseService  # type: ignore
    from database.settings_repo import KONSULTAN_STYLE, PERSONA_DEFAULTS  # type: ignore

TABLES = (
    "ai_identity",
    "personal_information",
    "ai_personality",
    "communication_settings",
    "system_instructions",
)


def _sync_persona_tables() -> None:
    for table in TABLES:
        payload = dict(PERSONA_DEFAULTS[table])
        saved = DatabaseService.update_config_table(table, payload)
        keys = ", ".join(sorted(k for k in payload if k != "updated_at"))
        print(f"[persona] {table} diperbarui (id={saved.get('id')}) fields: {keys}")


def _sync_styles() -> None:
    cfg = DatabaseService.get_config_table("response_styles") or {}
    styles = [s for s in (cfg.get("styles") or []) if isinstance(s, dict)]
    existing = {str(s.get("id")) for s in styles}
    if KONSULTAN_STYLE["id"] in existing:
        # Tetap segarkan kontennya bila admin pernah mengubah teksnya.
        styles = [dict(KONSULTAN_STYLE) if str(s.get("id")) == KONSULTAN_STYLE["id"] else s for s in styles]
        action = "disinkronkan"
    else:
        styles = [dict(KONSULTAN_STYLE), *styles]
        action = "ditambahkan"
    DatabaseService.update_config_table("response_styles", {"styles": styles})
    style_id = KONSULTAN_STYLE["id"]
    print(f"[persona] gaya '{style_id}' {action}; total gaya: {len(styles)}")


def main() -> int:
    _sync_persona_tables()
    _sync_styles()
    print("[persona] selesai")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
