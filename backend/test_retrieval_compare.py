"""Perbandingan retrieval: embedding lokal vs keyword fallback (off).

Read-only — tidak mengubah data, tidak reindex.

Usage:
  python -m backend.test_retrieval_compare                     # query bawaan
  python -m backend.test_retrieval_compare "biaya servis" "harga perbaikan"
"""
import sys
import time

DEFAULT_QUERIES = [
    "berapa biaya servis laptop",
    "gimana cara reset password",
    "produk yang tersedia apa saja",
]


def header(t: str) -> None:
    print(f"\n=== {t} ===")


def short(text: str, n: int = 160) -> str:
    text = (text or "").replace("\n", " ").strip()
    return text if len(text) <= n else text[:n] + "..."


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    queries = [a for a in sys.argv[1:] if not a.startswith("-")] or DEFAULT_QUERIES

    import backend.knowledge.knowledge_service as ks
    from backend.knowledge.knowledge_service import KnowledgeService, MATCH_THRESHOLD
    from backend.database.db import supabase_client

    if not supabase_client:
        print("Supabase client tidak tersedia — cek .env")
        return

    header("Warmup model embedding lokal")
    t0 = time.perf_counter()
    model = ks._get_embedding_model()
    print(f"model loaded: {model is not None} ({time.perf_counter() - t0:.1f}s)")
    if model is None:
        print("Model lokal gagal load — perbandingan tidak mungkin. Cek sentence-transformers.")
        return

    for q in queries:
        header(f"QUERY: {q!r}")

        # ── Mode ON: embedding lokal + RPC Supabase ─────────────────────
        ks.EMBEDDING_PROVIDER = "local"
        ks._embedding_cache.clear()
        t0 = time.perf_counter()
        emb = KnowledgeService.get_embedding(q)
        t_embed = time.perf_counter() - t0
        t0 = time.perf_counter()
        res = supabase_client.rpc(
            "match_knowledge_entries",
            {
                "query_embedding": emb,
                "match_threshold": MATCH_THRESHOLD,
                "match_count": 4,
            },
        ).execute()
        t_rpc = time.perf_counter() - t0
        rows_on = res.data or []

        # ── Mode OFF: keyword fallback ──────────────────────────────────
        ks.EMBEDDING_PROVIDER = "off"
        ks._embedding_cache.clear()
        t0 = time.perf_counter()
        rows_off = KnowledgeService.semantic_search(q, match_count=4)
        t_off = time.perf_counter() - t0

        print(f"\n[ON = embedding lokal]  {len(rows_on)} chunk | embed {t_embed*1000:.0f}ms + rpc {t_rpc*1000:.0f}ms")
        if rows_on:
            for r in rows_on:
                sim = r.get("similarity")
                sim_s = f"{sim:.3f}" if isinstance(sim, (int, float)) else "?"
                print(f"  sim={sim_s}  {short(r.get('content_chunk', ''))}")
        else:
            print("  (tidak ada chunk di atas threshold)")

        print(f"\n[OFF = keyword only]  {len(rows_off)} chunk | {t_off*1000:.0f}ms")
        if rows_off:
            for c in rows_off:
                print(f"  - {short(c)}")
        else:
            print("  (tidak ada match keyword)")

        on_texts = {short(r.get("content_chunk", ""), 80) for r in rows_on}
        off_texts = {short(c, 80) for c in rows_off}
        overlap = len(on_texts & off_texts)
        print(f"\noverlap: {overlap}/{max(len(on_texts), len(off_texts))} chunk sama")


if __name__ == "__main__":
    main()
