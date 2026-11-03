"""Penyimpanan dokumen lampiran chat (server-side, per user).

Teks hasil ekstraksi file disimpan di sini, bukan dikirim balik ke client.
Client hanya memegang `doc_id`; endpoint chat memuat teks dari server setelah
memverifikasi kepemilikan. Dokumen ikut terhapus otomatis setelah
`DOC_RETENTION_DAYS` (selaras retensi riwayat chat).
"""

import uuid
from datetime import datetime
from typing import Any


class DocumentMixin:
    DOC_RETENTION_DAYS = 7
    DOC_MAX_CHARS = 120_000
    DOC_MAX_PER_USER = 30

    @staticmethod
    def _documents_file() -> str:
        return "user_documents.json"

    @staticmethod
    def _doc_cutoff_iso() -> str:
        from datetime import timedelta

        from backend.database.db import DatabaseService

        return (datetime.now() - timedelta(days=DatabaseService.DOC_RETENTION_DAYS)).isoformat()

    @staticmethod
    def purge_expired_documents() -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        cutoff = DatabaseService._doc_cutoff_iso()
        if supabase_client:
            try:
                supabase_client.table("user_documents").delete().lt("created_at", cutoff).execute()
            except Exception as e:
                logger.warning(f"Error purging documents in Supabase: {e}")
        rows = _read_local_json(DatabaseService._documents_file(), [])
        kept = [d for d in rows if str(d.get("created_at") or "") >= cutoff]
        if len(kept) != len(rows):
            _write_local_json(DatabaseService._documents_file(), kept)

    @staticmethod
    def public_document_metadata(doc: dict[str, Any]) -> dict[str, Any]:
        """Metadata dokumen yang aman dikirim ke client (tanpa isi teks)."""
        return {
            "id": str(doc.get("id")),
            "title": str(doc.get("title") or "Dokumen"),
            "char_count": int(doc.get("char_count") or 0),
            "truncated": bool(doc.get("truncated")),
            "page_count": doc.get("page_count"),
            "file_type": str(doc.get("file_type") or ""),
            "created_at": doc.get("created_at"),
        }

    @staticmethod
    def save_user_document(
        user_id: str,
        *,
        title: str,
        content: str,
        file_type: str = "",
        truncated: bool = False,
        page_count: int | None = None,
    ) -> dict[str, Any]:
        """Simpan dokumen hasil ekstraksi. Return baris lengkap (termasuk isi)."""
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        DatabaseService.purge_expired_documents()
        text = str(content or "")
        row = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id),
            "title": str(title or "Dokumen")[:180],
            "content": text,
            "char_count": len(text),
            "truncated": bool(truncated),
            "page_count": page_count,
            "file_type": str(file_type or "")[:32],
            "created_at": datetime.now().isoformat(),
        }
        if supabase_client:
            try:
                res = supabase_client.table("user_documents").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error saving document in Supabase: {e}")
        rows = _read_local_json(DatabaseService._documents_file(), [])
        rows.append(row)
        # Jaga agar fallback lokal tidak membengkak: buang dokumen terlama milik user.
        mine = [d for d in rows if str(d.get("user_id")) == str(user_id)]
        if len(mine) > DatabaseService.DOC_MAX_PER_USER:
            drop = {
                str(d["id"])
                for d in sorted(mine, key=lambda d: str(d.get("created_at") or ""))[: -DatabaseService.DOC_MAX_PER_USER]
            }
            rows = [d for d in rows if str(d.get("id")) not in drop]
        _write_local_json(DatabaseService._documents_file(), rows)
        return row

    @staticmethod
    def get_user_document(user_id: str, doc_id: str) -> dict[str, Any] | None:
        """Ambil dokumen milik user. None bila tidak ada / bukan pemilik."""
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if not str(doc_id or "").strip():
            return None
        if supabase_client:
            try:
                res = (
                    supabase_client.table("user_documents")
                    .select("*")
                    .eq("id", str(doc_id))
                    .eq("user_id", str(user_id))
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error reading document in Supabase: {e}")
        for d in _read_local_json(DatabaseService._documents_file(), []):
            if str(d.get("id")) == str(doc_id) and str(d.get("user_id")) == str(user_id):
                return d
        return None

    @staticmethod
    def list_user_documents(user_id: str, doc_ids: list[str] | None = None) -> list[dict[str, Any]]:
        """Ambil banyak dokumen milik user sekaligus (urutan mengikuti `doc_ids`)."""
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        wanted = [str(i) for i in (doc_ids or []) if str(i).strip()]
        if not wanted:
            return []
        rows: list[dict[str, Any]] = []
        if supabase_client:
            try:
                res = (
                    supabase_client.table("user_documents")
                    .select("*")
                    .eq("user_id", str(user_id))
                    .in_("id", wanted)
                    .execute()
                )
                rows = list(res.data or [])
            except Exception as e:
                logger.warning(f"Error listing documents in Supabase: {e}")
        if not rows:
            all_rows = _read_local_json(DatabaseService._documents_file(), [])
            index = {str(d.get("id")): d for d in all_rows if str(d.get("user_id")) == str(user_id)}
            rows = [index[i] for i in wanted if i in index]
        by_id = {str(d.get("id")): d for d in rows}
        return [by_id[i] for i in wanted if i in by_id]

    @staticmethod
    def delete_user_document(user_id: str, doc_id: str) -> bool:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if DatabaseService.get_user_document(user_id, doc_id) is None:
            return False
        if supabase_client:
            try:
                supabase_client.table("user_documents").delete().eq("id", str(doc_id)).eq(
                    "user_id", str(user_id)
                ).execute()
            except Exception as e:
                logger.warning(f"Error deleting document in Supabase: {e}")
        rows = _read_local_json(DatabaseService._documents_file(), [])
        _write_local_json(DatabaseService._documents_file(), [d for d in rows if str(d.get("id")) != str(doc_id)])
        return True

    @staticmethod
    def _session_docs_file() -> str:
        return "chat_documents.json"

    @staticmethod
    def _read_session_doc_ids(session_id: str) -> list[str]:
        from backend.database.db import DatabaseService, _read_local_json

        mapping = _read_local_json(DatabaseService._session_docs_file(), {})
        return [str(i) for i in (mapping.get(str(session_id)) or []) if str(i).strip()]

    @staticmethod
    def _write_session_doc_ids(session_id: str, doc_ids: list[str]) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json

        mapping = _read_local_json(DatabaseService._session_docs_file(), {})
        mapping[str(session_id)] = list(dict.fromkeys(doc_ids))
        _write_local_json(DatabaseService._session_docs_file(), mapping)

    @staticmethod
    def bind_documents_to_session(user_id: str, session_id: str, doc_ids: list[str]) -> list[str]:
        """Kaitkan dokumen ke sesi chat (union, tidak menghapus yang lama).

        Return daftar `document_ids` final milik sesi. Fallback lokal selalu
        ditulis agar tetap bekerja sebelum migrasi kolom `document_ids` jalan.
        """
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        session = DatabaseService.get_chat_session(user_id, session_id)
        if session is None:
            return []
        # Hanya dokumen milik user yang boleh diikat.
        owned = {str(d.get("id")) for d in DatabaseService.list_user_documents(user_id, doc_ids)}
        current = [str(i) for i in (session.get("document_ids") or []) if str(i).strip()]
        current += DatabaseService._read_session_doc_ids(session_id)
        merged = list(dict.fromkeys([*current, *[i for i in doc_ids if i in owned]]))
        DatabaseService._write_session_doc_ids(session_id, merged)
        if supabase_client:
            try:
                supabase_client.table("chat_sessions").update({"document_ids": merged}).eq("id", session_id).eq(
                    "user_id", str(user_id)
                ).execute()
            except Exception as e:
                logger.warning(f"Error binding documents in Supabase: {e}")
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        for s in sessions:
            if str(s.get("id")) == str(session_id) and str(s.get("user_id")) == str(user_id):
                s["document_ids"] = merged
        _write_local_json(DatabaseService._chats_file(), sessions)
        return merged

    @staticmethod
    def session_documents(user_id: str, session_id: str) -> list[dict[str, Any]]:
        """Metadata dokumen yang terikat ke sesi chat (untuk buka ulang chat)."""
        from backend.database.db import DatabaseService

        session = DatabaseService.get_chat_session(user_id, session_id)
        if session is None:
            return []
        ids = [str(i) for i in (session.get("document_ids") or []) if str(i).strip()]
        ids += DatabaseService._read_session_doc_ids(session_id)
        ids = list(dict.fromkeys(ids))
        return [DatabaseService.public_document_metadata(d) for d in DatabaseService.list_user_documents(user_id, ids)]
