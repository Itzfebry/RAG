"""Test chunking + retrieval dokumen (P1): konteks tidak dump seluruh teks."""

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")


def _doc(title="panduan.txt", text="", chunks=None, doc_id="d1"):
    return {"id": doc_id, "title": title, "content": text, "chunks": chunks or []}


def test_build_chunks_splits_long_text_with_overlap():
    from backend.knowledge.document_context import DOC_CHUNK_SIZE, build_chunks

    text = ("Kalimat penting. " * 400).strip()
    chunks = build_chunks(text)
    assert len(chunks) > 1
    assert all(len(c["text"]) <= DOC_CHUNK_SIZE + 50 for c in chunks)
    assert [c["index"] for c in chunks] == list(range(len(chunks)))
    assert chunks[0]["page"] is None


def test_retrieval_picks_relevant_chunk_not_whole_document():
    from backend.knowledge.document_context import build_document_context

    chunks = [
        {"index": 0, "text": "Bagian pembuka tentang profil perusahaan.", "page": 1},
        {"index": 1, "text": "KEBIJAKAN REFUND: dana dikembalikan maksimal 7 hari kerja.", "page": 2},
        {"index": 2, "text": "Bagian penutup dan kontak admin.", "page": 3},
    ]
    context, sources = build_document_context([_doc(chunks=chunks)], query="bagaimana kebijakan refund?")
    assert "KEBIJAKAN REFUND" in context
    assert "Bagian pembuka" not in context
    assert len(context) < 400
    assert sources
    assert sources[0]["title"] == "panduan.txt"
    assert sources[0]["page"] == 2
    assert sources[0]["chunk_index"] == 1
    assert "content" not in sources[0]


def test_generic_query_falls_back_to_leading_chunks():
    from backend.knowledge.document_context import build_document_context

    chunks = [{"index": i, "text": f"Isi bagian {i}.", "page": None} for i in range(10)]
    context, sources = build_document_context([_doc(chunks=chunks)], query="jelaskan")
    assert "Isi bagian 0" in context
    assert len(sources) <= 4


def test_context_budget_is_capped_per_turn():
    from backend.knowledge.document_context import build_document_context

    chunks = [{"index": i, "text": "x" * 5000, "page": None} for i in range(10)]
    context, _ = build_document_context([_doc(chunks=chunks)], query="x", max_chars=3000)
    assert len(context) <= 4000


def test_chunks_without_stored_chunks_are_split_from_content():
    from backend.knowledge.document_context import build_document_context

    doc = _doc(text="alpha beta gamma. " * 300)
    context, sources = build_document_context([doc], query="alpha")
    assert context
    assert sources


def test_sources_include_page_for_pdf_chunks():
    from backend.knowledge.document_context import build_document_context

    chunks = [{"index": 0, "text": "Ringkasan laporan tahunan.", "page": 4}]
    _, sources = build_document_context([_doc(title="laporan.pdf", chunks=chunks)], query="laporan")
    assert sources[0]["page"] == 4
    assert sources[0]["title"] == "laporan.pdf"
