import Link from "next/link";
import {
  ArrowRight,
  Database,
  MessagesSquare,
  Network,
  Plus,
  Workflow,
} from "lucide-react";

/**
 * Landing page — editorial, satu aksen, garis rambut sebagai pemisah.
 *
 * Komponen server: tidak ada GSAP/three.js di halaman ini. Satu-satunya gerak
 * adalah keyframe masuk di kepala halaman dan aturan kemajuan gulir (CSS),
 * keduanya di dalam `prefers-reduced-motion: no-preference`.
 */

const CONTACT = "mailto:ayormahaki@gmail.com?subject=Discovery%20proyek%20AI";

const SHELL = "mx-auto w-full max-w-[1240px] px-5 md:px-8";
const RULE = "border-[color:var(--itz-rule)]";
const EYEBROW =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--itz-ink-3)]";
const H2 = "itz-display text-[clamp(1.55rem,2.7vw,2.2rem)] leading-[1.06] tracking-[-0.02em] text-[var(--itz-ink)]";
// Judul bagian unggulan: satu tingkat di atas judul bagian biasa, supaya
// hierarki tidak rata setelah hero.
const H2_LEAD =
  "itz-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.04] tracking-[-0.026em] text-[var(--itz-ink)]";
const H3 = "text-[1.0625rem] font-medium leading-[1.3] tracking-[-0.01em] text-[var(--itz-ink)] md:text-[1.125rem]";
const BODY = "text-[15px] leading-[1.62] text-[var(--itz-ink-2)]";
const LINK =
  "text-[var(--itz-ink-2)] transition-colors hover:text-[var(--itz-ink)]";
const CTA =
  "inline-flex h-11 items-center gap-2 rounded-[2px] bg-[var(--itz-accent)] px-5 text-[13.5px] font-medium text-[var(--itz-accent-ink)] transition-opacity hover:opacity-90";
const GHOST =
  "inline-flex h-11 items-center gap-1.5 text-[13.5px] text-[var(--itz-ink-2)] transition-colors hover:text-[var(--itz-ink)]";

const NAV = [
  { href: "#inti", label: "Prinsip" },
  { href: "#kemampuan", label: "Kemampuan" },
  { href: "#layanan", label: "Layanan" },
  { href: "#proyek", label: "Proyek" },
  { href: "#faq", label: "FAQ" },
];

const STACK = [
  "Next.js",
  "TypeScript",
  "FastAPI",
  "PostgreSQL + pgvector",
  "Supabase",
  "OpenAI-compatible LLM",
  "Cloudflare",
  "Vercel",
];

// Tiga baris bukti di rel kanan hero — kutipan dari isi halaman ini sendiri.
const PROOF = [
  "Retrieval dulu, model belakangan.",
  "Jawaban datang dengan sumbernya.",
  "Halusinasi bukan fitur, itu bug.",
];

const PILLARS = [
  {
    title: "Data",
    body: "Dokumen, SOP, transaksi, dan riwayat percakapan jadi sumber jawaban. Retrieval dulu, model belakangan.",
  },
  {
    title: "Tool",
    body: "AI boleh memanggil API dan menulis ke sistem nyata. Batasnya jelas: apa yang boleh, apa yang harus dikonfirmasi.",
  },
  {
    title: "Batas",
    body: "Kalau jawabannya tidak ada di sumber, ia bilang tidak ada. Halusinasi bukan fitur, itu bug.",
  },
];

const CAPABILITIES = [
  {
    icon: MessagesSquare,
    title: "Asisten & chat",
    body: "Antarmuka percakapan dengan identitas dan gaya komunikasi sendiri. Di web, WhatsApp, atau Telegram.",
  },
  {
    icon: Database,
    title: "Retrieval (RAG)",
    body: "Dokumen dipecah, di-embed, disimpan di pgvector, dicari dengan cosine HNSW. Jawaban datang dengan sumbernya.",
  },
  {
    icon: Workflow,
    title: "Otomasi & integrasi",
    body: "AI memanggil tool dan API nyata: mencatat transaksi, menyusun laporan, mengirim notifikasi.",
  },
  {
    icon: Network,
    title: "Orchestrator multi-agen",
    body: "Beberapa agen dengan peran berbeda bekerja dari satu perintah bahasa alami, dengan batas yang jelas.",
  },
];

const INTEGRATIONS = [
  "REST API",
  "Webhook",
  "PostgreSQL",
  "Supabase",
  "WhatsApp",
  "Telegram",
  "Google Sheets",
  "Object Storage",
  "Slack",
];

const SERVICES = [
  {
    title: "Aplikasi AI end-to-end",
    body: "Dari masalah sampai produksi: pemetaan, arsitektur, pembangunan, deploy, serah terima.",
  },
  {
    title: "Chatbot & basis pengetahuan",
    body: "Menjawab dari dokumen, SOP, produk, atau katalog sendiri — dan bisa dibatasi hanya ke sumber itu.",
  },
  {
    title: "Integrasi & otomasi",
    body: "Menempel ke alur kerja yang ada: pemrosesan dokumen, entri data, laporan berkala, notifikasi tim.",
  },
  {
    title: "Audit & perbaikan sistem AI",
    body: "Jawaban ngawur? Ukur kualitas retrieval, benahi data dan prompt, pasang kuota serta pemantauan biaya.",
  },
];

const PROJECTS = [
  {
    name: "UMKM-AI",
    tag: "Platform keuangan & analisis bisnis",
    body: "Pencatatan transaksi, utang-piutang, laporan dengan ekspor CSV/Excel/PDF, dan AI Finance Analyst yang menjelaskan kondisi bisnis dari angka aktual — bukan tebakan.",
    stack: "Next.js 15 · Drizzle · PostgreSQL · Auth.js · Cloudflare R2",
  },
  {
    name: "ITZ AI Axtra",
    tag: "Ruang kerja AI personal",
    body: "Chat multi-mode dengan memori personal yang dicari secara semantik, multi-provider LLM, riset web, generated image, jurnal, jadwal, PWA + Telegram, dan beranda orchestrator.",
    stack: "Next.js · FastAPI · Supabase + pgvector",
  },
  {
    name: "Mesin RAG produksi",
    tag: "Asisten AI di atas data sendiri",
    body: "Chat streaming dengan panel admin penuh: pengetahuan per kategori, chunking, embedding asimetris, prompt anti-halusinasi, kuota, dan tagihan otomatis.",
    stack: "Next.js · FastAPI · SSE · PostgreSQL + pgvector",
  },
];

const FAQ = [
  {
    q: "Data saya masih berantakan. Bisa mulai dari situ?",
    a: "Bisa — justru di situ nilainya. Kita mulai dari yang ada: dokumen, spreadsheet, catatan, riwayat percakapan. Data yang belum lengkap bukan alasan menunggu.",
  },
  {
    q: "Apakah harus mengganti sistem yang sekarang?",
    a: "Tidak. AI ditempel ke sistem yang sudah jalan lewat API, konektor, atau webhook. Antarmuka baru opsional.",
  },
  {
    q: "Bagaimana biaya bulanannya?",
    a: "Komponen terbesar adalah pemakaian model. Dikendalikan dengan kuota harian, cache hasil, pemilihan model per kebutuhan, dan laporan token per model.",
  },
  {
    q: "Seberapa aman data diproses?",
    a: "Akses dibatasi per peran, aktivitas admin tercatat di audit log, kunci akses model disimpan terenkripsi di server, dan permintaan dibatasi rate limit. Bisa ditempatkan di akun cloud milikmu sendiri.",
  },
  {
    q: "Modelnya bisa diganti nanti?",
    a: "Bisa. Sistem dibangun di atas API kompatibel OpenAI, jadi Groq, OpenAI, Gemini, OpenRouter, Cloudflare, sampai model yang di-host sendiri bisa dipakai tanpa membongkar aplikasi.",
  },
  {
    q: "Berapa lama pengerjaannya?",
    a: "Tergantung cakupan. Chatbot di atas data yang sudah ada jauh lebih cepat daripada orchestrator yang menyentuh beberapa sistem sekaligus.",
  },
];

function Mark() {
  return <span aria-hidden className="mr-2 inline-block size-1.5 rounded-[1px] bg-[var(--itz-accent)] align-middle" />;
}

export default function Landing() {
  return (
    <div className="itz-page min-h-full font-sans antialiased">
      {/* Nav: permukaan padat + garis rambut, tanpa kaca, tanpa bilah gradien. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b bg-[var(--itz-bg)] ${RULE}`}
      >
        <nav className={`${SHELL} flex h-[68px] items-center justify-between gap-6`}>
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--itz-ink)]"
          >
            <Mark />
            ITZ AI
          </Link>
          <div className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={`text-[13.5px] ${LINK}`}>
                {item.label}
              </a>
            ))}
          </div>
          <a href={CONTACT} className={CTA}>
            Konsultasi
          </a>
        </nav>
        <div
          aria-hidden
          className="itz-progress absolute inset-x-0 bottom-0 h-px scale-x-0 bg-[var(--itz-accent)]"
        />
      </header>

      <main id="main" className="pt-[68px]">
        {/* Hero: judul di kolom kiri, rel bukti di kolom kanan. */}
        <section className={`${SHELL} pb-14 pt-16 md:pb-20 md:pt-24`}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 md:col-span-7">
              <p className={`itz-enter ${EYEBROW}`}>Jasa sistem &amp; integrasi AI</p>
              <h1
                className="itz-display itz-enter itz-enter-2 mt-6 text-[clamp(2.6rem,6vw,5rem)] text-balance text-[var(--itz-ink)]"
              >
                Lapisan AI yang membuat kerja rumit jadi{" "}
                <span className="itz-serif">sederhana.</span>
              </h1>
              <p className={`itz-enter itz-enter-3 mt-7 max-w-[52ch] text-[16.5px] leading-[1.6] text-[var(--itz-ink-2)]`}>
                Sistem AI yang menempel ke sistem yang sudah kamu pakai — dari chatbot yang paham
                data bisnis, otomasi alur kerja, sampai orchestrator multi-agen.
              </p>
              <div className="itz-enter itz-enter-4 mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
                <a href={CONTACT} className={CTA}>
                  Mulai discovery
                  <ArrowRight className="size-4" strokeWidth={1.6} aria-hidden />
                </a>
                <a href="#proyek" className={GHOST}>
                  Lihat proyek
                </a>
              </div>
            </div>

            <ul className="col-span-12 md:col-span-4 md:col-start-9">
              {PROOF.map((line) => (
                <li
                  key={line}
                  className={`border-t py-4 text-[14px] leading-[1.5] text-[var(--itz-ink-2)] last:border-b ${RULE}`}
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Stack: pita penuh, label kiri, item rata kiri dengan garis rambut. */}
        <section aria-labelledby="stack-h" className={`border-y ${RULE}`}>
          <div className={`${SHELL} grid grid-cols-12 gap-x-6 gap-y-4 py-7`}>
            <h2 id="stack-h" className={`col-span-12 md:col-span-2 ${EYEBROW}`}>
              Stack produksi
            </h2>
            <ul className="col-span-12 grid grid-cols-2 gap-x-6 md:col-span-10 md:flex md:flex-wrap md:items-center md:divide-x md:divide-[color:var(--itz-rule)]">
              {STACK.map((item) => (
                <li
                  key={item}
                  className={`border-t py-2 font-mono text-[13px] leading-[1.4] text-[var(--itz-ink-2)] md:border-t-0 md:px-4 md:py-0 md:first:pl-0 md:last:pr-0 ${RULE}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Inti */}
        <section
          aria-labelledby="inti-h"
          id="inti"
          className={`${SHELL} scroll-mt-24 py-16 md:py-24`}
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-6">
            <h2 id="inti-h" className={`col-span-12 md:col-span-7 ${H2}`}>
              Inti dari sistem AI yang <span className="itz-serif">bisa dipercaya.</span>
            </h2>
            <p className={`col-span-12 md:col-span-4 md:col-start-9 md:self-end ${BODY}`}>
              Tiga hal ini yang menentukan apakah sebuah sistem AI layak dipakai sehari-hari.
            </p>
          </div>
          <dl className={`mt-12 grid grid-cols-12 gap-x-0 gap-y-8 border-t ${RULE} pt-8 md:divide-x md:divide-[color:var(--itz-rule)]`}>
            {PILLARS.map((item, i) => (
              <div key={item.title} className="col-span-12 md:col-span-4 md:px-7 md:first:pl-0">
                <dt>
                  <span className={`${EYEBROW} block`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={`${H3} mt-3 block`}>{item.title}</span>
                </dt>
                <dd className={`${BODY} mt-3`}>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Permukaan produk: satu bingkai berisi garis rambut, bukan kotak bersarang. */}
        <section aria-labelledby="produk-h" className={`${SHELL} pb-16 md:pb-24`}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 md:col-span-5">
              <p className={EYEBROW}>AI chat</p>
              <h2 id="produk-h" className={`${H2} mt-5`}>
                Percakapan yang menjawab dari <span className="itz-serif">datamu.</span>
              </h2>
              <p className={`${BODY} mt-5 max-w-[44ch]`}>
                Setiap jawaban disusun dari hasil pencarian semantik di pengetahuanmu sendiri,
                dengan sumber yang bisa diperiksa. Kalau tidak ada di sumber, ia bilang tidak ada.
              </p>
            </div>

            <div className="col-span-12 md:col-span-7">
              <div className={`rounded-[2px] border bg-[var(--itz-surface)] ${RULE}`}>
                <div className={`flex items-center justify-between border-b px-5 py-3 ${RULE}`}>
                  <span className={EYEBROW}>Sesi chat</span>
                  <span className="font-mono text-[11px] text-[var(--itz-ink-3)]">stream</span>
                </div>
                <dl className={`divide-y divide-[color:var(--itz-rule)]`}>
                  <div className="grid grid-cols-12 gap-x-4 px-5 py-5">
                    <dt className="col-span-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--itz-ink-3)]">
                      Kamu
                    </dt>
                    <dd className="col-span-9 text-[14.5px] leading-[1.55] text-[var(--itz-ink)]">
                      Berapa omzet tiga bulan terakhir dan kategori mana yang turun?
                    </dd>
                  </div>
                  <div className="grid grid-cols-12 gap-x-4 px-5 py-5">
                    <dt className="col-span-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--itz-ink-3)]">
                      ITZ AI
                    </dt>
                    <dd className="col-span-9">
                      <p className="text-[14.5px] leading-[1.55] text-[var(--itz-ink-2)]">
                        Omzet naik 12%, tapi kategori sembako turun 6% karena dua pembelian besar
                        tidak tercatat di periode ini.
                      </p>
                      <p className="mt-4 font-mono text-[11.5px] leading-[1.7] text-[var(--itz-ink-3)]">
                        sumber: laporan_q3.xlsx
                        <br />
                        pgvector · cosine
                      </p>
                    </dd>
                  </div>
                </dl>
                <p
                  className={`border-t px-5 py-3 font-mono text-[11px] text-[var(--itz-ink-3)] ${RULE}`}
                >
                  Ilustrasi pola antarmuka, bukan data nyata.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Kemampuan: baris editorial bernomor, tanpa kartu. */}
        <section
          aria-labelledby="kemampuan-h"
          id="kemampuan"
          className={`${SHELL} scroll-mt-24 pb-16 md:pb-24`}
        >
          <h2 id="kemampuan-h" className={`${H2_LEAD} max-w-[26ch]`}>
            Kemampuan yang dibutuhkan, dari yang paling{" "}
            <span className="itz-serif">sederhana.</span>
          </h2>
          <ol className={`mt-10 border-t ${RULE}`}>
            {CAPABILITIES.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className={`grid grid-cols-12 items-start gap-x-6 gap-y-3 border-b py-7 ${RULE}`}
              >
                <span className={`col-span-3 md:col-span-1 ${EYEBROW}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="col-span-9 flex items-center gap-3 md:col-span-3">
                  <Icon className="size-4 shrink-0 text-[var(--itz-ink-3)]" strokeWidth={1.6} aria-hidden />
                  <span className={H3}>{title}</span>
                </h3>
                <p className={`col-span-12 md:col-span-7 md:col-start-6 ${BODY}`}>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Integrasi: daftar teks, bukan pil. */}
        <section aria-labelledby="integrasi-h" className={`border-y ${RULE}`}>
          <div className={`${SHELL} py-16 md:py-20`}>
            <div className="grid grid-cols-12 gap-x-6 gap-y-6">
              <h2 id="integrasi-h" className={`col-span-12 md:col-span-7 ${H2}`}>
                Menempel ke sistem yang <span className="itz-serif">sudah jalan.</span>
              </h2>
              <p className={`col-span-12 md:col-span-4 md:col-start-9 md:self-end ${BODY}`}>
                Tidak perlu membongkar yang lama. AI masuk lewat jalur yang sudah ada.
              </p>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 md:grid-cols-3">
              {INTEGRATIONS.map((item) => (
                <li
                  key={item}
                  className={`border-t py-3 text-[14px] text-[var(--itz-ink-2)] ${RULE}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Layanan: catatan bernomor, bukan kartu gradien. */}
        <section
          aria-labelledby="layanan-h"
          id="layanan"
          className={`${SHELL} scroll-mt-24 py-16 md:py-24`}
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-8">
            <div className="col-span-12 md:sticky md:top-[92px] md:col-span-4 md:self-start">
              <h2 id="layanan-h" className={H2}>
                Layanan yang bisa <span className="itz-serif">kamu ambil.</span>
              </h2>
              <p className={`${BODY} mt-5 max-w-[38ch]`}>
                Semua dimulai dari masalah, bukan dari daftar teknologi.
              </p>
            </div>
            <ol className={`col-span-12 border-t md:col-span-7 md:col-start-6 ${RULE}`}>
              {SERVICES.map((service, i) => (
                <li
                  key={service.title}
                  className={`grid grid-cols-12 gap-x-5 gap-y-2 border-b py-6 ${RULE}`}
                >
                  <span className={`col-span-2 md:col-span-1 ${EYEBROW}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="col-span-10 md:col-span-11">
                    <h3 className={H3}>{service.title}</h3>
                    <p className={`${BODY} mt-2`}>{service.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Proyek: catatan lebar, tag di kolom kiri. */}
        <section
          aria-labelledby="proyek-h"
          id="proyek"
          className={`${SHELL} scroll-mt-24 pb-16 md:pb-24`}
        >
          <h2 id="proyek-h" className={`${H2_LEAD} max-w-[30ch]`}>
            Sistem yang sudah jalan, <span className="itz-serif">lengkap dengan operasionalnya.</span>
          </h2>
          <div className={`mt-10 border-t ${RULE}`}>
            {PROJECTS.map((project) => (
              <article
                key={project.name}
                className={`grid grid-cols-12 gap-x-6 gap-y-4 border-b py-8 ${RULE}`}
              >
                <div className="col-span-12 md:col-span-4">
                  <p className={EYEBROW}>{project.tag}</p>
                  <p className="mt-4 font-mono text-[12px] leading-[1.6] text-[var(--itz-ink-3)]">
                    {project.stack}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <h3 className="itz-display text-[1.5rem] tracking-[-0.02em] text-[var(--itz-ink)] md:text-[1.75rem]">
                    {project.name}
                  </h3>
                  <p className={`${BODY} mt-3`}>{project.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ: judul di kolom kiri, daftar di kolom kanan. */}
        <section
          aria-labelledby="faq-h"
          id="faq"
          className={`${SHELL} scroll-mt-24 pb-16 md:pb-24`}
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-8">
            <div className="col-span-12 md:sticky md:top-[92px] md:col-span-4 md:self-start">
              <h2 id="faq-h" className={H2}>
                Kami punya <span className="itz-serif">jawabannya.</span>
              </h2>
              <p className={`${BODY} mt-5 max-w-[34ch]`}>
                Kalau pertanyaanmu belum ada di sini, tanyakan langsung.
              </p>
            </div>
            <div className={`col-span-12 border-t md:col-span-7 md:col-start-6 ${RULE}`}>
              {FAQ.map(({ q, a }) => (
                <details key={q} className={`group border-b ${RULE}`}>
                  <summary
                    className={`flex cursor-pointer list-none items-start justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden`}
                  >
                    <span className="text-[15.5px] leading-[1.5] text-[var(--itz-ink)]">{q}</span>
                    <Plus
                      className="mt-0.5 size-4 shrink-0 text-[var(--itz-ink-3)] transition-transform duration-200 group-open:rotate-45"
                      strokeWidth={1.6}
                      aria-hidden
                    />
                  </summary>
                  <p className={`${BODY} max-w-[62ch] pb-6`}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Penutup: pernyataan penuh lebar, bukan dua kolom dengan ruang kosong. */}
        <section aria-labelledby="tutup-h" className={`border-t bg-[var(--itz-surface)] ${RULE}`}>
          <div className={`${SHELL} py-16 md:py-20`}>
            <h2 id="tutup-h" className={`${H2_LEAD} max-w-[26ch]`}>
              Siap mengotomasi yang <span className="itz-serif">berulang?</span>
            </h2>
            <p className={`${BODY} mt-6 max-w-[54ch]`}>
              Ceritakan alurnya. Saya bantu petakan mana yang bisa dibantu AI, mana yang lebih baik
              dibiarkan sederhana.
            </p>
            <div className={`mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 border-t pt-8 ${RULE}`}>
              <a href={CONTACT} className={CTA}>
                Mulai discovery
                <ArrowRight className="size-4" strokeWidth={1.6} aria-hidden />
              </a>
              <Link href="/chat" className={GHOST}>
                Coba demo
              </Link>
            </div>
          </div>
        </section>

        <footer className={`border-t ${RULE}`}>
          <div className={`${SHELL} grid grid-cols-12 gap-x-6 gap-y-10 py-14`}>
            <div className="col-span-12 md:col-span-4">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--itz-ink)]">
                <Mark />
                ITZ AI
              </p>
              <p className="mt-4 max-w-[30ch] text-[13px] leading-[1.6] text-[var(--itz-ink-2)]">
                AI yang menempel ke sistem dan masalah nyata — bukan demo yang berhenti di
                presentasi.
              </p>
            </div>
            <nav aria-label="Layanan" className="col-span-6 md:col-span-3 md:col-start-6">
              <p className={`${EYEBROW}`}>Layanan</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {SERVICES.slice(0, 3).map((service) => (
                  <li key={service.title}>
                    <a href="#layanan" className={LINK}>
                      {service.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Proyek" className="col-span-6 md:col-span-3">
              <p className={`${EYEBROW}`}>Proyek</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                {PROJECTS.map((project) => (
                  <li key={project.name}>
                    <a href="#proyek" className={LINK}>
                      {project.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Kontak" className="col-span-12 md:col-span-2">
              <p className={`${EYEBROW}`}>Kontak</p>
              <ul className="mt-4 space-y-2.5 text-[13px]">
                <li>
                  <a href={CONTACT} className={LINK}>
                    Email
                  </a>
                </li>
                <li>
                  <Link href="/chat" className={LINK}>
                    Demo chat
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className={`border-t ${RULE}`}>
            <div
              className={`${SHELL} flex flex-wrap items-center justify-between gap-2 py-6 font-mono text-[12px] text-[var(--itz-ink-3)]`}
            >
              <span>© 2026 ITZ AI</span>
              <span>ayormahaki@gmail.com</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
