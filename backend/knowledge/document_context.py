"""Pembentukan konteks dokumen untuk chat.

P0: isi dokumen digabung dengan batas total karakter agar biaya token terkendali.
P1 mengganti bagian pemilihan isi dengan retrieval chunk + sitasi.
"""

import os
from typing import Any

# Batas total karakter konteks dokumen per turn (semua lampiran digabung).
DOC_CONTEXT_MAX_CHARS = int(os.getenv("DOC_CONTEXT_MAX_CHARS", "24000"))


def build_document_context(
    documents: list[dict[str, Any]],
    query: str = "",
    max_chars: int | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Return (teks konteks, daftar sumber) dari dokumen milik user."""
    budget = max_chars or DOC_CONTEXT_MAX_CHARS
    parts: list[str] = []
    sources: list[dict[str, Any]] = []
    remaining = budget

    for doc in documents or []:
        if remaining <= 0:
            break
        title = str(doc.get("title") or "Dokumen").strip()
        content = str(doc.get("content") or "").strip()
        if not content:
            continue
        piece = content[:remaining]
        remaining -= len(piece)
        parts.append(f"[Dokumen: {title}]\n{piece}\n[Akhir dokumen: {title}]")
        sources.append(
            {
                "id": str(doc.get("id")),
                "title": title,
                "char_count": int(doc.get("char_count") or len(content)),
                "page_count": doc.get("page_count"),
                "truncated": bool(doc.get("truncated")) or len(piece) < len(content),
            }
        )

    return "\n\n".join(parts), sources
