import os
import time
from typing import Any

import httpx

try:
    from backend.core.logging_config import get_logger
    from backend.database.cache import rag_cache
    from backend.database.db import DatabaseService, supabase_client
except ImportError:
    from core.logging_config import get_logger  # type: ignore
    from database.cache import rag_cache
    from database.db import DatabaseService, supabase_client

logger = get_logger(__name__)

# ── Embedding configuration ───────────────────────────────────────────────
# Provider switch:
#   "gemini" (default) - Google Gemini embedContent REST. Free tier:
#                        input token gratis (rate-limited), tanpa model
#                        lokal → cocok untuk Vercel. Butuh GEMINI_API_KEY.
#                        Catatan free tier: data dipakai Google improve produk.
#   "hf"     (optional) - HuggingFace Inference API, model runs server-side.
#                        Model MiniLM di bawah = 384 dim, TIDAK cocok dengan
#                        skema vector(768) tanpa migrasi kolom.
#   "local"  (optional, dev-only) - sentence-transformers on CPU (384 dim).
# Vektor dari model/dimensi BERBEDA tidak comparable: ganti provider/dimensi =
# migrasi kolom pgvector (supabase_migration_768.sql) + reindex penuh
# (python -m backend.tools.reindex_embeddings).
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "gemini").strip().lower()
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

# Gemini embedding (provider "gemini"). Beda dengan GEMINI_MODEL di .env -
# variabel itu nama model LLM untuk agent, bukan embedding.
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2").strip()
# Kunci khusus embedding; fallback ke GEMINI_API_KEY (var itu juga dibaca
# agent LLM - aman selama GROQ_API_KEY/OPENROUTER_API_KEY terisi, karena
# urutan resolusi key agent memprioritaskan kunci provider aktif).
GEMINI_API_KEY = os.getenv("GEMINI_EMBEDDING_API_KEY", "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_API_BASE = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")

# Dimensi vektor - WAJIB sama dengan kolom pgvector di Supabase.
# Default 768: rekomendasi MRL Google untuk gemini-embedding-2 (MTEB 67.99,
# mendekati 68.17@1536, storage hemat). Ganti nilai ini HANYA bersamaan dengan
# migrasi kolom (supabase_migration_768.sql) + reindex penuh.
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))
# Retrieval floor: chunks below this cosine similarity are dropped.
# Default dikalibrasi per provider (gemini: 0.649-0.796 lolos, sampah 0.498-0.63).
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.64" if EMBEDDING_PROVIDER == "gemini" else "0.25"))

# Chunking SATU tempat: index_entry + reindex_embeddings wajib pakai fungsi ini.
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
# Naikkan bila parameter/mesin chunking berubah - tersimpan per baris embedding.
CHUNKER_VERSION = "rcs-500-50"

# Total budget embedding per entry. Harus di bawah vercel.json maxDuration (60s),
# supaya request tidak dibunuh server tepat di tengah tulis DB.
EMBEDDING_BUDGET_S = float(os.getenv("EMBEDDING_BUDGET_SECONDS", "45"))

# Dimensi output model yang diketahui. Dipakai validasi startup: salah mismatch
# = semua embedding disimpan ke kolom vector(N) yang beda → RPC gagal silent.
_PROVIDER_DIMS = {"hf": 384, "local": 384}


def validate_embedding_config() -> None:
    """Hentikan startup bila provider/dimensi tidak kompatibel dengan skema.

    HF MiniLM dan sentence-transformers lokal menghasilkan 384 dim, sedangkan
    Supabase memakai vector(768). Tanpa validasi, `_hf_embed` melempar
    ValueError tiap request, `get_embedding` menelannya, dan semua search
    diam-diam jatuh ke keyword fallback.
    """
    expected = _PROVIDER_DIMS.get(EMBEDDING_PROVIDER)
    if expected is not None and EMBEDDING_DIM != expected:
        raise RuntimeError(
            f"EMBEDDING_PROVIDER={EMBEDDING_PROVIDER} menghasilkan vektor {expected} dim, "
            f"tapi EMBEDDING_DIM={EMBEDDING_DIM}. Set EMBEDDING_DIM={expected} + migrasi "
            f"kolom vector({expected}) + reindex penuh, atau pakai EMBEDDING_PROVIDER=gemini."
        )


def _current_match_threshold() -> float:
    """Threshold dari admin (app_settings.rag_match_threshold); None = env MATCH_THRESHOLD."""
    try:
        t = DatabaseService.get_app_settings().get("rag_match_threshold")
        if t is not None:
            return float(t)
    except Exception:
        pass
    return MATCH_THRESHOLD


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

            logger.info("Loading SentenceTransformer model 'paraphrase-multilingual-MiniLM-L12-v2'...")
            _embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2", device="cpu")
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.exception(f"Error loading embedding model: {e}")
            _embedding_model = None
    return _embedding_model


def chunk_text(text: str) -> list[str]:
    """Split konten jadi chunk (500/50) - dipakai indexing, reindex, keyword fallback.

    RecursiveCharacterTextSplitter memotong per karakter saat separator habis,
    jadi teks tanpa paragraf tidak jadi satu chunk raksasa di luar budget embed.
    Import lazy: langchain_text_splitters menarik deps berat.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    if not (text or "").strip():
        return []
    return RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP).split_text(text)


def embedding_metadata() -> dict[str, str]:
    """Identitas model + versi chunker untuk baris knowledge_embeddings.

    Tanpa ini, DB bisa berisi vektor dari dua model sekaligus (mis. reindex
    parsial setelah ganti .env) tanpa cara mendeteksinya.
    """
    if EMBEDDING_PROVIDER == "gemini":
        model = GEMINI_EMBEDDING_MODEL
    elif EMBEDDING_PROVIDER == "hf":
        model = HF_EMBEDDING_MODEL
    else:
        model = EMBEDDING_PROVIDER
    return {"embedding_model": f"{EMBEDDING_PROVIDER}:{model}", "chunker_version": CHUNKER_VERSION}


def _insert_embeddings(rows: list[dict]) -> None:
    """Insert baris embedding; kalau kolom metadata belum ada, fallback tanpa itu."""
    try:
        supabase_client.table("knowledge_embeddings").insert(rows).execute()
    except Exception as e:
        stripped = [{k: v for k, v in r.items() if k not in ("embedding_model", "chunker_version")} for r in rows]
        try:
            supabase_client.table("knowledge_embeddings").insert(stripped).execute()
            logger.warning(f"knowledge_embeddings belum punya kolom metadata (jalankan migrasi): {e}")
        except Exception:
            raise e from None


def _sleep_until_retry(seconds: float, deadline: float | None) -> None:
    """Sleep backoff, tapi jangan pernah melewati deadline request."""
    if deadline is not None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("Embedding deadline terlampaui - retry dibatalkan")
        seconds = min(seconds, remaining)
    time.sleep(seconds)


def _request_timeout(deadline: float | None) -> float:
    """Timeout HTTP per attempt, dipotong sisa budget request."""
    if deadline is None:
        return _HF_TIMEOUT_S
    return max(1.0, min(_HF_TIMEOUT_S, deadline - time.monotonic()))


def _hf_embed(text: str, deadline: float | None = None) -> list[float]:
    """Call HuggingFace Inference API. Raises on failure."""
    if not HF_TOKEN:
        raise RuntimeError(
            "HF_TOKEN not set - create a free read token at https://huggingface.co/settings/tokens and put it in .env"
        )
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {HF_TOKEN}"}

    last_err = "unknown error"
    with httpx.Client(timeout=_HF_TIMEOUT_S) as client:
        for _attempt in range(_HF_MAX_RETRIES):
            if deadline is not None and time.monotonic() >= deadline:
                raise RuntimeError(f"HF embedding deadline terlampaui: {last_err}")
            try:
                resp = client.post(
                    HF_API_URL,
                    headers=headers,
                    json={"inputs": text},
                    timeout=_request_timeout(deadline),
                )
            except httpx.HTTPError as e:
                last_err = f"network error: {e}"
                _sleep_until_retry(_HF_RETRY_WAIT_S, deadline)
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
                _sleep_until_retry(_HF_RETRY_WAIT_S, deadline)
                continue
            raise RuntimeError(f"HF embedding failed: HTTP {resp.status_code}: {body}")

    raise RuntimeError(f"HF embedding unavailable after {_HF_MAX_RETRIES} tries: {last_err}")


def _gemini_embed(text: str, as_query: bool = False, deadline: float | None = None) -> list[float]:
    """Call Gemini embedContent REST. Raises on failure.

    Prefix task mengikuti dokumentasi resmi - DUA format berbeda:
      - gemini-embedding-2  : taskType TIDAK boleh dikirim; petunjuk tugas
                              disisipkan ke teks input (prefix prompt).
      - gemini-embedding-001: pakai field taskType (RETRIEVAL_QUERY vs
                              RETRIEVAL_DOCUMENT), teks tanpa prefix.
    Query dan dokumen HARUS pakai mode yang sama (asimetris) supaya ruang
    embeddingnya sejajar.

    output_dimensionality=EMBEDDING_DIM supaya skema pgvector tidak berubah.
    Vektor non-default selalu di-L2-normalize manual (syarat MRL untuk 001;
    v2 sudah auto-normalize - normalisasi ulang idempoten/boler).
    """
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY not set - ambil kunci gratis di https://aistudio.google.com/apikey lalu isi di .env"
        )

    is_v2 = "embedding-2" in GEMINI_EMBEDDING_MODEL
    content_text = (
        (f"task: search result | query: {text}" if as_query else f"title: none | text: {text}") if is_v2 else text
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
        for retry_num in range(_HF_MAX_RETRIES):
            if deadline is not None and time.monotonic() >= deadline:
                raise RuntimeError(f"Gemini embedding deadline terlampaui: {last_err}")
            try:
                resp = client.post(url, headers=headers, json=body, timeout=_request_timeout(deadline))
            except httpx.HTTPError as e:
                last_err = f"network error: {e}"
                _sleep_until_retry(_HF_RETRY_WAIT_S, deadline)
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
                _sleep_until_retry(_HF_RETRY_WAIT_S * (retry_num + 1), deadline)
                continue
            # 400/403 (key salah, model salah) → gagal cepat, jangan retry.
            raise RuntimeError(f"Gemini embedding failed: HTTP {resp.status_code}: {body_txt}")

    raise RuntimeError(f"Gemini embedding unavailable after {_HF_MAX_RETRIES} tries: {last_err}")


# Cache untuk query embeddings (avoid re-encoding same query)
_embedding_cache: dict[str, list[float]] = {}


def _warmup_embedding_model():
    """Load model di background thread saat server start.

    Tanpa ini, chat pertama setiap boot/reload bayar biaya load model
    (~9.6s ukuran L12) di dalam request. Dengan warmup, load terjadi
    paralel - chat pertama cukup bayar RPC + Groq saja.
    """
    try:
        _get_embedding_model()
    except Exception as e:
        logger.warning(f"Embedding warmup skipped: {e}")


if EMBEDDING_PROVIDER == "local" and __name__ != "__main__":
    import threading

    _warm_thread = threading.Thread(target=_warmup_embedding_model, daemon=True, name="emb-warmup")
    _warm_thread.start()


# Common Indonesian + English stopwords - excluded from keyword matching so
# generic words ("yang", "cara", "how") don't match every entry.
_STOPWORDS = {
    "yang",
    "dan",
    "di",
    "ke",
    "dari",
    "ini",
    "itu",
    "apa",
    "gimana",
    "bagaimana",
    "cara",
    "ada",
    "untuk",
    "dengan",
    "atau",
    "saya",
    "aku",
    "kamu",
    "anda",
    "kah",
    "adalah",
    "pada",
    "juga",
    "bisa",
    "tolong",
    "mohon",
    "the",
    "a",
    "an",
    "is",
    "are",
    "how",
    "what",
    "to",
    "of",
    "in",
    "for",
    "you",
}


def _keyword_search_scored(query: str, match_count: int) -> list[tuple[int, str, str]]:
    """Varian `_keyword_search` yang mempertahankan skor + entry_id untuk trace.

    Return list (hits, chunk, entry_id), sudah diurutkan menurun.
    """
    import re as _re

    terms = {w for w in _re.findall(r"\w+", query.lower()) if len(w) >= 3 and w not in _STOPWORDS}
    if not terms:
        return []
    needed = min(2, len(terms))

    scored: list[tuple[int, str, str]] = []
    for entry in DatabaseService.get_knowledge_entries():
        if entry.get("is_active") is False:
            continue
        entry_id = str(entry.get("id") or "")
        for chunk in chunk_text(entry.get("content") or ""):
            tl = chunk.lower()
            hits = sum(len(_re.findall(r"\b" + _re.escape(t), tl)) for t in terms)
            if hits >= needed:
                scored.append((hits, chunk, entry_id))

    scored.sort(key=lambda x: -x[0])
    return scored[:match_count]


def _keyword_search(query: str, match_count: int) -> list[str]:
    """Keyword fallback - chunk yang benar-benar cocok, diurutkan skor.

    Sengaja TIDAK punya fallback "entry pertama": konten tidak relevan yang
    disuntik ke system prompt bikin LLM mengarang jawaban. Empty list lebih
    jujur - context_builder menangani empty dengan pesan "tidak ada knowledge
    relevan", dan Core Rules bilang fallback ke general knowledge.

    - Tokenisasi regex \\w+ (bukan split) supaya "paket?" == "paket".
    - Kembalikan chunk (bukan seluruh entry) agar budget prompt tetap utuh.
    - Ranking: frekuensi kemunculan term (bukan urutan tabel); minimal 2 term
      berbeda cocok, atau semua bila query hanya punya 1 term berarti.
    - Word boundary + prefix: "nama" tidak match "purnama", tapi "paket"
      match "paketnya".
    """
    return [chunk for _, chunk, _ in _keyword_search_scored(query, match_count)]


def _entry_title_map() -> dict[str, str]:
    """entry_id -> judul entry, untuk label sumber di trace RAG client."""
    try:
        return {
            str(e.get("id")): str(e.get("title") or "").strip()
            for e in (DatabaseService.get_knowledge_entries() or [])
            if e.get("id")
        }
    except Exception:
        return {}


class KnowledgeService:
    @staticmethod
    def get_embedding(text: str, as_query: bool = False, deadline: float | None = None) -> list[float]:
        """Generate embedding (cached).

        Returns an EMBEDDING_DIM vector (default 768) representing semantic
        meaning of text. Provider via EMBEDDING_PROVIDER (.env):
        "hf" | "local" | "gemini" | "off".
        as_query=True hanya berpengaruh untuk provider gemini (prefix task
        query vs dokumen) - dua mode punya cache key terpisah.
        Provider gagal → dummy zeros → semantic_search jatuh ke keyword
        fallback (sengaja: vektor model berbeda TIDAK boleh dicampur).
        """
        # Gemini: prefix query vs dokumen beda → cache key harus dibedakan
        # agar teks identik di mode berbeda tidak saling tabrak.
        cache_key = f"{'q:' if as_query else 'd:'}{text}" if EMBEDDING_PROVIDER == "gemini" else text
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]

        # TEMPORARY TEST SWITCH: "off" = no embeddings, keyword fallback only.
        if EMBEDDING_PROVIDER == "off":
            logger.info("Embedding disabled (EMBEDDING_PROVIDER=off) -> keyword fallback")
            return [0.0] * EMBEDDING_DIM

        try:
            if EMBEDDING_PROVIDER == "gemini":
                result = _gemini_embed(text, as_query=as_query, deadline=deadline)
            elif EMBEDDING_PROVIDER == "local":
                model = _get_embedding_model()
                if model is None:
                    logger.warning("Warning: Using dummy embeddings (local model not loaded)")
                    return [0.0] * EMBEDDING_DIM
                embedding = model.encode(text, convert_to_tensor=False, show_progress_bar=False)
                result = [float(x) for x in embedding.tolist()]
            else:
                result = _hf_embed(text, deadline=deadline)
            # Cache dipagari agar tidak membengkak tanpa batas (teks unik =
            # entry baru tiap kali): hapus key tertua (insertion order) saat
            # melewati batas.
            if len(_embedding_cache) >= 2000:
                _embedding_cache.pop(next(iter(_embedding_cache)))
            _embedding_cache[cache_key] = result
            return result
        except Exception as e:
            # Dummy vector -> semantic_search falls back to keyword search
            logger.warning(f"Error generating embedding ({EMBEDDING_PROVIDER}): {e}")
            return [0.0] * EMBEDDING_DIM

    @staticmethod
    def index_entry(entry_id: str, content: str) -> int:
        """Re-index satu entry tanpa pernah meninggalkannya tanpa chunk.

        Urutan: embed semua chunk (deadline EMBEDDING_BUDGET_S) -> insert baris
        baru -> hapus HANYA baris lama yang id-nya sudah dibaca di awal. Kalau
        insert gagal, index lama utuh; kalau delete gagal, yang tersisa hanya
        duplikat (bukan entry kosong) dan context_builder membuang duplikatnya.
        Zero-vector tidak pernah disimpan.
        """
        if EMBEDDING_PROVIDER == "off" or not supabase_client:
            return 0

        deadline = time.monotonic() + EMBEDDING_BUDGET_S
        chunks = chunk_text(content)

        rows = []
        for idx, chunk in enumerate(chunks):
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"Embedding melebihi budget {EMBEDDING_BUDGET_S:.0f}s pada chunk {idx}/"
                    f"{len(chunks)}; index entry tidak diubah"
                )
            embedding = KnowledgeService.get_embedding(chunk, deadline=deadline)
            if not _is_valid_vector(embedding):
                raise RuntimeError(f"Embedding gagal pada chunk {idx}; index entry tidak diubah")
            rows.append(
                {
                    "entry_id": entry_id,
                    "chunk_index": idx,
                    "content_chunk": chunk,
                    "embedding": embedding,
                    **embedding_metadata(),
                }
            )

        # Snapshot id lama SEBELUM insert; tanpa ini delete setelah insert akan
        # ikut menghapus chunk baru (filter hanya entry_id).
        try:
            old = supabase_client.table("knowledge_embeddings").select("id").eq("entry_id", entry_id).execute()
        except Exception as e:
            raise RuntimeError(f"Gagal membaca index lama entry {entry_id}; DB tidak diubah") from e
        old_ids = [r["id"] for r in (getattr(old, "data", None) or [])]

        if rows:
            _insert_embeddings(rows)
        if old_ids:
            try:
                supabase_client.table("knowledge_embeddings").delete().in_("id", old_ids).execute()
            except Exception as e:
                # Chunk baru sudah aman; sisa chunk lama hanya duplikat.
                logger.warning(f"Gagal menghapus chunk lama entry {entry_id} (duplikat tersisa): {e}")
        rag_cache.clear()
        try:
            DatabaseService.bump_knowledge_version()
        except Exception as e:
            logger.warning(f"Gagal menaikkan knowledge_version: {e}")
        return len(rows)

    @staticmethod
    def _vector_candidates(query: str, match_count: int, threshold: float | None) -> list[dict[str, Any]] | None:
        """Baris hasil RPC match_knowledge_entries, atau None bila tidak tersedia."""
        if not supabase_client:
            return None
        query_embedding = KnowledgeService.get_embedding(query, as_query=True)
        if not _is_valid_vector(query_embedding):
            return None
        try:
            res = supabase_client.rpc(
                "match_knowledge_entries",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": threshold if threshold is not None else _current_match_threshold(),
                    "match_count": match_count,
                },
            ).execute()
            return list(res.data or [])
        except Exception as e:
            logger.warning(f"Search error: {e}")
            return None

    @staticmethod
    def semantic_search_detailed(
        query: str, match_count: int = 4, threshold: float | None = None
    ) -> dict[str, Any]:
        """Vector search + fallback, lengkap dengan metadata untuk ditampilkan ke klien.

        Return:
            {
              "chunks": [{"content", "score", "entry_id", "title", "method"}],
              "method": "vector" | "keyword" | "none",
              "threshold": float,   # ambang efektif yang dipakai
            }

        `score` = cosine similarity saat method "vector"; saat "keyword" berisi
        jumlah kecocokan term (bukan similarity). `threshold` eksplisit dipakai
        oleh mode perbandingan RAG (ambang rendah vs tinggi).
        """
        effective = float(threshold) if threshold is not None else _current_match_threshold()
        titles = _entry_title_map()

        rows = KnowledgeService._vector_candidates(query, match_count, threshold)
        if rows:
            chunks = [
                {
                    "content": str(r.get("content_chunk") or ""),
                    "score": round(float(r.get("similarity") or 0.0), 4),
                    "entry_id": str(r.get("entry_id") or ""),
                    "title": titles.get(str(r.get("entry_id") or ""), ""),
                    "method": "vector",
                }
                for r in rows
            ]
            return {"chunks": chunks, "method": "vector", "threshold": round(effective, 4)}

        # Ambang eksplisit (mode banding / pilihan pengguna) berarti uji presisi:
        # jangan diam-diam jatuh ke pencarian kata kunci, karena hasilnya tidak
        # lagi mencerminkan ambang yang dipilih. Tanpa ambang eksplisit, fallback
        # kata kunci tetap dipakai supaya chat biasa tidak kehilangan konteks.
        if threshold is not None:
            return {"chunks": [], "method": "none", "threshold": round(effective, 4)}

        kw = _keyword_search_scored(query, match_count)
        chunks = [
            {
                "content": chunk,
                "score": float(hits),
                "entry_id": entry_id,
                "title": titles.get(entry_id, ""),
                "method": "keyword",
            }
            for hits, chunk, entry_id in kw
        ]
        return {
            "chunks": chunks,
            "method": "keyword" if chunks else "none",
            "threshold": round(effective, 4),
        }

    @staticmethod
    def semantic_search(query: str, match_count: int = 4) -> list[str]:
        """Vector search dengan threshold (match_knowledge_entries), lalu keyword
        fallback. Hasil di bawah MATCH_THRESHOLD tidak dikirim ke LLM."""
        result = KnowledgeService.semantic_search_detailed(query, match_count=match_count)
        return [str(c.get("content") or "") for c in result["chunks"]]


def _is_valid_vector(vec: list[float]) -> bool:
    return len(vec) == EMBEDDING_DIM and any(x != 0.0 for x in vec)
