"""RAG pipeline test — 4 layer.

Usage:
  python -m backend.test_rag             # test saja (reindex manual via --reindex)
  python -m backend.test_rag --reindex   # reindex semua entri lalu test
"""
import json
import sys


def header(t: str) -> None:
    print(f"\n=== {t} ===")


def run_chat(query: str) -> str:
    """Panggil agent persis seperti /api/chat, tanpa HTTP/quota."""
    import asyncio
    from backend.agent.agent import AgentOrchestrator

    agent = AgentOrchestrator()

    async def _run():
        out = []
        async for chunk in agent.stream_chat_response(query, []):
            line = chunk.strip()
            if not line.startswith("data: "):
                continue
            payload = line[6:]
            if payload == "[DONE]":
                break
            try:
                j = json.loads(payload)
            except Exception:
                continue
            if "content" in j:
                out.append(j["content"])
            if "timing" in j:
                print("  timing:", j["timing"])
        return "".join(out)

    return asyncio.run(_run())


def main() -> None:
    # Windows console default cp1252 — Groq output memakai char unicode (nbsp dsb)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    reindex = "--reindex" in sys.argv

    header("1. Embedding model")
    from backend.knowledge.knowledge_service import KnowledgeService
    from backend.database.db import DatabaseService, supabase_client

    emb = KnowledgeService.get_embedding("tes embed apakah model jalan")
    ok = len(emb) == 384 and any(x != 0.0 for x in emb)
    print(f"dims={len(emb)} non-zero={ok} -> {'OK' if ok else 'GAGAL'}")

    entries = DatabaseService.get_knowledge_entries()
    print(f"entries: {len(entries)}")

    if reindex:
        header("2. Reindex semua entri")
        for en in entries:
            KnowledgeService.index_entry(en["id"], en.get("content", ""))
            print("  indexed:", en.get("title"))
    else:
        header("2. Reindex: skip (jalankan dengan --reindex kalau belum)")

    header("3. Coverage embedding per entri")
    try:
        res = supabase_client.table("knowledge_embeddings").select("entry_id, chunk_index", count="exact").execute()
        indexed_ids = {r["entry_id"] for r in (res.data or [])}
        print(f"chunks tersimpan: {res.count} | entri ter-index: {len(indexed_ids)}/{len(entries)}")
        for en in entries:
            mark = "OK " if en["id"] in indexed_ids else "MISS"
            print(f"  [{mark}] {en.get('title')}")
    except Exception as ex:
        print("ERROR:", str(ex)[:250])

    from backend.knowledge.knowledge_service import MATCH_THRESHOLD
    header(f"4. Semantic search — positive (threshold produksi: {MATCH_THRESHOLD})")
    for en in entries:
        q = str(en.get("title") or "")[:90]
        if not q:
            continue
        try:
            qemb = KnowledgeService.get_embedding(q)
            r = supabase_client.rpc(
                "match_knowledge_entries",
                {"query_embedding": qemb, "match_threshold": MATCH_THRESHOLD, "match_count": 6},
            ).execute()
            rows = r.data or []
            sims = ", ".join(f"{row['similarity']:.2f}" for row in rows)
            print(f"  Q {q!r} -> {len(rows)} chunk [sim: {sims}]")
        except Exception as ex:
            print(f"  Q {q!r} ERROR: {str(ex)[:180]}")

    header("4b. Semantic search — negative (threshold 0.35, topik tak ada di KB)")
    for neg in ["apa resep nasi goreng", "jadwal bola malam ini"]:
        try:
            qemb = KnowledgeService.get_embedding(neg)
            r = supabase_client.rpc(
                "match_knowledge_entries",
                {"query_embedding": qemb, "match_threshold": 0.35, "match_count": 4},
            ).execute()
            rows = r.data or []
            print(f"  Q {neg!r} -> {len(rows)} chunk ({'BENAR — tak ada noise' if len(rows) == 0 else 'ADA NOISE'})")
            for row in rows:
                print(f"     {row['similarity']:.2f} {row['content_chunk'][:90]!r}")
        except Exception as ex:
            print(f"  Q {neg!r} ERROR: {str(ex)[:180]}")

    header("5. E2E via agent (RAG context -> Groq openai/gpt-oss-20b)")
    kb_q = f"Ceritakan detail tentang: {entries[0].get('title')}" if entries else "halo"
    print(f"  Q (positif): {kb_q}")
    ans = run_chat(kb_q)
    print(f"  A: {ans[:500] or '(kosong)'}")

    print("\n  Q (negatif): Siapa presiden pertama Amerika Serikat?")
    ans2 = run_chat("Siapa presiden pertama Amerika Serikat?")
    print(f"  A: {ans2[:500] or '(kosong)'}")

    print("\nDone.")


if __name__ == "__main__":
    main()
