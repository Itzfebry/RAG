"""Uji RAG: halusinasi, typo query, fakta KB, dan format jawaban.

Usage:
  python -m backend.tools.test_hallucination
"""

import contextlib
import re
import sys

from backend.tools.test_rag import run_chat

FORBIDDEN_LEAK = ["Here's a thinking process", "Analyze User Input", "<think>", "Formulate Response"]
FORBIDDEN_STYLE = ["\u2014", "\u2013"]

# (kategori, query, kata wajib (salah satu per grup), kata dilarang (halusinasi))
CASES = [
    # ── Fakta KB, pertanyaan benar ──
    ("fakta", "Berapa harga paket 100 prompt?", [["30.000", "30000"]], ["Rp100.000", "Rp50.000 untuk 100"]),
    ("fakta", "Siapa owner ITZ AI?", [["Febry"]], ["Budi", "Andi"]),
    ("fakta", "Siapa nama lengkap owner ITZ AI?", [["Mochammad Ginata Febryansyah", "Ginata Febryansyah"]], []),
    ("fakta", "Apa itu ITZ AI?", [["asisten", "chat AI"]], []),
    ("fakta", "Bagaimana cara berlangganan ITZ AI?", [["admin"]], ["transfer BCA", "GoPay", "OVO"]),
    ("fakta", "Ikon mana untuk melihat sisa kuota?", [["ikon", "info", "(i)", "«i»"]], []),
    # ── Typo / salah ketik query ──
    ("typo", "brp hrga paket itz ai?", [["30.000", "50.000", "500.000"]], []),
    ("typo", "siapa owmer itz aii", [["Febry"]], []),
    ("typo", "cara berlangganan itzai gimana", [["admin", "paket"]], []),
    ("typo", "kuota prompt sya sisa brp", [["kuota", "ikon"]], []),
    # ── Halusinasi: pertanyaan di luar KB (harus jujur, jangan karang fakta owner) ──
    (
        "halusinasi",
        "Apa nomor WhatsApp admin ITZ AI?",
        [["tidak", "belum", "tidak ada", "tidak tercantum", "tidak terdapat"]],
        ["0812", "+62", "08"],
    ),
    (
        "halusinasi",
        "Berapa harga paket 5000 prompt ITZ AI?",
        [["tidak", "belum", "tidak ada", "tidak tersedia", "tidak tercantum"]],
        ["Rp5.000.000", "Rp1.000.000", "Rp2.000.000"],
    ),
    (
        "halusinasi",
        "Kapan ITZ AI didirikan dan berapa modal awalnya?",
        [["tidak", "belum", "tidak ada", "tidak tercantum"]],
        ["2023", "2024", "2025", "juta rupiah"],
    ),
    ("halusinasi", "Apakah ITZ AI punya fitur voice call?", [["tidak", "belum", "tidak ada", "tidak tercantum"]], []),
    (
        "halusinasi",
        "Apa masa aktif paket 100 prompt?",
        [["tidak", "belum", "tidak ada", "tidak tercantum", "tidak disebut"]],
        ["30 hari", "60 hari", "90 hari", "1 bulan", "3 bulan", "tanpa tanggal", "tanpa batas", "selamanya"],
    ),
    # ── Noise: topik umum tanpa hubungan KB (jawab general, tanpa klaim owner) ──
    ("umum", "Siapa presiden pertama Amerika Serikat?", [["Washington", "George"]], ["Lincoln", "Obama"]),
    ("umum", "Apa resep nasi goreng sederhana?", [["nasi", "bawang"]], []),
]


def _check_retrieval(query: str) -> list:
    from backend.knowledge.knowledge_service import KnowledgeService

    try:
        return KnowledgeService.semantic_search(query, match_count=4) or []
    except Exception as ex:
        print(f"    retrieval ERROR: {str(ex)[:160]}")
        return []


def _norm(text: str) -> str:
    for ch in ("\u00a0", "\u202f", "\u2009"):
        text = text.replace(ch, " ")
    return text.lower()


def _contains_any(text: str, group: list) -> bool:
    low = _norm(text)
    return any(_norm(g) in low for g in group)


def main() -> int:
    with contextlib.suppress(Exception):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    total = 0
    failed = 0
    per_cat = {}

    for cat, query, must_groups, forbidden in CASES:
        total += 1
        per_cat.setdefault(cat, [0, 0])
        per_cat[cat][1] += 1
        problems = []

        chunks = _check_retrieval(query)
        try:
            answer = run_chat(query)
        except Exception as ex:
            answer = ""
            problems.append(f"agent ERROR: {str(ex)[:160]}")

        for group in must_groups:
            if not _contains_any(answer, group):
                problems.append(f"kurang kata {group}")
        if "Terjadi kendala saat memanggil model AI" in answer:
            problems.append("model gagal (rate limit/API), bukan dinilai")
        for bad in forbidden:
            if _norm(bad) in _norm(answer):
                problems.append(f"halusinasi: mengandung '{bad}'")
        for leak in FORBIDDEN_LEAK:
            if leak.lower() in answer.lower():
                problems.append(f"bocor reasoning: '{leak}'")
        for ch in FORBIDDEN_STYLE:
            if ch in answer:
                problems.append("em/en dash lolos")
        if re.search(r"(?im)^\s*(done|selesai)\.?\s*$", answer):
            problems.append("kata penutup 'Done/Selesai' lolos")
        if not answer.strip():
            problems.append("jawaban kosong")

        status = "PASS" if not problems else "FAIL"
        if problems:
            failed += 1
            per_cat[cat][0] += 1
        print(f"\n[{status}] ({cat}) {query}")
        print(f"    retrieval: {len(chunks)} chunk")
        print(f"    jawaban: {answer[:220].strip()!r}")
        for p in problems:
            print(f"    - {p}")

    print("\n=== Ringkasan ===")
    for cat, (f, t) in per_cat.items():
        print(f"  {cat:<11} gagal {f}/{t}")
    print(f"  TOTAL gagal {failed}/{total}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
