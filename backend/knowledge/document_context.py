"""Pembentukan konteks dokumen untuk chat: chunk + retrieval + sitasi.

Isi dokumen TIDAK lagi ditempel utuh. Setiap dokumen dipecah menjadi chunk
(disimpan saat upload bila tersedia), lalu hanya chunk paling relevan dengan
pertanyaan yang dikirim ke model. Sitasi per chunk (judul + halaman) ikut
diemitkan ke client lewat event `sources`.
"""

import os
import re
from typing import Any

# Batas total karakter konteks dokumen per turn (semua lampiran digabung).
DOC_CONTEXT_MAX_CHARS = int(os.getenv("DOC_CONTEXT_MAX_CHARS", "24000"))
# Jumlah chunk maksimum yang diambil per dokumen.
DOC_TOP_K = int(os.getenv("DOC_TOP_K", "4"))
# Ukuran chunk saat upload / fallback pemecahan.
DOC_CHUNK_SIZE = int(os.getenv("DOC_CHUNK_SIZE", "1200"))
DOC_CHUNK_OVERLAP = int(os.getenv("DOC_CHUNK_OVERLAP", "150"))

_STOPWORDS = {
    "yang",
    "dan",
    "dari",
    "untuk",
    "dengan",
    "pada",
    "dalam",
    "adalah",
    "atau",
    "juga",
    "akan",
    "bisa",
    "dapat",
    "ini",
    "itu",
    "saya",
    "kamu",
    "anda",
    "kami",
    "kita",
    "apa",
    "bagaimana",
    "jelaskan",
    "sebutkan",
    "tentang",
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "what",
    "how",
    "explain",
}

_WORD_RE = re.compile(r"[a-zA-Z0-9\u00C0-\u024F]+")


def build_chunks(text: str, page: int | None = None) -> list[dict[str, Any]]:
    """Pecah teks menjadi chunk yang saling tumpang tindih tipis."""
    clean = str(text or "").strip()
    if not clean:
        return []
    size = max(300, DOC_CHUNK_SIZE)
    overlap = max(0, min(DOC_CHUNK_OVERLAP, size // 2))
    chunks: list[dict[str, Any]] = []
    start = 0
    idx = 0
    while start < len(clean):
        end = min(len(clean), start + size)
        # Usahakan potong di batas paragraf/kalimat agar chunk tetap koheren.
        if end < len(clean):
            window = clean[start:end]
            cut = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("\n"))
            if cut > size // 2:
                end = start + cut + 1
        piece = clean[start:end].strip()
        if piece:
            chunks.append({"index": idx, "text": piece, "page": page})
            idx += 1
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _doc_chunks(doc: dict[str, Any]) -> list[dict[str, Any]]:
    chunks = doc.get("chunks")
    if isinstance(chunks, list) and chunks:
        out = []
        for i, c in enumerate(chunks):
            if isinstance(c, dict) and str(c.get("text") or "").strip():
                out.append(
                    {
                        "index": int(c.get("index", i) or i),
                        "text": str(c["text"]).strip(),
                        "page": c.get("page"),
                    }
                )
            elif isinstance(c, str) and c.strip():
                out.append({"index": i, "text": c.strip(), "page": None})
        if out:
            return out
    return build_chunks(str(doc.get("content") or ""))


def _query_terms(query: str) -> list[str]:
    terms: list[str] = []
    for word in _WORD_RE.findall((query or "").lower()):
        if len(word) < 3 or word in _STOPWORDS:
            continue
        if word not in terms:
            terms.append(word)
    return terms


def _score_chunk(chunk: dict[str, Any], terms: list[str], title_terms: list[str]) -> float:
    text = str(chunk.get("text") or "").lower()
    if not terms:
        return 0.0
    score = 0.0
    for term in terms:
        count = len(re.findall(r"\b" + re.escape(term), text))
        if count:
            score += 1.0 + min(count, 3) * 0.25
    for term in title_terms:
        if term in text:
            score += 0.5
    return score


def _select_chunks(chunks: list[dict[str, Any]], query: str, title: str, top_k: int) -> list[dict[str, Any]]:
    terms = _query_terms(query)
    title_terms = _query_terms(title)
    if not terms:
        # Pertanyaan generik ("jelaskan") -> pakai chunk awal secara berurutan
        # supaya model bisa meringkas bagian pembuka/inti dokumen.
        return chunks[: max(top_k, 1)]
    ranked = sorted(
        ((_score_chunk(c, terms, title_terms), i, c) for i, c in enumerate(chunks)),
        key=lambda x: (-x[0], x[1]),
    )
    chosen = [c for score, _i, c in ranked if score > 0][:top_k]
    # Jika tidak ada istilah yang cocok, tetap beri konteks pembuka (bukan kosong).
    return chosen or chunks[:1]


def build_document_context(
    documents: list[dict[str, Any]],
    query: str = "",
    max_chars: int | None = None,
    top_k: int | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Return (teks konteks terpilih, daftar sumber) dari dokumen milik user.

    Anggaran karakter dibagi rata antar dokumen agar satu file besar tidak
    menghabiskan seluruh konteks.
    """
    docs = [d for d in (documents or []) if str(d.get("content") or d.get("chunks") or "").strip()]
    if not docs:
        return "", []

    budget = max_chars or DOC_CONTEXT_MAX_CHARS
    per_doc_budget = max(1000, budget // len(docs))
    k = top_k or DOC_TOP_K
    parts: list[str] = []
    sources: list[dict[str, Any]] = []

    for doc in docs:
        title = str(doc.get("title") or "Dokumen").strip()
        chunks = _doc_chunks(doc)
        if not chunks:
            continue
        selected = _select_chunks(chunks, query, title, k)
        used = 0
        for chunk in selected:
            text = str(chunk.get("text") or "").strip()
            if not text or used >= per_doc_budget:
                continue
            piece = text[: per_doc_budget - used]
            used += len(piece)
            page = chunk.get("page")
            label = f"{title}, hal. {page}" if page else title
            parts.append(f"[Sumber: {label} | chunk {chunk.get('index', 0)}]\n{piece}")
            sources.append(
                {
                    "id": str(doc.get("id")),
                    "title": title,
                    "page": page,
                    "chunk_index": chunk.get("index", 0),
                    "excerpt": piece[:180],
                }
            )

    return "\n\n".join(parts), sources
