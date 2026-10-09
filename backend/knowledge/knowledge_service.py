from typing import List, Dict
import os
import time

import httpx
from langchain_text_splitters import CharacterTextSplitter

try:
    from backend.config.config import settings
    from backend.database.db import DatabaseService, supabase_client
except ImportError:
    from config.config import settings
    from database.db import DatabaseService, supabase_client

# ── Embedding configuration ───────────────────────────────────────────────
# Provider switch:
#   "hf"     (default) — HuggingFace Inference API, model runs server-side.
#                        Works on Vercel/serverless (no local ML deps).
#   "local"  (optional, dev-only) — sentence-transformers on CPU.
#   "gemini" (optional) — Google Gemini embedContent REST. Free tier:
#                        input token gratis (rate-limited), tanpa model
#                        lokal → cocok untuk Vercel. Butuh GEMINI_API_KEY.
#                        Catatan free tier: data dipakai Google improve produk.
# The default model is multilingual (50+ languages incl. Indonesian) and
# outputs EMBEDDING_DIM vectors (default 768, skema Supabase vector(768)).
# Vektor dari model/dimensi BERBEDA tidak comparable: ganti provider/dimensi =
# migrasi kolom pgvector (supabase_migration_768.sql) + reindex penuh
# (python -m backend.reindex_embeddings).
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "hf").strip().lower()
HF_EMBEDDING_MODEL = os.getenv(
    "HF_EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
# HF sunset the old anonymous api-inference.huggingface.co endpoint; the
# router.huggingface.co path requires a (free) HF_TOKEN read token.
HF_API_URL = os.getenv(
    "HF_API_URL",
    f"https://router.huggingface.co/hf-inference/models/{HF_EMBEDDING_MODEL}",
)
HF_TOKEN = os.getenv("HF_TOKEN", "").strip()

# Gemini embedding (provider "gemini"). Beda dengan GEMINI_MODEL di .env —
# variabel itu nama model LLM untuk agent, bukan embedding.
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2").strip()
# Kunci khusus embedding; fallback ke GEMINI_API_KEY (var itu juga dibaca
# agent LLM — aman selama GROQ_API_KEY/OPENROUTER_API_KEY terisi, karena
# urutan resolusi key agent memprioritaskan kunci provider aktif).
GEMINI_API_KEY = (
    os.getenv("GEMINI_EMBEDDING_API_KEY", "").strip()
    or os.getenv("GEMINI_API_KEY", "").strip()
)
GEMINI_API_BASE = os.getenv(
    "GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta"
).rstrip("/")

# Dimensi vektor — WAJIB sama dengan kolom pgvector di Supabase.
# Default 768: rekomendasi MRL Google untuk gemini-embedding-2 (MTEB 67.99,
# mendekati 68.17@1536, storage hemat). Ganti nilai ini HANYA bersamaan dengan
# migrasi kolom (supabase_migration_768.sql) + reindex penuh.
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))
# Retrieval floor: chunks below this cosine similarity are dropped.
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.25"))

# HF cold-start handling: a "loading" 503 means the model is warming up.
_HF_MAX_RETRIES = int(os.getenv("HF_EMBEDDING_RETRIES", "4"))
_HF_RETRY_WAIT_S = float(os.getenv("HF_EMBEDDING_RETRY_WAIT", "3.0"))
_HF_TIMEOUT_S = float(os.getenv("HF_EMBEDDING_TIMEOUT", "30.0"))

# Optional local model (only imported when EMBEDDING_PROVIDER=local)
_embedding_model = None


def _get_embedding_model():
    """Lazy load local sentence-transformers model (dev/offline only)."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            print("Loading SentenceTransformer model 'paraphrase-multilingual-MiniLM-L12-v2'...")
            _embedding_model = SentenceTransformer(
                "paraphrase-multilingual-MiniLM-L12-v2", device="cpu"
            )
            print("Embedding model loaded successfully")
        except Exception as e:
            print(f"Error loading embedding model: {e}")
            _embedding_model = None
    return _embedding_model


def _hf_embed(text: str) -> List[float]:
    """Call HuggingFace Inference API. Raises on failure."""
    if not HF_TOKEN:
        raise RuntimeError(
            "HF_TOKEN not set — create a free read token at "
            "https://huggingface.co/settings/tokens and put it in .env"
        )
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {HF_TOKEN}"}

    last_err = "unknown error"
    with httpx.Client(timeout=_HF_TIMEOUT_S) as client:
        for attempt in range(_HF_MAX_RETRIES):
            try:
                resp = client.post(HF_API_URL, headers=headers, json={"inputs": text})
            except httpx.HTTPError as e:
                last_err = f"network error: {e}"
                time.sleep(_HF_RETRY_WAIT_S)
                continue

            if resp.status_code == 200:
                data = resp.json()
                # HF returns [[...]] for feature-extraction models
                vector = data[0] if (data and isinstance(data[0], list)) else data
                if not isinstance(vector, list) or len(vector) != EMBEDDING_DIM:
                    raise ValueError(
                        f"Unexpected embedding shape from HF (got {type(vector)}, "
                        f"len={len(vector) if isinstance(vector, list) else '?'})"
                    )
                return [float(x) for x in vector]

            body = (resp.text or "")[:200]
            # 503 + "loading" = cold start; 429 = rate limit. Both retryable.
            if resp.status_code in (429, 503):
                last_err = f"HTTP {resp.status_code}: {body}"
                time.sleep(_HF_RETRY_WAIT_S)
                continue
            raise RuntimeError(f"HF embedding failed: HTTP {resp.status_code}: {body}")

    raise RuntimeError(f"HF embedding unavailable after {_HF_MAX_RETRIES} tries: {last_err}")


def _gemini_embed(text: str, as_query: bool = False) -> List[float]:
    """Call Gemini embedContent REST. Raises on failure.

    Prefix task mengikuti dokumentasi resmi — DUA format berbeda:
      - gemini-embedding-2  : taskType TIDAK boleh dikirim; petunjuk tugas
                              disisipkan ke teks input (prefix prompt).
      - gemini-embedding-001: pakai field taskType (RETRIEVAL_QUERY vs
                              RETRIEVAL_DOCUMENT), teks tanpa prefix.
    Query dan dokumen HARUS pakai mode yang sama (asimetris) supaya ruang
    embeddingnya sejajar.

    output_dimensionality=EMBEDDING_DIM supaya skema pgvector tidak berubah.
    Vektor non-default selalu di-L2-normalize manual (syarat MRL untuk 001;
    v2 sudah auto-normalize — normalisasi ulang idempoten/boler).
    """
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY not set — ambil kunci gratis di "
            "https://aistudio.google.com/apikey lalu isi di .env"
        )

    is_v2 = "embedding-2" in GEMINI_EMBEDDING_MODEL
    content_text = (
        (f"task: search result | query: {text}" if as_query else f"title: none | text: {text}")
        if is_v2
        else text
    )
    body: dict = {
        "model": f"models/{GEMINI_EMBEDDING_MODEL}",
        "content": {"parts": [{"text": content_text}]},
        "output_dimensionality": EMBEDDING_DIM,
    }
    if not is_v2:
        body["taskType"] = "RETRIEVAL_QUERY" if as_query else "RETRIEVAL_DOCUMENT"

    url = f"{GEMINI_API_BASE}/models/{GEMINI_EMBEDDING_MODEL}:embedContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}

    last_err = "unknown error"
    with httpx.Client(timeout=_HF_TIMEOUT_S) as client:
        for attempt in range(_HF_MAX_RETRIES):
            try:
                resp = client.post(url, headers=headers, json=body)
            except httpx.HTTPError as e:
                last_err = f"network error: {e}"
                time.sleep(_HF_RETRY_WAIT_S)
                continue

            if resp.status_code == 200:
                data = resp.json()
                # embedContent tunggal → {"embedding": {"values": [...]}}
                values = (data.get("embedding") or {}).get("values")
                if not values and data.get("embeddings"):
                    values = data["embeddings"][0].get("values")
                if not values or len(values) != EMBEDDING_DIM:
                    raise ValueError(
                        f"Gemini embedding shape unexpected: "
                        f"len={len(values) if values else 0}, expected {EMBEDDING_DIM}. "
                        f"Cek EMBEDDING_DIM vs kolom pgvector."
                    )
                vec = [float(x) for x in values]
                norm = sum(x * x for x in vec) ** 0.5
                if norm > 0:
                    vec = [x / norm for x in vec]
                return vec

            body_txt = (resp.text or "")[:300]
            # 429 = free-tier rate limit; 5xx = server Google. Retryable.
            if resp.status_code in (429, 500, 502, 503, 504):
                last_err = f"HTTP {resp.status_code}: {body_txt}"
                time.sleep(_HF_RETRY_WAIT_S * (attempt + 1))
                continue
            # 400/403 (key salah, model salah) → gagal cepat, jangan retry.
            raise RuntimeError(
                f"Gemini embedding failed: HTTP {resp.status_code}: {body_txt}"
            )

    raise RuntimeError(
        f"Gemini embedding unavailable after {_HF_MAX_RETRIES} tries: {last_err}"
    )


# Cache untuk query embeddings (avoid re-encoding same query)
_embedding_cache: Dict[str, List[float]] = {}


def _warmup_embedding_model():
    """Load model di background thread saat server start.

    Tanpa ini, chat pertama setiap boot/reload bayar biaya load model
    (~9.6s ukuran L12) di dalam request. Dengan warmup, load terjadi
    paralel — chat pertama cukup bayar RPC + Groq saja.
    """
    try:
        _get_embedding_model()
    except Exception as e:
        print(f"Embedding warmup skipped: {e}")


if EMBEDDING_PROVIDER == "local" and __name__ != "__main__":
    import threading
    _warm_thread = threading.Thread(target=_warmup_embedding_model, daemon=True, name="emb-warmup")
    _warm_thread.start()


# Common Indonesian + English stopwords — excluded from keyword matching so
# generic words ("yang", "cara", "how") don't match every entry.
_STOPWORDS = {
    "yang", "dan", "di", "ke", "dari", "ini", "itu", "apa", "gimana", "bagaimana",
    "cara", "ada", "untuk", "dengan", "atau", "saya", "aku", "kamu", "anda", "kah",
    "adalah", "pada", "juga", "bisa", "tolong", "mohon",
    "the", "a", "an", "is", "are", "how", "what", "to", "of", "in", "for", "you",
}


def _keyword_search(query: str, match_count: int) -> List[str]:
    """Keyword fallback — returns ONLY chunks that actually match the query.

    Sengaja TIDAK punya fallback "entry pertama": konten tidak relevan yang
    disuntik ke system prompt bikin LLM mengarang jawaban. Empty list lebih
    jujur — context_builder menangani empty dengan pesan "tidak ada knowledge
    relevan", dan Core Rules bilang fallback ke general knowledge.

    Term match pakai word boundary (\b): substring mentah bikin "nama"
    match di dalam "purnama" — konten nyasar ikut nyuntik konteks LLM.
    """
    import re as _re
    terms = [w for w in query.lower().split() if len(w) >= 3 and w not in _STOPWORDS]
    entries = DatabaseService.get_knowledge_entries()
    chunks = []
    for entry in entries:
        text = entry.get("content", "")
        tl = text.lower()
        if query.lower() in tl or any(_re.search(r"\b" + _re.escape(w), tl) for w in terms):
            chunks.append(text)
    return chunks[:match_count]


class KnowledgeService:
    @staticmethod
    def get_embedding(text: str, as_query: bool = False) -> List[float]:
        """Generate embedding (cached).

        Returns an EMBEDDING_DIM vector (default 384) representing semantic
        meaning of text. Provider via EMBEDDING_PROVIDER (.env):
        "hf" | "local" | "gemini" | "off".
        as_query=True hanya berpengaruh untuk provider gemini (prefix task
        query vs dokumen) — dua mode punya cache key terpisah.
        Provider gagal → dummy zeros → semantic_search jatuh ke keyword
        fallback (sengaja: vektor model berbeda TIDAK boleh dicampur).
        """
        # Gemini: prefix query vs dokumen beda → cache key harus dibedakan
        # agar teks identik di mode berbeda tidak saling tabrak.
        cache_key = (
            f"{'q:' if as_query else 'd:'}{text}"
            if EMBEDDING_PROVIDER == "gemini"
            else text
        )
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]

        # TEMPORARY TEST SWITCH: "off" = no embeddings, keyword fallback only.
        if EMBEDDING_PROVIDER == "off":
            print("Embedding disabled (EMBEDDING_PROVIDER=off) -> keyword fallback")
            return [0.0] * EMBEDDING_DIM

        try:
            if EMBEDDING_PROVIDER == "gemini":
                result = _gemini_embed(text, as_query=as_query)
            elif EMBEDDING_PROVIDER == "local":
                model = _get_embedding_model()
                if model is None:
                    print("Warning: Using dummy embeddings (local model not loaded)")
                    return [0.0] * EMBEDDING_DIM
                embedding = model.encode(text, convert_to_tensor=False, show_progress_bar=False)
                result = [float(x) for x in embedding.tolist()]
            else:
                result = _hf_embed(text)
            _embedding_cache[cache_key] = result
            return result
        except Exception as e:
            # Dummy vector -> semantic_search falls back to keyword search
            print(f"Error generating embedding ({EMBEDDING_PROVIDER}): {e}")
            return [0.0] * EMBEDDING_DIM

    @staticmethod
    def index_entry(entry_id: str, content: str):
        splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_text(content)

        if supabase_client:
            try:
                supabase_client.table("knowledge_embeddings").delete().eq("entry_id", entry_id).execute()
                for idx, chunk in enumerate(chunks):
                    embedding = KnowledgeService.get_embedding(chunk)
                    supabase_client.table("knowledge_embeddings").insert({
                        "entry_id": entry_id,
                        "chunk_index": idx,
                        "content_chunk": chunk,
                        "embedding": embedding
                    }).execute()
            except Exception as e:
                print(f"Error indexing entry in Supabase: {e}")

    @staticmethod
    def semantic_search(query: str, match_count: int = 4) -> List[str]:
        """Search knowledge entries by semantic similarity.

        Uses cosine similarity on embeddings to find relevant chunks.
        Falls back to keyword search if embeddings unavailable.
        """
        query_embedding = KnowledgeService.get_embedding(query, as_query=True)

        if not supabase_client:
            # No Supabase, use keyword fallback
            return _keyword_search(query, match_count)

        # Check if embeddings are real (384 dims, not dummy zeros)
        is_dummy = len(query_embedding) != EMBEDDING_DIM or all(x == 0.0 for x in query_embedding[:20])

        if is_dummy:
            # Dummy embeddings, use keyword fallback only
            return _keyword_search(query, match_count)

        # Real embeddings - use Supabase semantic search
        try:
            res = supabase_client.rpc(
                "match_knowledge_entries",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": MATCH_THRESHOLD,
                    "match_count": match_count
                }
            ).execute()
            if res.data:
                return [row["content_chunk"] for row in res.data]
        except Exception as e:
            print(f"Supabase RPC search error: {e}")

        # RPC failed, fallback to keyword search
        return _keyword_search(query, match_count)
