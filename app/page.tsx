"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AIChatInput } from "@/components/ui/ai-chat-input";
import OrbitalSphereBackground from "@/components/ui/orbital-sphere";

interface Message {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
}

const SUGGESTION_POOL = [
  "Ringkas knowledge base saya",
  "Buatkan outline artikel futuristik",
  "Jelaskan RAG dengan contoh sederhana",
  "Apa saja yang kamu tahu tentang saya?",
  "Bantu saya brainstorm ide konten",
  "Review arsitektur proyek saya",
  "Buatkan prompt untuk use case saya",
  "Ringkas poin penting minggu ini",
  "Jelaskan konsep AI agent secara sederhana",
  "Saran cara improve workflow kerja saya",
];

function pickSuggestions(): string[] {
  const shuffled = [...SUGGESTION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ username: string; display_name?: string | null; max_prompts: number; prompts_used: number; remaining: number | null } | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ trial_prompts: number; used: number; remaining: number; allowed: boolean } | null>(null);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  // Mulai kosong — diisi setelah mount saja. Math.random() di initializer
  // bikin hydration mismatch (server & client dapat set berbeda).
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!infoOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!infoRef.current?.contains(e.target as Node)) setInfoOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInfoOpen(false); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [infoOpen]);
  const refreshSuggestions = useCallback(async () => {
    try {
      const r = await fetch("/api/python/suggestions?limit=3");
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.suggestions) && j.suggestions.length) setSuggestions(j.suggestions);
      }
    } catch {}
  }, []);
  useEffect(() => {
    setSuggestions(pickSuggestions());
    refreshSuggestions();
  }, [refreshSuggestions]);
  const quotaRem = userInfo ? userInfo.remaining : trialInfo ? trialInfo.remaining : null;
  const remStatus =
    quotaRem === null
      ? { label: "Tanpa batas", color: "text-emerald-400" }
      : quotaRem > 0
        ? { label: "Aktif", color: "text-emerald-400" }
        : { label: "Habis", color: "text-red-400" };
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0;
  const startedAtRef = useRef<number>(0);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    fetch("/api/python/user/me")
      .then(async (r) => {
        if (r.ok) { const j = await r.json(); setUserInfo(j); return; }
        // guest -> fetch trial info
        const t = await fetch("/api/python/trial").then((x) => x.json()).catch(() => null);
        if (t) setTrialInfo(t);
      })
      .catch(async () => {
        const t = await fetch("/api/python/trial").then((x) => x.json()).catch(() => null);
        if (t) setTrialInfo(t);
      });
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 120);
    return () => window.clearInterval(id);
  }, [isLoading]);
  const elapsedMs = isLoading && startedAtRef.current ? nowTick - startedAtRef.current : 0;

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    if (!nearBottom && messages.length > 1) return;
    endRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);
    const next: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(next);
    const started = Date.now();
    startedAtRef.current = started;
    setNowTick(started);
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/python/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: next.slice(0, -1) }),
      });
      if (!res.ok) {
        let msg = `Server ${res.status}`;
        try { const j = await res.json(); msg = (j.detail || j.message || msg) as string; } catch {}
        if (msg.includes("Trial habis") || msg.includes("Trial")) {
          setQuotaAlert(msg + " — ");
          // refresh trial info
          fetch("/api/python/trial").then((x) => x.json()).then(setTrialInfo).catch(() => {});
          throw new Error(msg);
        }
        if (res.status === 403 && msg.includes("Batas prompt habis")) { setQuotaAlert(msg); throw new Error(msg); }
        if (res.status === 401 && msg.includes("Login diperlukan")) { setQuotaAlert(msg); throw new Error(msg); }
        throw new Error(msg);
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const s = line.replace("data: ", "").trim();
          if (s === "[DONE]") break;
          try {
            const p = JSON.parse(s);
            if (p.content) {
              acc += p.content;
              setMessages((prev) => {
                const u = [...prev];
                u[u.length - 1] = { role: "assistant", content: acc };
                return u;
              });
            }
            if (p.error) { if (String(p.error).includes("Batas prompt")) setQuotaAlert(String(p.error)); setError(p.error); }
          } catch {}
        }
      }
      if (userInfo) fetch("/api/python/user/me").then(async (r) => { if (r.ok) { const j = await r.json(); setUserInfo(j); if (j.remaining === 0) setQuotaAlert("Batas prompt habis — hubungi admin untuk menambah kuota"); } }).catch(() => {});
      else fetch("/api/python/trial").then((x) => x.json()).then(setTrialInfo).catch(() => {});
      const dur = Date.now() - started;
      setMessages((prev) => {
        const u = [...prev];
        const last = u[u.length - 1];
        if (last?.role === "assistant") u[u.length - 1] = { ...last, durationMs: dur };
        return u;
      });
    } catch (e: any) {
      const m = e.message || "Gagal terhubung ke backend.";
      if (m.includes("Batas prompt habis")) setQuotaAlert(m);
      setError(m);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      startedAtRef.current = 0;
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#101015] text-zinc-100 antialiased selection:bg-white/10">
      {/* Orbital sphere background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <OrbitalSphereBackground 
          particleCount={1800}
          particleSize={1.8}
          orbitRadius={3.2}
          ringCount={3}
          rotationSpeed={0.08}
          cameraDistance={9}
          nodeCount={10}
          nodeSize={5}
          hue={0}
        />
      </div>

      {/* aurora overlay — subtle gradient on top */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-[860px]"
        style={{
          background: `
            radial-gradient(1100px 580px at 18% -8%, rgba(56,189,248,0.08), transparent 68%),
            radial-gradient(980px 550px at 78% -10%, rgba(124,92,255,0.09), transparent 70%),
            radial-gradient(820px 480px at 50% -10%, rgba(52,211,153,0.045), transparent 72%),
            linear-gradient(to bottom, rgba(8,8,10,0.3) 0%, rgba(8,8,10,0.5) 16%, rgba(8,8,10,0.7) 36%, rgba(8,8,10,0.85) 66%)
          `,
          maskImage: "linear-gradient(to bottom, black 0%, black 24%, rgba(0,0,0,0.8) 46%, rgba(0,0,0,0.95) 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 24%, rgba(0,0,0,0.8) 46%, rgba(0,0,0,0.95) 78%)",
        }}
      />
      {/* particles — subtle accents */}
      <div aria-hidden className="itz-particles z-[1]">
        <span className="itz-dot" style={{ left: "14%", top: "10%", width: 4, height: 4, color: "rgba(56,189,248,0.7)", animationDelay: "0s", ["--dur" as any]: "5s" }} />
        <span className="itz-dot" style={{ left: "68%", top: "12%", width: 5, height: 5, color: "rgba(56,189,248,0.6)", animationDelay: "1.1s", ["--dur" as any]: "5.5s" }} />
        <span className="itz-dot" style={{ left: "28%", top: "26%", width: 3, height: 3, color: "rgba(124,92,255,0.65)", animationDelay: "1.6s", ["--dur" as any]: "4.8s" }} />
        <span className="itz-dot" style={{ left: "74%", top: "38%", width: 4, height: 4, color: "rgba(124,92,255,0.6)", animationDelay: "1.3s", ["--dur" as any]: "5.2s" }} />
      </div>

      <header className="relative z-30 flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[rgba(14,14,19,0.13)] px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(14,14,19,0.13)] sm:px-6">
        <div className="flex items-center gap-3">
          <div className="itz-logo itz-logo-sheen relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white/[0.12] bg-zinc-900 shadow-lg">
            <Image src="/image/favicon.png" alt="ITZ" width={36} height={36} className="h-full w-full object-cover" priority />
          </div>
          <span className="itz-brand text-[15.5px] font-semibold tracking-[0.14em]">ITZ AI</span>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const rem = userInfo ? userInfo.remaining : trialInfo ? trialInfo.remaining : null;
            return (
              <span className="mr-2 hidden items-center gap-2 sm:flex" title={rem === null ? "Kuota tanpa batas" : `Sisa ${rem} prompt`}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[12.5px] tracking-tight text-zinc-200">
                  {userInfo ? (userInfo.display_name || userInfo.username) : trialInfo ? "TRIAL" : "GUEST"}
                  <span className="text-zinc-500"> · {rem === null ? "∞" : `${rem} sisa`}</span>
                </span>
              </span>
            );
          })()}
          <div className="relative" ref={infoRef}>
            <button
              onClick={() => setInfoOpen((v) => !v)}
              title="Informasi kuota"
              aria-label="Informasi kuota"
              aria-expanded={infoOpen}
              className="flex items-center rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </button>
            {infoOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#16161c] shadow-[0_16px_48px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">Info Kuota</span>
                  <span className="relative flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 bg-emerald-400" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                </div>
                <div className="px-4 py-3.5">
                  <p className="font-mono text-[14px] font-medium tracking-tight text-zinc-100">
                    {userInfo ? (userInfo.display_name || userInfo.username) : trialInfo ? "Pengunjung Trial" : "Tamu"}
                  </p>
                  <p className="mt-1 text-[11.5px] text-zinc-400">
                    Status prompt:{" "}
                    <span className={remStatus.color}>{remStatus.label}</span>
                  </p>
                  <div className="mt-3.5 border-t border-white/[0.07] pt-3.5">
                    <p className="text-[11.5px] leading-5 text-zinc-400">Sisa kuota anda sekarang</p>
                    <p className="mt-1 font-mono text-[26px] font-semibold leading-none tracking-tight text-zinc-50">
                      {quotaRem === null ? "∞" : quotaRem}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={() => { setMessages([]); setError(null); setQuotaAlert(null); setSuggestions(pickSuggestions()); refreshSuggestions(); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span className="hidden sm:inline">New Chat</span>
          </button>
          {userInfo ? (
            <button onClick={async () => { try { await fetch("/api/python/user/logout", { method: "POST" }); } catch {} window.location.href = "/login"; }} title="Keluar" aria-label="Keluar" className="flex items-center rounded-lg px-2.5 py-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          ) : (
            <a href="/login" className="ml-1 rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition-colors hover:bg-zinc-200">Login</a>
          )}
        </div>
      </header>

      {quotaAlert && (
        <div className="relative z-20 mx-auto w-full max-w-[720px] px-4 pt-3 sm:px-6">
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[13px] leading-5 text-amber-200">
            <span className="mt-0.5">⚠</span><span className="flex-1">{quotaAlert} <a href="/login" className="underline underline-offset-2">Login</a> atau hubungi admin.</span>
            <button onClick={() => setQuotaAlert(null)} className="shrink-0 rounded-md px-2 py-1 text-amber-300 hover:bg-white/10">Tutup</button>
          </div>
        </div>
      )}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-12 sm:py-20">
            <div className="flex w-full max-w-[720px] flex-col items-center">
              <div className="itz-logo itz-logo-sheen mb-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/[0.15] bg-zinc-900 shadow-[0_0_48px_rgba(56,189,248,0.2),0_0_96px_rgba(124,92,255,0.12)]">
                <Image src="/image/favicon.png" alt="ITZ" width={64} height={64} className="h-full w-full object-cover" />
              </div>

              <h1 className="text-center text-[36px] font-bold leading-[1.08] tracking-[-0.048em] text-zinc-50 sm:text-[44px]">
                Tanyakan apa saja.
              </h1>
              <p className="mt-4 text-center text-[16.5px] font-[450] leading-[1.45] tracking-[-0.016em] text-zinc-400">
                ITZ AI memahami konteksmu.
              </p>
              <p className="mt-2.5 text-center text-[13px] leading-5 tracking-wide text-zinc-600">
                Private intelligence for your knowledge
              </p>

              <div className="mt-12 w-full">
                <div className="mb-5 flex flex-wrap justify-center gap-2.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 py-2.5 text-[13px] font-medium leading-none tracking-wide text-zinc-400 shadow-sm transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.09] hover:text-zinc-200 hover:scale-105 active:scale-95 focus-visible:outline-offset-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <AIChatInput value={input} onChange={setInput} onSubmit={handleSend} isLoading={isLoading} />
              </div>

              <p suppressHydrationWarning className="mt-8 text-center text-[11px] tracking-[0.06em] text-zinc-600">
                © {new Date().getFullYear()} Mochammad Ginata Febryansyah
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[800px] px-4 py-8 sm:px-6 sm:py-10">
                <div className="mx-auto flex max-w-[720px] flex-col gap-8">
                  {messages.map((m, i) => {
                    const streaming = isLoading && i === messages.length - 1 && m.role === "assistant";
                    return (
                      <MessageBubble
                        key={i}
                        role={m.role}
                        content={m.content}
                        isStreaming={streaming}
                        durationMs={streaming && !m.durationMs ? elapsedMs : m.durationMs}
                      />
                    );
                  })}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.10] px-4 py-3.5 text-[13.5px] leading-6 text-red-200 shadow-lg">
                      {error}
                    </div>
                  )}
                  <div ref={endRef} className="h-1" />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/[0.08] bg-[rgba(5,3,10,0.85)] backdrop-blur-xl">
              <div className="mx-auto w-full max-w-[800px] px-4 pb-5 pt-4 sm:px-6">
                <div className="mx-auto max-w-[720px]">
                  <AIChatInput value={input} onChange={setInput} onSubmit={handleSend} isLoading={isLoading} />
                  <p suppressHydrationWarning className="mt-3 text-center text-[11px] tracking-[0.06em] text-zinc-600">© {new Date().getFullYear()} Mochammad Ginata Febryansyah</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
