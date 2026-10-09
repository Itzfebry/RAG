"""Seed ulang knowledge base — reset total ke fokus branding ITZ AI.

- Hapus SEMUA entry lama (mock: Akmal, BXJ, Purnama, ...) + embeddings-nya.
- Buat 2 kategori baru: Branding ITZ AI, Harga & Langganan.
- Insert 12 entry branding + embed (Gemini 768) lewat jalur resmi
  (DatabaseService + KnowledgeService.index_entry, sama dengan panel admin).

Jalankan:  python -m backend.seed_branding_kb
"""
try:
    from backend.database.db import DatabaseService, supabase_client
    from backend.knowledge.knowledge_service import KnowledgeService, EMBEDDING_DIM, EMBEDDING_PROVIDER
except ImportError:
    from database.db import DatabaseService, supabase_client  # type: ignore
    from knowledge.knowledge_service import (  # type: ignore
        KnowledgeService, EMBEDDING_DIM, EMBEDDING_PROVIDER,
    )

CATEGORIES = [
    {"slug": "branding_itz_ai", "name": "Branding ITZ AI",
     "description": "Identitas, tujuan, owner, dan kemampuan ITZ AI"},
    {"slug": "pricing_subscription", "name": "Harga & Langganan",
     "description": "Paket prompt, harga, dan cara berlangganan"},
]

# Fakta yang dipakai HANYA dari brief owner:
#   - ITZ AI = chat AI asisten, bantu prompting skala kecil & kebutuhan harian,
#     fokus knowledge sederhana, ingin dikenalkan ke publik lewat langganan.
#   - Owner/builder: Febry (Mochammad Ginata Febryansyah).
#   - Paket: 100 prompt Rp30.000 | 200 prompt Rp50.000 | 1000 prompt Rp500.000.
# Jangan menambah fakta (metode bayar, masa aktif, fitur) yang belum dikonfirmasi.
ENTRIES = [
    # ── Branding ──
    ("branding_itz_ai", "Apa itu ITZ AI",
     "ITZ AI adalah chat AI asisten berbahasa Indonesia yang dibangun oleh Febry. "
     "Fungsinya membantu pengguna melakukan prompting skala kecil untuk kebutuhan "
     "harian: bertanya, menyusun teks, brainstorming ide, dan mencari pengetahuan "
     "sederhana. ITZ AI dirancang sederhana dan mudah dipakai siapa saja tanpa "
     "keahlian teknis.",
     ["itz ai", "asisten", "intro"]),

    ("branding_itz_ai", "Tujuan dan visi ITZ AI",
     "Tujuan ITZ AI adalah memperkenalkan AI asisten kepada publik luas melalui "
     "sistem berlangganan prompt yang terjangkau. ITZ AI berfokus pada kebutuhan "
     "sederhana sehari-hari, bukan analisis berat. Pengguna membeli kuota prompt "
     "sesuai kebutuhan lalu memakainya kapan saja di chat.",
     ["tujuan", "visi", "langganan"]),

    ("branding_itz_ai", "Owner ITZ AI Febry",
     "Owner dan pembangun ITZ AI adalah Febry, nama lengkapnya Mochammad Ginata "
     "Febryansyah. Seluruh pengembangan, keputusan produk, dan penetapan harga "
     "ITZ AI ditangani langsung oleh owner.",
     ["owner", "febry", "pendiri"]),

    ("branding_itz_ai", "Target pengguna ITZ AI",
     "ITZ AI ditujukan untuk pelajar, mahasiswa, pekerja kantoran, dan pemilik "
     "usaha kecil yang membutuhkan bantuan AI sehari-hari: menyusun pesan atau "
     "email, brainstorm ide, merangkum teks pendek, dan menjawab pertanyaan "
     "pengetahuan umum sederhana.",
     ["pengguna", "target", "pelajar", "umkm"]),

    ("branding_itz_ai", "Kemampuan chat ITZ AI",
     "Contoh pemakaian ITZ AI: menulis caption media sosial, menyusun pesan formal "
     "atau santai, brainstorm ide konten dan ide usaha, merangkum teks singkat, "
     "membantu tugas sekolah atau kantor skala kecil, serta menjawab pertanyaan "
     "pengetahuan umum. Fokusnya bantuan praktis harian.",
     ["fitur", "kemampuan", "contoh"]),

    ("branding_itz_ai", "Batasan layanan ITZ AI",
     "ITZ AI berfokus pada knowledge sederhana dan bantuan harian. Jawaban mengikuti "
     "informasi di knowledge base ITZ AI; di luar itu ITZ AI menjawab dengan "
     "pengetahuan umum model AI. ITZ AI bukan pengganti tenaga ahli untuk urusan "
     "medis, hukum, atau keuangan serius.",
     ["batasan", "limitasi"]),

    # ── Harga & langganan ──
    ("pricing_subscription", "Daftar harga paket ITZ AI",
     "ITZ AI menyediakan tiga paket langganan prompt: Paket 100 Prompt seharga "
     "Rp30.000, Paket 200 Prompt seharga Rp50.000, dan Paket 1000 Prompt seharga "
     "Rp500.000. Pilih paket sesuai kebutuhan; kuota langsung dipakai di akun setelah "
     "pemesanan aktif.",
     ["harga", "paket", "biaya"]),

    ("pricing_subscription", "Paket 100 Prompt",
     "Paket 100 Prompt adalah paket entry ITZ AI seharga Rp30.000, berisi 100 "
     "pertanyaan yang bisa dijawab AI (setara Rp300 per prompt). Cocok untuk mencoba "
     "ITZ AI atau kebutuhan ringan harian seperti menulis pesan dan brainstorming "
     "singkat.",
     ["paket 100", "30000", "entry"]),

    ("pricing_subscription", "Paket 200 Prompt",
     "Paket 200 Prompt ITZ AI seharga Rp50.000, berisi 200 pertanyaan (setara Rp250 "
     "per prompt, lebih hemat dari Paket 100). Cocok untuk pemakaian rutin: tugas "
     "kuliah, kerja kantor ringan, dan ide konten.",
     ["paket 200", "50000", "hemat"]),

    ("pricing_subscription", "Paket 1000 Prompt",
     "Paket 1000 Prompt ITZ AI seharga Rp500.000 berisi 1000 pertanyaan untuk "
     "pemakaian intensif. Ditujukan untuk pengguna yang chat setiap hari dengan volume "
     "besar, misalnya usaha kecil yang rutin butuh draft pesan, caption, dan jawaban "
     "cepat.",
     ["paket 1000", "500000", "intensif"]),

    ("pricing_subscription", "Cara berlangganan ITZ AI",
     "Cara berlangganan ITZ AI: pilih paket yang diinginkan (100, 200, atau 1000 "
     "prompt), lakukan pemesanan kepada admin ITZ AI, lalu tunggu kuota diaktifkan di "
     "akun Anda. Setelah aktif, kuota langsung bisa dipakai untuk chat. Informasi "
     "pembayaran dan pemesanan diberikan admin saat pemesanan.",
     ["cara beli", "daftar", "order", "admin"]),

    ("pricing_subscription", "Cara pakai kuota prompt",
     "Satu prompt ITZ AI sama dengan satu pertanyaan yang dikirim pengguna dan dijawab "
     "AI. Kuota berkurang satu per satu setiap kali mengirim pesan. Sisa kuota bisa "
     "dilihat di menu info (ikon i) pada halaman chat. Tambahan kuota bisa dibeli "
     "kapan saja lewat paket langganan.",
     ["kuota", "sisa prompt", "ikon info"]),
]


def main() -> int:
    print(f"Provider embedding: {EMBEDDING_PROVIDER} | dim: {EMBEDDING_DIM}")
    if EMBEDDING_PROVIDER == "off" or not supabase_client:
        print("ABORT: provider off / Supabase tidak terkonfigurasi.")
        return 1

    # 1) Bersihkan: embeddings dulu (jaga-jaga kalau FK cascade tidak ada),
    #    lalu semua entry lama.
    old_emb = supabase_client.table("knowledge_embeddings").delete().neq("entry_id", "00000000-0000-0000-0000-000000000000").execute()
    old_ent = supabase_client.table("knowledge_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print(f"Dihapus: {len(old_emb.data or [])} embeddings, {len(old_ent.data or [])} entry lama")

    # 2) Kategori baru (idempoten — slug dipakai untuk cek).
    cats = supabase_client.table("knowledge_categories").select("id, slug").execute().data or []
    cat_id = {c["slug"]: c["id"] for c in cats}
    for c in CATEGORIES:
        if c["slug"] not in cat_id:
            row = supabase_client.table("knowledge_categories").insert({
                "slug": c["slug"], "name": c["name"], "description": c["description"],
            }).execute().data[0]
            cat_id[c["slug"]] = row["id"]
            print(f"Kategori baru: {c['name']} ({row['id']})")

    # 3) Insert + embed per entry.
    for slug, title, content, tags in ENTRIES:
        saved = DatabaseService.create_or_update_knowledge_entry({
            "category_id": cat_id[slug],
            "title": title,
            "content": content,
            "tags": tags,
            "is_active": True,
        })
        KnowledgeService.index_entry(saved["id"], saved["content"])
        print(f"  + {title}")

    print(f"Selesai — {len(ENTRIES)} entry branding, provider {EMBEDDING_PROVIDER} {EMBEDDING_DIM}d.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
