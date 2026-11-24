"""Retrieval deterministik: chunking, keyword fallback, dan urutan index_entry.

Tidak menyentuh API model - embedding/fetch di-monkeypatch. Jalankan:
python -m pytest backend/tests/test_retrieval.py
"""

import backend.knowledge.knowledge_service as ks


def test_chunk_text_hard_splits_paragraphless_text():
    chunks = ks.chunk_text("a" * 2000)
    assert chunks
    assert all(len(c) <= 550 for c in chunks)


def test_keyword_search_strips_punctuation_and_returns_chunks(monkeypatch):
    long_text = "Info paket langganan tersedia di halaman pricing. " + ("penjelasan tambahan. " * 80)
    entries = [{"id": "e1", "content": long_text, "is_active": True}]
    monkeypatch.setattr(ks.DatabaseService, "get_knowledge_entries", staticmethod(lambda *_a, **_k: entries))

    out = ks._keyword_search("apa itu paket?", 4)

    assert out, "term 'paket' harus cocok walau query bertanda tanya"
    assert all(len(c) <= 550 for c in out), "fallback harus mengembalikan chunk, bukan entry utuh"


def test_keyword_search_ranks_by_hits_not_table_order(monkeypatch):
    entries = [
        {"id": "a", "content": "harga servis laptop murah", "is_active": True},
        {
            "id": "b",
            "content": "harga servis laptop berikut syarat servis laptop dan garansi servis laptop",
            "is_active": True,
        },
    ]
    monkeypatch.setattr(ks.DatabaseService, "get_knowledge_entries", staticmethod(lambda *_a, **_k: entries))

    out = ks._keyword_search("servis laptop", 2)

    assert out[0].startswith("harga servis laptop berikut"), "entry dengan hit terbanyak harus ranking 1"


class _Table:
    def __init__(self):
        self.ops = []

    def select(self, *_a):
        self.ops.append("select")
        return self

    def eq(self, *_a):
        return self

    def insert(self, rows):
        self.ops.append("insert")
        self.rows = rows
        return self

    def delete(self):
        self.ops.append("delete")
        return self

    def in_(self, _key, ids):
        self.ops.append("delete_ids")
        self.deleted = ids
        return self

    def execute(self):
        if self.ops and self.ops[-1] == "select":
            return type("R", (), {"data": [{"id": "old-1"}]})()
        return type("R", (), {"data": None})()


def test_retrieval_query_includes_previous_user_turn_for_followup():
    from backend.knowledge.context_builder import _retrieval_query

    hist = [
        {"role": "user", "content": "Berapa lama masa aktif paket 100 prompt?"},
        {"role": "assistant", "content": "Paket aktif 30 hari."},
    ]
    q = _retrieval_query("itu berlaku sampai kapan?", hist)

    assert "masa aktif" in q
    assert "sampai kapan" in q


def test_index_entry_inserts_new_chunks_before_deleting_old(monkeypatch):
    table = _Table()

    class _Client:
        def table(self, _name):
            return table

    monkeypatch.setattr(ks, "supabase_client", _Client())
    monkeypatch.setattr(ks.DatabaseService, "bump_knowledge_version", staticmethod(lambda: 1))
    monkeypatch.setattr(
        ks.KnowledgeService,
        "get_embedding",
        staticmethod(lambda *_a, **_k: [0.1] * ks.EMBEDDING_DIM),
    )

    n = ks.KnowledgeService.index_entry("e1", "konten singkat untuk indexing")

    assert n >= 1
    assert table.ops == ["select", "insert", "delete", "delete_ids"]
    assert table.deleted == ["old-1"]
