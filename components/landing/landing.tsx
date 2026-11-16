"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { SparklesIcon, type SparklesIconHandle } from "lucide-animated";
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
import ShinyText from "@/components/ShinyText";
import BlurText from "@/components/BlurText";
import StarBorder from "@/components/StarBorder";
import FadeContent from "@/components/FadeContent";
import GhostFibers from "@/components/GhostFibers";
import ChromaGrid from "@/components/ChromaGrid";

const CONTACT = "mailto:ayormahaki@gmail.com?subject=Discovery%20proyek%20AI";

/* Kerangka mengikuti monoai.framer.website:
   kontainer 1320px · H1 800px terpusat · art hero full-bleed 2:1 tanpa radius ·
   grid 3×440 tanpa gap · FAQ 700px terpusat · footer 12px.
   Narasi halaman: Masalah → Layanan → Project Launch → Cara Kerja → FAQ. */
const SHELL = "mx-auto w-full max-w-[1424px] px-5 md:px-[52px]";
const NARROW = "mx-auto w-full max-w-[804px] px-5 md:px-[52px]";
const HEADLINE = "mx-auto w-full max-w-[904px] px-5 md:px-[52px]";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.14em] text-white/70";
const ACCENT = "font-sans font-medium italic text-white";
const H1 =
  "text-balance font-heading text-[clamp(1.5rem,2.6vw,2rem)] font-normal leading-[1.2] tracking-[-0.02em]";
const BRANDLABEL =
  "font-heading text-[clamp(3rem,5.5vw,5rem)] font-medium uppercase tracking-[0.06em] text-white [mask-image:linear-gradient(to_bottom,black_54%,transparent_86%)]";
const H2 =
  "text-balance text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.2] tracking-[-0.03em]";
const BODY = "text-[15px] leading-[1.65] text-white/65 md:text-[16px]";
const PILL =
  "inline-flex h-11 items-center rounded-full bg-[#fafafa] px-5 text-[14px] font-medium text-[#05060a] transition-transform hover:scale-[1.03]";
const GHOST =
  "g-crystal inline-flex h-11 items-center rounded-full px-5 text-[14px] font-medium text-white/90 transition-colors hover:bg-white/[0.1]";
const NAVLINK = "text-[15px] text-white/80 transition-colors hover:text-white";

const NAV = [
  { href: "#masalah", label: "Masalah" },
  { href: "#kenali", label: "Layanan" },
  { href: "#karya", label: "Project" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#faq", label: "FAQ" },
];

const STRIP = [
  "AI Integration",
  "Chatbot",
  "Otomasi Dokumen",
  "RAG & Basis Pengetahuan",
  "Dashboard",
  "Otomasi Pembayaran",
  "Voice AI",
  "Workflow",
];

const FLOW = [
  {
    label: "Discovery",
    body: "Pemetaan masalah, data, dan target. Menentukan apa yang layak dibangun lebih dulu.",
  },
  {
    label: "Architecture",
    body: "Rancangan alur, pemilihan model, skema retrieval, dan batas tool sebelum satu baris kode ditulis.",
  },
  {
    label: "Development",
    body: "Pembangunan bertahap dengan demo yang bisa dicoba, bukan laporan yang tak bisa diuji.",
  },
  {
    label: "Deployment",
    body: "Deploy, kuota, pemantauan biaya, dan serah terima. Satu pekerjaan, satu tanggung jawab.",
  },
];

const CAPABILITIES = [
  {
    icon: MessagesSquare,
    step: "01",
    title: "AI Chatbot",
    body: "Antarmuka percakapan dengan identitas, gaya komunikasi, dan instruksi sendiri, di web, WhatsApp, atau Telegram.",
    img: "/landing/layanan-chatbot.webp",
  },
  {
    icon: Database,
    step: "02",
    title: "RAG & Knowledge AI",
    body: "Dokumen dipecah jadi chunk, di-embed, disimpan di pgvector, dicari dengan cosine HNSW. Jawaban disertai sumbernya.",
    img: "/landing/layanan-rag.webp",
  },
  {
    icon: Workflow,
    step: "03",
    title: "AI Automation",
    body: "AI memanggil tool dan API nyata: mencatat transaksi, menyusun laporan, mengirim notifikasi ke sistem yang sudah jalan.",
    img: "/landing/layanan-automation.webp",
  },
  {
    icon: Sparkles,
    step: "04",
    title: "AI Agent",
    body: "Satu agen yang tahu kapan harus bertanya, kapan memakai tool, dan kapan berhenti sebelum salah langkah.",
    img: "/landing/layanan-agent.webp",
  },
  {
    icon: Network,
    step: "05",
    title: "Multi-Agent System",
    body: "Beberapa agen dengan peran berbeda bekerja dari satu perintah bahasa alami, saling menyerahkan hasil.",
    img: "/landing/layanan-multiagent.webp",
  },
  {
    icon: Wrench,
    step: "06",
    title: "AI API Integration",
    body: "AI ditempel ke sistem yang sudah berjalan lewat REST, webhook, atau konektor. Tanpa membongkar aplikasi lama.",
    img: "/landing/layanan-api.webp",
  },
];

const CHROMA_ACCENTS = ["#a78bfa", "#818cf8", "#38bdf8", "#c084fc", "#22d3ee", "#e879f9"];

const CHROMA = CAPABILITIES.map(({ title, body, img }, i) => ({
  image: img,
  title,
  subtitle: body,
  accent: CHROMA_ACCENTS[i % CHROMA_ACCENTS.length],
}));

const MAS_LOGO_BUBBLES = [
  { name: "OpenAI", src: "/logos/llm-openai.svg", size: "size-20", delay: "0s", style: { left: "5%", top: "30%" } },
  { name: "Anthropic", src: "/logos/llm-anthropic.svg", size: "size-16", delay: "1.2s", style: { left: "12%", top: "54%" } },
  { name: "DeepSeek", src: "/logos/llm-deepseek.svg", size: "size-14", delay: "2.4s", style: { left: "4%", top: "72%" } },
  { name: "Google Gemini", src: "/logos/llm-googlegemini.svg", size: "size-20", delay: "0.6s", style: { right: "5%", top: "26%" } },
  { name: "Mistral", src: "/logos/llm-mistralai.svg", size: "size-16", delay: "1.8s", style: { right: "12%", top: "52%" } },
  { name: "Meta", src: "/logos/llm-meta.svg", size: "size-14", delay: "3s", style: { right: "4%", top: "70%" } },
];

const INTEGRATIONS = [
  { name: "WhatsApp", logo: "/logos/whatsapp.svg" },
  { name: "Telegram", logo: "/logos/telegram.svg" },
  { name: "Discord", logo: "/logos/discord.svg" },
  { name: "Microsoft Teams", logo: "/logos/microsoft-teams.svg" },
  { name: "Google Sheets", logo: "/logos/google-sheets.svg" },
  { name: "Excel", logo: "/logos/excel.svg" },
  { name: "Google Drive", logo: "/logos/google-drive.svg" },
  { name: "Shopee", logo: "/logos/shopee.svg" },
  { name: "GitHub", logo: "/logos/github.svg" },
  { name: "Google Calendar", logo: "/logos/google-calendar.svg" },
  { name: "OneDrive", logo: "/logos/onedrive.svg" },
  { name: "Midtrans", logo: null },
  { name: "Xendit", logo: "/logos/xendit.svg" },
  { name: "TikTok", logo: "/logos/tiktok.svg" },
  { name: "Instagram", logo: "/logos/instagram.svg" },
];

const SERVICES = [
  {
    icon: Boxes,
    title: "Aplikasi AI end-to-end",
    body: "Pemetaan masalah, arsitektur, pembangunan, deploy, dan serah terima. Satu pekerjaan, satu tanggung jawab.",
    material: "/landing/iridescent-flow.jpg",
  },
  {
    icon: Database,
    title: "Chatbot & basis pengetahuan",
    body: "Menjawab dari dokumen, SOP, produk, atau katalog sendiri, bisa dibatasi hanya ke sumber itu.",
    material: "/landing/iridescent-waves.jpg",
  },
  {
    icon: Wrench,
    title: "Integrasi & otomasi",
    body: "Menempel ke alur kerja yang ada: pemrosesan dokumen, entri data, laporan berkala, notifikasi tim.",
    material: null,
  },
  {
    icon: Gauge,
    title: "Audit & perbaikan sistem AI",
    body: "Ukur kualitas retrieval, benahi data dan prompt, pasang kuota serta pemantauan biaya.",
    material: null,
  },
];

const PROJECTS = [
  {
    name: "UMKM-AI",
    tag: "Platform keuangan & analisis bisnis",
    body: "Pencatatan transaksi, utang-piutang, laporan dengan ekspor CSV/Excel/PDF, dan AI Finance Analyst yang menjelaskan kondisi bisnis dari angka aktual, bukan tebakan.",
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
    a: "Bisa, justru di situ nilainya. Kita mulai dari yang ada: dokumen, spreadsheet, catatan, riwayat percakapan. Data yang belum lengkap bukan alasan menunggu.",
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

function AiSparkle({ className }: { className?: string }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const icon = useRef<SparklesIconHandle>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        icon.current?.startAnimation();
        io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={wrap} aria-hidden className={`inline-block ${className ?? ""}`}>
      <SparklesIcon ref={icon} size={30} />
    </span>
  );
}

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

    let stopMarquee: (() => void) | undefined;
    let stopCursorGlow: (() => void) | undefined;

    const ctx = gsap.context(() => {
      // 1 · Nav kaca saat digulir + garis kemajuan spektral.
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

      // 2 · Judul: kata muncul dari blur saat heading masuk viewport.
      el.querySelectorAll<HTMLElement>("h2").forEach((heading) => {
        const words = heading.querySelectorAll<HTMLElement>(".js-w");
        if (!words.length) return;
        gsap.from(words, {
          opacity: 0,
          filter: "blur(10px)",
          y: 16,
          stagger: 0.04,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: heading, start: "top 88%" },
        });
      });

      // 2b · Masalah: spotlight parallax + narasi per paragraf.
      const spot = el.querySelector<HTMLElement>(".js-masalah-spot");
      if (spot) {
        gsap.fromTo(
          spot,
          { yPercent: -4, scale: 1 },
          {
            yPercent: 10,
            scale: 1.15,
            ease: "none",
            scrollTrigger: {
              trigger: "#masalah",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      }
      const masalahLines = el.querySelector<HTMLElement>(".js-masalah-lines");
      if (masalahLines) {
        gsap.from(masalahLines.children, {
          opacity: 0,
          y: 18,
          filter: "blur(8px)",
          duration: 0.8,
          stagger: 0.16,
          ease: "power3.out",
          scrollTrigger: { trigger: masalahLines, start: "top 84%" },
        });
      }

      // 2c · Masalah: spotlight mengikuti kursor (transform only).
      const masalahSection = el.querySelector<HTMLElement>("#masalah");
      const cursorGlow = el.querySelector<HTMLElement>(".js-masalah-cursor");
      if (masalahSection && cursorGlow) {
        const half = 210;
        const xTo = gsap.quickTo(cursorGlow, "x", { duration: 0.55, ease: "power3" });
        const yTo = gsap.quickTo(cursorGlow, "y", { duration: 0.55, ease: "power3" });
        const place = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          const box = masalahSection.getBoundingClientRect();
          xTo(event.clientX - box.left - half);
          yTo(event.clientY - box.top - half);
        };
        const onEnter = (event: PointerEvent) => {
          place(event);
          gsap.to(cursorGlow, { opacity: 1, duration: 0.35, overwrite: "auto" });
        };
        const onLeave = () => gsap.to(cursorGlow, { opacity: 0, duration: 0.35, overwrite: "auto" });
        masalahSection.addEventListener("pointermove", place, { passive: true });
        masalahSection.addEventListener("pointerenter", onEnter);
        masalahSection.addEventListener("pointerleave", onLeave);
        stopCursorGlow = () => {
          masalahSection.removeEventListener("pointermove", place);
          masalahSection.removeEventListener("pointerenter", onEnter);
          masalahSection.removeEventListener("pointerleave", onLeave);
        };
      }

      // 3 · Reveal per kelompok.
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

      // 4 · Latar hero: full-bleed statis, tanpa zoom/parallax.
      gsap.from(".js-hero-bg", { opacity: 0, duration: 1.2, ease: "power3.out" });

      // 4b · Diagram alur: garis tergambar, node menyusul berurutan.
      gsap.from(".js-connector", {
        scaleX: 0,
        duration: 1.1,
        ease: "power2.out",
        delay: 0.5,
      });
      gsap.from(".js-nodes li", {
        y: 22,
        opacity: 0,
        filter: "blur(6px)",
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.65,
      });
      gsap.to(".js-nodes li", {
        y: -6,
        duration: 4.5,
        stagger: { each: 0.35, yoyo: true, repeat: -1 },
        ease: "sine.inOut",
        delay: 1.6,
      });

      // 5 · Pantulan kaca mengikuti pointer.
      el.querySelectorAll<HTMLElement>(".g-sheen").forEach((panel) => {
        panel.addEventListener("pointermove", (event) => {
          const point = event as PointerEvent;
          if (point.pointerType === "touch") return;
          const box = panel.getBoundingClientRect();
          panel.style.setProperty("--mx", `${point.clientX - box.left}px`);
          panel.style.setProperty("--my", `${point.clientY - box.top}px`);
        });
      });

      // 6 · Pita kapabilitas: kecepatan ikut gulir, jeda saat kursor di atasnya.
      const marquee = gsap.to(".js-marquee", {
        xPercent: -50,
        duration: 42,
        repeat: -1,
        ease: "none",
      });
      ScrollTrigger.create({
        onUpdate: (self) => {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 900, 2.4);
          gsap.to(marquee, { timeScale: boost, duration: 0.5, overwrite: true });
        },
      });
      const marqueeWrap = el.querySelector<HTMLElement>(".js-marquee-wrap");
      const pauseMarquee = () => gsap.to(marquee, { timeScale: 0, duration: 0.4, overwrite: true });
      const resumeMarquee = () => gsap.to(marquee, { timeScale: 1, duration: 0.4, overwrite: true });
      marqueeWrap?.addEventListener("pointerenter", pauseMarquee);
      marqueeWrap?.addEventListener("pointerleave", resumeMarquee);
      stopMarquee = () => {
        marqueeWrap?.removeEventListener("pointerenter", pauseMarquee);
        marqueeWrap?.removeEventListener("pointerleave", resumeMarquee);
      };

      // 7 · Korsel layanan: drag-scroll halus (native snap + indikator).
      const rail = el.querySelector<HTMLElement>(".js-rail");
      if (rail) {
        gsap.from(rail.children, {
          y: 30,
          opacity: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: rail, start: "top 86%" },
        });
      }

      // 8 · Parallax material gambar.
      el.querySelectorAll<HTMLElement>(".js-material img").forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -5, scale: 1.08 },
          {
            yPercent: 5,
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

      // 8b · Integrasi: chip masuk memantul.
      gsap.from(".js-chips > div > span", {
        scale: 0.85,
        opacity: 0,
        duration: 0.45,
        stagger: 0.04,
        ease: "back.out(2)",
        scrollTrigger: { trigger: ".js-chips", start: "top 88%" },
      });

      // 8c · Proyek: panel bergeser halus + garis atas digambar.
      el.querySelectorAll<HTMLElement>(".js-project").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 18 * (i % 2 === 0 ? 1 : -1) },
          {
            y: -18 * (i % 2 === 0 ? 1 : -1),
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
        gsap.from(card, {
          opacity: 0,
          scale: 0.985,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 88%" },
        });
      });

      // 9 · FAQ: buka/tutup native <details>; animasi fade via CSS (tanpa tween height = tanpa layout tiap frame).

      // 10 · Tombol magnetik.
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
      stopMarquee?.();
      stopCursorGlow?.();
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <main
      ref={root}
      id="main"
      className="obsidian-field relative isolate min-h-full overflow-x-hidden font-sans text-[#f7f8f8]"
      style={{ fontFeatureSettings: '"cv01", "ss03"' }}
    >
      <a
        href="#kenali"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:text-black"
      >
        Lompat ke konten
      </a>

      <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[45]" />
      <div className="js-progress spectral-line fixed inset-x-0 top-0 z-[60] origin-left scale-x-0" />

      {/* Nav kaca mengambang */}
      <header className="fixed inset-x-0 top-3 z-50 px-4 md:top-4 md:px-8">
        <nav className="js-nav g-frosted g-float mx-auto flex h-[60px] w-full max-w-[1320px] items-center justify-between gap-6 rounded-full px-5 md:px-6">
          <span
            aria-hidden
            className="spectral-line pointer-events-none absolute inset-x-8 bottom-0 opacity-30"
          />
          <Link href="/" className="text-[15px] font-semibold">
            ITZ AI
          </Link>
          <div className="hidden items-center gap-8 lg:ml-auto lg:mr-24 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={`${NAVLINK} font-light`}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat" className={`hidden text-[14px] sm:block ${NAVLINK}`}>
              Demo
            </Link>
            <a
              href={CONTACT}
              className="inline-flex h-9 items-center rounded-full bg-[#fafafa] px-4 text-[13px] font-medium text-[#05060a] transition-transform hover:scale-[1.03]"
            >
              Konsultasi
            </a>
          </div>
        </nav>
      </header>

      {/* 1 · Hero: gambar iridescent jadi latar, konten mengapung di atasnya */}
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pb-20 pt-[calc(env(safe-area-inset-top,0px)+8rem)] md:pb-28 md:pt-40">
        <div aria-hidden className="js-hero-bg pointer-events-none absolute inset-0 -z-10">
          <div aria-hidden className="hero-aurora" />
          <div className="hero-fibers absolute inset-0">
            <GhostFibers
              glowColor="#8b5cf6"
              secondaryColor="#4f46e5"
              lineColor="#cbd5e1"
              gradient="depth"
              fiberStyle="lines"
              speed={0.35}
              twist={1.1}
              thickness={1}
              glow={0.7}
              brightness={1}
              vignette={0.4}
              particles={0}
              sparkle={0}
              mouseInteraction
              hoverEffect="part"
              pulseOnClick={false}
            />
          </div>
          {/* Vignette + fade hitam merata di atas ribbon */}
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_38%,transparent_30%,rgba(5,6,10,0.55)_78%,#05060a_100%)]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,#05060a,rgba(5,6,10,0.35)_60%,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(0deg,#05060a,rgba(5,6,10,0.5)_55%,transparent)]" />
        </div>

        <div className={`${HEADLINE} relative isolate text-center`}>
          <div className="relative">
            <ShinyText
              text="ITZ AI"
              color="#c7ccd4"
              shineColor="#ffffff"
              speed={3.6}
              delay={1.2}
              angle={115}
              shineWidth={24}
              softness={0.9}
              direction="right"
              className={BRANDLABEL}
            />
          </div>
          <h1 className="sr-only">Hadirkan Kecerdasan AI ke dalam Bisnis Anda.</h1>
          <BlurText
            text="Hadirkan Kecerdasan AI ke dalam Bisnis Anda."
            aria-hidden
            trigger="load"
            effect="blur"
            animateBy="words"
            direction="bottom"
            delay={90}
            stepDuration={0.5}
            blur={8}
            distance={18}
            className={`${H1} relative mt-4 justify-center`}
          />
          <FadeContent
            trigger="mount"
            effect="fade"
            duration={0.9}
            delay={0.45}
            className={`${BODY} mx-auto mt-5 max-w-[54ch]`}
          >
            Integrasikan AI ke aplikasi Anda dan bangun solusi digital baru berbasis AI. Dari AI
            integration hingga custom AI application development.
          </FadeContent>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="js-magnet inline-flex">
              <StarBorder
                as="a"
                href={CONTACT}
                color="#ffffff"
                trailColor="#ffffff"
                backgroundColor="rgba(255,255,255,0.12)"
                textColor="#ffffff"
                borderColor="rgba(255,255,255,0.3)"
                duration={6}
                thickness={1}
                radius={999}
                glow={0.55}
                className="backdrop-blur-md transition-[transform,backdrop-filter] duration-300 hover:scale-[1.04] hover:backdrop-blur-xl"
              >
                Mulai discovery
                <ArrowRight className="ml-2 size-4" strokeWidth={1.7} />
              </StarBorder>
            </span>
          </div>
        </div>
      </section>

      {/* 2 · Strip kapabilitas */}
      <section className="relative isolate border-y border-white/[0.08] py-8">
        {/* fade simetris di belakang marquee biar tak ada pita gelap */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-24 bg-[linear-gradient(180deg,#05060a,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-[1] h-24 bg-[linear-gradient(0deg,#05060a,transparent)]"
        />
        <p className={`${SHELL} text-center text-[12px] tracking-[0.02em] text-white/50`}>
          Kapabilitas yang bisa dibawa ke bisnis Anda
        </p>
        <div className="group mt-5 flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_22%,black_78%,transparent)]">
          <div className="js-marquee-wrap flex w-full overflow-hidden">
            <div className="js-marquee flex shrink-0 items-center gap-14 pr-14 text-[14px] text-white/60">
              {[...STRIP, ...STRIP].map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="whitespace-nowrap"
                  aria-hidden={i >= STRIP.length}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3 · Masalah: cinematic, storytelling */}
      <section
        id="masalah"
        className="relative isolate scroll-mt-28 overflow-hidden border-y border-white/[0.06] bg-[#05060a] py-24 md:py-36"
      >
        {/* Latar sinematik: foto section + spotlight violet + fade tepi */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: "url('/image/section_masalah.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "brightness(0.17)",
            }}
          />
          <div className="js-masalah-spot absolute inset-0 origin-center bg-[radial-gradient(75%_55%_at_50%_-5%,rgba(139,92,246,0.18),transparent_62%)] will-change-transform" />
          <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,#05060a,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(0deg,#05060a,transparent)]" />
          <div className="absolute left-1/2 top-0 h-px w-[70%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)]" />
        </div>

        {/* Spotlight mengikuti kursor */}
        <div
          aria-hidden
          className="js-masalah-cursor pointer-events-none absolute left-0 top-0 -z-[1] h-[420px] w-[420px] rounded-full opacity-0 blur-2xl will-change-transform"
          style={{ background: "radial-gradient(circle,rgba(139,92,246,0.22),transparent 70%)" }}
        />

        {/* Bubble logo model AI (kiri & kanan, desktop) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
          {MAS_LOGO_BUBBLES.map((b) => (
            <div
              key={b.name}
              className="mas-bubble-wrap pointer-events-auto absolute"
              style={{ position: "absolute", ...b.style }}
              title={b.name}
            >
              <div className={`mas-bubble ${b.size}`} style={{ animationDelay: b.delay }}>
                <span
                  className="block bg-white/85"
                  style={{
                    width: "46%",
                    height: "46%",
                    maskImage: `url(${b.src})`,
                    WebkitMaskImage: `url(${b.src})`,
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={SHELL}>
          <div className="mx-auto max-w-[860px] text-center">
            <p className={`${EYEBROW} js-reveal`}>Masalah</p>
            <h2 className={`${H2} mt-6`}>
              <Words text="Apakah Infrastruktur Bisnis Anda Siap Menghadapi" />{" "}
              <span className={ACCENT}>
                <Words text="Era AI?" />
              </span>
              <AiSparkle className="ml-2 align-[-0.06em] text-[color:var(--spectral-violet)]" />
            </h2>
          </div>

          {/* Narasi */}
          <div className="mt-14">
            <div className="js-masalah-lines mx-auto max-w-[64ch] space-y-5 text-center text-[15px] leading-[1.75] text-white/60">
            <p>
              Banyak <em className="italic">perusahaan, mitra, dan pelaku bisnis</em> masih menghadapi
              tantangan dalam mengelola operasional, memproses informasi, serta menghubungkan berbagai
              sistem yang mereka gunakan. Di tengah perkembangan industri yang semakin cepat,
              pendekatan konvensional tidak lagi cukup untuk menjawab kompleksitas kebutuhan bisnis.
              Efisiensi, otomatisasi, dan pengambilan keputusan berbasis data menjadi semakin penting.
            </p>
            <p className="text-white/80">
              AI bukan lagi sekadar teknologi tambahan. AI mulai menjadi bagian penting dari
              infrastruktur bisnis modern.
            </p>
            <p className="text-white/80">
              <ShinyText
                text="ITZ AI hadir untuk menjembatani kebutuhan tersebut."
                className="font-semibold"
                color="#dfe3ea"
                shineColor="#ffffff"
                speed={3.2}
                delay={0.4}
                angle={110}
                shineWidth={22}
                softness={0.9}
              />
            </p>
            <p>
              Kami membantu bisnis mengintegrasikan kapabilitas AI ke dalam sistem yang sudah berjalan
              maupun membangun aplikasi digital baru berbasis AI. Mengubah proses yang kompleks
              menjadi workflow yang lebih cerdas, terintegrasi, dan adaptif terhadap kebutuhan bisnis.
            </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · Apa yang bisa ITZ AI lakukan: 6 kapabilitas */}
      <section id="kenali" className={`${SHELL} scroll-mt-28 py-20 md:py-28`}>
        <div className="mx-auto max-w-[760px] text-center">
          <p className={EYEBROW}>Layanan</p>
          <h2 className={`${H2} mt-5`}>
            <Words text="Apa yang bisa ITZ AI" />{" "}
            <span className={ACCENT}>
              <Words text="lakukan." />
            </span>
          </h2>
          <p className={`${BODY} mx-auto mt-5 max-w-[52ch]`}>
            Layanan kami mencakup perancangan hingga penerapan solusi AI, mulai dari chatbot dan
            basis pengetahuan, otomasi proses bisnis, integrasi API, serta sistem multi-agen. Setiap
            layanan disesuaikan dengan kebutuhan dan kematangan sistem yang Anda miliki.
          </p>
        </div>
        <div className="mt-14">
          <ChromaGrid items={CHROMA} columns={3} minCardWidth={280} gap={14} radius={300} cardRadius={20} aspectRatio="16 / 10" theme="dark" />
        </div>
      </section>

      {/* 3b · AI chat: teks + mock dalam kaca gelap */}
      <section className="border-y border-white/[0.08] py-20 md:py-28">
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
            <div className="js-reveal g-dark g-sheen g-float rounded-[24px] p-4 md:p-6">
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

      {/* 5 · Cara Kerja: empat fase */}
      <section id="cara-kerja" className={`${SHELL} scroll-mt-28 py-20 md:py-28`}>
        <div className="mx-auto max-w-[760px] text-center">
          <p className={EYEBROW}>Cara kerja</p>
          <h2 className={`${H2} mt-5`}>
            <Words text="Empat langkah," />{" "}
            <span className={ACCENT}>
              <Words text="satu alur." />
            </span>
          </h2>
          <p className={`${BODY} mx-auto mt-5 max-w-[52ch]`}>
            Proses yang sama untuk setiap pekerjaan. Tidak ada lompatan dari ide ke produksi.
          </p>
        </div>
        <div className="relative mt-14">
          <span
            aria-hidden
            className="js-connector spectral-line absolute inset-x-12 top-[30px] hidden h-px origin-left opacity-70 lg:block"
          />
          <ol className="js-nodes relative grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, i) => (
              <li key={step.label} className="g-dark rounded-2xl px-5 py-5">
                <span className="font-mono text-[10px] text-white/55">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-[16px] font-medium">{step.label}</h3>
                <p className="mt-2 text-[13px] leading-[1.55] text-white/60">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5b · Integrasi: heading terpusat + kaca kristal besar */}
      <section className={`${SHELL} py-20 md:py-28`}>
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className={H2}>
            <Words text="Integrasikan AI" />{" "}
            <span className={ACCENT}>
              <Words text="ke dalam Apps." />
            </span>
          </h2>
          <p className={`${BODY} mx-auto mt-5 max-w-[52ch]`}>
            Dari chat, dokumen, hingga pembayaran, integrasikan AI ke seluruh alat kerja Anda.
          </p>
        </div>
        <div className="js-reveal js-chips g-crystal g-sheen mx-auto mt-12 max-w-[1000px] rounded-[28px] p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] text-white/70"
              >
                {item.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.logo}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 shrink-0"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-4 items-center justify-center rounded-[3px] border border-white/30 text-[9px] leading-none text-white/60"
                  >
                    {item.name.charAt(0)}
                  </span>
                )}
                {item.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 5c · Layanan: korsel kartu material (pola "Next-gen AI features") */}
      <section id="layanan" className="scroll-mt-28 border-y border-white/[0.08] py-20 md:py-28">
        <div className={`${SHELL} flex flex-wrap items-end justify-between gap-6`}>
          <h2 className={`${H2} max-w-[22ch]`}>
            <Words text="Layanan yang bisa" />{" "}
            <span className={ACCENT}>
              <Words text="kamu ambil." />
            </span>
          </h2>
          <p className={`${BODY} max-w-[36ch]`}>
            Semua mulai dari masalah, bukan dari daftar teknologi.
          </p>
        </div>
        <div className="js-rail mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SERVICES.map(({ icon: Icon, title, body, material }) => (
            <article
              key={title}
              className="g-sheen relative flex min-h-[19rem] w-[19rem] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[20px] border border-white/[0.1] p-6 md:w-[22rem]"
            >
              {material ? (
                <div className="js-material absolute inset-0">
                  <Image src={material} alt="" fill sizes="24rem" className="object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(5,6,10,0.75),rgba(5,6,10,0.9))]" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-[#0a0b10]" />
              )}
              <div className="relative flex items-center justify-between">
                <Icon className="size-5 text-white/70" strokeWidth={1.6} />
                <span className="flex size-6 items-center justify-center rounded-full border border-white/20 text-[13px] text-white/70">
                  +
                </span>
              </div>
              <div className="relative">
                <h3 className="text-[18px] font-medium">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-white/65">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 6 · Project Launch: proyek yang sudah jalan */}
      <section id="karya" className={`${SHELL} scroll-mt-28 py-20 md:py-28`}>
        <div className="mx-auto max-w-[760px] text-center">
          <p className={EYEBROW}>Project Launch</p>
          <h2 className={`${H2} mt-5`}>
            <Words text="Sistem yang sudah jalan," />{" "}
            <span className={ACCENT}>
              <Words text="lengkap dengan operasionalnya." />
            </span>
          </h2>
        </div>
        <div className="js-reveal mt-12 space-y-4">
          {PROJECTS.map((project) => (
            <article
              key={project.name}
              className="g-frosted g-sheen g-float rounded-[20px] p-6 md:p-8"
            >
              <p className={EYEBROW}>{project.tag}</p>
              <h3 className="mt-3 text-[20px] font-medium tracking-[-0.01em]">{project.name}</h3>
              <p className="mt-3 max-w-[72ch] text-[15px] leading-[1.65] text-white/60">
                {project.body}
              </p>
              <p className="mt-5 border-t border-white/[0.07] pt-4 font-mono text-[12px] text-white/45">
                {project.stack}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 7 · FAQ: kolom 700px terpusat */}
      <section id="faq" className="scroll-mt-28 border-y border-white/[0.08] py-20 md:py-28">
        <div className={NARROW}>
          <h2 className={`${H2} text-center`}>
            <Words text="Kami punya" />{" "}
            <span className={ACCENT}>
              <Words text="jawabannya." />
            </span>
          </h2>
          <div className="js-reveal mt-10">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b border-white/[0.08]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="text-white/90 transition-colors group-hover:text-white">
                    {q}
                  </span>
                  <Plus
                    className="size-4 shrink-0 text-white/45 transition-transform duration-300 group-open:rotate-45"
                    strokeWidth={1.7}
                  />
                </summary>
                <p className="js-faq-body pb-5 text-[15px] leading-[1.65] text-white/60">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · CTA penutup terpusat */}
      <section className={`${SHELL} py-20 md:py-28`}>
        <div className="g-irid g-irid--live g-float rounded-[28px] p-px">
          <div className="g-dark relative overflow-hidden rounded-[27px] px-6 py-16 text-center md:px-16 md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 bottom-[-10rem] h-[20rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.32),rgba(34,211,238,0.14)_50%,transparent_72%)] blur-3xl"
            />
            <h2 className={`${H2} relative mx-auto max-w-[22ch]`}>
              <Words text="Siap mengotomasi yang" />{" "}
              <span className={ACCENT}>
                <Words text="berulang?" />
              </span>
            </h2>
            <p className={`${BODY} relative mx-auto mt-5 max-w-[50ch]`}>
              Ceritakan alurnya. Saya bantu petakan mana yang bisa dibantu AI, mana yang lebih baik
              dibiarkan sederhana.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </div>
      </section>

      {/* 9 · Footer: 4 kolom + bilah legal (pola referensi) */}
      <footer className="border-t border-white/[0.08]">
        <div
          className={`${SHELL} grid gap-10 py-14 text-[12px] md:grid-cols-[1.8fr_1fr_1fr_1fr] md:py-16`}
        >
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles className="size-4" strokeWidth={1.7} />
              ITZ AI
            </div>
            <p className="mt-4 max-w-[28ch] text-[13px] leading-[1.7] text-white/45">
              AI yang menempel ke sistem dan masalah nyata, bukan demo yang berhenti di presentasi.
            </p>
          </div>
          <div>
            <p className="text-[12px] text-white/40">Layanan</p>
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
            <p className="text-[12px] text-white/40">Proyek</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {PROJECTS.map((project) => (
                <li key={project.name}>
                  <a href="#karya" className="text-white/65 transition-colors hover:text-white">
                    {project.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] text-white/40">Kontak</p>
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
          <div
            className={`${SHELL} flex flex-col gap-2 text-[12px] text-white/35 sm:flex-row sm:items-center sm:justify-between`}
          >
            <p>© 2026 ITZ AI</p>
            <p>
              By{" "}
              <a
                href={CONTACT}
                className="text-white/55 transition-colors hover:text-white"
              >
                Mochammad Ginata Febryansyah
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
