"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Compass,
  FileText,
  Loader2,
  LogIn,
  MessageSquareQuote,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import StarBorder from "@/components/StarBorder";
import Markdown from "@/components/chat/markdown";
import BriefPanel from "@/components/discovery/BriefPanel";
import BusinessIntelligencePanel from "@/components/discovery/BusinessIntelligencePanel";
import { aiStatus } from "@/lib/ai-status";
import { apiErrorMessage, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/fetch-api";
import type { DiscoveryConfig, DiscoveryContextResult, DiscoveryState } from "@/lib/api-types";

/* ── Konstanta & util ─────────────────────────────────────────────────── */

const MAX_HISTORY_MESSAGES = 20;
const SESSION_KEY = "itz_discovery_session";
const MESSAGES_KEY = "itz_discovery_messages";
const STATE_KEY = "itz_discovery_state";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  /** Tahap pemrosesan dari backend (nama event internal, lihat lib/ai-status). */
  statusKey?: string;
}

const STARTERS = [
  "Saya punya tiga cabang laundry dan admin kewalahan menjawab pelanggan.",
  "Toko online saya masih rekap pesanan manual di spreadsheet.",
  "Saya ingin tahu bagian operasional mana yang paling layak diotomasi.",
  "Butuh sistem untuk tim lapangan yang sering bekerja di luar kantor.",
];

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    // Backend mensyaratkan 8-64 karakter [A-Za-z0-9_-].
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/* ── Halaman ──────────────────────────────────────────────────────────── */

export default function DiscoveryPage() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const stateRef = useRef<DiscoveryState | null>(null);
  const turnCountRef = useRef(0);
  const extractedTurnRef = useRef(-1);

  /* Init: sesi + riwayat sesi browser. */
  useEffect(() => {
    const sid = readSessionId();
    setSessionId(sid);
    try {
      const raw = sessionStorage.getItem(MESSAGES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* storage tidak wajib */
    }
  }, []);

  const loadConfig = useCallback(async (sid: string) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/python/discovery/config?session_id=${encodeURIComponent(sid)}`);
      if (!res.ok) return;
      setConfig((await res.json()) as DiscoveryConfig);
    } catch {
      /* konfigurasi opsional: UI tetap jalan dengan nilai default */
    }
  }, []);

  useEffect(() => {
    void loadConfig(sessionId);
  }, [sessionId, loadConfig]);

  /* Persist ringan supaya refresh tidak menghapus percakapan. */
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* kuota storage penuh: abaikan */
    }
  }, [messages]);

  // Ref agar ekstraksi konteks membaca pesan terbaru tanpa dependency churn.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    stateRef.current = discoveryState;
  }, [discoveryState]);

  /* State BI disimpan per sesi: pulih saat refresh, hapus saat sesi baru. */
  useEffect(() => {
    if (!sessionId) return;
    try {
      const raw = sessionStorage.getItem(`${STATE_KEY}:${sessionId}`);
      setDiscoveryState(raw ? (JSON.parse(raw) as DiscoveryState) : null);
    } catch {
      setDiscoveryState(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !discoveryState) return;
    try {
      sessionStorage.setItem(`${STATE_KEY}:${sessionId}`, JSON.stringify(discoveryState));
    } catch {
      /* kuota storage penuh: abaikan */
    }
  }, [discoveryState, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const remaining = config?.remaining_turns;
  const maxTurns = config?.max_turns ?? 10;
  const authed = config?.authenticated ?? false;
  const usedTurns =
    remaining === null || remaining === undefined ? null : Math.max(0, maxTurns - remaining);
  const outOfTurns = remaining !== null && remaining !== undefined && remaining <= 0;

  const history = useMemo(
    () =>
      messages.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  /* Ekstraksi konteks bisnis: satu panggilan model, dipanggil berkala. */
  const extractContext = useCallback(async () => {
    if (!sessionId) return;
    const hist = messagesRef.current
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-20);
    if (hist.length < 2) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/python/discovery/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, history: hist, previous: stateRef.current }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as DiscoveryContextResult;
      if (data?.state) setDiscoveryState(data.state);
    } catch {
      /* insight best-effort: percakapan tetap jalan */
    } finally {
      setInsightLoading(false);
    }
  }, [sessionId]);

  // Turn pertama langsung, lalu tiap 2 turn. Hindari satu LLM call per pesan.
  useEffect(() => {
    if (loading || !sessionId) return;
    const turn = turnCountRef.current;
    if (turn === 0 || extractedTurnRef.current === turn) return;
    if (!(turn === 1 || turn % 2 === 0)) return;
    extractedTurnRef.current = turn;
    void extractContext();
  }, [loading, sessionId, extractContext]);

  /* ── Kirim pesan (SSE) ─────────────────────────────────────────────── */

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    if (outOfTurns) {
      setError("Sesi discovery ini sudah mencapai batas pesan. Mulai sesi baru untuk melanjutkan.");
      return;
    }

    turnCountRef.current += 1;
    setError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: newId(), role: "user", content: text };
    const assistantMsg: Message = { id: newId(), role: "assistant", content: "" };
    const base = [...messages, userMsg];
    setMessages([...base, assistantMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patchAssistant = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, ...patch } : m)));

    try {
      const res = await fetch("/api/python/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: [...messages]
            .slice(-MAX_HISTORY_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content })),
          mode: "discovery",
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = (j.detail || j.message || "") as string;
        } catch {
          /* body bukan JSON (mis. proxy gagal): pakai pesan ramah */
        }
        throw new Error(
          detail ||
            (res.status >= 500 ? SERVER_UNAVAILABLE_MESSAGE : `Permintaan gagal (${res.status}).`),
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Koneksi streaming tidak tersedia.");
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";

      const handleFrame = (line: string) => {
        if (!line.startsWith("data: ")) return false;
        const s = line.slice(6).trim();
        if (s === "[DONE]") return true;
        try {
          const p = JSON.parse(s);
          if (typeof p.status === "string" && p.status) patchAssistant({ statusKey: p.status });
          if (Array.isArray(p.suggestions) && p.suggestions.length)
            patchAssistant({ suggestions: p.suggestions as string[] });
          if (typeof p.content === "string" && p.content) {
            acc += p.content;
            patchAssistant({ content: acc });
          }
          if (p.error) setError(String(p.error));
        } catch {
          /* frame tidak lengkap: diabaikan, akan diulang di buffer berikut */
        }
        return false;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (handleFrame(line)) return;
        }
      }
      if (buf && handleFrame(buf)) return;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(apiErrorMessage(e, "Gagal mengirim pesan. Coba lagi."));
        patchAssistant({ content: "" });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      // Buang balon asisten kosong bila gagal total.
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantMsg.id && !m.content)),
      );
      void loadConfig(sessionId);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    turnCountRef.current = 0;
    extractedTurnRef.current = -1;
    setDiscoveryState(null);
    try {
      sessionStorage.removeItem(MESSAGES_KEY);
      if (sessionId) sessionStorage.removeItem(`${STATE_KEY}:${sessionId}`);
      const fresh =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, fresh);
      setSessionId(fresh);
    } catch {
      setSessionId(newId());
    }
  };

  /* ── Render ────────────────────────────────────────────────────────── */

  const canBrief = history.some((m) => m.role === "assistant" && m.content.trim().length > 0);

  return (
    <div className="obsidian-field min-h-full font-sans text-[#f7f8f8]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#05060a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="itz-shine bg-gradient-to-r from-white via-white/50 to-white bg-clip-text text-[15px] font-semibold tracking-tight text-transparent"
          >
            ITZ AI
          </Link>
          <span className="rounded-full border border-white/12 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/55">
            Discovery
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 sm:inline">
              {usedTurns === null ? `${maxTurns} pesan / sesi` : `${usedTurns}/${maxTurns} pesan`}
            </span>
            <button
              type="button"
              onClick={reset}
              title="Mulai sesi baru"
              className="inline-flex size-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBriefOpen(true)}
              disabled={!canBrief}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#fafafa] px-3.5 text-[12.5px] font-medium text-[#05060a] transition-transform hover:scale-[1.03] disabled:opacity-40"
            >
              <FileText className="size-3.5" />
              Brief
            </button>
            {!authed && (
              <StarBorder
                as="a"
                href="/login"
                title="Login untuk mengunduh brief"
                color="#ffffff"
                trailColor="#ffffff"
                backgroundColor="rgba(255,255,255,0.12)"
                textColor="#ffffff"
                borderColor="rgba(255,255,255,0.3)"
                duration={6}
                thickness={1}
                radius={999}
                glow={0.55}
                className="h-9 gap-1.5! px-4! py-0! text-[12.5px] backdrop-blur-md transition-transform hover:scale-[1.04]"
              >
                <LogIn className="size-3.5" aria-hidden />
                Login
              </StarBorder>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-10 pt-6 sm:px-6">
        {/* Kolom percakapan */}
        <main className="flex min-h-[calc(100dvh-7rem)] min-w-0 flex-1 flex-col">
          {messages.length === 0 ? (
            <section className="mx-auto max-w-[66ch] pt-6 sm:pt-12">
              <h1 className="text-balance font-heading text-[clamp(1.6rem,4vw,2.5rem)] font-medium leading-[1.15] tracking-[-0.03em]">
                Ceritakan bisnis Anda. Kami bantu petakan masalah dan menemukan solusi yang tepat.
              </h1>
              <p className="mt-3 max-w-[58ch] text-[14.5px] leading-[1.7] text-white/55">
                Kami akan terlebih dahulu memahami operasional, tantangan, dan target bisnis Anda.
                Berdasarkan hasil analisis, kami akan merekomendasikan solusi yang paling relevan,
                baik berupa perbaikan proses, pengembangan aplikasi, maupun penerapan AI.
              </p>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="group flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-colors hover:border-[color:var(--spectral-violet)]/40 hover:bg-white/[0.04]"
                  >
                    <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-[color:var(--spectral-violet)]/70" />
                    <span className="text-[13px] leading-[1.55] text-white/70 group-hover:text-white/90">
                      {s}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3" /> tanpa akun
                </span>
                <span>{maxTurns} pesan per sesi</span>
              </div>
            </section>
          ) : (
            <div className="space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md border border-[color:var(--spectral-violet)]/25 bg-[color:var(--spectral-violet)]/10 px-4 py-2.5 text-[14px] leading-[1.6] text-white/90">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="max-w-[76ch]">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                        ITZ
                      </span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/35">
                        Konsultan
                      </span>
                    </div>
                    {m.content ? (
                      <div className="prose-itz text-[14px] leading-[1.75] text-white/80">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5 py-1">
                        <div className="flex items-center gap-2 text-[13px] text-white/70">
                          <Loader2 className="size-3.5 animate-spin text-white/40" />
                          {aiStatus(m.statusKey).label}
                        </div>
                        {aiStatus(m.statusKey).description && (
                          <span className="pl-[22px] text-[11.5px] leading-[1.5] text-white/35">
                            {aiStatus(m.statusKey).description}
                          </span>
                        )}
                      </div>
                    )}
                    {m.suggestions && m.suggestions.length > 0 && !loading && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.suggestions.slice(0, 3).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void send(s)}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/55 transition-colors hover:border-white/25 hover:text-white/85"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Composer: menempel di bawah kolom percakapan, tetap terlihat saat
              riwayat panjang (sticky) maupun saat halaman masih kosong. */}
          <div className="sticky bottom-0 z-20 mt-auto pt-4">
            <div className="bg-[#05060a]/90 pb-1 backdrop-blur-md">
              {/* Toolbar mobile: aksi yang tidak tersedia di sidebar kecil. */}
              <div className="mb-2 flex gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setInsightOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--spectral-violet)]/40 bg-[color:var(--spectral-violet)]/10 px-3 text-[12px] text-white/80"
                >
                  <Compass className="size-3.5" />
                  Insight
                </button>
                {outOfTurns && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[12px] text-white/70"
                  >
                    <RotateCcw className="size-3.5" />
                    Sesi baru
                  </button>
                )}
              </div>
              {error && (
                <p className="mb-2 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[12.5px] text-red-200">
                  {error}
                </p>
              )}
              <div className="g-dark flex items-end gap-2 rounded-2xl p-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={
                    outOfTurns
                      ? "Batas sesi tercapai. Mulai sesi baru atau buat brief."
                      : "Ceritakan kebutuhan atau masalah bisnis Anda..."
                  }
                  disabled={outOfTurns}
                  className="max-h-[160px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] leading-[1.55] text-white placeholder:text-white/30 focus:outline-none disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim() || outOfTurns}
                  aria-label="Kirim"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#fafafa] text-[#05060a] transition-transform hover:scale-[1.04] disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10.5px] text-white/25">
                Jawaban bisa keliru. Estimasi bersifat kasar, bukan penawaran resmi.
              </p>
            </div>
          </div>
        </main>

        {/* Sidebar desktop */}
        <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-[300px] shrink-0 self-start space-y-3 overflow-y-auto lg:block">
          <BusinessIntelligencePanel
            state={discoveryState}
            loading={insightLoading}
            onChange={setDiscoveryState}
          />

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                Sisa sesi
              </span>
              <span className="font-mono text-[11px] text-white/70">
                {remaining === null || remaining === undefined ? maxTurns : remaining}
                <span className="text-white/30">/{maxTurns}</span>
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--spectral-cyan),var(--spectral-violet))] transition-[width]"
                style={{
                  width: `${usedTurns === null ? 0 : Math.min(100, (usedTurns / maxTurns) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.55] text-white/35">
              Cukup untuk memetakan kebutuhan. Brief bisa dibuat kapan saja.
            </p>
          </section>

          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setBriefOpen(true)}
              disabled={!canBrief}
              className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition-colors hover:border-[color:var(--spectral-violet)]/35 hover:bg-white/[0.04] disabled:opacity-40"
            >
              <FileText className="size-4 shrink-0 text-[color:var(--spectral-violet)]" />
              <span>
                <span className="block text-[12.5px] text-white/80">Brief proyek</span>
                <span className="block text-[11px] leading-[1.5] text-white/40">
                  Rangkum percakapan jadi dokumen terstruktur.
                </span>
              </span>
            </button>
            {!authed && (
              <Link
                href="/login"
                title="Login untuk mengunduh brief"
                className="inline-flex size-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogIn className="size-3.5" />
              </Link>
            )}
          </div>
        </aside>
      </div>

      {/* Drawer insight bisnis di layar kecil (sidebar desktop hidden). */}
      {insightOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup insight"
            onClick={() => setInsightOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(360px,90vw)] flex-col border-l border-white/10 bg-[#0a0b12]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <span className="text-[13px] font-medium text-white/85">Insight bisnis</span>
              <button
                type="button"
                onClick={() => setInsightOpen(false)}
                aria-label="Tutup"
                className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <BusinessIntelligencePanel
                state={discoveryState}
                loading={insightLoading}
                onChange={setDiscoveryState}
              />
            </div>
          </div>
        </div>
      )}

      <BriefPanel
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        sessionId={sessionId}
        history={history}
        authenticated={authed}
      />
    </div>
  );
}
