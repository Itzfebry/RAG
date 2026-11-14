import type { Metadata } from "next";
import Landing from "@/components/landing/landing";

// Halaman server tipis: metadata tetap di sini, seluruh animasi GSAP ada di komponen klien.
export const metadata: Metadata = {
  title: { absolute: "ITZ AI — Solusi & Integrasi AI untuk Sistem Anda" },
  description:
    "Jasa merancang, membangun, dan mengoperasikan sistem AI yang menempel ke sistem Anda: chatbot berbasis data sendiri, otomasi alur kerja, sampai orchestrator multi-agen.",
};

export default function RootPage() {
  return <Landing />;
}
