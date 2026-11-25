"""Seed knowledge base untuk posisi ITZ sebagai agensi jasa AI/web/mobile.

Yang dilakukan:
1. Membuat kategori agensi (Layanan, Proses Kerja, Teknologi, Studi Kasus, FAQ,
   Kebijakan & Kontak).
2. Menambah/memperbarui entry katalog agensi (idempoten per judul) + embed.
3. Menonaktifkan (is_active=false) SEMUA entry di luar kategori agensi -
   termasuk knowledge produk chat lama (branding_itz_ai, pricing_subscription).

Catatan penting:
- Isi di bawah sengaja TIDAK memuat angka harga, nama klien, atau tanggal.
  Nominal proyek memang baru ditentukan setelah discovery (lihat entri
  "Estimasi dan penawaran"). Sunting lewat panel admin bila ingin menambah
  harga publik atau portfolio nyata.
- Tidak menghapus data: entry lama hanya dinonaktifkan, jadi masih bisa
  diaktifkan kembali dari panel admin.

Jalankan:  python -m backend.seed_agency_kb
"""

try:
    from backend.database.db import DatabaseService, supabase_client
    from backend.knowledge.knowledge_service import EMBEDDING_DIM, EMBEDDING_PROVIDER, KnowledgeService
except ImportError:
    from database.db import DatabaseService, supabase_client  # type: ignore
    from knowledge.knowledge_service import (  # type: ignore
        EMBEDDING_DIM,
        EMBEDDING_PROVIDER,
        KnowledgeService,
    )

CATEGORIES = [
    {"slug": "agency_services", "name": "Layanan", "description": "Jenis jasa yang dikerjakan ITZ"},
    {"slug": "agency_process", "name": "Proses Kerja", "description": "Tahapan kerja sama dari discovery sampai serah terima"},
    {"slug": "agency_tech", "name": "Teknologi", "description": "Stack dan pendekatan teknis yang dipakai"},
    {"slug": "agency_cases", "name": "Studi Kasus", "description": "Proyek yang sudah dikerjakan"},
    {"slug": "agency_faq", "name": "FAQ Layanan", "description": "Pertanyaan umum calon klien"},
    {"slug": "agency_policy", "name": "Kebijakan & Kontak", "description": "Estimasi, cakupan, dan cara memulai"},
]

AGENCY_SLUGS = {c["slug"] for c in CATEGORIES}

# (slug kategori, judul, konten, tags)
ENTRIES = [
    # ── Layanan ──
    (
        "agency_services",
        "Layanan ITZ",
        "ITZ adalah studio pengembangan digital yang berfokus pada tiga hal: membangun "
        "aplikasi web, membangun aplikasi mobile, dan menempelkan AI ke sistem bisnis yang "
        "sudah berjalan. Selain pembuatan dari nol, ITZ juga mengaudit serta membenahi "
        "sistem AI yang sudah ada tetapi hasilnya belum bisa dipercaya.",
        ["layanan", "jasa", "agensi", "studio"],
    ),
    (
        "agency_services",
        "Pengembangan aplikasi web",
        "ITZ merancang dan membangun aplikasi web: dashboard internal, portal pelanggan, "
        "sistem pemesanan, katalog produk, hingga panel admin. Pengerjaan mencakup desain "
        "antarmuka, backend, database, autentikasi, dan deploy ke server produksi.",
        ["web app", "dashboard", "portal", "jasa web"],
    ),
    (
        "agency_services",
        "Pengembangan aplikasi mobile",
        "ITZ membangun aplikasi mobile untuk kebutuhan operasional maupun pelanggan, "
        "misalnya aplikasi tim lapangan, pencatatan transaksi, dan aplikasi pendamping "
        "layanan. Aplikasi dapat terhubung ke sistem backend yang sudah dipakai klien.",
        ["mobile", "android", "aplikasi hp", "jasa mobile"],
    ),
    (
        "agency_services",
        "Integrasi AI ke sistem yang sudah jalan",
        "ITZ menempelkan kemampuan AI ke aplikasi atau alur kerja yang sudah dipakai klien "
        "tanpa membongkar sistem lama. Caranya lewat REST API, webhook, atau konektor ke "
        "layanan yang sudah ada. Contoh: AI membaca data dari sistem klien lalu menyusun "
        "ringkasan, balasan, atau laporan otomatis.",
        ["integrasi", "api", "webhook", "ai"],
    ),
    (
        "agency_services",
        "Chatbot dan knowledge base (RAG)",
        "ITZ membangun chatbot yang menjawab dari dokumen milik klien sendiri: SOP, katalog "
        "produk, panduan, atau arsip pertanyaan pelanggan. Teknik yang dipakai adalah "
        "Retrieval-Augmented Generation: dokumen dipecah menjadi potongan kecil, diubah jadi "
        "vektor, disimpan di database vektor, lalu dicari yang paling relevan sebelum AI "
        "menyusun jawaban. Chatbot bisa ditanam di website, WhatsApp, atau Telegram.",
        ["chatbot", "rag", "knowledge base", "sop", "dokumen"],
    ),
    (
        "agency_services",
        "Otomasi alur kerja",
        "ITZ mengotomasi pekerjaan berulang: entri data, rekap laporan berkala, pengiriman "
        "notifikasi, pemrosesan dokumen masuk, dan sinkronisasi antar aplikasi. AI dipakai "
        "pada bagian yang butuh pemahaman teks, sedangkan bagian yang butuh kepastian "
        "ditangani aturan program biasa.",
        ["otomasi", "automation", "rekap", "workflow"],
    ),
    (
        "agency_services",
        "Audit dan perbaikan sistem AI",
        "Untuk sistem AI yang sudah jalan tetapi jawabannya sering meleset, ITZ mengukur "
        "kualitas pencarian datanya, membenahi isi knowledge base, menyetel ambang "
        "relevansi, dan memasang kuota serta pemantauan biaya. Hasilnya dilaporkan lengkap "
        "dengan bukti pengujian, bukan sekadar klaim.",
        ["audit", "evaluasi", "perbaikan", "kualitas"],
    ),
    # ── Proses kerja ──
    (
        "agency_process",
        "Tahapan kerja sama",
        "Alur kerja ITZ berjalan lima tahap: intake (klien menceritakan kebutuhan), "
        "discovery (pemetaan masalah, data, dan target), architecture (rancangan alur dan "
        "pemilihan teknologi), development (pembangunan bertahap dengan demo yang bisa "
        "dicoba), lalu deployment (rilis ke produksi beserta serah terima). Setelah rilis, "
        "ITZ tetap mendampingi untuk perbaikan dan perawatan bila dibutuhkan.",
        ["proses", "tahapan", "alur kerja"],
    ),
    (
        "agency_process",
        "Tahap discovery",
        "Discovery adalah tahap pertama dan yang paling menentukan. Di sini ITZ memetakan "
        "masalah yang ingin diselesaikan, data yang sudah dimiliki klien, sistem yang sedang "
        "dipakai, target hasil, dan batasan seperti tenggat serta anggaran. Keluarannya "
        "adalah brief proyek berisi rekomendasi solusi dan langkah berikutnya. Discovery "
        "dilakukan lewat percakapan di halaman chat ITZ dan bisa langsung menghasilkan brief "
        "yang dapat diunduh.",
        ["discovery", "brief", "pemetaan", "konsultasi"],
    ),
    (
        "agency_process",
        "Demo bertahap saat pengerjaan",
        "Pengerjaan dilakukan bertahap dan setiap tahap penting menghasilkan demo yang bisa "
        "dicoba klien, bukan laporan yang tidak bisa diuji. Tujuannya supaya koreksi terjadi "
        "lebih awal, saat perubahan masih murah.",
        ["demo", "bertahap", "iterasi"],
    ),
    # ── Teknologi ──
    (
        "agency_tech",
        "Teknologi yang dipakai ITZ",
        "Untuk aplikasi web, ITZ memakai Next.js dan React dengan TypeScript serta Tailwind "
        "CSS. Untuk backend dan layanan AI, ITZ memakai Python dan FastAPI. Basis data "
        "menggunakan PostgreSQL, dan untuk pencarian vektor (RAG) memakai pgvector dengan "
        "indeks HNSW. Model bahasa yang dipakai bisa diganti sesuai kebutuhan: penyedia "
        "OpenAI-compatible, model terbuka yang dihosting, maupun model lokal.",
        ["stack", "teknologi", "next.js", "fastapi", "postgres", "pgvector"],
    ),
    (
        "agency_tech",
        "Pendekatan RAG yang dipakai ITZ",
        "Pencarian knowledge memakai embedding asimetris: pertanyaan dan dokumen diubah ke "
        "ruang vektor yang sama tetapi dengan mode berbeda, sehingga pertanyaan pendek tetap "
        "menemukan dokumen panjang. Hasil pencarian disaring dengan ambang kemiripan, lalu "
        "potongan yang lolos disuntikkan ke jawaban bersama aturan agar AI tidak mengarang "
        "fakta di luar sumber. Bila tidak ada potongan yang cukup relevan, sistem mengatakan "
        "tidak tahu daripada memakai konteks yang salah.",
        ["rag", "embedding", "retrieval", "hallucination", "anti halusinasi"],
    ),
    # ── Studi kasus ──
    (
        "agency_cases",
        "Studi kasus: mesin RAG ITZ AI",
        "Sistem yang dipakai halaman ini adalah bukti kerja ITZ sendiri: mesin RAG dengan "
        "embedding 768 dimensi, pencarian vektor HNSW dengan ambang relevansi yang bisa "
        "disetel, jatuh ke pencarian kata kunci bila pencarian vektor tidak tersedia, "
        "penyusunan prompt anti-halusinasi, panel admin untuk mengelola knowledge, serta "
        "pemantauan pemakaian token. Seluruh alur dapat ditelusuri: setiap jawaban "
        "menyertakan potongan sumber dan skor kemiripannya.",
        ["studi kasus", "portofolio", "rag", "ai"],
    ),
    (
        "agency_cases",
        "Studi kasus: chatbot berbasis dokumen",
        "Untuk kebutuhan customer service, ITZ membangun chatbot yang menjawab hanya dari "
        "dokumen resmi klien. Manfaatnya: jawaban konsisten dengan kebijakan terbaru, "
        "operator bisa melihat dari dokumen mana jawaban diambil, dan pemilik usaha bisa "
        "memperbarui isi jawaban cukup dengan mengganti dokumennya.",
        ["studi kasus", "chatbot", "customer service"],
    ),
    # ── FAQ ──
    (
        "agency_faq",
        "Berapa lama pengerjaan sebuah proyek",
        "Durasi ditentukan oleh lingkup yang disepakati setelah discovery. Proyek kecil "
        "seperti chatbot dari dokumen atau dashboard sederhana jauh lebih cepat daripada "
        "sistem operasional menyeluruh. Setelah discovery, ITZ menyampaikan jadwal bertahap "
        "beserta titik demo, sehingga klien tahu kapan hasilnya bisa dilihat.",
        ["durasi", "berapa lama", "jadwal", "timeline"],
    ),
    (
        "agency_faq",
        "Apakah bisa menempel ke sistem yang sudah dipakai",
        "Bisa. ITZ bekerja lewat integrasi, bukan penggantian paksa. AI dan fitur baru "
        "dihubungkan ke sistem klien melalui REST API, webhook, atau konektor, sehingga "
        "aplikasi lama tetap berjalan dan tim klien tidak perlu belajar ulang semuanya.",
        ["integrasi", "sistem lama", "legacy"],
    ),
    (
        "agency_faq",
        "Bagaimana keamanan data klien",
        "Data klien disimpan di infrastruktur yang dipilih bersama, dengan akses dibatasi "
        "dan kunci rahasia hanya ada di sisi server. Dokumen yang dipakai chatbot tidak "
        "ditampilkan utuh; yang dikirim ke antarmuka hanya cuplikan sumber dan skor "
        "relevansinya. Rincian penyimpanan dan retensi data disepakati pada tahap "
        "architecture.",
        ["keamanan", "privasi", "data"],
    ),
    (
        "agency_faq",
        "Bisa dibuatkan chatbot WhatsApp",
        "Bisa. Chatbot ITZ dapat dipasang di WhatsApp, Telegram, Discord, atau website. "
        "Isi jawabannya tetap bersumber dari dokumen resmi klien, dan pertanyaan yang tidak "
        "dijawab memadai bisa dialihkan ke operator manusia.",
        ["whatsapp", "telegram", "chatbot"],
    ),
    (
        "agency_faq",
        "Apa yang AI tidak bisa kerjakan",
        "AI tidak cocok untuk keputusan yang menuntut kepastian mutlak tanpa pengawasan, "
        "seperti perhitungan keuangan final, diagnosis medis, atau keputusan hukum. Pada "
        "kasus seperti itu, AI tetap bisa membantu menyiapkan bahan, tetapi keputusan dan "
        "verifikasi tetap di tangan manusia. ITZ akan menyampaikan ini terus terang saat "
        "discovery.",
        ["batasan", "limitasi", "risiko"],
    ),
    # ── Kebijakan & kontak ──
    (
        "agency_policy",
        "Estimasi dan penawaran",
        "Estimasi biaya dan durasi dihitung per proyek setelah discovery selesai, karena "
        "lingkup setiap klien berbeda. Setelah brief tersusun, tim ITZ mengirim penawaran "
        "tertulis berisi lingkup, tahapan, jadwal, dan nominal. Angka apa pun yang "
        "disebutkan di percakapan discovery bersifat perkiraan kasar, bukan penawaran "
        "resmi, sampai penawaran tertulis dikirim dan disetujui.",
        ["harga", "biaya", "estimasi", "penawaran", "penawaran resmi"],
    ),
    (
        "agency_policy",
        "Cara memulai proyek",
        "Cara memulai: klik tombol Mulai discovery di halaman utama, lalu ceritakan "
        "kebutuhan atau masalah yang dihadapi. Percakapan discovery berjalan tanpa perlu "
        "membuat akun. Setelah cukup informasi, ITZ menyusun brief proyek yang bisa diunduh "
        "dan meminta kontak agar tim dapat menindaklanjuti dengan penawaran.",
        ["cara mulai", "mulai proyek", "kontak", "discovery"],
    ),
    (
        "agency_policy",
        "Perawatan setelah proyek selesai",
        "Setelah sistem rilis, ITZ menyediakan pendampingan untuk perbaikan bug, penyesuaian "
        "kecil, dan pemantauan biaya AI. Lingkup dan skema perawatan disepakati terpisah "
        "dari proyek awal, supaya klien tidak membayar untuk hal yang tidak dipakai.",
        ["maintenance", "perawatan", "support", "garansi"],
    ),
    (
        "agency_policy",
        "Cakupan kerja dan lokasi",
        "ITZ bekerja dari Indonesia dan menangani klien secara remote. Seluruh koordinasi "
        "bisa dilakukan lewat chat, panggilan, dan dokumen daring. Untuk kebutuhan yang "
        "memerlukan pertemuan langsung, hal itu dibicarakan terlebih dahulu.",
        ["remote", "lokasi", "cakupan"],
    ),
]


def _category_map() -> dict[str, str]:
    cats = supabase_client.table("knowledge_categories").select("id, slug").execute().data or []
    return {c["slug"]: c["id"] for c in cats}


def _entry_category_slug(entry: dict) -> str:
    nested = entry.get("knowledge_categories")
    if isinstance(nested, dict) and nested.get("slug"):
        return str(nested["slug"])
    return str(entry.get("category_slug") or "")


def main() -> int:
    print(f"Provider embedding: {EMBEDDING_PROVIDER} | dim: {EMBEDDING_DIM}")
    if EMBEDDING_PROVIDER == "off" or not supabase_client:
        print("ABORT: provider off / Supabase tidak terkonfigurasi (embedding butuh Supabase).")
        return 1

    # 1) Kategori agensi (idempoten per slug).
    cat_id = _category_map()
    for c in CATEGORIES:
        if c["slug"] not in cat_id:
            row = (
                supabase_client.table("knowledge_categories")
                .insert({"slug": c["slug"], "name": c["name"], "description": c["description"]})
                .execute()
                .data[0]
            )
            cat_id[c["slug"]] = row["id"]
            print(f"Kategori baru: {c['name']} ({row['id']})")

    # 2) Peta judul -> id supaya skrip aman dijalankan berulang.
    existing = DatabaseService.get_knowledge_entries() or []
    by_title = {str(e.get("title") or "").strip(): e for e in existing}

    created = updated = 0
    for slug, title, content, tags in ENTRIES:
        prior = by_title.get(title)
        payload = {
            "category_id": cat_id[slug],
            "title": title,
            "content": content,
            "tags": tags,
            "is_active": True,
        }
        if prior and prior.get("id"):
            payload["id"] = prior["id"]
            updated += 1
        else:
            created += 1
        saved = DatabaseService.create_or_update_knowledge_entry(payload)
        KnowledgeService.index_entry(saved["id"], saved["content"])
        print(f"  {'~' if prior else '+'} {title}")

    # 3) Nonaktifkan entry di luar kategori agensi (knowledge produk chat lama
    #    dan konteks personal pemilik).
    deactivated = 0
    for entry in DatabaseService.get_knowledge_entries() or []:
        if _entry_category_slug(entry) in AGENCY_SLUGS:
            continue
        if entry.get("is_active") is False:
            continue
        DatabaseService.create_or_update_knowledge_entry(
            {
                "id": entry["id"],
                "category_id": entry.get("category_id"),
                "title": entry.get("title"),
                "content": entry.get("content"),
                "tags": entry.get("tags") or [],
                "is_active": False,
            }
        )
        deactivated += 1

    print(
        f"Selesai - {created} entry baru, {updated} diperbarui, {deactivated} entry lama "
        f"dinonaktifkan (provider {EMBEDDING_PROVIDER} {EMBEDDING_DIM}d)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
