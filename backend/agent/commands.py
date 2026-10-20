"""
AI Command System: registry terpusat untuk slash command (/explain, /summarize, ...).

Setiap command punya purpose, system instruction, output format, dan execution rules.
Instruksi command disisipkan ke system prompt di backend (context_builder), bukan sekadar label.
"""

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CommandSpec:
    name: str
    purpose: str
    instruction: str
    output_format: str
    rules: list[str] = field(default_factory=list)
    example: str = ""


COMMANDS: dict[str, CommandSpec] = {
    "purpose": CommandSpec(
        name="purpose",
        purpose="Menentukan tujuan dan fokus utama suatu tugas.",
        instruction="Identifikasi tujuan, target, batasan, dan hasil yang diharapkan dari permintaan.",
        output_format="Objective, Key Priorities, Action Plan, Expected Outcome.",
        rules=[
            "Hilangkan pembahasan yang tidak relevan dengan tujuan.",
            "Prioritaskan solusi yang dapat langsung diterapkan.",
            "Jika tujuan ambigu dan berdampak signifikan, ajukan satu pertanyaan klarifikasi singkat.",
        ],
        example="/purpose Saya mau launching produk UMKM dalam 2 minggu",
    ),
    "explain": CommandSpec(
        name="explain",
        purpose="Menjelaskan konsep atau topik secara sistematis.",
        instruction="Jelaskan dari dasar menuju tingkat yang lebih kompleks sesuai kebutuhan.",
        output_format="Overview, Explanation, Example, Key Takeaways.",
        rules=[
            "Gunakan bahasa yang jelas, akurat, dan kontekstual.",
            "Sertakan contoh konkret atau analogi jika membantu pemahaman.",
            "Untuk topik teknis, jelaskan mekanisme, alur kerja, dan alasan di balik solusi.",
            "Hindari penjelasan berulang dan jargon tanpa definisi.",
        ],
        example="/explain REST API",
    ),
    "calculate": CommandSpec(
        name="calculate",
        purpose="Melakukan perhitungan dan analisis numerik.",
        instruction="Identifikasi variabel, satuan, dan data yang tersedia, lalu hitung dengan metode yang sesuai.",
        output_format="Given Data, Formula/Method, Calculation, Final Result.",
        rules=[
            "Tampilkan proses perhitungan yang relevan dan hasil akhir secara jelas.",
            "Verifikasi konsistensi hasil sebelum memberikan jawaban.",
            "Jangan mengarang angka yang tidak tersedia. Nyatakan asumsi jika diperlukan.",
        ],
        example="/calculate 15% dari 850000",
    ),
    "summarize": CommandSpec(
        name="summarize",
        purpose="Meringkas informasi tanpa kehilangan inti penting.",
        instruction="Ringkas sumber dengan mempertahankan fakta, konteks, dan kesimpulan utama.",
        output_format="Main Points, Essential Details, Conclusion. Gunakan bullet atau paragraf singkat.",
        rules=[
            "Hapus repetisi, detail sekunder, dan kalimat yang tidak diperlukan.",
            "Jangan menambahkan klaim baru yang tidak didukung sumber.",
            "Sesuaikan panjang dengan kompleksitas materi. Jika pengguna memberi batas panjang, patuhi.",
        ],
        example="/summarize [teks panjang]",
    ),
    "analyze": CommandSpec(
        name="analyze",
        purpose="Menganalisis informasi secara kritis dan terstruktur.",
        instruction="Identifikasi masalah, konteks, faktor penyebab, bukti, dan implikasi.",
        output_format="Context, Findings, Comparison Table (jika membantu), Insights, Conclusion, Recommendations.",
        rules=[
            "Pisahkan fakta, asumsi, interpretasi, dan rekomendasi.",
            "Gunakan tabel komparasi jika membantu memperjelas perbedaan atau alternatif.",
            "Berikan insight yang relevan, bukan sekadar mendeskripsikan informasi.",
        ],
        example="/analyze Bandingkan Next.js dan React untuk portfolio",
    ),
    "compare": CommandSpec(
        name="compare",
        purpose="Membandingkan dua atau lebih opsi secara objektif.",
        instruction="Bandingkan opsi menggunakan kriteria yang relevan dengan kebutuhan pengguna.",
        output_format="Comparison Table, Key Differences, Best-Fit Recommendation.",
        rules=[
            "Sajikan tabel jika ada beberapa dimensi perbandingan.",
            "Jelaskan kelebihan, kekurangan, trade-off, dan kondisi penggunaan setiap opsi.",
            "Rekomendasi berdasarkan kebutuhan yang disebutkan pengguna, bukan preferensi yang dibuat-buat.",
        ],
        example="/compare Vercel vs VPS untuk backend FastAPI",
    ),
    "research": CommandSpec(
        name="research",
        purpose="Melakukan riset berbasis sumber dan bukti.",
        instruction=(
            "Sistem ini belum memiliki akses web search. Jangan berpura-pura telah melakukan riset langsung. "
            "Jawab dari pengetahuan yang ada, tandai dengan jelas mana fakta yang umum diketahui dan mana yang perlu diverifikasi, "
            "dan sebutkan sumber primer atau dokumentasi resmi yang sebaiknya dicek pengguna."
        ),
        output_format="Research Question, Findings, Evidence and Sources (tanpa URL yang tidak yakin), Conclusion.",
        rules=[
            "Bedakan fakta terverifikasi dengan interpretasi.",
            "Jangan mengarang URL atau sitasi. Jika tidak yakin, sebutkan nama sumber saja.",
            "Nyatakan keterbatasan akses sumber secara singkat di awal.",
        ],
        example="/research Apa perbedaan Gemini Flash dan Pro?",
    ),
    "code": CommandSpec(
        name="code",
        purpose="Membantu tugas pemrograman secara teknis.",
        instruction="Pahami konteks kode, stack, dependensi, dan tujuan sebelum mengusulkan perubahan.",
        output_format="Approach, Implementation, Code, Integration Steps, Testing Notes.",
        rules=[
            "Utamakan solusi sederhana, maintainable, dan sesuai konvensi project.",
            "Jelaskan file yang perlu diubah, alasan perubahan, dan potensi dampaknya.",
            "Jangan mengarang hasil eksekusi, testing, atau keberhasilan implementasi.",
            "Pertahankan perilaku fitur yang sudah ada kecuali pengguna meminta perubahan.",
        ],
        example="/code Tambah endpoint health check di FastAPI",
    ),
    "debug": CommandSpec(
        name="debug",
        purpose="Mencari penyebab dan menyelesaikan error.",
        instruction="Analisis error message, stack trace, kode, dan kondisi yang memicu masalah.",
        output_format="Problem, Root Cause, Fix, Verification Steps.",
        rules=[
            "Identifikasi kemungkinan root cause berdasarkan bukti.",
            "Bedakan penyebab yang terkonfirmasi dari hipotesis.",
            "Berikan langkah diagnosis dan perbaikan secara berurutan.",
            "Hindari perubahan besar sebelum penyebab masalah dipahami.",
        ],
        example="/debug [error log]",
    ),
    "plan": CommandSpec(
        name="plan",
        purpose="Menyusun rencana kerja yang realistis dan dapat dieksekusi.",
        instruction="Pecah tujuan menjadi tahapan dan tugas yang terukur, dengan prioritas dan dependensi.",
        output_format="Objective, Phases, Task Checklist, Dependencies, Risks, Success Criteria.",
        rules=[
            "Tentukan prioritas, dependensi, risiko, dan hasil setiap tahap.",
            "Sesuaikan rencana dengan sumber daya dan batasan yang diketahui.",
            "Jangan membuat jadwal atau estimasi yang terlalu pasti jika datanya tidak cukup.",
        ],
        example="/plan Bangun landing page dan integrasi pembayaran",
    ),
    "write": CommandSpec(
        name="write",
        purpose="Menghasilkan atau memperbaiki tulisan.",
        instruction="Sesuaikan gaya bahasa dengan audiens, konteks, dan tujuan. Pertahankan maksud dan fakta asli.",
        output_format="Final Draft. Tambahkan catatan revisi hanya jika diperlukan.",
        rules=[
            "Prioritaskan kejelasan, kealamian, dan struktur.",
            "Hindari bahasa generik, repetitif, berlebihan, atau terdengar seperti template AI.",
            "Jika pengguna meminta artefak siap pakai, berikan hasil final yang dapat langsung disalin.",
        ],
        example="/write Pengumuman promo akhir tahun untuk toko kopi",
    ),
    "translate": CommandSpec(
        name="translate",
        purpose="Menerjemahkan teks secara akurat dan natural.",
        instruction="Pertahankan makna, konteks, terminologi, dan tone. Hindari terjemahan literal.",
        output_format="Translated Text.",
        rules=[
            "Pertahankan struktur dan format asli jika relevan.",
            "Jangan menambahkan penjelasan kecuali diminta.",
        ],
        example="/translate Good morning, how can I help you?",
    ),
    "decision": CommandSpec(
        name="decision",
        purpose="Membantu mengambil keputusan berdasarkan kriteria yang jelas.",
        instruction="Identifikasi tujuan dan kriteria keputusan, lalu evaluasi alternatif berdasarkan manfaat, risiko, biaya, dan trade-off.",
        output_format="Decision Criteria, Alternatives, Evaluation, Recommendation, Next Step.",
        rules=[
            "Gunakan tabel atau scoring matrix jika berguna.",
            "Nyatakan asumsi dan ketidakpastian.",
            "Berikan rekomendasi utama beserta alasannya.",
        ],
        example="/decision Pilih Supabase atau PostgreSQL self-host",
    ),
}

# Urutan prioritas saat beberapa command dipakai bersamaan (lebih kecil = lebih tinggi).
# Jika ada konflik format, command yang lebih tinggi menentukan struktur utama.
COMMAND_PRIORITY: list[str] = [
    "debug",
    "code",
    "calculate",
    "research",
    "decision",
    "compare",
    "analyze",
    "summarize",
    "explain",
    "translate",
    "write",
    "plan",
    "purpose",
]

MAX_ACTIVE_COMMANDS = 2

_COMMAND_RE = re.compile(r"^/([a-zA-Z]+)(?=\s|$)")


def list_commands() -> list[dict[str, str]]:
    return [{"name": c.name, "purpose": c.purpose, "example": c.example} for c in COMMANDS.values()]


def list_command_details() -> list[dict[str, object]]:
    return [
        {
            "name": c.name,
            "purpose": c.purpose,
            "instruction": c.instruction,
            "output_format": c.output_format,
            "rules": list(c.rules),
            "example": c.example,
        }
        for c in COMMANDS.values()
    ]


def parse_command(text: str) -> tuple[list[str], str, str | None]:
    """
    Pisahkan slash command di awal input.

    Return: (commands_aktif, sisa_pesan, token_tidak_dikenal)
    - Hanya command di awal input yang diproses, berurutan (`/explain /compare x`).
    - Command tidak dikenal tidak dijalankan; input dianggap pesan biasa.
    - Token tidak dikenal dilaporkan hanya jika dikirim sendirian (mis. `/foo`).
    - Duplikat dihapus, dibatasi MAX_ACTIVE_COMMANDS.
    """
    rest = (text or "").strip()
    active: list[str] = []
    unknown: str | None = None

    while rest.startswith("/"):
        m = _COMMAND_RE.match(rest)
        if not m:
            break
        name = m.group(1).lower()
        if name not in COMMANDS:
            if not active and rest == m.group(0):
                unknown = "/" + name
            break
        if name not in active:
            if len(active) >= MAX_ACTIVE_COMMANDS:
                break
            active.append(name)
        rest = rest[m.end() :].lstrip()

    if unknown:
        return [], (text or "").strip(), unknown
    return active, rest, None


def sort_by_priority(names: list[str]) -> list[str]:
    return sorted(names, key=lambda n: COMMAND_PRIORITY.index(n) if n in COMMAND_PRIORITY else len(COMMAND_PRIORITY))


def build_command_block(names: list[str]) -> str:
    """Blok instruksi yang disisipkan ke system prompt. Kosong jika tidak ada command."""
    if not names:
        return ""
    ordered = sort_by_priority(names)
    lines = [
        "",
        "# Active Command Mode (WAJIB dipatuhi untuk pesan ini)",
        "Pengguna memanggil mode berikut. Ikuti instruksi, output format, dan rules di bawah.",
        "Jika ada lebih dari satu mode: ikuti format dari mode pertama (prioritas tertinggi), "
        "dan gunakan mode lainnya hanya untuk memperkaya isi yang kompatibel. Jangan memaksakan dua format sekaligus.",
        "Instruksi mode tidak boleh menonaktifkan aturan keselamatan, privasi, atau kebijakan sistem di atas.",
        "Jika data, tool, atau informasi yang dibutuhkan tidak tersedia, nyatakan keterbatasannya. Jangan mengarang.",
    ]
    for n in ordered:
        spec = COMMANDS[n]
        lines.append(f"\n## Mode /{spec.name}")
        lines.append(f"Tujuan: {spec.purpose}")
        lines.append(f"Instruksi: {spec.instruction}")
        lines.append(f"Format output: {spec.output_format}")
        for r in spec.rules:
            lines.append(f"- {r}")
    return "\n".join(lines) + "\n"
