"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Boxes,
  Database,
  Gauge,
  MessagesSquare,
  Network,
  Plus,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";

// Pusat visual hero: medan alir 3D. three.js dimuat terpisah (tidak di bundle awal).
const FlowVisual = dynamic(() => import("@/components/landing/flow-visual"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[radial-gradient(circle_at_40%_35%,rgba(34,211,238,0.22),rgba(139,92,246,0.18)_45%,transparent_72%)]" />
  ),
});

const CONTACT = "mailto:ayormahaki@gmail.com?subject=Discovery%20proyek%20AI";

// Tipografi: Geist (display) + Source Serif 4 untuk aksen miring.
const SHELL = "mx-auto w-full max-w-[1200px] px-5 md:px-8";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.14em] text-white/60";
const ACCENT = "font-serif font-medium italic text-white";
const H1 =
  "text-balance text-[clamp(2.5rem,5.6vw,4.5rem)] font-medium leading-[1.06] tracking-[-0.045em]";
const H2 =
  "text-balance text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.035em]";
const BODY = "text-[15px] leading-[1.7] text-white/65 md:text-[16px]";
const PRIMARY =
  "inline-flex h-11 items-center rounded-full bg-[#f7f8f8] px-6 text-[14px] font-medium text-[#05060a] transition-transform hover:scale-[1.03]";
const GHOST =
  "g-crystal inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium text-white/85 transition-colors hover:bg-white/[0.08]";
const NAVLINK = "text-[14px] text-white/70 transition-colors hover:text-white";

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

// Langkah alur yang digambar di panel hero (bukan data palsu: ini arsitekturnya).
const FLOW = [
  { label: "Perintah bahasa alami", gate: false },
  { label: "Retrieval pgvector · cosine HNSW", gate: false },
  { label: "Tool: REST / webhook ke sistem lama", gate: false },
  { label: "Berhenti — keputusanmu", gate: true },
  { label: "Jawaban + sumber", gate: false },
];

const PILLARS = [
  {
    label: "Data",
    body: "Dokumen, SOP, transaksi, dan riwayat percakapan jadi sumber jawaban. Retrieval dulu, model belakangan.",
  },
  {
    label: "Tool",
    body: "AI boleh memanggil API dan menulis ke sistem nyata, dengan batas yang jelas soal apa yang harus dikonfirmasi.",
  },
  {
    label: "Batas",
    body: "Kalau jawabannya tidak ada di sumber, ia bilang tidak ada. Halusinasi bukan fitur, itu bug.",
  },
];

const CAPABILITIES = [
  {
    step: "01",
    title: "Asisten & chat",
    body: "Antarmuka percakapan dengan identitas, gaya komunikasi, dan instruksi sendiri — di web, WhatsApp, atau Telegram.",
  },
  {
    step: "02",
    title: "Retrieval (RAG)",
    body: "Dokumen dipecah jadi chunk, di-embed, disimpan di pgvector, dicari dengan cosine HNSW. Jawaban disertai sumbernya.",
  },
  {
    step: "03",
    title: "Otomasi & integrasi",
    body: "AI memanggil tool dan API nyata: mencatat transaksi, menyusun laporan, mengirim notifikasi ke sistem yang sudah jalan.",
  },
  {
    step: "04",
    title: "Orchestrator multi-agen",
    body: "Beberapa agen dengan peran berbeda bekerja dari satu perintah bahasa alami, dan tahu kapan harus berhenti bertanya.",
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
    icon: Boxes,
    title: "Aplikasi AI end-to-end",
    body: "Pemetaan masalah, arsitektur, pembangunan, deploy, dan serah terima. Satu pekerjaan, satu tanggung jawab.",
  },
  {
    icon: Database,
    title: "Chatbot & basis pengetahuan",
    body: "Menjawab dari dokumen, SOP, produk, atau katalog sendiri — bisa dibatasi hanya ke sumber itu.",
  },
  {
    icon: Wrench,
    title: "Integrasi & otomasi",
    body: "Menempel ke alur kerja yang ada: pemrosesan dokumen, entri data, laporan berkala, notifikasi tim.",
  },
  {
    icon: Gauge,
    title: "Audit & perbaikan sistem AI",
    body: "Ukur kualitas retrieval, benahi data dan prompt, pasang kuota serta pemantauan biaya.",
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
    a: "Akses dibatasi per peran, aktivitas admin tercatat di audit log, kunci akses model dienkripsi di server, dan permintaan dibatasi rate limit. Bisa ditempatkan di akun cloud milikmu sendiri.",
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

function Words({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className={`js-w inline-block ${className ?? ""}`}>
          {word}
          {i < words.length - 1 ? "\u00A0" : null}
        </span>
      ))}
    </>
  );
}

export default function Landing() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1 · Nav kaca saat digulir + garis spektral mengikuti kemajuan halaman.
      const nav = el.querySelector<HTMLElement>(".js-nav");
      ScrollTrigger.create({
        start: 24,
        end: "max",
        onEnter: () => {
          if (!nav) return;
          nav.style.background = "linear-gradient(160deg,rgba(16,19,26,0.72),rgba(8,9,14,0.62))";
          nav.style.borderColor = "rgba(255,255,255,0.12)";
        },
        onLeaveBack: () => {
          if (!nav) return;
          nav.style.background =
            "linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))";
          nav.style.borderColor = "rgba(255,255,255,0.10)";
        },
      });
      gsap.fromTo(
        ".js-progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left",
          scrollTrigger: { start: 0, end: "max", scrub: 0.25 },
        },
      );

      // 2 · Judul: kata muncul dari blur (tetap jadi efek tanda tangan).
      gsap.from(".js-w", {
        opacity: 0,
        filter: "blur(10px)",
        y: 16,
        stagger: 0.04,
        duration: 0.85,
        ease: "power3.out",
      });

      // 3 · Reveal per bagian (satu pola, hemat jumlah animasi).
      gsap.utils.toArray<HTMLElement>(".js-reveal").forEach((group) => {
        gsap.from(group.children, {
          y: 26,
          opacity: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: group, start: "top 86%" },
        });
      });

      // 4 · Pusat visual hero: mengapung pelan + parallax kursor.
      const art = el.querySelector<HTMLElement>(".js-art");
      if (art) {
        gsap.to(art, { y: -10, duration: 7, repeat: -1, yoyo: true, ease: "sine.inOut" });
        const toX = gsap.quickTo(art, "x", { duration: 1.1, ease: "power3" });
        const toY = gsap.quickTo(art, "y", { duration: 1.1, ease: "power3" });
        window.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          if (point.pointerType === "touch") return;
          toX((point.clientX / window.innerWidth - 0.5) * 22);
          toY((point.clientY / window.innerHeight - 0.5) * 14);
        });
      }

      // 5 · Pantulan kaca mengikuti pointer (desktop).
      el.querySelectorAll<HTMLElement>(".g-sheen").forEach((panel) => {
        panel.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          if (point.pointerType === "touch") return;
          const box = panel.getBoundingClientRect();
          panel.style.setProperty("--mx", `${point.clientX - box.left}px`);
          panel.style.setProperty("--my", `${point.clientY - box.top}px`);
        });
      });

      // 6 · Pita stack berjalan.
      gsap.to(".js-marquee", { xPercent: -50, duration: 48, repeat: -1, ease: "none" });

      // 7 · Pita gambar lebar: parallax halus.
      el.querySelectorAll<HTMLElement>(".js-band img").forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -6, scale: 1.08 },
          {
            yPercent: 6,
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: img.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      });

      // 8 · Kartu proyek: geser berlawanan arah (kedalaman, bukan parallax besar).
      el.querySelectorAll<HTMLElement>(".js-project").forEach((card, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        gsap.fromTo(
          card,
          { y: 22 * dir },
          {
            y: -22 * dir,
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      // 9 · FAQ: tinggi dianimasikan saat dibuka.
      el.querySelectorAll<HTMLDetailsElement>("details").forEach((item) => {
        const body = item.querySelector(".js-faq-body");
        if (!body) return;
        item.addEventListener("toggle", () => {
          if (!item.open) return;
          gsap.fromTo(
            body,
            { height: 0, opacity: 0 },
            { height: "auto", opacity: 1, duration: 0.34, ease: "power2.out" },
          );
        });
      });

      // 10 · Tombol magnetik di penutup.
      el.querySelectorAll<HTMLElement>(".js-magnet").forEach((magnet) => {
        const toX = gsap.quickTo(magnet, "x", { duration: 0.45, ease: "power3" });
        const toY = gsap.quickTo(magnet, "y", { duration: 0.45, ease: "power3" });
        magnet.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          const box = magnet.getBoundingClientRect();
          toX((point.clientX - (box.left + box.width / 2)) * 0.28);
          toY((point.clientY - (box.top + box.height / 2)) * 0.38);
        });
        magnet.addEventListener("pointerleave", () => {
          toX(0);
          toY(0);
        });
      });
    }, el);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <main
      ref={root}
      id="main"
      className="obsidian-field relative isolate min-h-full overflow-x-hidden font-display text-[#f7f8f8]"
      style={{ fontFeatureSettings: '"cv01", "ss03"' }}
    >
      <a
        href="#inti"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:text-black"
      >
        Lompat ke konten
      </a>

      {/* Butiran halus: menutup banding pada gradien besar */}
      <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[45]" />

      {/* Garis kemajuan spektral */}
      <div className="js-progress spectral-line fixed inset-x-0 top-0 z-[60] origin-left scale-x-0" />

      {/* Nav kaca mengambang */}
      <header className="fixed inset-x-0 top-3 z-50 px-4 md:top-4 md:px-8">
        <nav
          className={`js-nav g-frosted g-float mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between gap-6 rounded-full px-5 md:px-6`}
        >
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4" strokeWidth={1.7} />
            ITZ AI
          </Link>
          <div className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={NAVLINK}>
                {item.label}
              </a>
            ))}
          </div>
          <span
            aria-hidden
            className="spectral-line pointer-events-none absolute inset-x-8 bottom-0 opacity-70"
          />
          <div className="flex items-center gap-3">
            <Link href="/chat" className={`hidden text-[14px] sm:block ${NAVLINK}`}>
              Demo
            </Link>
            <a
              href={CONTACT}
              className="inline-flex h-9 items-center rounded-full bg-[#f7f8f8] px-4 text-[13px] font-medium text-[#05060a] transition-transform hover:scale-[1.03]"
            >
              Konsultasi
            </a>
          </div>
        </nav>
      </header>

      {/* Hero editorial: teks kiri, pusat visual kanan */}
      <section className="relative overflow-hidden px-5 pb-16 pt-[calc(env(safe-area-inset-top,0px)+7.5rem)] md:px-8 md:pb-24 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] overflow-hidden lg:block"
        >
          <Image
            src="/landing/spectral-streaks.jpg"
            alt=""
            fill
            priority
            sizes="60vw"
            className="object-cover opacity-[0.55] mix-blend-screen [mask-image:radial-gradient(58%_52%_at_62%_46%,black,transparent_74%)]"
          />
        </div>

        <div className={`${SHELL} relative grid items-center gap-14 lg:grid-cols-12 lg:gap-10`}>
          <div className="lg:col-span-7">
            <span className="g-crystal inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[12px] text-white/85">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[linear-gradient(120deg,var(--spectral-cyan),var(--spectral-violet),var(--spectral-magenta))]"
              />
              Terbuka untuk proyek AI baru
            </span>
            <h1 className={`${H1} mt-7 max-w-[16ch]`}>
              <Words text="Lapisan AI yang membuat kerja rumit jadi" />{" "}
              <span className={ACCENT}>
                <Words text="sederhana." />
              </span>
            </h1>
            <p className={`${BODY} mt-6 max-w-[48ch]`}>
              Sistem AI yang menempel ke sistem yang sudah kamu pakai — dari chatbot yang paham data
              bisnis, otomasi alur kerja, sampai orchestrator multi-agen.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={CONTACT} className={PRIMARY}>
                Mulai discovery
                <ArrowRight className="ml-2 size-4" strokeWidth={1.7} />
              </a>
              <a href="#proyek" className={GHOST}>
                Lihat proyek
              </a>
            </div>
          </div>

          {/* Kaca iridescent + medan alir 3D */}
          <div className="relative lg:col-span-5 lg:-mr-[7vw]">
            <div className="js-art g-irid g-sheen g-float relative aspect-[4/5] w-full overflow-hidden rounded-[32px] sm:aspect-[3/2] lg:aspect-[4/5]">
              <FlowVisual className="absolute inset-0 h-full w-full opacity-40" />
              <span className="absolute left-5 top-4 font-mono text-[11px] uppercase tracking-[0.14em] text-white/75">
                FIG 0.1 · alur agen
              </span>
              <ol className="absolute inset-x-4 bottom-4 space-y-1.5 md:inset-x-5 md:bottom-5">
                {FLOW.map((step, i) => (
                  <li
                    key={step.label}
                    className={
                      step.gate
                        ? "g-crystal flex items-center gap-3 rounded-xl border border-[color:var(--spectral-violet)]/40 px-3 py-2 text-[12px] text-white"
                        : "g-crystal flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] text-white/80"
                    }
                  >
                    <span className="font-mono text-[10px] text-white/55">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step.label}
                    {step.gate ? (
                      <span className="ml-auto font-mono text-[10px] uppercase text-white/60">
                        gate
                      </span>
                    ) : null}
                  </li>
                ))}
                <li className="pt-1 pl-[34px] font-mono text-[10px] uppercase tracking-[0.1em] text-white/50">
                  ↺ bila perlu konfirmasi, kembali ke langkah 01
                </li>
              </ol>
            </div>
            <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-white/70">
              Satu perintah bahasa alami — agen memilih tool, menyusun langkah, dan berhenti saat
              perlu keputusanmu
            </p>
          </div>
        </div>

        {/* Strip stack */}
        <div className="mt-16 md:mt-20">
          <div className={`${SHELL} flex items-center gap-4`}>
            <span className={EYEBROW}>Stack produksi</span>
            <span className="hairline hidden flex-1 sm:block" />
          </div>
          <div className="mt-4 flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_9%,black_91%,transparent)]">
            <div className="js-marquee flex shrink-0 items-center gap-14 pr-14 text-[14px] text-white/55">
              {[...STACK, ...STACK].map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="whitespace-nowrap"
                  aria-hidden={i >= STACK.length}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pernyataan + tiga pilar (tanpa kartu) */}
      <section id="inti" className={`${SHELL} scroll-mt-28 pb-20 pt-16 md:pb-28 md:pt-20`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className={EYEBROW}>Prinsip</p>
            <h2 className={`${H2} mt-5 max-w-[20ch]`}>
              <Words text="Masalahnya jarang di modelnya." />{" "}
              <span className="text-white/55">
                <Words text="Konteksmu yang belum masuk ke sistemnya." />
              </span>
            </h2>
          </div>
          <div className="js-reveal grid gap-10 sm:grid-cols-3 lg:col-span-6 lg:gap-8">
            {PILLARS.map((item, i) => (
              <div
                key={item.label}
                className={`pt-6 ${i > 0 ? "border-t border-white/[0.08] sm:border-l sm:border-t-0 sm:pl-6" : "border-t border-white/[0.08]"}`}
              >
                <h3 className="text-[15px] font-medium text-white/90">{item.label}</h3>
                <p className="mt-3 text-[14px] leading-[1.7] text-white/55">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Split: kaca gelap mengambang berisi pola percakapan */}
      <section className="px-5 pb-20 md:px-8 md:pb-28">
        <div className={`${SHELL} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
          <div className="js-reveal lg:col-span-5">
            <p className={EYEBROW}>AI chat</p>
            <h2 className={`${H2} mt-5`}>
              <Words text="Percakapan yang menjawab dari" />{" "}
              <span className={ACCENT}>
                <Words text="datamu." />
              </span>
            </h2>
            <p className={`${BODY} mt-5 max-w-[46ch]`}>
              Setiap jawaban disusun dari hasil pencarian semantik di pengetahuanmu sendiri, dengan
              sumber yang bisa diperiksa. Kalau tidak ada di sumber, ia bilang tidak ada.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="js-reveal g-dark g-sheen g-float rounded-[28px] p-4 md:p-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className={EYEBROW}>Sesi chat</span>
                <span className="flex gap-1.5">
                  <span className="size-2 rounded-full bg-white/20" />
                  <span className="size-2 rounded-full bg-white/20" />
                  <span className="size-2 rounded-full bg-white/20" />
                </span>
              </div>
              <div className="mt-5 space-y-4">
                <div className="ml-auto max-w-[85%] rounded-2xl bg-white/[0.12] px-4 py-3 text-[14px] text-white/90">
                  Berapa omzet tiga bulan terakhir dan kategori mana yang turun?
                </div>
                <div className="max-w-[92%] rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-[14px] leading-[1.65] text-white/75">
                  Omzet naik 12%, tapi kategori sembako turun 6% karena dua pembelian besar tidak
                  tercatat di periode ini.
                  <span className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 font-mono text-[11px] text-white/60">
                      sumber: laporan_q3.xlsx
                    </span>
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 font-mono text-[11px] text-white/60">
                      pgvector · cosine
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pita visual lebar */}
      <section className="relative px-0 pb-20 md:pb-28">
        <div className="js-band relative h-[46vh] min-h-[320px] w-full overflow-hidden">
          <Image
            src="/landing/iridescent-waves.jpg"
            alt=""
            fill
            sizes="100vw"
            className="band-mask object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.85),rgba(5,6,10,0.35)_45%,rgba(5,6,10,0.9))]" />
          <div className={`${SHELL} relative flex h-full flex-col justify-end gap-6 pb-10`}>
            <h2 className={`${H2} max-w-[24ch]`}>
              <Words text="Menempel ke sistem yang" />{" "}
              <span className={ACCENT}>
                <Words text="sudah jalan." />
              </span>
            </h2>
            <div className="g-crystal g-sheen grid gap-4 rounded-[24px] px-5 py-4 sm:grid-cols-3">
              {INTEGRATIONS.slice(0, 3).map((item) => (
                <p key={item} className="font-mono text-[12px] text-white/70">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Kemampuan: baris editorial, bukan grid kartu */}
      <section id="kemampuan" className={`${SHELL} scroll-mt-28 pb-20 md:pb-28`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={EYEBROW}>Kemampuan</p>
            <h2 className={`${H2} mt-5 max-w-[22ch]`}>
              <Words text="Dari satu percakapan sampai" />{" "}
              <span className={ACCENT}>
                <Words text="orkestrasi banyak agen." />
              </span>
            </h2>
          </div>
        </div>

        <div className="js-reveal mt-10">
          {CAPABILITIES.map((item) => (
            <article
              key={item.step}
              className="group grid gap-4 border-t border-white/[0.08] py-8 transition-colors hover:bg-white/[0.02] lg:grid-cols-12 lg:gap-8"
            >
              <span className="font-mono text-[11px] text-white/60 lg:col-span-1">{item.step}</span>
              <h3
                className={`font-medium leading-tight tracking-[-0.02em] lg:col-span-5 ${
                  item.step === "04"
                    ? "text-[clamp(1.4rem,2.6vw,2.05rem)]"
                    : "text-[clamp(1.25rem,2.2vw,1.75rem)]"
                }`}
              >
                {item.title}
              </h3>
              <p className="text-[15px] leading-[1.7] text-white/55 lg:col-span-5">{item.body}</p>
              <span className="spectral-line col-span-full h-px origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100 lg:col-span-12" />
            </article>
          ))}
        </div>
      </section>

      {/* Layanan: 1 kaca iridescent featured + 3 kaca gelap */}
      <section id="layanan" className={`${SHELL} scroll-mt-28 pb-20 md:pb-28`}>
        <p className={EYEBROW}>Layanan</p>
        <h2 className={`${H2} mt-5 max-w-[20ch]`}>
          <Words text="Semua mulai dari masalah," />{" "}
          <span className="text-white/55">
            <Words text="bukan dari daftar teknologi." />
          </span>
        </h2>

        <div className="js-reveal mt-12 space-y-5">
          <article className="g-irid g-sheen g-float relative overflow-hidden rounded-[32px]">
            <Image
              src="/landing/iridescent-flow.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(5,6,10,0.92),rgba(5,6,10,0.55)_55%,rgba(5,6,10,0.8))]" />
            <div className="relative flex flex-col gap-6 p-7 md:flex-row md:items-end md:justify-between md:p-10">
              <div className="max-w-[42ch]">
                <p className={EYEBROW}>Unggulan</p>
                <h3 className="mt-4 text-[clamp(1.4rem,2.6vw,2rem)] font-medium leading-tight tracking-[-0.025em]">
                  {SERVICES[0].title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.7] text-white/70">{SERVICES[0].body}</p>
              </div>
              <a
                href={CONTACT}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/[0.12] px-5 text-[14px] text-white/90 backdrop-blur-xl transition-colors hover:bg-white/[0.2]"
              >
                Mulai discovery
                <ArrowRight className="size-4" strokeWidth={1.7} />
              </a>
            </div>
          </article>

          <div className="grid gap-5 md:grid-cols-3">
            {SERVICES.slice(1).map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="g-dark g-sheen g-float flex flex-col justify-between rounded-[24px] p-6"
              >
                <Icon className="size-5 text-white/60" strokeWidth={1.6} />
                <div className="mt-8">
                  <h3 className="text-[16px] font-medium">{title}</h3>
                  <p className="mt-2.5 text-[14px] leading-[1.65] text-white/55">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Proyek: panel kaca mengambang bergantian */}
      <section id="proyek" className={`${SHELL} scroll-mt-28 pb-20 md:pb-28`}>
        <p className={EYEBROW}>Kerja</p>
        <h2 className={`${H2} mt-5 max-w-[22ch]`}>
          <Words text="Sistem yang sudah jalan," />{" "}
          <span className={ACCENT}>
            <Words text="lengkap dengan operasionalnya." />
          </span>
        </h2>

        <div className="mt-14 space-y-6">
          {PROJECTS.map((project, i) => (
            <article
              key={project.name}
              className={`js-project g-frosted g-sheen g-float relative rounded-[28px] p-6 md:p-9 ${
                i % 2 === 0 ? "lg:mr-[14%]" : "lg:ml-[14%]"
              }`}
            >
              <span className="spectral-line absolute inset-x-8 top-0 h-px opacity-70" />
              <p className={EYEBROW}>{project.tag}</p>
              <h3 className="mt-3 text-[clamp(1.3rem,2.2vw,1.75rem)] font-medium tracking-[-0.02em]">
                {project.name}
              </h3>
              <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.7] text-white/60">
                {project.body}
              </p>
              <p className="mt-6 border-t border-white/[0.07] pt-4 font-mono text-[12px] text-white/55">
                {project.stack}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`${SHELL} scroll-mt-28 pb-20 md:pb-28`}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className={EYEBROW}>FAQ</p>
            <h2 className={`${H2} mt-5 max-w-[16ch]`}>
              <Words text="Kami punya" />{" "}
              <span className={ACCENT}>
                <Words text="jawabannya." />
              </span>
            </h2>
          </div>
          <div className="js-reveal lg:col-span-8">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b border-white/[0.08]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="text-white/90 transition-colors group-hover:text-white">
                    {q}
                  </span>
                  <Plus
                    className="size-4 shrink-0 text-white/55 transition-transform duration-300 group-open:rotate-45"
                    strokeWidth={1.7}
                  />
                </summary>
                <p className="js-faq-body pb-5 text-[15px] leading-[1.7] text-white/55">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Penutup: kaca iridescent dengan tepi cahaya berjalan */}
      <section className={`${SHELL} pb-24 md:pb-32`}>
        <div className="g-irid g-irid--live g-float rounded-[32px] p-[1px]">
          <div className="g-dark relative overflow-hidden rounded-[31px] px-6 py-16 text-center md:px-16 md:py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 bottom-[-10rem] h-[22rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.35),rgba(34,211,238,0.16)_50%,transparent_72%)] blur-3xl"
            />
            <h2 className={`${H2} relative mx-auto max-w-[20ch]`}>
              <Words text="Siap mengotomasi yang" />{" "}
              <span className={ACCENT}>
                <Words text="berulang?" />
              </span>
            </h2>
            <p className={`${BODY} relative mx-auto mt-6 max-w-[50ch]`}>
              Ceritakan alurnya. Saya bantu petakan mana yang bisa dibantu AI, mana yang lebih baik
              dibiarkan sederhana.
            </p>
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <span className="js-magnet inline-flex">
                <a href={CONTACT} className={PRIMARY}>
                  Mulai discovery
                  <ArrowRight className="ml-2 size-4" strokeWidth={1.7} />
                </a>
              </span>
              <Link href="/chat" className={GHOST}>
                Coba demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07]">
        <div className={`${SHELL} grid gap-10 py-14 md:grid-cols-[1.8fr_1fr_1fr_1fr]`}>
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles className="size-4" strokeWidth={1.7} />
              ITZ AI
            </div>
            <p className="mt-4 max-w-[30ch] text-[13px] leading-[1.7] text-white/55">
              AI yang menempel ke sistem dan masalah nyata — bukan demo yang berhenti di presentasi.
            </p>
          </div>
          <div>
            <p className="text-[13px] text-white/40">Layanan</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {SERVICES.slice(0, 3).map((service) => (
                <li key={service.title}>
                  <a href="#layanan" className="text-white/65 transition-colors hover:text-white">
                    {service.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] text-white/40">Proyek</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {PROJECTS.map((project) => (
                <li key={project.name}>
                  <a href="#proyek" className="text-white/65 transition-colors hover:text-white">
                    {project.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] text-white/40">Kontak</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li>
                <a href={CONTACT} className="text-white/65 transition-colors hover:text-white">
                  Email
                </a>
              </li>
              <li>
                <Link href="/chat" className="text-white/65 transition-colors hover:text-white">
                  Demo chat
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.07] py-6">
          <p className={`${SHELL} text-[12px] text-white/35`}>© 2026 ITZ AI</p>
        </div>
      </footer>
    </main>
  );
}
