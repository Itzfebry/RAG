"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Download, Copy, Check, FileText, LogIn } from "lucide-react";
import { fetchApi, apiErrorMessage } from "@/lib/fetch-api";
import type { BriefResult } from "@/lib/api-types";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  history: { role: "user" | "assistant"; content: string }[];
  /** Login terbukti saat ini. Unduh/salin brief hanya untuk pengguna login. */
  authenticated: boolean;
}

type Channel = "whatsapp" | "email" | "other";

const BRIEF_KEY = "itz_discovery_brief";

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  other: "Lainnya",
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "brief-proyek"
  );
}

/**
 * Penutup alur discovery: kontak diminta di sini (bukan di awal), lalu backend
 * merangkum transkrip menjadi brief terstruktur yang bisa diunduh.
 */
export default function BriefPanel({ open, onClose, sessionId, history, authenticated }: Props) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Login berpindah tab/halaman (router.push) memuat ulang komponen; brief yang
  // sudah dibuat dibaca lagi dari sessionStorage agar tidak hilang.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem(`${BRIEF_KEY}:${sessionId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as BriefResult;
        setResult((prev) => prev ?? parsed);
      }
    } catch {
      /* storage tidak wajib */
    }
  }, [open, sessionId]);

  if (!open) return null;

  const submit = async () => {
    if (loading) return;
    setError(null);
    if (name.trim().length < 2) return setError("Nama minimal 2 karakter.");
    if (contact.trim().length < 3) return setError("Isi kontak yang bisa kami hubungi.");
    if (history.length === 0) return setError("Belum ada percakapan untuk dirangkum.");

    setLoading(true);
    try {
      const data = await fetchApi<BriefResult>("/api/python/discovery/brief", {
        json: {
          session_id: sessionId,
          name: name.trim(),
          contact_channel: channel,
          contact_value: contact.trim(),
          history: history.slice(-40),
        },
      });
      setResult(data);
      try {
        sessionStorage.setItem(`${BRIEF_KEY}:${sessionId}`, JSON.stringify(data));
      } catch {
        /* storage penuh: brief tetap tampil di sesi ini */
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Gagal membuat brief. Coba lagi."));
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(result.brief.project_title)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Browser menolak akses clipboard. Unduh file sebagai gantinya.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
      <div className="g-dark my-auto w-full max-w-3xl rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-[22px] font-medium tracking-[-0.02em] text-white">
              {result ? "Brief proyek Anda siap" : "Simpan brief proyek"}
            </h2>
            <p className="mt-1 max-w-[58ch] text-[13.5px] leading-[1.6] text-white/50">
              {result
                ? "Ringkasan ini dibuat dari percakapan kita. Unduh atau salin untuk dibagikan ke tim Anda."
                : "Kami merangkum percakapan ini menjadi brief terstruktur: masalah, solusi, integrasi, estimasi kasar, dan langkah berikutnya."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {!result ? (
          <div className="mt-5 space-y-3.5">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                Nama / perusahaan
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda atau nama usaha"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[color:var(--spectral-violet)]/60 focus:outline-none"
              />
            </label>

            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                Dihubungi lewat
              </span>
              <div className="mt-1.5 flex gap-2">
                {(Object.keys(CHANNEL_LABEL) as Channel[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChannel(key)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                      channel === key
                        ? "border-[color:var(--spectral-violet)]/60 bg-[color:var(--spectral-violet)]/15 text-white"
                        : "border-white/10 text-white/55 hover:border-white/20 hover:text-white/80"
                    }`}
                  >
                    {CHANNEL_LABEL[key]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                {channel === "email"
                  ? "Alamat email"
                  : channel === "whatsapp"
                    ? "Nomor WhatsApp"
                    : "Kontak"}
              </span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={channel === "email" ? "nama@perusahaan.com" : "+62 812 3456 7890"}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-[color:var(--spectral-violet)]/60 focus:outline-none"
              />
            </label>

            <p className="text-[12px] leading-[1.6] text-white/35">
              Kontak hanya dipakai tim ITZ untuk menindaklanjuti brief ini. Tidak ada email massal.
            </p>

            {error && (
              <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#fafafa] px-5 text-[14px] font-medium text-[#05060a] transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {loading ? "Menyusun brief…" : "Buat brief proyek"}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            {authenticated ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#fafafa] px-4 text-[13px] font-medium text-[#05060a] transition-transform hover:scale-[1.02]"
                >
                  <Download className="size-4" />
                  Unduh .md
                </button>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] text-white/80 transition-colors hover:border-white/25 hover:text-white"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-300" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Tersalin" : "Salin teks"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto inline-flex h-10 items-center rounded-full px-3 text-[13px] text-white/50 transition-colors hover:text-white"
                >
                  Kembali ke percakapan
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="text-[13px] leading-[1.55] text-white/60">
                  Brief sudah siap. Login untuk mengunduh atau menyalinnya.
                </p>
                <Link
                  href="/login"
                  className="inline-flex size-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogIn className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded-full px-3 text-[13px] text-white/50 transition-colors hover:text-white"
                >
                  Kembali
                </button>
              </div>
            )}

            {authenticated && (
              <div className="mt-4 max-h-[52vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-black/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-white/75">
                  {result.markdown}
                </pre>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
