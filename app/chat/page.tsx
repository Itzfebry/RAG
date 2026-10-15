"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AIChatInput } from "@/components/ui/ai-chat-input";
import QuotaOfferModal, { QuotaOfferVariant } from "@/components/chat/QuotaOfferModal";
import QuotaNotice from "@/components/chat/QuotaNotice";
import ChatHistoryPanel, { ChatSummary } from "@/components/chat/ChatHistoryPanel";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
}

const MAX_HISTORY_MESSAGES = 20;

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
  const [userInfo, setUserInfo] = useState<{ username: string; display_name?: string | null; max_prompts: number; prompts_used: number; remaining: number | null; has_password?: boolean; goal?: string; style_id?: string; gender?: string } | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ trial_prompts: number; used: number; remaining: number; allowed: boolean } | null>(null);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  const [quotaOffer, setQuotaOffer] = useState<QuotaOfferVariant | null>(null);
  // Notice inline bergaya GPT: aktif saat kuota habis, sampai user tutup.
  const [quotaOut, setQuotaOut] = useState<QuotaOfferVariant | null>(null);
  const [quotaNoticeHidden, setQuotaNoticeHidden] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Modal profil user: ganti nama, tujuan pakai AI, pilih gaya respons (template admin)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileGoal, setProfileGoal] = useState("");
  const [profileStyle, setProfileStyle] = useState("");
  const [profileGender, setProfileGender] = useState("");
  const [styleOptions, setStyleOptions] = useState<{ id: string; name: string; description: string; prompt: string }[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  // Riwayat chat tersimpan (hanya user login). Trial/tamu tetap state lokal.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatList, setChatList] = useState<ChatSummary[]>([]);
  const [chatLimit, setChatLimit] = useState(3);
  const [chatRetention, setChatRetention] = useState(7);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  useEffect(() => {
    if (quotaOffer === "quota" || quotaOffer === "trial") {
      setQuotaOut(quotaOffer);
      setQuotaNoticeHidden(false);
    }
  }, [quotaOffer]);
  // Modal penawaran kuota untuk pesan habis/trial/login; pesan lain tetap toast.
  const openQuotaOffer = useCallback((msg: string) => {
    if (msg.includes("Trial")) setQuotaOffer("trial");
    else if (msg.includes("Batas prompt habis")) setQuotaOffer("quota");
    else if (msg.includes("Login diperlukan")) setQuotaOffer("login");
    else setQuotaAlert(msg);
  }, []);
  // Mulai kosong - diisi setelah mount saja. Math.random() di initializer
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
        if (r.ok) {
          const j = await r.json();
          setUserInfo(j);
          // sapaan selamat datang setelah login (flag dari /login atau ?welcome=1 dari OAuth Google)
          try {
            const flagged = sessionStorage.getItem("itz_welcome") === "1";
            const qp = new URLSearchParams(window.location.search).has("welcome");
            if (flagged || qp) {
              sessionStorage.removeItem("itz_welcome");
              if (qp) window.history.replaceState({}, "", window.location.pathname);
              if (j.display_name) setWelcomeName(j.display_name);
            }
          } catch {}
          return;
        }
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
    if (!welcomeName) return;
    const id = window.setTimeout(() => setWelcomeName(null), 5000);
    return () => window.clearTimeout(id);
  }, [welcomeName]);

  useEffect(() => {
    if (!isLoading) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 120);
    return () => window.clearInterval(id);
  }, [isLoading]);
  const elapsedMs = isLoading && startedAtRef.current ? nowTick - startedAtRef.current : 0;

  const doLogout = async () => {
    setConfirmLogout(false);
    try { await fetch("/api/python/user/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  };

  const loadChatList = useCallback(async () => {
    try {
      const r = await fetch("/api/python/user/chats");
      if (!r.ok) return;
      const j = await r.json();
      setChatList(j.items || []);
      if (typeof j.limit === "number") setChatLimit(j.limit);
      if (typeof j.retention_days === "number") setChatRetention(j.retention_days);
    } catch {}
  }, []);

  useEffect(() => {
    if (userInfo) loadChatList();
  }, [userInfo, loadChatList]);

  const openChat = async (id: string) => {
    if (isLoading) return;
    try {
      const r = await fetch(`/api/python/user/chats/${id}`);
      if (!r.ok) { setError("Chat tidak ditemukan"); return; }
      const j = await r.json();
      setMessages((j.messages || []).map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content })));
      setActiveChatId(id);
      setError(null);
      setHistoryOpen(false);
    } catch {
      setError("Gagal membuka chat");
    }
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm("Hapus chat ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const r = await fetch(`/api/python/user/chats/${id}`, { method: "DELETE" });
      if (!r.ok) { setError("Gagal menghapus chat"); return; }
      if (activeChatId === id) { setActiveChatId(null); setMessages([]); }
      await loadChatList();
    } catch {
      setError("Gagal menghapus chat");
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setError(null);
    setQuotaAlert(null);
    setHistoryOpen(false);
  };

  const openProfile = useCallback(() => {
    if (!userInfo) return;
    setProfileName(userInfo.display_name || "");
    setProfileGoal(userInfo.goal || "");
    setProfileStyle(userInfo.style_id || "");
    setProfileGender(userInfo.gender || "");
    setProfileMsg(null);
    setProfileOpen(true);
    if (styleOptions.length === 0) {
      fetch("/api/python/user/styles")
        .then(async (r) => { if (r.ok) { const j = await r.json(); setStyleOptions(j.styles || []); } })
        .catch(() => {});
    }
  }, [userInfo, styleOptions.length]);

  useEffect(() => {
    if (userInfo && !userInfo.display_name) openProfile();
  }, [userInfo, openProfile]);

  const savePassword = async () => {
    if (pwSaving) return;
    setPwSaving(true);
    setPwMsg(null);
    try {
      const r = await fetch("/api/python/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: pwOld || null, new_password: pwNew }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPwMsg(typeof j.detail === "string" ? j.detail : "Gagal mengubah sandi");
        return;
      }
      setUserInfo((p) => (p ? { ...p, has_password: true } : p));
      setPwOld("");
      setPwNew("");
      setPwMsg("Sandi diperbarui");
    } catch {
      setPwMsg("Gagal mengubah sandi");
    } finally {
      setPwSaving(false);
    }
  };

  const saveProfile = async () => {
    if (profileSaving) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const r = await fetch("/api/python/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: profileName, goal: profileGoal, style_id: profileStyle, gender: profileGender }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProfileMsg(typeof j.detail === "string" ? j.detail : "Gagal menyimpan profil");
        return;
      }
      setUserInfo((p) => (p ? { ...p, display_name: j.display_name, goal: j.goal, style_id: j.style_id, gender: j.gender } : p));
      setProfileMsg("Tersimpan");
      setTimeout(() => setProfileOpen(false), 700);
    } catch {
      setProfileMsg("Gagal menyimpan profil");
    } finally {
      setProfileSaving(false);
    }
  };

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
    await runChat(userMessage, messages);
  };

  const handleRegenerate = async () => {
    if (isLoading) return;
    const idx = messages.map((m) => m.role).lastIndexOf("user");
    if (idx < 0) return;
    if (userInfo && activeChatId) {
      await fetch(`/api/python/user/chats/${activeChatId}/truncate-last-turn`, { method: "POST" }).catch(() => {});
    }
    await runChat(String(messages[idx].content), messages.slice(0, idx));
  };

  const saveTurn = async (userMessage: string, answer: string) => {
    try {
      let id = activeChatId;
      if (!id) {
        const r = await fetch("/api/python/user/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userMessage.slice(0, 60) }),
        });
        if (!r.ok) {
          // batas 3 chat tercapai: jawaban tetap tampil, tapi tidak disimpan
          if (r.status === 409) setQuotaAlert((await r.json().catch(() => ({}))).detail || "Maksimal 3 chat tersimpan.");
          return;
        }
        const j = await r.json();
        id = String(j.id);
        setActiveChatId(id);
      }
      await fetch(`/api/python/user/chats/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: userMessage },
            { role: "assistant", content: answer },
          ],
        }),
      });
      await loadChatList();
    } catch {}
  };

  const runChat = async (userMessage: string, base: Message[]) => {
    setError(null);
    const next: Message[] = [...base, { role: "user", content: userMessage }];
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
        body: JSON.stringify({ message: userMessage, history: next.slice(0, -1).slice(-MAX_HISTORY_MESSAGES) }),
      });
      if (!res.ok) {
        let msg = `Server ${res.status}`;
        try { const j = await res.json(); msg = (j.detail || j.message || msg) as string; } catch {}
        if (msg.includes("Trial habis") || msg.includes("Trial")) {
          openQuotaOffer(msg);
          // refresh trial info
          fetch("/api/python/trial").then((x) => x.json()).then(setTrialInfo).catch(() => {});
          throw new Error(msg);
        }
        if (res.status === 403 && msg.includes("Batas prompt habis")) { openQuotaOffer(msg); throw new Error(msg); }
        if (res.status === 401 && msg.includes("Login diperlukan")) { openQuotaOffer(msg); throw new Error(msg); }
        if (res.status === 428) { setProfileMsg(null); openProfile(); throw new Error(msg); }
        if (res.status === 503) { setQuotaAlert(msg); throw new Error(msg); }
        throw new Error(msg);
      }
      const isStatic = res.headers.get("X-Command-Mode") === "static";
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
            if (p.error) {
              const em = String(p.error);
              if (em.includes("Batas prompt") || em.includes("Trial")) openQuotaOffer(em);
              else if (!em.includes("Login diperlukan")) setError(p.error);
            }
          } catch {}
        }
      }
      if (userInfo) fetch("/api/python/user/me").then(async (r) => { if (r.ok) { const j = await r.json(); setUserInfo(j); if (j.remaining === 0) { setQuotaOut("quota"); setQuotaNoticeHidden(false); } } }).catch(() => {});
      else fetch("/api/python/trial").then((x) => x.json()).then(setTrialInfo).catch(() => {});
      if (userInfo && acc.trim() && !isStatic) {
        void saveTurn(userMessage, acc);
      }
      const dur = Date.now() - started;
      setMessages((prev) => {
        const u = [...prev];
        const last = u[u.length - 1];
        if (last?.role === "assistant") u[u.length - 1] = { ...last, durationMs: dur };
        return u;
      });
    } catch (e: any) {
      const m = e.message || "Gagal terhubung ke backend.";
      if (m.includes("Batas prompt habis") || m.includes("Trial habis") || m.includes("Login diperlukan")) openQuotaOffer(m);
      else setError(m);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      startedAtRef.current = 0;
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#101015] text-zinc-100 antialiased selection:bg-white/10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(900px_500px_at_50%_-10%,rgba(255,255,255,0.035),transparent_70%)]"
      />
      <div aria-hidden className="itz-particles z-[1]">
        <span className="itz-dot" style={{ left: "14%", top: "10%", width: 4, height: 4, color: "rgba(255,255,255,0.35)", animationDelay: "0s", ["--dur" as any]: "5s" }} />
        <span className="itz-dot" style={{ left: "68%", top: "12%", width: 3, height: 3, color: "rgba(255,255,255,0.25)", animationDelay: "1.1s", ["--dur" as any]: "5.5s" }} />
        <span className="itz-dot" style={{ left: "28%", top: "26%", width: 3, height: 3, color: "rgba(255,255,255,0.2)", animationDelay: "1.6s", ["--dur" as any]: "4.8s" }} />
        <span className="itz-dot" style={{ left: "74%", top: "38%", width: 4, height: 4, color: "rgba(255,255,255,0.25)", animationDelay: "1.3s", ["--dur" as any]: "5.2s" }} />
      </div>

      <header className="relative z-30 flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[rgba(14,14,19,0.13)] px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(14,14,19,0.13)] sm:px-6">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.06 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="itz-logo itz-logo-sheen relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/[0.12] bg-zinc-900 shadow-lg"
          >
            <Image src="/image/favicon.png" alt="ITZ" width={36} height={36} className="h-full w-full object-cover" priority />
          </motion.div>
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
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setInfoOpen((v) => !v)}
              title="Informasi kuota"
              aria-label="Informasi kuota"
              aria-expanded={infoOpen}
              className="flex items-center rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
            >
              <Info className="h-4 w-4" />
            </motion.button>
            {infoOpen && (
              <div className="fixed inset-x-3 top-[64px] z-40 overflow-hidden rounded-xl border border-white/10 bg-[#16161c] shadow-[0_16px_48px_rgba(0,0,0,0.65)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-60">
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
          {userInfo && (
            <button
              onClick={() => { setHistoryOpen(true); loadChatList(); }}
              title="Riwayat chat"
              aria-label="Riwayat chat"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
              <span className="hidden sm:inline">Riwayat</span>
            </button>
          )}
          <a
            href="/pricing"
            title="Harga & paket"
            aria-label="Harga dan paket"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>
            <span className="hidden sm:inline">Harga</span>
          </a>
          <button 
            onClick={() => { startNewChat(); setSuggestions(pickSuggestions()); refreshSuggestions(); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span className="hidden sm:inline">New Chat</span>
          </button>
          {userInfo ? (
            <>
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={openProfile} title="Pengaturan profil" aria-label="Pengaturan profil" className="flex items-center rounded-lg px-2.5 py-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
                <motion.svg whileHover={{ rotate: 90 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></motion.svg>
              </motion.button>
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={() => setConfirmLogout(true)} title="Keluar" aria-label="Keluar" className="flex items-center rounded-lg px-2.5 py-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
                <motion.svg whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></motion.svg>
              </motion.button>
            </>
          ) : (
            <a href="/login" className="ml-1 rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition-colors hover:bg-zinc-200">Login</a>
          )}
        </div>
      </header>

      {/* Selamat datang setelah login */}
      <AnimatePresence>
        {welcomeName && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed left-1/2 top-4 z-[90] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-2xl border border-white/[0.1] bg-[#16161c] px-5 py-3.5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
          >
            <p className="text-[14.5px] font-semibold tracking-[-0.01em] text-white">
              Selamat Datang, {welcomeName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">Senang bertemu lagi. Tanyakan apa saja.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={chatList}
        activeId={activeChatId}
        limit={chatLimit}
        retentionDays={chatRetention}
        onOpenChat={openChat}
        onDeleteChat={deleteChat}
        onNewChat={startNewChat}
      />

      {/* Konfirmasi keluar */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[5px]" onClick={() => setConfirmLogout(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-[360px] rounded-2xl border border-white/[0.1] bg-[#0c0c10] p-6 shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)]"
            >
              <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-white">Keluar dari akun?</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">
                Sesi kamu akan berakhir dan kamu kembali ke halaman login.
              </p>
              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="h-10 flex-1 rounded-xl border border-white/[0.1] text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Batal
                </button>
                <button
                  onClick={doLogout}
                  className="h-10 flex-1 rounded-xl bg-white text-[14px] font-semibold text-black transition-colors hover:bg-zinc-200"
                >
                  Ya, keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal profil: nama, tujuan, gaya respons */}
        {profileOpen && userInfo && (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[5px]" onClick={() => { if (userInfo?.display_name) setProfileOpen(false); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              role="dialog"
              aria-modal="true"
              aria-label="Pengaturan profil"
              className="relative flex max-h-[86vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c10] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">Pengaturan Profil</h3>
                <button onClick={() => { if (userInfo?.display_name) setProfileOpen(false); }} aria-label="Tutup" className="rounded-lg px-2 py-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="space-y-1.5">
                  <label htmlFor="pf-name" className="text-[12.5px] font-medium text-zinc-400">Nama tampilan</label>
                  <input
                    id="pf-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    maxLength={64}
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 text-[14px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/25"
                    placeholder="Nama kamu"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pf-goal" className="text-[12.5px] font-medium text-zinc-400">Tujuan kamu pakai ITZ AI</label>
                  <textarea
                    id="pf-goal"
                    value={profileGoal}
                    onChange={(e) => setProfileGoal(e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 py-2.5 text-[14px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/25"
                    placeholder="Contoh: bantu riset kuliah, brainstorm konten, belajar coding"
                  />
                  <p className="text-[11.5px] text-zinc-600">AI memakai tujuan ini agar jawaban lebih relevan.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-zinc-400">Gender</label>
                  <select
                    value={profileGender}
                    onChange={(e) => setProfileGender(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 text-[14px] text-white outline-none transition-colors focus:border-white/25 [&>option]:bg-zinc-900"
                  >
                    <option value="">Tidak disetel</option>
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="text-[12.5px] font-medium text-zinc-400">Kata sandi</span>
                  <p className="text-[11.5px] text-zinc-600">
                    {userInfo?.has_password ? "Ubah sandi untuk login username + sandi." : "Akun ini belum punya sandi. Atur sandi agar bisa login dengan username."}
                  </p>
                  {userInfo?.has_password && (
                    <input
                      type="password"
                      value={pwOld}
                      onChange={(e) => setPwOld(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Sandi lama"
                      className="h-10 w-full rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 text-[14px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/25"
                    />
                  )}
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Sandi baru (min. 8 karakter)"
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-zinc-900/70 px-3.5 text-[14px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/25"
                  />
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={savePassword}
                      disabled={pwSaving || pwNew.length < 8 || (!!userInfo?.has_password && !pwOld)}
                      className="h-9 rounded-xl border border-white/[0.1] px-4 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pwSaving ? "Menyimpan..." : "Simpan sandi"}
                    </button>
                    {pwMsg && (
                      <span className={`text-[12px] ${pwMsg === "Sandi diperbarui" ? "text-emerald-400" : "text-rose-400"}`}>{pwMsg}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[12.5px] font-medium text-zinc-400">Gaya respons AI</span>
                  <div className="space-y-2">
                    {styleOptions.map((s) => {
                      const active = profileStyle === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setProfileStyle(active ? "" : s.id)}
                          aria-pressed={active}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                            active ? "border-white/60 bg-white/[0.07]" : "border-white/[0.08] bg-zinc-900/40 hover:border-white/20 hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-[14px] font-semibold ${active ? "text-white" : "text-zinc-300"}`}>{s.name}</span>
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-white bg-white" : "border-zinc-600"}`}>
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                            </span>
                          </div>
                          {s.description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">{s.description}</p>}
                        </button>
                      );
                    })}
                    {styleOptions.length === 0 && (
                      <p className="rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-3 text-[12.5px] text-zinc-600">Memuat pilihan gaya...</p>
                    )}
                  </div>
                  {profileStyle && (
                    <p className="text-[11.5px] text-zinc-600">Klik lagi untuk kembali ke gaya default.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 border-t border-white/[0.07] px-6 py-4">
                {profileMsg && (
                  <span className={`text-[12.5px] ${profileMsg === "Tersimpan" ? "text-emerald-400" : "text-rose-400"}`}>{profileMsg}</span>
                )}
                <div className="ml-auto flex gap-2.5">
                  <button
                    onClick={() => { if (userInfo?.display_name) setProfileOpen(false); }}
                    className="h-10 rounded-xl border border-white/[0.1] px-4 text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving || !profileName.trim()}
                    className="h-10 rounded-xl bg-white px-5 text-[14px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {profileSaving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quotaAlert && (
          <motion.div
            key="quota-alert"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative z-20 mx-auto w-full max-w-[720px] overflow-hidden px-4 pt-3 sm:px-6"
          >
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[13px] leading-5 text-amber-200">
              <motion.span
                aria-hidden
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 0.7, delay: 0.2, ease: "easeInOut" }}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </motion.span>
              <span className="flex-1">{quotaAlert.includes("Budget token") ? <>Batas harian ITZ AI sudah tercapai. Coba lagi besok atau hubungi admin.</> : <>{quotaAlert} <a href="/login" className="underline underline-offset-2 hover:text-amber-100">Login</a> atau hubungi admin.</>}</span>
              <motion.button
                type="button"
                onClick={() => setQuotaAlert(null)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                aria-label="Tutup peringatan"
                className="shrink-0 rounded-md p-1 text-amber-300 transition-colors hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuotaOfferModal
        open={quotaOffer !== null}
        variant={quotaOffer ?? "quota"}
        username={userInfo?.username ?? null}
        used={userInfo ? userInfo.prompts_used : null}
        max={userInfo ? userInfo.max_prompts : null}
        onClose={() => setQuotaOffer(null)}
      />

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

                <div className="mt-12 w-full space-y-4">
                  <QuotaNotice
                    visible={quotaOut !== null && !quotaNoticeHidden}
                    onOpenOffer={() => setQuotaOffer(quotaOut ?? "quota")}
                    onDismiss={() => setQuotaNoticeHidden(true)}
                  />
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
                        onRegenerate={i === messages.length - 1 && m.role === "assistant" && !isLoading && messages.length > 1 ? handleRegenerate : undefined}
                      />
                    );
                  })}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.10] px-4 py-3.5 text-[13.5px] leading-6 text-red-200 shadow-lg">
                      {error}
                    </div>
                  )}
                  <QuotaNotice
                    visible={quotaOut !== null && !quotaNoticeHidden}
                    onOpenOffer={() => setQuotaOffer(quotaOut ?? "quota")}
                    onDismiss={() => setQuotaNoticeHidden(true)}
                  />
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
