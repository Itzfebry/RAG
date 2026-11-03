"""Ekstraksi + penyimpanan dokumen lampiran chat (pengguna paket premium).

Alur:
1. Client upload file -> teks diekstrak di worker thread (tidak memblok event loop).
2. Teks disimpan server-side; client hanya menerima metadata + `doc_id`.
3. Client mengirim `document_ids` saat chat; backend memuat teks dari storage
   setelah memverifikasi kepemilikan.

Dokumen terhapus otomatis setelah `DOC_RETENTION_DAYS`.
"""

import io
import os
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

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
MAX_CONTENT_CHARS = DatabaseService.DOC_MAX_CHARS  # pengaman teks hasil ekstraksi


def _require_doc_access(user: dict[str, Any]) -> None:
    """403 bila user tidak berhak memakai fitur dokumen (doc_upload per paket)."""
    if not DatabaseService.can_use_document_feature(user):
        raise HTTPException(
            status_code=403,
            detail="Fitur dokumen khusus paket dengan akses upload dokumen. Berlangganan di halaman pricing.",
        )


def _extract_text(raw: bytes, suffix: str) -> tuple[str, int | None]:
    """Ekstrak teks dari file upload. Return (teks, jumlah_halaman).

    Raise HTTPException bila file tidak terbaca. Dijalankan di worker thread
    (parsing PDF mahal) - jangan panggil langsung dari event loop.
    """
    if suffix == ".pdf":
        try:
            import pypdf
        except ImportError as e:  # pragma: no cover - dependency ada di requirements
            raise HTTPException(status_code=500, detail="Parser PDF tidak tersedia di server") from e
        try:
            reader = pypdf.PdfReader(io.BytesIO(raw))
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception as e:
                    raise HTTPException(
                        status_code=400,
                        detail="PDF terenkripsi - hapus kata sandi lalu unggah ulang",
                    ) from e
            pages = len(reader.pages)
            content = "\n".join((page.extract_text() or "") for page in reader.pages)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[documents] gagal membaca PDF: {e}")
            raise HTTPException(status_code=400, detail="PDF tidak bisa dibaca (mungkin terenkripsi/rusak)") from e
        if not content.strip():
            raise HTTPException(
                status_code=400,
                detail="PDF ini tidak memiliki teks yang bisa dibaca (kemungkinan hasil scan/gambar)",
            )
        return content.strip(), pages

    return raw.decode("utf-8", errors="ignore").strip(), None


@router.post("/user/documents/extract")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Ekstrak satu file, simpan teks di server, balikan metadata + `doc_id`."""
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

    # Parsing (PDF) berjalan di threadpool supaya event loop tetap melayani
    # request lain selama ekstraksi.
    content, page_count = await run_in_threadpool(_extract_text, raw, suffix)
    if not content:
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari file ini")

    truncated = len(content) > MAX_CONTENT_CHARS
    if truncated:
        content = content[:MAX_CONTENT_CHARS]

    doc = await run_in_threadpool(
        DatabaseService.save_user_document,
        str(user["id"]),
        title=filename,
        content=content,
        file_type=suffix.lstrip("."),
        truncated=truncated,
        page_count=page_count,
    )
    logger.info(
        "[documents] extracted doc_id=%s user=%s chars=%s truncated=%s pages=%s",
        doc.get("id"),
        user.get("id"),
        len(content),
        truncated,
        page_count,
    )
    return {"status": "success", "document": DatabaseService.public_document_metadata(doc)}


@router.delete("/user/documents/{doc_id}")
def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Hapus dokumen milik user (dipakai saat lampiran dilepas)."""
    if not DatabaseService.delete_user_document(str(user["id"]), doc_id):
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    return {"status": "success"}
