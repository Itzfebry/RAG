"use client";

import dynamic from "next/dynamic";
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

// Art hero: medan alir 3D (pengganti video pita di referensi). three.js dimuat
// terpisah supaya tidak masuk bundle awal.
const FlowVisual = dynamic(() => import("@/components/landing/flow-visual"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.35),rgba(0,212,255,0.18)_46%,transparent_72%)]" />
  ),
});

const CONTACT = "mailto:ayormahaki@gmail.com?subject=Discovery%20proyek%20AI";

// Tipografi & permukaan mengikuti referensi: Geist, aksen Source Serif 4 italic,
// pil radius penuh, kartu radius 16px, permukaan putih 15%/4%.
const SHELL = "mx-auto w-full max-w-[1200px] px-5 md:px-8";
const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.04]";
const SOFT = "rounded-2xl border border-white/[0.06] bg-black/30";
const PILL =
  "inline-flex h-10 items-center rounded-full bg-[#fafafa] px-5 text-[13px] font-medium text-black transition-transform hover:scale-[1.03]";
const GHOST =
  "inline-flex h-10 items-center rounded-full bg-white/[0.15] px-5 text-[13px] font-medium text-white/90 backdrop-blur-xl transition-colors hover:bg-white/[0.22]";
const NAVLINK = "text-[15px] text-white/80 transition-colors hover:text-white";
const ACCENT = "font-serif italic font-normal";
const H1 =
  "text-balance text-[clamp(2.4rem,5.4vw,4rem)] font-medium leading-[1.2] tracking-[-0.04em] text-[#fafafa]";
const H2 =
  "text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium leading-[1.2] tracking-[-0.03em] text-[#fafafa]";
const BODY = "text-[15px] leading-[1.65] text-white/60";

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

// Kartu gradien seperti bagian "Next-gen AI features" di referensi.
const GRADIENTS = [
  "linear-gradient(140deg,#7c3aed,#e879f9 55%,#f472b6)",
  "linear-gradient(140deg,#5b7c0f,#eab308 60%,#fde68a)",
  "linear-gradient(140deg,#0f766e,#4ade80 60%,#a3e635)",
  "linear-gradient(140deg,#1d4ed8,#06b6d4 60%,#f472b6)",
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

/** Kata per kata: reveal ala referensi (blur + naik, bukan terpotong topeng). */
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
      // 1 · Nav kaca saat digulir + garis kemajuan.
      const nav = el.querySelector(".js-nav");
      ScrollTrigger.create({
        start: 24,
        end: "max",
        onEnter: () => {
          if (nav instanceof HTMLElement) {
            nav.style.background = "rgba(0,0,0,0.6)";
            nav.style.backdropFilter = "blur(18px) saturate(150%)";
            nav.style.borderColor = "rgba(255,255,255,0.08)";
          }
        },
        onLeaveBack: () => {
          if (nav instanceof HTMLElement) {
            nav.style.background = "transparent";
            nav.style.backdropFilter = "none";
            nav.style.borderColor = "transparent";
          }
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

      // 2 · Judul: kata muncul dari blur (efek tanda tangan referensi).
      gsap.from(".js-w", {
        opacity: 0,
        filter: "blur(10px)",
        y: 14,
        stagger: 0.045,
        duration: 0.8,
        ease: "power3.out",
      });

      // 3 · Semua judul bagian memakai reveal yang sama saat masuk viewport.
      el.querySelectorAll<HTMLElement>(".js-block").forEach((block) => {
        const words = block.querySelectorAll(".js-w");
        if (words.length)
          gsap.from(words, {
            opacity: 0,
            filter: "blur(10px)",
            y: 14,
            stagger: 0.04,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: block, start: "top 86%" },
          });
      });

      // 4 · Panel art hero: naik + parallax kursor (halus).
      const art = el.querySelector<HTMLElement>(".js-art");
      if (art) {
        gsap.from(art, {
          opacity: 0,
          scale: 0.94,
          y: 40,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.5,
        });
        const toX = gsap.quickTo(art, "x", { duration: 1, ease: "power3" });
        const toY = gsap.quickTo(art, "y", { duration: 1, ease: "power3" });
        window.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          if (point.pointerType === "touch") return;
          toX((point.clientX / window.innerWidth - 0.5) * 26);
          toY((point.clientY / window.innerHeight - 0.5) * 18);
        });
        gsap.to(art, {
          yPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: art, start: "top bottom", end: "bottom top", scrub: true },
        });
      }

      // 5 · Tiga pilar: masuk bergantian.
      gsap.from(".js-pillar", {
        y: 34,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ".js-pillars", start: "top 85%" },
      });

      // 6 · Mock chat: gelembung masuk satu per satu dari bawah.
      gsap.from(".js-bubble", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        stagger: 0.18,
        ease: "power3.out",
        scrollTrigger: { trigger: ".js-chat", start: "top 82%" },
      });

      // 7 · Grid kemampuan: tersingkap dari kiri (clip-path).
      gsap.from(".js-cap", {
        clipPath: "inset(0 100% 0 0)",
        opacity: 0,
        duration: 0.85,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: { trigger: ".js-cap-grid", start: "top 84%" },
      });

      // 8 · Chip integrasi: muncul memantul.
      gsap.from(".js-chip", {
        scale: 0.8,
        opacity: 0,
        duration: 0.45,
        stagger: 0.05,
        ease: "back.out(2)",
        scrollTrigger: { trigger: ".js-chips", start: "top 88%" },
      });

      // 9 · Kartu gradien: masuk berurutan + miring saat disentuh kursor.
      gsap.from(".js-grad", {
        y: 40,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".js-grads", start: "top 85%" },
      });
      el.querySelectorAll<HTMLElement>(".js-grad").forEach((card) => {
        card.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          if (point.pointerType === "touch") return;
          const box = card.getBoundingClientRect();
          const rx = (0.5 - (point.clientY - box.top) / box.height) * 5;
          const ry = ((point.clientX - box.left) / box.width - 0.5) * 7;
          card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        });
        card.addEventListener("pointerleave", () => {
          card.style.transform = "";
        });
      });

      // 10 · Proyek: parallax halus berlawanan arah.
      el.querySelectorAll<HTMLElement>(".js-project").forEach((card, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        gsap.fromTo(
          card,
          { y: 34 * dir, opacity: 0.45 },
          {
            y: -34 * dir,
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      // 11 · FAQ: baris masuk + isi dibuka dengan tween tinggi.
      gsap.from(".js-faq", {
        y: 18,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: "power2.out",
        scrollTrigger: { trigger: "#faq", start: "top 85%" },
      });
      el.querySelectorAll<HTMLDetailsElement>("details").forEach((item) => {
        const body = item.querySelector(".js-faq-body");
        if (!body) return;
        item.addEventListener("toggle", () => {
          if (!item.open) return;
          gsap.fromTo(
            body,
            { height: 0, opacity: 0 },
            { height: "auto", opacity: 1, duration: 0.36, ease: "power2.out" },
          );
        });
      });

      // 12 · Penutup: cahaya berdenyut + tombol magnetik.
      gsap.to(".js-glow", {
        scale: 1.2,
        opacity: 0.55,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      el.querySelectorAll<HTMLElement>(".js-magnet").forEach((magnet) => {
        const toX = gsap.quickTo(magnet, "x", { duration: 0.45, ease: "power3" });
        const toY = gsap.quickTo(magnet, "y", { duration: 0.45, ease: "power3" });
        magnet.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          const box = magnet.getBoundingClientRect();
          toX((point.clientX - (box.left + box.width / 2)) * 0.3);
          toY((point.clientY - (box.top + box.height / 2)) * 0.4);
        });
        magnet.addEventListener("pointerleave", () => {
          toX(0);
          toY(0);
        });
      });

      // 13 · Footer.
      gsap.from(".js-foot", {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.07,
        ease: "power2.out",
        scrollTrigger: { trigger: "footer", start: "top 92%" },
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
      className="relative isolate min-h-full overflow-x-hidden bg-black font-display text-[#fafafa]"
      style={{ fontFeatureSettings: '"cv01", "ss03"' }}
    >
      {/* Cahaya ambient */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
        <div className="aurora absolute left-[-20%] top-[-24%] h-[36rem] w-[36rem] opacity-[0.07]" />
        <div className="aurora absolute bottom-[-28%] right-[-18%] h-[34rem] w-[34rem] opacity-[0.05]" />
      </div>

      {/* Nav */}
      <header className="js-nav fixed inset-x-0 top-0 z-50 border-b border-transparent">
        <div className="js-progress absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,#8b5cf6,#06b6d4,#f472b6)]" />
        <nav className={`${SHELL} flex h-[68px] items-center justify-between gap-6`}>
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
          <div className="flex items-center gap-4">
            <a href={CONTACT} className={PILL}>
              Konsultasi
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative px-5 pb-16 pt-[calc(env(safe-area-inset-top,0px)+8rem)] md:px-8 md:pb-20 md:pt-36">
        <div className={`${SHELL} max-w-[900px] text-center`}>
          <span className="js-w inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-1.5 text-[12px] text-white/80">
            <Sparkles className="size-3.5" strokeWidth={1.7} />
            Terbuka untuk proyek AI baru
          </span>
          <h1 className={`${H1} mt-7`}>
            <Words text="Lapisan AI yang membuat kerja rumit jadi" />{" "}
            <span className={ACCENT}>
              <Words text="sederhana." />
            </span>
          </h1>
          <p className="js-w mx-auto mt-6 max-w-[44ch] text-[16px] leading-[1.6] text-white/60 md:text-[17px]">
            Sistem AI yang menempel ke sistem yang sudah kamu pakai — dari chatbot yang paham data
            bisnis, otomasi alur kerja, sampai orchestrator multi-agen.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={CONTACT} className={PILL}>
              Mulai discovery
              <ArrowRight className="ml-2 size-4" strokeWidth={1.7} />
            </a>
            <a href="#proyek" className={GHOST}>
              Lihat proyek
            </a>
          </div>
        </div>

        {/* Panel art: medan alir 3D */}
        <div className={`${SHELL} mt-14 md:mt-20`}>
          <div className="js-art relative aspect-[2/1] w-full overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
            <FlowVisual className="absolute inset-0 h-full w-full" />
            <span className="absolute left-5 top-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
              FIG 0.1
            </span>
            <span className="absolute right-5 top-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
              Orchestrator
            </span>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-y border-white/[0.06] py-10">
        <div className={SHELL}>
          <p className="text-center text-[13px] text-white/60">Dibangun dengan stack produksi</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] text-white/60">
            {STACK.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Inti */}
      <section id="inti" className={`${SHELL} scroll-mt-24 py-20 md:py-28`}>
        <h2 className={`js-block ${H2} text-center`}>
          <Words text="Inti dari sistem AI yang" />{" "}
          <span className={ACCENT}>
            <Words text="bisa dipercaya." />
          </span>
        </h2>
        <div className="js-pillars mt-14 grid gap-5 md:grid-cols-3">
          {PILLARS.map((item) => (
            <div key={item.title} className={`${CARD} js-pillar p-6`}>
              <h3 className="text-[17px] font-medium">{item.title}</h3>
              <p className={`${BODY} mt-3`}>{item.body}</p>
              <a
                href={CONTACT}
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-white/80 transition-colors hover:text-white"
              >
                Mulai discovery
                <ArrowRight className="size-3.5" strokeWidth={1.7} />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Fitur chat */}
      <section className="py-20 md:py-28">
        <div className={`${SHELL} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
          <div className="js-block">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
              AI chat
            </p>
            <h2 className={`${H2} mt-4`}>
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

          {/* Mock antarmuka: ilustrasi pola, bukan data nyata */}
          <div className={`${SOFT} js-chat p-4 md:p-6`}>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                Sesi chat
              </span>
              <span className="flex gap-1.5">
                <span className="size-2 rounded-full bg-white/20" />
                <span className="size-2 rounded-full bg-white/20" />
                <span className="size-2 rounded-full bg-white/20" />
              </span>
            </div>
            <div className="mt-5 space-y-4">
              <div className="js-bubble ml-auto max-w-[85%] rounded-2xl bg-white/[0.14] px-4 py-3 text-[14px] text-white/90">
                Berapa omzet tiga bulan terakhir dan kategori mana yang turun?
              </div>
              <div className="js-bubble max-w-[90%] rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-[14px] leading-[1.6] text-white/80">
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
      </section>

      {/* Kemampuan */}
      <section id="kemampuan" className={`${SHELL} scroll-mt-24 pb-20 md:pb-28`}>
        <h2 className={`js-block ${H2} max-w-[24ch]`}>
          <Words text="Kemampuan yang dibutuhkan, dari yang paling" />{" "}
          <span className={ACCENT}>
            <Words text="sederhana." />
          </span>
        </h2>
        <div className="js-cap-grid mt-12 grid gap-5 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <article key={title} className={`${CARD} js-cap p-6`}>
              <Icon className="size-5 text-white/70" strokeWidth={1.6} />
              <h3 className="mt-5 text-[17px] font-medium">{title}</h3>
              <p className={`${BODY} mt-2.5`}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Integrasi */}
      <section className="border-y border-white/[0.06] py-20 md:py-28">
        <div className={`${SHELL} text-center`}>
          <h2 className={`js-block ${H2} mx-auto max-w-[26ch]`}>
            <Words text="Menempel ke sistem yang" />{" "}
            <span className={ACCENT}>
              <Words text="sudah jalan." />
            </span>
          </h2>
          <p className={`${BODY} mx-auto mt-5 max-w-[50ch]`}>
            Tidak perlu membongkar yang lama. AI masuk lewat jalur yang sudah ada.
          </p>
          <div className="js-chips mt-10 flex flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map((item) => (
              <span
                key={item}
                className="js-chip rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Layanan: kartu gradien */}
      <section id="layanan" className={`${SHELL} scroll-mt-24 py-20 md:py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className={`js-block ${H2} max-w-[22ch]`}>
            <Words text="Layanan yang bisa" />{" "}
            <span className={ACCENT}>
              <Words text="kamu ambil." />
            </span>
          </h2>
          <p className={`${BODY} max-w-[38ch]`}>
            Semua dimulai dari masalah, bukan dari daftar teknologi.
          </p>
        </div>
        <div className="js-grads -mx-5 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SERVICES.map((service, i) => (
            <article
              key={service.title}
              className="js-grad relative flex min-h-[15rem] w-[19rem] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-6 transition-transform duration-300 ease-out [transform-style:preserve-3d]"
              style={{ backgroundImage: GRADIENTS[i % GRADIENTS.length] }}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-black/25 text-[15px] text-white/90">
                +
              </span>
              <span>
                <h3 className="text-[17px] font-medium text-white">{service.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-white/85">{service.body}</p>
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* Proyek */}
      <section id="proyek" className={`${SHELL} scroll-mt-24 pb-20 md:pb-28`}>
        <h2 className={`js-block ${H2}`}>
          <Words text="Sistem yang sudah jalan," />{" "}
          <span className={ACCENT}>
            <Words text="lengkap dengan operasionalnya." />
          </span>
        </h2>
        <div className="mt-12 space-y-5">
          {PROJECTS.map((project) => (
            <article key={project.name} className={`${CARD} js-project p-6 md:p-8`}>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                {project.tag}
              </p>
              <h3 className="mt-3 text-[22px] font-medium tracking-[-0.01em]">{project.name}</h3>
              <p className={`${BODY} mt-3 max-w-[70ch] text-[15px]`}>{project.body}</p>
              <p className="mt-5 border-t border-white/[0.06] pt-4 font-mono text-[12px] text-white/50">
                {project.stack}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`${SHELL} scroll-mt-24 pb-20 md:pb-28`}>
        <h2 className={`js-block ${H2} text-center`}>
          <Words text="Kami punya" />{" "}
          <span className={ACCENT}>
            <Words text="jawabannya." />
          </span>
        </h2>
        <div className="mx-auto mt-12 max-w-[820px]">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="js-faq group border-b border-white/[0.08]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-white/90 transition-colors group-hover:text-white">{q}</span>
                <Plus
                  className="size-4 shrink-0 text-white/50 transition-transform duration-300 group-open:rotate-45"
                  strokeWidth={1.7}
                />
              </summary>
              <p className="js-faq-body pb-5 text-[15px] leading-[1.65] text-white/60">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Penutup */}
      <section className={`${SHELL} pb-24 md:pb-32`}>
        <div
          className={`${SOFT} relative overflow-hidden px-6 py-16 text-center md:px-16 md:py-24`}
        >
          <div
            aria-hidden
            className="js-glow aurora pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 opacity-30"
          />
          <h2 className={`js-block ${H2} relative mx-auto max-w-[22ch]`}>
            <Words text="Siap mengotomasi yang" />{" "}
            <span className={ACCENT}>
              <Words text="berulang?" />
            </span>
          </h2>
          <p className={`${BODY} relative mx-auto mt-5 max-w-[50ch] text-[16px]`}>
            Ceritakan alurnya. Saya bantu petakan mana yang bisa dibantu AI, mana yang lebih baik
            dibiarkan sederhana.
          </p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <span className="js-magnet inline-flex">
              <a href={CONTACT} className={PILL}>
                Mulai discovery
                <ArrowRight className="ml-2 size-4" strokeWidth={1.7} />
              </a>
            </span>
            <Link href="/chat" className={GHOST}>
              Coba demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className={`${SHELL} grid gap-10 py-14 md:grid-cols-[1.8fr_1fr_1fr_1fr]`}>
          <div className="js-foot">
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles className="size-4" strokeWidth={1.7} />
              ITZ AI
            </div>
            <p className="mt-4 max-w-[28ch] text-[13px] leading-[1.6] text-white/50">
              AI yang menempel ke sistem dan masalah nyata — bukan demo yang berhenti di presentasi.
            </p>
          </div>
          <div className="js-foot">
            <p className="text-[13px] text-white/60">Layanan</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {SERVICES.slice(0, 3).map((service) => (
                <li key={service.title}>
                  <a href="#layanan" className="text-white/70 transition-colors hover:text-white">
                    {service.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="js-foot">
            <p className="text-[13px] text-white/60">Proyek</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {PROJECTS.map((project) => (
                <li key={project.name}>
                  <a href="#proyek" className="text-white/70 transition-colors hover:text-white">
                    {project.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="js-foot">
            <p className="text-[13px] text-white/60">Kontak</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li>
                <a href={CONTACT} className="text-white/70 transition-colors hover:text-white">
                  Email
                </a>
              </li>
              <li>
                <Link href="/chat" className="text-white/70 transition-colors hover:text-white">
                  Demo chat
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.06] py-6">
          <p className={`${SHELL} text-[12px] text-white/40`}>© 2026 ITZ AI</p>
        </div>
      </footer>
    </main>
  );
}
