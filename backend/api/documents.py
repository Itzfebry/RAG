"""Ekstraksi + penyimpanan dokumen lampiran chat (pengguna paket premium).

Alur:
1. Client upload file -> validasi magic-byte + ekstraksi teks di worker thread
   (tidak memblok event loop).
2. Teks disimpan server-side; client hanya menerima metadata + `doc_id`.
3. Client mengirim `document_ids` saat chat; backend memuat teks dari storage
   setelah memverifikasi kepemilikan.

Dokumen terhapus otomatis setelah `DOC_RETENTION_DAYS`.
"""

import io
import os
import time
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

try:
    from backend.api.users import get_current_user
    from backend.core.logging_config import get_logger
    from backend.database.db import DatabaseService
    from backend.knowledge.document_context import build_chunks
    from backend.security.rate_limiter import enforce_rate_limit, get_client_ip
except ImportError:
    from core.logging_config import get_logger  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from knowledge.document_context import build_chunks  # type: ignore
    from security.rate_limiter import enforce_rate_limit, get_client_ip  # type: ignore

    from api.users import get_current_user  # type: ignore

router = APIRouter(prefix="/api", tags=["User Documents"])
logger = get_logger(__name__)

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf"}
MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB per file (selaras pilihan produk)
MAX_CONTENT_CHARS = DatabaseService.DOC_MAX_CHARS  # pengaman teks hasil ekstraksi
PDF_MAX_PAGES = int(os.getenv("PDF_MAX_PAGES", "50"))
# OCR fallback untuk PDF hasil scan. Butuh pymupdf + pytesseract + biner tesseract;
# bila tidak tersedia, fitur tetap berjalan dan pengguna mendapat pesan jelas.
DOC_OCR_ENABLED = os.getenv("DOC_OCR_ENABLED", "1").strip().lower() not in {"0", "false", "off", "no"}
DOC_OCR_MAX_PAGES = int(os.getenv("DOC_OCR_MAX_PAGES", "10"))

_PDF_MAGIC = b"%PDF-"


def _require_doc_access(user: dict[str, Any]) -> None:
    """403 bila user tidak berhak memakai fitur dokumen (doc_upload per paket)."""
    if not DatabaseService.can_use_document_feature(user):
        raise HTTPException(
            status_code=403,
            detail="Fitur dokumen khusus paket dengan akses upload dokumen. Berlangganan di halaman pricing.",
        )


def _validate_magic_bytes(raw: bytes, suffix: str) -> None:
    """Pastikan isi file cocok dengan ekstensinya (bukan hanya nama file).

    Mencegah file biner/berbahaya disamarkan sebagai .txt, atau file non-PDF
    yang dinamai .pdf lalu diproses parser.
    """
    head = raw[:1024].lstrip()
    if suffix == ".pdf":
        if not head.startswith(_PDF_MAGIC):
            logger.warning("[documents] reject: ekstensi .pdf tapi magic byte bukan PDF")
            raise HTTPException(status_code=400, detail="File bukan PDF yang valid")
        return

    # .txt / .md
    if head.startswith(_PDF_MAGIC):
        logger.warning("[documents] reject: ekstensi teks tapi isi file PDF")
        raise HTTPException(status_code=400, detail="Ekstensi file tidak cocok dengan isinya")
    if b"\x00" in raw[:8192]:
        logger.warning("[documents] reject: file teks mengandung byte biner")
        raise HTTPException(status_code=400, detail="File terdeteksi sebagai biner, bukan teks biasa (.txt/.md)")


def _ocr_pdf(raw: bytes) -> str:
    """OCR PDF hasil scan. Return teks, atau None bila OCR tidak tersedia/gagal.

    Sengaja best-effort: ketiadaan dependensi OCR tidak boleh membuat endpoint
    error 500 - pengguna cukup diberi tahu PDF tidak punya teks.
    """
    if not DOC_OCR_ENABLED:
        return ""
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.info("[documents] OCR dilewati: pymupdf/pytesseract/Pillow tidak terpasang")
        return ""

    try:
        pdf = fitz.open(stream=raw, filetype="pdf")
        page_texts: list[str] = []
        for i, page in enumerate(pdf):
            if i >= DOC_OCR_MAX_PAGES:
                logger.info("[documents] OCR dibatasi %s halaman pertama", DOC_OCR_MAX_PAGES)
                break
            pix = page.get_pixmap(dpi=200)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_texts.append(pytesseract.image_to_string(image) or "")
        pdf.close()
        text = "\n".join(page_texts).strip()
        if text:
            logger.info("[documents] OCR berhasil: %s halaman, %s karakter", len(page_texts), len(text))
        return text
    except Exception as e:  # pragma: no cover - bergantung biner tesseract
        logger.warning("[documents] OCR gagal: %s", e)
        return ""


def _extract_text(raw: bytes, suffix: str) -> tuple[str, int | None, list[dict], bool]:
    """Ekstrak teks dari file upload.

    Return (teks, jumlah_halaman, chunks, ocr_dipakai). Raise HTTPException bila
    file tidak terbaca. Dijalankan di worker thread (parsing PDF mahal).
    """
    if suffix == ".pdf":
        try:
            import pypdf
        except ImportError as e:  # pragma: no cover - dependency ada di requirements
            raise HTTPException(status_code=500, detail="Parser PDF tidak tersedia di server") from e
        try:
            reader = pypdf.PdfReader(io.BytesIO(raw))
            if reader.is_encrypted:
                # Coba kata sandi kosong (umum untuk PDF yang hanya dikunci
                # permission). Bila gagal, minta pengguna menghapus sandi.
                try:
                    unlocked = reader.decrypt("")
                except Exception:
                    unlocked = 0
                if not unlocked:
                    logger.info("[documents] reject: PDF terenkripsi kata sandi")
                    raise HTTPException(
                        status_code=400,
                        detail="PDF terenkripsi kata sandi - hapus kata sandi lalu unggah ulang",
                    )
            pages = len(reader.pages)
            if pages > PDF_MAX_PAGES:
                logger.info("[documents] reject: PDF %s halaman > batas %s", pages, PDF_MAX_PAGES)
                raise HTTPException(
                    status_code=413,
                    detail=f"PDF terlalu banyak halaman (maksimal {PDF_MAX_PAGES} halaman)",
                )
            page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
            content = "\n".join(page_texts).strip()
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("[documents] gagal membaca PDF: %s", e)
            raise HTTPException(status_code=400, detail="PDF tidak bisa dibaca (mungkin terenkripsi/rusak)") from e

        ocr_used = False
        if not content:
            content = _ocr_pdf(raw)
            ocr_used = bool(content)
        if not content:
            raise HTTPException(
                status_code=400,
                detail=(
                    "PDF ini tidak memiliki teks yang bisa dibaca (kemungkinan hasil scan). "
                    "OCR belum tersedia di server - unggah PDF berbasis teks atau salin isinya ke .txt."
                ),
            )

        chunks: list[dict] = []
        if ocr_used:
            chunks = build_chunks(content)
        else:
            for i, page_text in enumerate(page_texts):
                chunks.extend(build_chunks(page_text, page=i + 1))
        return content, pages, _trim_chunks(chunks, content), ocr_used

    content = raw.decode("utf-8", errors="ignore").strip()
    return content, None, build_chunks(content), False


def _trim_chunks(chunks: list[dict], content: str) -> list[dict]:
    """Batasi total teks chunk agar tidak melebihi batas isi dokumen."""
    out: list[dict] = []
    used = 0
    for chunk in chunks:
        text = str(chunk.get("text") or "")
        if not text:
            continue
        if used + len(text) > MAX_CONTENT_CHARS:
            text = text[: max(0, MAX_CONTENT_CHARS - used)]
        if not text:
            break
        out.append({**chunk, "text": text})
        used += len(text)
        if used >= MAX_CONTENT_CHARS:
            break
    if out:
        return out
    return build_chunks(content[:MAX_CONTENT_CHARS])


@router.post("/user/documents/extract")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Ekstrak satu file, simpan teks di server, balikan metadata + `doc_id`."""
    started = time.perf_counter()
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
    _validate_magic_bytes(raw, suffix)

    # Parsing (PDF) berjalan di threadpool supaya event loop tetap melayani
    # request lain selama ekstraksi.
    content, page_count, chunks, ocr_used = await run_in_threadpool(_extract_text, raw, suffix)
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
        chunks=chunks,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "[documents] extracted doc_id=%s user=%s type=%s bytes=%s chars=%s chunks=%s pages=%s ocr=%s truncated=%s ms=%.0f",
        doc.get("id"),
        user.get("id"),
        suffix.lstrip("."),
        len(raw),
        len(content),
        len(chunks),
        page_count,
        ocr_used,
        truncated,
        elapsed_ms,
    )
    return {"status": "success", "document": DatabaseService.public_document_metadata(doc)}


@router.delete("/user/documents/{doc_id}")
def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Hapus dokumen milik user (dipakai saat lampiran dilepas)."""
    if not DatabaseService.delete_user_document(str(user["id"]), doc_id):
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    return {"status": "success"}
