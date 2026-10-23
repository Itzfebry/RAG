import uuid
from datetime import UTC, datetime
from typing import Any


class UsersMixin:
    @staticmethod
    def _users_file() -> str:
        return "app_users.json"

    @staticmethod
    def list_users() -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        local = _read_local_json(DatabaseService._users_file(), [])
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").order("created_at", desc=True).execute()
                if res.data is not None:
                    supa = res.data
                    # Gabungkan user yang hanya ada di JSON lokal (mis. hasil fallback
                    # saat Supabase sempat gagal) supaya tidak tersembunyi di admin.
                    seen = {str(u.get("id")) for u in supa}
                    merged = list(supa) + [u for u in local if str(u.get("id")) not in seen]
                    merged.sort(key=lambda u: str(u.get("created_at") or ""), reverse=True)
                    return merged
            except Exception:
                pass
        return local

    @staticmethod
    def _mirror_user_local(user: dict[str, Any]) -> None:
        """Sinkronkan satu user ke JSON lokal (best-effort, untuk konsistensi dev)."""
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json

        try:
            users = _read_local_json(DatabaseService._users_file(), [])
            uid = str(user.get("id"))
            for i, u in enumerate(users):
                if str(u.get("id")) == uid:
                    users[i] = {**u, **user}
                    break
            else:
                users.append(user)
            _write_local_json(DatabaseService._users_file(), users)
        except Exception:
            pass

    @staticmethod
    def get_user_by_id(user_id: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").eq("id", user_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("id")) == str(user_id):
                return u
        return None

    @staticmethod
    def get_user_by_username(username: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        uname = str(username or "").strip().lower()
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").eq("username", uname).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("username") or "").strip().lower() == uname:
                return u
        return None

    @staticmethod
    def get_user_by_email(email: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        mail = str(email or "").strip().lower()
        if not mail:
            return None
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").ilike("email", mail).execute()
                for row in res.data or []:
                    if str(row.get("email") or "").strip().lower() == mail:
                        return row
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("email") or "").strip().lower() == mail:
                return u
        return None

    # ── Email OTP (verifikasi email & reset kata sandi). Tabel email_otps; fallback JSON lokal. ──
    @staticmethod
    def _otps_file() -> str:
        return "email_otps.json"

    @staticmethod
    def delete_email_otps(email: str, purpose: str) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                supabase_client.table("email_otps").delete().eq("email", email).eq("purpose", purpose).execute()
            except Exception as e:
                logger.warning(f"Error deleting OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        kept = [r for r in rows if not (r.get("email") == email and r.get("purpose") == purpose)]
        if len(kept) != len(rows):
            _write_local_json(DatabaseService._otps_file(), kept)

    @staticmethod
    def prune_email_otps(keep_hours: int = 24) -> None:
        """Buang OTP lama (default >24 jam) agar tabel/JSON tidak menumpuk.
        Best-effort: error tidak boleh menggagalkan alur kirim OTP."""
        from datetime import timedelta as _td

        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        cutoff = datetime.now(UTC) - _td(hours=max(1, int(keep_hours)))
        if supabase_client:
            try:
                supabase_client.table("email_otps").delete().lt("created_at", cutoff.isoformat()).execute()
            except Exception as e:
                logger.warning(f"Error pruning OTP in Supabase: {e}")
        try:
            rows = _read_local_json(DatabaseService._otps_file(), [])
            kept = []
            for r in rows:
                try:
                    dt = datetime.fromisoformat(str(r.get("created_at") or ""))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=UTC)
                    if dt >= cutoff:
                        kept.append(r)
                except Exception:
                    pass  # buang baris tanpa created_at valid
            if len(kept) != len(rows):
                _write_local_json(DatabaseService._otps_file(), kept)
        except Exception as e:
            logger.warning(f"Error pruning OTP locally: {e}")

    @staticmethod
    def create_email_otp(email: str, purpose: str, code_hash: str, expires_at: str) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        DatabaseService.delete_email_otps(email, purpose)
        DatabaseService.prune_email_otps()
        row = {
            "id": str(uuid.uuid4()),
            "email": email,
            "purpose": purpose,
            "code_hash": code_hash,
            "attempts": 0,
            "expires_at": expires_at,
            "created_at": datetime.now().isoformat(),
        }
        if supabase_client:
            try:
                res = supabase_client.table("email_otps").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error creating OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        rows.append(row)
        _write_local_json(DatabaseService._otps_file(), rows)
        return row

    @staticmethod
    def get_latest_email_otp(email: str, purpose: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        if supabase_client:
            try:
                res = (
                    supabase_client.table("email_otps")
                    .select("*")
                    .eq("email", email)
                    .eq("purpose", purpose)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return res.data[0]
            except Exception:
                pass
        rows = [
            r
            for r in _read_local_json(DatabaseService._otps_file(), [])
            if r.get("email") == email and r.get("purpose") == purpose
        ]
        if not rows:
            return None
        return max(rows, key=lambda r: str(r.get("created_at") or ""))

    @staticmethod
    def update_email_otp_attempts(otp_id: str, attempts: int) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                supabase_client.table("email_otps").update({"attempts": attempts}).eq("id", otp_id).execute()
                return
            except Exception as e:
                logger.warning(f"Error updating OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        for r in rows:
            if str(r.get("id")) == str(otp_id):
                r["attempts"] = attempts
                _write_local_json(DatabaseService._otps_file(), rows)
                break

    @staticmethod
    def create_user(data: dict[str, Any]) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        data = dict(data)
        data["id"] = data.get("id") or str(uuid.uuid4())
        data["username"] = str(data.get("username") or "").strip().lower()
        now = datetime.now().isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = now
        data.setdefault("prompts_used", 0)
        data.setdefault("is_active", True)
        data.setdefault("email_verified", False)
        data.setdefault("provider", "manual")
        data.setdefault("session_version", 0)
        if supabase_client:
            try:
                res = supabase_client.table("app_users").insert(data).execute()
                if res.data:
                    DatabaseService._mirror_user_local(res.data[0])
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error creating user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        users.append(data)
        _write_local_json(DatabaseService._users_file(), users)
        return data

    @staticmethod
    def update_user(user_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                patch2 = dict(patch)
                patch2["updated_at"] = datetime.now().isoformat()
                res = supabase_client.table("app_users").update(patch2).eq("id", user_id).execute()
                if res.data and len(res.data) > 0:
                    DatabaseService._mirror_user_local(res.data[0])
                    return res.data[0]
                # Update sempat gagal (mis. kolom belum ada) atau 0 rows cocok —
                # baca ulang row terkini supaya caller tidak menerima None saat
                # update Supabase partly-succeed atau user hanya ada di Sb.
                try:
                    fetch = supabase_client.table("app_users").select("*").eq("id", user_id).execute()
                    if fetch.data and len(fetch.data) > 0:
                        return fetch.data[0]
                except Exception as e:
                    logger.warning(f"Error re-fetching user after update: {e}")
            except Exception as e:
                logger.warning(f"Error updating user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        for i, u in enumerate(users):
            if str(u.get("id")) == str(user_id):
                merged = {**u, **patch, "updated_at": datetime.now().isoformat()}
                # keep username normalized
                if "username" in merged:
                    merged["username"] = str(merged["username"]).strip().lower()
                users[i] = merged
                _write_local_json(DatabaseService._users_file(), users)
                return merged
        # Terakhir: user mungkin hanya ada di Supabase (kolom baru menggagalkan
        # update) sedangkan mirror lokal tidak ada — kembalikan row terkini
        # supaya API tidak 500 dengan NoneType.get.
        if supabase_client:
            try:
                fetch = supabase_client.table("app_users").select("*").eq("id", user_id).execute()
                if fetch.data and len(fetch.data) > 0:
                    DatabaseService._mirror_user_local(fetch.data[0])
                    return fetch.data[0]
            except Exception as e:
                logger.warning(f"Error fetching user as last resort: {e}")
        return None

    @staticmethod
    def delete_user(user_id: str) -> bool:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        found = False
        if supabase_client:
            try:
                res = supabase_client.table("app_users").delete().eq("id", user_id).execute()
                if res.data:
                    found = True
            except Exception as e:
                logger.warning(f"Error deleting user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        new_users = [u for u in users if str(u.get("id")) != str(user_id)]
        if len(new_users) != len(users):
            _write_local_json(DatabaseService._users_file(), new_users)
            found = True
        return found

    @staticmethod
    def sync_local_users_to_supabase() -> int:
        """Dorong user yang hanya ada di JSON lokal ke Supabase.

        Kasus: create_user sempat gagal insert ke Supabase (mis. kolom baru belum
        ada) sehingga user hanya tercatat lokal (atau di /tmp serverless yang
        hilang). Return jumlah user yang berhasil dibuat.
        """
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if not supabase_client:
            return 0
        local = _read_local_json(DatabaseService._users_file(), [])
        if not local:
            return 0
        try:
            res = supabase_client.table("app_users").select("id").execute()
            existing = {str(r.get("id")) for r in (res.data or [])}
        except Exception as e:
            logger.warning(f"Error reading users for sync: {e}")
            return 0
        created = 0
        for u in local:
            if str(u.get("id")) in existing:
                continue
            try:
                ins = supabase_client.table("app_users").insert(dict(u)).execute()
                if ins.data:
                    created += 1
            except Exception as e:
                logger.warning(f"Error syncing local user {u.get('username')}: {e}")
        return created

    @staticmethod
    def increment_prompt_usage(user_id: str) -> dict[str, Any] | None:
        """Inkrement kuota terpakai ATOMIK: dihitung di SQL (RPC `increment_prompt_usage`).

        Menghilangkan lost update read-modify-write: dua request paralel kini
        masing-masing menambah counter, bukan saling menimpa. Fallback lokal
        memakai pola lama di bawah `_counter_lock` (per-process saja).
        """
        from backend.database.db import DatabaseService, _counter_lock, logger, supabase_client

        if supabase_client:
            try:
                supabase_client.rpc("increment_prompt_usage", {"p_user_id": user_id}).execute()
                return DatabaseService.get_user_by_id(user_id)
            except Exception as e:
                logger.warning(f"[quota] RPC increment_prompt_usage gagal, fallback lokal: {e}")
        with _counter_lock:
            u = DatabaseService.get_user_by_id(user_id)
            if not u:
                return None
            used = int(u.get("prompts_used", 0) or 0) + 1
            return DatabaseService.update_user(user_id, {"prompts_used": used})

    @staticmethod
    def is_prompt_quota_exhausted(user: dict[str, Any]) -> bool:
        """DEPRECATED — superseded by QuotaMixin.is_prompt_quota_exhausted.

        Defini ini dulu menang di MRO (UsersMixin sebelum QuotaMixin) sehingga
        gating kuota harian tidak pernah jalan untuk user dengan legacy
        `max_prompts = 0` (praktis semua user). Jangan hidupkan kembali di sini:
        delegasikan eksplisit ke implementasi kuota harian.
        """
        from backend.database.quota_repo import QuotaMixin

        return QuotaMixin.is_prompt_quota_exhausted(user)

    # ── User profile (display name override, tujuan, gaya respons) ──
    # Tabel Supabase user_profiles; fallback JSON lokal jika DB tidak bisa diakses.
    @staticmethod
    def _profiles_file() -> str:
        return "user_profiles.json"

    @staticmethod
    def get_user_profile(user_id: str) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        if supabase_client:
            try:
                res = (
                    supabase_client.table("user_profiles")
                    .select("profile")
                    .eq("user_id", str(user_id))
                    .limit(1)
                    .execute()
                )
                if res.data:
                    p = res.data[0].get("profile")
                    return p if isinstance(p, dict) else {}
                return {}
            except Exception:
                pass
        data = _read_local_json(DatabaseService._profiles_file(), {})
        p = data.get(str(user_id))
        return p if isinstance(p, dict) else {}

    @staticmethod
    def update_user_profile(user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, supabase_client

        current = DatabaseService.get_user_profile(user_id)
        current.update(patch)
        current["updated_at"] = datetime.now().isoformat()
        if supabase_client:
            try:
                supabase_client.table("user_profiles").upsert(
                    {"user_id": str(user_id), "profile": current, "updated_at": current["updated_at"]},
                    on_conflict="user_id",
                ).execute()
                return current
            except Exception:
                pass
        data = _read_local_json(DatabaseService._profiles_file(), {})
        data[str(user_id)] = current
        _write_local_json(DatabaseService._profiles_file(), data)
        return current
