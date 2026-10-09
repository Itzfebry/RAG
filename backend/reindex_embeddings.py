"""Reindex seluruh knowledge entries ke provider embedding aktif (.env).

Pakai setelah ganti EMBEDDING_PROVIDER — vektor dari model BERBEDA tidak
comparable, jadi semua chunk harus di-embed ulang dengan model baru.

Aman untuk dijalankan berkali-kali: seluruh entry di-embed + divalidasi
(non-zero, dimensi benar) SEBELUM database disentuh. Gagal di tengah =
data lama tidak tersentuh.

Jalankan:  python -m backend.reindex_embeddings
"""
try:
    from backend.knowledge.knowledge_service import (
        KnowledgeService, EMBEDDING_PROVIDER, EMBEDDING_DIM, supabase_client,
    )
    from backend.database.db import DatabaseService
except ImportError:
    from knowledge.knowledge_service import (  # type: ignore
        KnowledgeService, EMBEDDING_PROVIDER, EMBEDDING_DIM, supabase_client,
    )
    from database.db import DatabaseService  # type: ignore

from langchain_text_splitters import CharacterTextSplitter


def _is_dummy(v) -> bool:
    return (not v) or len(v) != EMBEDDING_DIM or all(x == 0.0 for x in v[:20])


def main() -> int:
    print(f"Provider aktif: {EMBEDDING_PROVIDER} | dim: {EMBEDDING_DIM}")
    if EMBEDDING_PROVIDER == "off":
        print("ABORT: EMBEDDING_PROVIDER=off — matikan dulu switch test itu.")
        return 1
    if not supabase_client:
        print("ABORT: Supabase client tidak terkonfigurasi.")
        return 1

    entries = DatabaseService.get_knowledge_entries() or []
    if not entries:
        print("Tidak ada entry.")
        return 0

    # Splitter HARUS sama dengan KnowledgeService.index_entry (500/50).
    splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)

    # 1) Embed SEMUA dulu — validasi sebelum menyentuh database.
    plan = []
    for e in entries:
        chunks = splitter.split_text(e.get("content", "") or "")
        vectors = []
        for i, c in enumerate(chunks):
            v = KnowledgeService.get_embedding(c, as_query=False)
            if _is_dummy(v):
                print(
                    f"ABORT: embed gagal untuk entry {e.get('title')!r} "
                    f"chunk {i} — database TIDAK diubah."
                )
                return 1
            vectors.append(v)
        plan.append((e.get("id"), e.get("title", "?"), chunks, vectors))

    # 2) Tulis ulang per entry (delete lama → insert baru).
    for entry_id, title, chunks, vectors in plan:
        supabase_client.table("knowledge_embeddings").delete().eq(
            "entry_id", entry_id
        ).execute()
        for idx, (c, v) in enumerate(zip(chunks, vectors)):
            supabase_client.table("knowledge_embeddings").insert({
                "entry_id": entry_id,
                "chunk_index": idx,
                "content_chunk": c,
                "embedding": v,
            }).execute()
        print(f"  reindexed: {title} ({len(chunks)} chunks)")

    total = sum(len(v) for *_, v in plan)
    print(f"Selesai — {len(plan)} entry, {total} chunk, provider {EMBEDDING_PROVIDER}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
