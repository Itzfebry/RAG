"""Ekstraksi teks dokumen untuk command `/doc` (pengguna paket premium).

File TIDAK disimpan: teks hasil ekstraksi dikembalikan ke client, lalu client
mengirimnya kembali bersama pesan chat sebagai konteks sekali-pakai. Endpoint
tetap di-balik langganan (order paid / grant manual admin).
"""

import io
import os
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

try:
    from backend.api.users import get_current_user
    from backend.core.logging_config import get_logger
    from backend.database.db import DatabaseService
    from backend.security.rate_limiter import enforce_rate_limit, get_client_ip
except ImportError:
    from core.logging_config import get_logger  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from security.rate_limiter import enforce_rate_limit, get_client_ip  # type: ignore

    from api.users import get_current_user  # type: ignore

router = APIRouter(prefix="/api", tags=["User Documents"])
logger = get_logger(__name__)

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf"}
MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB per file (selaras pilihan produk)
MAX_CONTENT_CHARS = 120_000  # pengaman teks hasil ekstraksi


def _require_doc_access(user: dict[str, Any]) -> None:
    """403 bila user tidak berhak memakai fitur dokumen (doc_upload per paket)."""
    if not DatabaseService.can_use_document_feature(user):
        raise HTTPException(
            status_code=403,
            detail="Fitur dokumen khusus paket dengan akses upload dokumen. Berlangganan di halaman pricing.",
        )


def _extract_text(raw: bytes, suffix: str) -> str:
    """Ekstrak teks dari file upload. Raise HTTPException bila tidak terbaca."""
    if suffix == ".pdf":
        try:
            import pypdf
        except ImportError as e:  # pragma: no cover - dependency ada di requirements
            raise HTTPException(status_code=500, detail="Parser PDF tidak tersedia di server") from e
        try:
            reader = pypdf.PdfReader(io.BytesIO(raw))
            content = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            logger.warning(f"[documents] gagal membaca PDF: {e}")
            raise HTTPException(status_code=400, detail="PDF tidak bisa dibaca (mungkin terenkripsi/rusak)") from e
    else:
        content = raw.decode("utf-8", errors="ignore")
    return content.strip()


@router.post("/user/documents/extract")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Ekstrak teks dari satu file untuk dipakai chat. Tidak disimpan."""
    # Batasi parsing berulang (PDF mahal) per user+IP.
    ip = get_client_ip(request)
    enforce_rate_limit(f"documents:{user.get('id')}:{ip}", 20, 60, durable=True)
    _require_doc_access(user)

    filename = os.path.basename(str(file.filename or "")).strip() or "Dokumen"
    suffix = os.path.splitext(filename)[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format tidak didukung (hanya .pdf, .txt, .md)")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File terlalu besar (maksimal {MAX_FILE_BYTES // (1024 * 1024)} MB)",
        )

    content = _extract_text(raw, suffix)
    if not content:
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari file ini")

    truncated = len(content) > MAX_CONTENT_CHARS
    if truncated:
        content = content[:MAX_CONTENT_CHARS]

    return {
        "status": "success",
        "document": {
            "title": filename[:180],
            "content": content,
            "char_count": len(content),
            "truncated": truncated,
        },
    }
