"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SparklesIcon, type SparklesIconHandle } from "lucide-animated";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
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
import GhostFibers from "@/components/GhostFibers";
import AccordionGallery from "@/components/AccordionGallery";
import ClickSpark from "@/components/ClickSpark";
import StarBorder from "@/components/StarBorder";
import CardNav from "@/components/CardNav";
import BorderGlow from "@/components/BorderGlow";
import MagicBento from "@/components/MagicBento";
import GradientText from "@/components/GradientText";

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
    icon: Sparkles,
    label: "Discovery",
    tag: "Brief",
    input: "Masalah",
    output: "Scope",
    img: "/landing/spectral-streaks.webp",
    body: "Pemetaan masalah, data, dan target. Menentukan apa yang layak dibangun lebih dulu.",
  },
  {
    icon: Network,
    label: "Architecture",
    tag: "Blueprint",
    input: "Scope",
    output: "Rancangan",
    img: "/landing/iridescent-flow.webp",
    body: "Rancangan alur, pemilihan model, skema retrieval, dan batas tool sebelum satu baris kode ditulis.",
  },
  {
    icon: Workflow,
    label: "Development",
    tag: "Build",
    input: "Rancangan",
    output: "Demo",
    img: "/landing/iridescent-waves.webp",
    body: "Pembangunan bertahap dengan demo yang bisa dicoba, bukan laporan yang tak bisa diuji.",
  },
  {
    icon: Gauge,
    label: "Deployment",
    tag: "Live",
    input: "Demo",
    output: "Produksi",
    img: "/image/section_masalah.webp",
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

const ACCORDION_ITEMS = CAPABILITIES.map(({ title, img }) => ({
  image: img,
  label: title,
  alt: title,
}));

const MAS_LOGO_BUBBLES = [
  {
    name: "OpenAI",
    src: "/logos/llm-openai.svg",
    size: "size-20",
    delay: "0s",
    style: { left: "5%", top: "30%" },
  },
  {
    name: "Anthropic",
    src: "/logos/llm-anthropic.svg",
    size: "size-16",
    delay: "1.2s",
    style: { left: "12%", top: "54%" },
  },
  {
    name: "DeepSeek",
    src: "/logos/llm-deepseek.svg",
    size: "size-14",
    delay: "2.4s",
    style: { left: "4%", top: "72%" },
  },
  {
    name: "Google Gemini",
    src: "/logos/llm-googlegemini.svg",
    size: "size-20",
    delay: "0.6s",
    style: { right: "5%", top: "26%" },
  },
  {
    name: "Mistral",
    src: "/logos/llm-mistralai.svg",
    size: "size-16",
    delay: "1.8s",
    style: { right: "12%", top: "52%" },
  },
  {
    name: "Meta",
    src: "/logos/llm-meta.svg",
    size: "size-14",
    delay: "3s",
    style: { right: "4%", top: "70%" },
  },
];

const INTEGRATIONS = [
  // Sosial media
  { name: "Instagram", logo: "/logos/instagram.svg" },
  { name: "TikTok", logo: "/logos/tiktok.svg" },
  // Chat & kolaborasi
  { name: "WhatsApp", logo: "/logos/whatsapp.svg" },
  { name: "Telegram", logo: "/logos/telegram.svg" },
  { name: "Discord", logo: "/logos/discord.svg" },
  { name: "Microsoft Teams", logo: "/logos/microsoft-teams.svg" },
  // Dokumen & penyimpanan
  { name: "Google Sheets", logo: "/logos/google-sheets.svg" },
  { name: "Excel", logo: "/logos/excel.svg" },
  { name: "Google Drive", logo: "/logos/google-drive.svg" },
  { name: "OneDrive", logo: "/logos/onedrive.svg" },
  // Penjadwalan & pengembangan
  { name: "Google Calendar", logo: "/logos/google-calendar.svg" },
  { name: "GitHub", logo: "/logos/github.svg" },
  // E-commerce & pembayaran
  { name: "Shopee", logo: "/logos/shopee.svg" },
  { name: "Midtrans", logo: null },
  { name: "Xendit", logo: "/logos/xendit.svg" },
];

const SERVICES = [
  {
    icon: Boxes,
    title: "Aplikasi AI end-to-end",
    body: "Pemetaan masalah, arsitektur, pembangunan, deploy, dan serah terima. Satu pekerjaan, satu tanggung jawab.",
    material: "/landing/iridescent-flow.webp",
  },
  {
    icon: Database,
    title: "Chatbot & basis pengetahuan",
    body: "Menjawab dari dokumen, SOP, produk, atau katalog sendiri, bisa dibatasi hanya ke sumber itu.",
    material: "/landing/iridescent-waves.webp",
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
    <span ref={wrap} aria-hidden className={`js-split-ignore inline-block ${className ?? ""}`}>
      <SparklesIcon ref={icon} size={30} />
    </span>
  );
}

/** Teks polos — pemecahan kata dilakukan SplitText di efek GSAP (autoSplit + a11y). */
function Words({ text }: { text: string }) {
  return <>{text}</>;
}

/** Aksen italic dengan gradient hidup. Di-ignore SplitText supaya tidak dipecah. */
function Accent({ text }: { text: string }) {
  return (
    <GradientText
      className={`${ACCENT} js-split-ignore`}
      colors={["#c4b5fd", "#a78bfa", "#67e8f9"]}
      variant="flow"
      animationSpeed={9}
      scale={2}
      glow={0}
    >
      {text}
    </GradientText>
  );
}

export default function Landing() {
  const root = useRef<HTMLElement>(null);
  // Dimatikan saat hero tertutup tirai ATAU saat user sedang scroll:
// GhostFibers berhenti merender frame GPU selama scroll (paling terasa jank).
  const [heroPaused, setHeroPaused] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
    // Kurva gerak khas ITZ AI — dipakai ulang di reveal agar terasa konsisten.
    // easeOutQuint: awal tetap cepat, tapi ekor lebih panjang & halus
    // (dulu 0.16,1,0.3,1 terlalu "sentak" untuk reveal 0.7–0.85 detik).
    CustomEase.create("itz", "0.22, 1, 0.36, 1");

    let stopMarquee: (() => void) | undefined;
    let stopCursorGlow: (() => void) | undefined;
    let onHeroScroll: (() => void) | undefined;

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
      // SplitText menangani pemecahan kata (tag span agar aman di dalam <em>/<span>),
      // autoSplit menjaga pemecahan tetap benar setelah font termuat / resize,
      // dan aria default menjaga heading tetap terbaca pembaca layar.
      el.querySelectorAll<HTMLElement>("h2").forEach((heading) => {
        SplitText.create(heading, {
          type: "words",
          tag: "span",
          wordsClass: "js-w",
          ignore: ".js-split-ignore",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.words, {
              opacity: 0,
              y: 16,
              stagger: 0.04,
              duration: 0.85,
              ease: "itz",
              scrollTrigger: { trigger: heading, start: "top 88%" },
            });
          },
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
        // Satu timeline scrub: eyebrow → paragraf → bubble, berurutan seperti film.
        // Dimulai tepat saat tirai mulai membuka (top 46%) dan selesai sebelum
        // tirai benar-benar hilang.
        const intro = gsap.timeline({
          scrollTrigger: {
            trigger: "#masalah",
            start: "top 46%",
            end: "top 4%",
            scrub: 0.55,
          },
        });
        intro
          .fromTo(
            ".js-masalah-eyebrow",
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, ease: "none" },
          )
          .fromTo(
            Array.from(masalahLines.children),
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, stagger: 0.2, ease: "none" },
            0.1,
          )
          // Bubble hanya opacity: transform-nya dipakai animasi CSS/hover.
          .fromTo(
            ".mas-bubble-wrap",
            { opacity: 0 },
            { opacity: 1, stagger: 0.07, ease: "none" },
            0.18,
          );
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
        const onLeave = () =>
          gsap.to(cursorGlow, { opacity: 0, duration: 0.35, overwrite: "auto" });
        masalahSection.addEventListener("pointermove", place, { passive: true });
        masalahSection.addEventListener("pointerenter", onEnter);
        masalahSection.addEventListener("pointerleave", onLeave);
        stopCursorGlow = () => {
          masalahSection.removeEventListener("pointermove", place);
          masalahSection.removeEventListener("pointerenter", onEnter);
          masalahSection.removeEventListener("pointerleave", onLeave);
        };
      }

      // 2d · Layanan: "pop" naik saat masuk dari Masalah. Scrub, transform +
      //     opacity saja; header dan galeri naik berurutan.
      const kenali = el.querySelector<HTMLElement>("#kenali");
      if (kenali) {
        const popTargets = [
          kenali.firstElementChild as HTMLElement | null,
          kenali.querySelector<HTMLElement>(".js-layanan-pop"),
        ].filter((node): node is HTMLElement => !!node);
        if (popTargets.length) {
          gsap.fromTo(
            popTargets,
            { opacity: 0, y: 64, scale: 0.94 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              stagger: 0.08,
              scrollTrigger: {
                trigger: kenali,
                start: "top 95%",
                end: "top 48%",
                scrub: 0.6,
              },
            },
          );
        }
      }

      // 3 · Reveal per kelompok — di-batch agar grup yang masuk bareng
      //     mendapat satu stagger terkoordinasi (lebih sedikit ScrollTrigger).
      const revealGroups = gsap
        .utils.toArray<HTMLElement>(".js-reveal")
        .filter((group) => group.children.length > 0);
      const revealTargets = revealGroups.flatMap((group) => Array.from(group.children));
      gsap.set(revealTargets, { y: 26, opacity: 0 });
      ScrollTrigger.batch(revealGroups, {
        start: "top 86%",
        once: true,
        onEnter: (batch) =>
          gsap.to(
            batch.flatMap((group) => Array.from(group.children)),
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.08,
              ease: "itz",
              overwrite: true,
            },
          ),
      });

      // 4 · Hero: keluar sinematik saat digulir + parallax pointer halus.
      gsap.from(".hero-fibers", { opacity: 0, duration: 1.2, ease: "itz" });
      // H1: hanya transform, tanpa opacity, supaya langsung ter-paint (LCP).
      gsap.from(".js-hero-h1", { y: 18, duration: 0.8, ease: "itz" });

      // 4a · Opening wordmark "ITZ AI": naik + menjauh lalu mengunci
      //     (scaleX menggantikan animasi letter-spacing agar tetap transform-only).
      //     Shine ShinyText mulai di 1.2s tepat saat entrance selesai.
      gsap.from(".js-brand", {
        y: 18,
        scaleX: 1.06,
        opacity: 0,
        duration: 1.0,
        ease: "itz",
        clearProps: "transform,opacity",
      });
      const hero = el.querySelector<HTMLElement>(".js-hero");
      const heroCopy = el.querySelector<HTMLElement>(".js-hero-copy");
      if (hero && heroCopy) {
        gsap.to(heroCopy, {
          yPercent: -14,
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.4 },
        });
        gsap.fromTo(
          ".js-hero-bg",
          { opacity: 1 },
          {
            // Tanpa scale: menghindari resample tekstur canvas WebGL tiap frame.
            opacity: 0.22,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 },
          },
        );
        // Tirai tenggelam: (A) naik linear ke 0.85 lalu DITAHAN sampai Masalah
        // mencapai tengah viewport; (B) baru setelah itu meredup terbuka.
        // Jeda hitam setelah hero memberi ruang scroll ekstra untuk hold.
        const veil = el.querySelector<HTMLElement>(".js-page-veil");
        if (veil) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                endTrigger: "#masalah",
                end: "top 50%",
                scrub: 0.5,
              },
            })
            .fromTo(veil, { opacity: 0 }, { opacity: 1, ease: "none", duration: 0.75 })
            // Hold: hitam penuh, hanya menahan jarak scroll.
            .to(veil, { opacity: 1, ease: "none", duration: 1 });
          // Fade-out baru mulai saat #masalah top di tengah layar.
          gsap.fromTo(
            veil,
            { opacity: 1 },
            {
              opacity: 0,
              ease: "none",
              immediateRender: false,
              scrollTrigger: {
                trigger: "#masalah",
                start: "top 50%",
                end: "top 8%",
                scrub: 0.5,
              },
            },
          );
        }
        // Selama tirai hitam (waktu idle), panaskan aset section berikutnya:
        // logo bubble + gambar Layanan. Reveal jadi mulus, tanpa nunggu decode.
        ScrollTrigger.create({
          trigger: "#masalah",
          start: "top 80%",
          once: true,
          onEnter: () => {
            const warm = () => {
              if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
                return;
              MAS_LOGO_BUBBLES.forEach(({ src }) => {
                const probe = document.createElement("img");
                probe.decoding = "async";
                probe.src = src;
                probe.decode?.().catch(() => {});
              });
              document.querySelectorAll<HTMLImageElement>("#kenali img").forEach((img) => {
                if (img.loading === "lazy") img.loading = "eager";
                img.decode?.().catch(() => {});
              });
            };
            if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 1200 });
            else window.setTimeout(warm, 150);
          },
        });
        // GhostFibers: berhenti merender saat hero tertutup tirai / saat scroll
        // turun, TAPI hidup lagi lebih awal ketika user scroll naik dan hero
        // masih di balik tirai hitam. Jadi saat hero terlihat, ribbon sudah
        // berjalan — tidak terkesan "start ulang" setelah freeze.
        // Listener scroll langsung, bukan callback arah ScrollTrigger, supaya
        // lompatan scroll cepat dari Lenis tetap konsisten.
        let prevY = window.scrollY;
        onHeroScroll = () => {
          const y = window.scrollY;
          const goingUp = y < prevY - 1;
          prevY = y;
          const covered = y > hero.offsetHeight * 0.45;
          setHeroPaused(goingUp && y < hero.offsetHeight ? false : covered);
        };
        window.addEventListener("scroll", onHeroScroll, { passive: true });
        setHeroPaused(window.scrollY > hero.offsetHeight * 0.45);
        gsap.to(".js-hero-cue", {
          opacity: 0,
          y: 12,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "30% top", scrub: 0.3 },
        });

        const xTo = gsap.quickTo(heroCopy, "x", { duration: 1.1, ease: "power3" });
        const yTo = gsap.quickTo(heroCopy, "y", { duration: 1.1, ease: "power3" });
        hero.addEventListener(
          "pointermove",
          (event) => {
            if (event.pointerType === "touch") return;
            const nx = event.clientX / window.innerWidth - 0.5;
            const ny = event.clientY / window.innerHeight - 0.5;
            xTo(nx * 22);
            yTo(ny * 14);
          },
          { passive: true },
        );
        hero.addEventListener("pointerleave", () => {
          xTo(0);
          yTo(0);
        });
      }

      // 4b · Mekanisme alur: tiap tautan terisi, paket sinyal jalan, node menyala.
      gsap.from(".js-node", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: ".js-nodes", start: "top 84%" },
      });
      const flowCards = gsap.utils.toArray<HTMLElement>(".js-node");
      const flowLinks = gsap.utils.toArray<HTMLElement>(".js-flow-link");
      const flowBg = el.querySelector<HTMLElement>(".js-flow-bg");
      if (flowBg) {
        gsap.fromTo(
          flowBg,
          { yPercent: -5, scale: 1.05 },
          {
            yPercent: 5,
            scale: 1.05,
            ease: "none",
            scrollTrigger: {
              trigger: "#cara-kerja",
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
      }
      const flow = gsap.timeline({
        scrollTrigger: { trigger: ".js-nodes", start: "top 76%", end: "bottom 62%", scrub: 0.5 },
      });
      flowCards.forEach((card, i) => {
        const link = flowLinks[i];
        const fill = link?.querySelector<HTMLElement>(".js-flow-fill");
        const packet = link?.querySelector<HTMLElement>(".js-flow-packet");
        if (fill && packet) {
          flow.fromTo(
            fill,
            { scaleX: 0 },
            { scaleX: 1, ease: "power1.inOut", duration: 0.18 },
            i * 0.25 + 0.06,
          );
          // Posisi paket memakai transform (x), bukan `left` yang memicu layout.
          gsap.set(packet, { xPercent: -50 });
          flow.fromTo(
            packet,
            { x: 0, opacity: 0 },
            { x: () => link.offsetWidth, opacity: 1, ease: "power1.inOut", duration: 0.24 },
            i * 0.25 + 0.02,
          );
          flow.to(packet, { opacity: 0, duration: 0.06 }, i * 0.25 + 0.26);
        }
        const glow = card.querySelector<HTMLElement>(".js-node-glow");
        if (glow) {
          flow.to(glow, { opacity: 1, duration: 0.16, ease: "power2.out" }, i * 0.25 + 0.2);
        }
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
      const resumeMarquee = () =>
        gsap.to(marquee, { timeScale: 1, duration: 0.4, overwrite: true });
      marqueeWrap?.addEventListener("pointerenter", pauseMarquee);
      marqueeWrap?.addEventListener("pointerleave", resumeMarquee);
      stopMarquee = () => {
        marqueeWrap?.removeEventListener("pointerenter", pauseMarquee);
        marqueeWrap?.removeEventListener("pointerleave", resumeMarquee);
      };

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
      });

      // 8d · Proyek: tilt 3D + sorot kaca mengikuti pointer.
      el.querySelectorAll<HTMLElement>(".js-tilt").forEach((card) => {
        gsap.set(card, { transformPerspective: 1200, transformStyle: "preserve-3d" });
        const rotX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power2" });
        const rotY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power2" });
        const glare = card.querySelector<HTMLElement>(".js-glare");
        const move = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          const box = card.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width - 0.5;
          const py = (event.clientY - box.top) / box.height - 0.5;
          rotX(-py * 6);
          rotY(px * 8);
          if (!glare) return;
          glare.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
          glare.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
          glare.style.opacity = "1";
        };
        const leave = () => {
          rotX(0);
          rotY(0);
          if (glare) glare.style.opacity = "0";
        };
        card.addEventListener("pointermove", move, { passive: true });
        card.addEventListener("pointerleave", leave);
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

    // Hitung ulang posisi trigger setelah font & gambar selesai dimuat,
    // supaya start/end tidak meleset dari layout akhir.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });

    return () => {
      window.removeEventListener("load", refresh);
      if (onHeroScroll) window.removeEventListener("scroll", onHeroScroll);
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
      {/* Vignette tepi atas/bawah untuk semua section setelah hero: statis,
          tidak menutup konten, nol biaya per frame (beda dengan tirai). */}
      <div aria-hidden className="page-vignette pointer-events-none fixed inset-0 z-[38]" />
      {/* Tirai dip-to-black: hanya sekali, hero → Masalah (opening).
          pointer-events-none, opacity saja. */}
      <div
        aria-hidden
        className="js-page-veil pointer-events-none fixed inset-0 z-[40] bg-[#05060a] opacity-0"
      />
      <ClickSpark />
      <div className="js-progress spectral-line fixed inset-x-0 top-0 z-[60] origin-left scale-x-0" />

      {/* Nav kaca mengambang: link penuh di desktop, menu kartu di mobile */}
      <header className="fixed inset-x-0 top-3 z-50 px-4 md:top-4 md:px-8">
        <nav className="g-flat g-float mx-auto hidden h-[60px] w-full max-w-[1320px] items-center justify-between gap-6 rounded-full px-5 md:px-6 lg:flex">
          <span
            aria-hidden
            className="spectral-line pointer-events-none absolute inset-x-8 bottom-0 opacity-30"
          />
          <Link href="/" className="text-[15px] font-semibold">
            ITZ AI
          </Link>
          <div className="ml-auto mr-16 flex items-center gap-8">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={`${NAVLINK} font-light`}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat" prefetch={false} className={`text-[14px] ${NAVLINK}`}>
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
        <div className="lg:hidden">
          <CardNav
            logo={<span className="text-[15px] font-semibold">ITZ AI</span>}
            logoHref="/"
            linkComponent={Link}
            items={[
              {
                label: "Jelajahi",
                description: "Bagian utama landing page.",
                links: NAV.map((item) => ({ label: item.label, href: item.href })),
              },
              {
                label: "Coba langsung",
                description: "Lihat ITZ AI bekerja.",
                links: [
                  { label: "Demo Chat", href: "/chat" },
                  { label: "Dokumentasi", href: "/docs" },
                ],
              },
            ]}
            cta={{ label: "Konsultasi", href: CONTACT }}
            theme="dark"
            surface="glass"
            maxWidth={1320}
            accentColor="#fafafa"
            menuLabel={false}
            intro={false}
            cardEffect="rise"
          />
        </div>
      </header>

      {/* 1 · Hero: gambar iridescent jadi latar, konten mengapung di atasnya */}
      <section className="js-hero relative flex min-h-[100svh] flex-col justify-center overflow-hidden pb-20 pt-[calc(env(safe-area-inset-top,0px)+8rem)] md:pb-28 md:pt-40">
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
              threads={56}
              glow={0.7}
              brightness={1}
              vignette={0.4}
              particles={0}
              sparkle={0}
              mouseInteraction
              hoverEffect="part"
              pulseOnClick={false}
              paused={heroPaused}
            />
          </div>
          {/* Vignette + fade hitam — satu layer, bukan tiga, supaya komposit
              di atas canvas tiap frame lebih murah. */}
          <div className="hero-vignette absolute inset-0" />
        </div>

        <div className={`${HEADLINE} js-hero-copy relative isolate text-center`}>
          <div className="js-brand relative">
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
          {/* H1 dan paragraf hero sengaja tampil langsung (bukan opacity:0) agar LCP
              tidak tertahan animasi entrance. Gerak hanya transform. */}
          <h1 className={`${H1} js-hero-h1 relative mt-4`}>
            Hadirkan Kecerdasan AI ke dalam Bisnis Anda.
          </h1>
          <p className={`${BODY} mx-auto mt-5 max-w-[54ch]`}>
            Integrasikan AI ke aplikasi Anda dan bangun solusi digital baru berbasis AI. Dari AI
            integration hingga custom AI application development.
          </p>
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

        <div
          aria-hidden
          className="js-hero-cue pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/35">
            scroll
          </span>
          <span className="relative h-12 w-px overflow-hidden bg-white/10">
            <span className="hero-cue-run absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent via-white/70 to-transparent" />
          </span>
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

      {/* Jeda hitam + fade bertopeng antara hero dan Masalah.
          CSS murni (tanpa JS/opacity gate) supaya tidak menambah biaya LCP. */}
      <div aria-hidden className="relative h-[32vh] overflow-hidden bg-[#05060a] md:h-[40vh]">
        <div className="absolute inset-x-0 top-0 h-full bg-[linear-gradient(180deg,rgba(139,92,246,0.10),transparent_72%)] [mask-image:linear-gradient(180deg,black,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.22),transparent)]" />
      </div>

      {/* 3 · Masalah: cinematic, storytelling */}
      <section
        id="masalah"
        className="relative isolate scroll-mt-28 overflow-hidden border-b border-white/[0.06] bg-[#05060a] pb-32 pt-24 md:pb-48 md:pt-36"
      >
        {/* Latar sinematik: foto section + spotlight violet + fade tepi */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
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
            <p className={`${EYEBROW} js-masalah-eyebrow`}>Masalah</p>
            <h2 className={`${H2} mt-6`}>
              <Words text="Apakah Infrastruktur Bisnis Anda Siap Menghadapi" />{" "}
              <Accent text="Era AI?" />
              <AiSparkle className="ml-2 align-[-0.06em] text-[color:var(--spectral-violet)]" />
            </h2>
          </div>

          {/* Narasi */}
          <div className="mt-14">
            <div className="js-masalah-lines mx-auto max-w-[62ch] space-y-5 text-center text-[18px] leading-[1.75] text-white/60 md:text-[19px]">
              <p>
                Banyak bisnis menghadapi tantangan dalam mengelola operasional, informasi, dan
                integrasi sistem. Di tengah perkembangan industri, efisiensi dan otomatisasi menjadi
                kebutuhan utama.
              </p>
              <p className="text-white/80">
                <ShinyText
                  text="ITZ AI hadir sebagai solusi integrasi AI untuk bisnis."
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
                Kami membantu mengintegrasikan AI ke dalam sistem yang sudah ada maupun membangun
                aplikasi digital berbasis AI, menciptakan workflow yang lebih cerdas, efisien, dan
                adaptif.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · Apa yang bisa ITZ AI lakukan: 6 kapabilitas */}
      <section id="kenali" className={`${SHELL} scroll-mt-28 py-20 md:py-28`}>
        <div className="mx-auto max-w-[860px] text-center">
          <p className={EYEBROW}>Layanan</p>
          <h2 className={`${H2} mt-5`}>
            <Words text="Apa yang bisa ITZ AI" />{" "}
            <Accent text="lakukan." />
          </h2>
          <p className="mx-auto mt-5 max-w-[62ch] text-center text-[18px] leading-[1.75] text-white/60 md:text-[19px]">
            Layanan kami mencakup perancangan hingga penerapan solusi AI, mulai dari chatbot dan
            basis pengetahuan, otomasi proses bisnis, integrasi API, serta sistem multi-agen. Setiap
            layanan disesuaikan dengan kebutuhan dan kematangan sistem yang Anda miliki.
          </p>
        </div>
        <div className="js-layanan-pop mt-14">
          <AccordionGallery
            items={ACCORDION_ITEMS}
            defaultIndex={0}
            height={460}
            gap={10}
            radius={20}
            expandRatio={0.52}
            orientation="horizontal"
            trigger="hover"
            grayscale
            overlayColor="#05060a"
            accentColor="#a78bfa"
            parallax={0.5}
            tilt={8}
            duration={0.6}
            ease="power3.out"
          />
        </div>
      </section>

      {/* 5 · Cara Kerja: mekanisme alur empat tahap */}
      <section
        id="cara-kerja"
        className="relative isolate scroll-mt-28 overflow-hidden border-y border-white/[0.08] py-20 md:py-28"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="js-flow-bg absolute inset-0 opacity-25">
            <Image
              src="/landing/spectral-streaks.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,rgba(5,6,10,0.3),#05060a_78%)]" />
          <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,#05060a,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,#05060a,transparent)]" />
        </div>

        <div className={SHELL}>
          <div className="mx-auto max-w-[760px] text-center">
            <p className={EYEBROW}>Cara kerja</p>
            <h2 className={`${H2} mt-5`}>
              <Words text="Empat langkah," />{" "}
              <Accent text="satu alur." />
            </h2>
            <p className="mx-auto mt-5 max-w-[62ch] text-center text-[18px] leading-[1.75] text-white/60 md:text-[19px]">
              Proses yang sama untuk setiap pekerjaan. Tidak ada lompatan dari ide ke produksi.
            </p>
          </div>

          <div className="js-flow-panel g-dark g-sheen relative mt-12 overflow-hidden rounded-[26px] border-white/[0.12] p-3 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-2 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Flow mechanism
              </span>
              <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
                <span className="size-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />
                04 stages · intake ke live
              </span>
            </div>

            <ol className="js-nodes relative mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
              {FLOW.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.label}
                    className={`relative flex flex-1 flex-col lg:flex-row lg:items-stretch ${
                      i > 0
                        ? "pt-3 before:absolute before:left-1/2 before:top-0 before:h-3 before:w-px before:-translate-x-1/2 before:bg-white/15 lg:pt-0 lg:before:hidden"
                        : ""
                    }`}
                  >
                    <article className="js-node group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0b12]">
                      {/* Sorot aktif: warna/static, yang dianimasikan hanya opacity. */}
                      <span
                        aria-hidden
                        className="js-node-glow pointer-events-none absolute inset-0 rounded-2xl border border-violet-300/40 bg-violet-500/[0.08] opacity-0 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.16),inset_0_-28px_70px_-38px_rgba(139,92,246,0.65)]"
                      />
                      <div className="relative h-28 shrink-0 overflow-hidden">
                        <Image
                          src={step.img}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 24vw, 100vw"
                          className="object-cover opacity-50 saturate-[0.8] transition duration-700 group-hover:scale-[1.04] group-hover:opacity-80 group-hover:saturate-100"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.15),rgba(10,11,18,0.82)_72%,#0a0b12)]" />
                        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3">
                          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">
                            Stage {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded-full border border-white/[0.14] bg-black/35 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/55 backdrop-blur-sm">
                            {step.tag}
                          </span>
                        </div>
                        <Icon
                          className="absolute bottom-3 left-3 size-5 text-white/80"
                          strokeWidth={1.6}
                        />
                        <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/25" />
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-[15px] font-medium tracking-[-0.01em]">{step.label}</h3>
                        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-white/55">
                          {step.body}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3 font-mono text-[9px] uppercase tracking-[0.14em]">
                          <span className="text-white/35">
                            in · <span className="text-white/65">{step.input}</span>
                          </span>
                          <ArrowRight className="size-3 shrink-0 text-white/20" />
                          <span className="text-right text-violet-200/70">{step.output}</span>
                        </div>
                      </div>
                    </article>

                    {i < FLOW.length - 1 ? (
                      <span
                        aria-hidden
                        className="js-flow-link relative hidden w-9 shrink-0 items-center justify-center lg:flex"
                      >
                        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.12]" />
                        <span className="js-flow-fill absolute inset-x-0 top-1/2 h-px origin-left -translate-y-1/2 scale-x-0 bg-gradient-to-r from-violet-300/90 via-fuchsia-200/80 to-cyan-200/90" />
                        <span className="js-flow-packet absolute left-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-cyan-200 opacity-0 shadow-[0_0_12px_3px_rgba(103,232,249,0.6)]" />
                        <ArrowRight className="absolute right-0 top-1/2 size-3 -translate-y-1/2 text-white/25" />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-2 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              <span>intake → discovery → architecture → development → deployment</span>
              <span className="inline-flex items-center gap-1.5 text-white/45">
                <span className="size-1.5 rounded-full bg-emerald-300/80" />
                alur siap
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5b · Integrasi: heading terpusat + kaca kristal besar */}
      <section className={`${SHELL} py-20 md:py-28`}>
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className={H2}>
            <Words text="Integrasikan AI" />{" "}
            <Accent text="ke dalam Apps." />
          </h2>
          <p className="mx-auto mt-5 max-w-[62ch] text-center text-[18px] leading-[1.75] text-white/60 md:text-[19px]">
            Dari chat, dokumen, hingga pembayaran, integrasikan AI ke seluruh alat kerja Anda.
          </p>
        </div>
        <MagicBento
          items={INTEGRATIONS.map((item) => ({
            id: item.name,
            label: item.name,
            visual: item.logo ? (
              <span className="flex h-12 w-12 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.logo} alt="" className="h-12 w-12 object-contain" />
              </span>
            ) : (
              <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-lg border border-white/20 text-[15px] text-white/60"
              >
                {item.name.charAt(0)}
              </span>
            ),
          }))}
          columns={5}
          rowHeight={120}
          gap={8}
          radius={16}
          theme="dark"
          glowColor="#a78bfa"
          enableBorderGlow
          enableSpotlight
          spotlightRadius={260}
          enableStars={false}
          enableTilt={false}
          enableMagnetism={false}
          clickEffect
          intro={false}
          className="mx-auto mt-12 max-w-[1000px]"
        />
      </section>

      {/* 6 · Project Launch: proyek yang sudah jalan */}
      <section id="karya" className={`${SHELL} scroll-mt-28 py-20 md:py-28`}>
        <div className="mx-auto max-w-[760px] text-center">
          <p className={EYEBROW}>Project Launch</p>
          <h2 className={`${H2} mt-5`}>
            <Words text="Sistem yang sudah jalan," />{" "}
            <Accent text="lengkap dengan operasionalnya." />
          </h2>
        </div>
        <div className="js-reveal mt-12 space-y-4">
          {PROJECTS.map((project) => (
            <article
              key={project.name}
              className="js-project js-tilt g-frosted g-sheen g-float relative overflow-hidden rounded-[20px] p-6 md:p-8"
            >
              <div
                aria-hidden
                className="js-glare pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300"
                style={{
                  background:
                    "radial-gradient(460px circle at var(--gx,50%) var(--gy,50%),rgba(167,139,250,0.18),transparent 58%)",
                }}
              />
              <p className={`${EYEBROW} relative`}>{project.tag}</p>
              <h3 className="relative mt-3 text-[20px] font-medium tracking-[-0.01em]">
                {project.name}
              </h3>
              <p className="relative mt-3 max-w-[72ch] text-[15px] leading-[1.65] text-white/60">
                {project.body}
              </p>
              <p className="relative mt-5 border-t border-white/[0.07] pt-4 font-mono text-[12px] text-white/45">
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
            <Accent text="jawabannya." />
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
        <BorderGlow
          backgroundColor="#0a0b12"
          borderRadius={28}
          glowColor="262 90 70"
          colors={["#a78bfa", "#22d3ee", "#e879f9"]}
          glowIntensity={0.9}
          coneSpread={28}
          edgeSensitivity={40}
          className="overflow-hidden"
        >
          <div className="relative px-6 py-16 text-center md:px-16 md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 bottom-[-10rem] h-[20rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.32),rgba(34,211,238,0.14)_50%,transparent_72%)] blur-3xl"
            />
            <h2 className={`${H2} relative mx-auto max-w-[22ch]`}>
              <Words text="Siap mengotomasi yang" />{" "}
              <Accent text="berulang?" />
            </h2>
            <p className="relative mx-auto mt-5 max-w-[62ch] text-center text-[18px] leading-[1.75] text-white/60 md:text-[19px]">
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
              <Link href="/chat" prefetch={false} className={GHOST}>
                Coba demo
              </Link>
            </div>
            <p className="relative mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
              Tanpa komitmen · balasan dalam 1×24 jam · bukan sales call
            </p>
          </div>
        </BorderGlow>
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
                  <a href="#kenali" className="text-white/65 transition-colors hover:text-white">
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
                <Link href="/chat" prefetch={false} className="text-white/65 transition-colors hover:text-white">
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
              <a href={CONTACT} className="text-white/55 transition-colors hover:text-white">
                Mochammad Ginata Febryansyah
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
