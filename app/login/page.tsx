"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, AlertCircle, Zap, MessageSquare, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const VALUE_POINTS = [
  {
    icon: Zap,
    title: "Langsung bisa dipakai",
    desc: "Tanpa setup, tanpa pengaturan. Buka dan tanya apa saja.",
  },
  {
    icon: MessageSquare,
    title: "Jawaban rapi dan lugas",
    desc: "Format terstruktur, bahasa Indonesia natural, tanpa basa-basi.",
  },
  {
    icon: Wallet,
    title: "Kuota transparan",
    desc: "Sisa kuota terlihat kapan saja. Tidak ada langganan tersembunyi.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function UserLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("auth_error");
    if (p) {
      setAuthError(p);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/python/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        try { sessionStorage.setItem("itz_welcome", "1"); } catch {}
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({} as any));
        setAuthError(typeof data.detail === "string" ? data.detail : "Login gagal");
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/python/auth/google-login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setAuthError("Gagal memulai login Google");
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#101015] px-4 py-8 antialiased relative sm:py-12">
      {/* cahaya lembut: loop CSS murni (kompositor), ringan, tanpa JS per frame */}
      <div
        aria-hidden
        className="itz-drift pointer-events-none fixed left-1/2 top-1/2 h-[420px] w-[420px] rounded-full bg-white/[0.05] blur-[110px]"
      />

      <div className="relative z-10 grid w-full max-w-[1000px] items-center gap-8 lg:grid-cols-[1fr_400px] lg:gap-20">
        {/* BRANDING */}
        <div className="hidden lg:block">
          {/* logo: muncul pelan */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="flex items-center gap-3"
          >
            <motion.span
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#16161c]"
              animate={{ boxShadow: [
                "0 0 0 0 rgba(255,255,255,0)",
                "0 0 0 7px rgba(255,255,255,0.045)",
                "0 0 0 0 rgba(255,255,255,0)",
              ] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image src="/image/favicon.png" alt="ITZ" width={44} height={44} className="h-full w-full object-cover" />
            </motion.span>
            <div>
              <div className="text-[15px] font-semibold tracking-[0.12em] text-zinc-100">ITZ AI</div>
            </div>
          </motion.div>

          {/* headline: reveal seperti tiras naik */}
          <div className="mt-8 overflow-hidden pb-1">
            <motion.h1
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
              className="itz-shine bg-gradient-to-r from-white via-zinc-400 to-white bg-clip-text text-transparent text-[44px] font-semibold leading-[1.06] tracking-[-0.04em]"
            >
              Tanya apa saja.
              <br />
              Dapat jawaban lugas.
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
            className="mt-5 max-w-[440px] text-[15.5px] leading-relaxed text-zinc-400"
          >
            Asisten AI yang siap menemani harimu: merangkum, menyusun ide, menjawab
            pertanyaan. Tanpa basa-basi, tanpa perlu pengaturan apa pun.
          </motion.p>

          {/* nilai jual: muncul bersamaan, tanpa efek berlebih */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
            className="mt-9 border-t border-white/[0.07]"
          >
            {VALUE_POINTS.map((v) => (
              <div key={v.title} className="group flex gap-4 border-b border-white/[0.07] py-4 transition-colors hover:bg-white/[0.02]">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors group-hover:border-white/[0.16] group-hover:bg-white/[0.06]">
                  <v.icon className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-200" />
                </span>
                <div>
                  <div className="text-[14px] font-medium text-zinc-200">{v.title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{v.desc}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* CARD LOGIN */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="w-full max-w-[400px] justify-self-center"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#101015]">
              <Image src="/image/favicon.png" alt="ITZ" width={56} height={56} className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-3.5 text-[15px] font-semibold tracking-[0.1em] text-zinc-100">ITZ AI</h1>
            <p className="itz-shine mt-5 bg-gradient-to-r from-white via-zinc-400 to-white bg-clip-text text-transparent text-[26px] font-semibold leading-[1.15] tracking-[-0.03em]">
              Tanya apa saja.
              <br />
              Dapat jawaban lugas.
            </p>
            <p className="mt-2.5 max-w-[320px] text-[13.5px] leading-relaxed text-zinc-500">
              Asisten AI siap menemani harimu. Tanpa basa-basi, tanpa pengaturan.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#16161c] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:p-8">
            <h2 className="text-[20px] font-bold text-white mb-1">Masuk</h2>
            <p className="text-[12px] text-zinc-500 mb-8">Pilih metode untuk melanjutkan</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Nama Pengguna</label>
                <Input
                  className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kata Sandi</label>
                <div className="relative">
                  <Input
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 pr-10 transition-all duration-300 rounded-xl"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {authError && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-red-950/20 px-3 py-2 text-red-200 border border-red-500/10 overflow-hidden"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <p className="text-[12px]">{authError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="itz-float mt-2">
                <Button
                  type="submit"
                  className="itz-cta-pulse h-12 w-full bg-zinc-100 text-[13px] font-bold text-black hover:bg-white transition-all active:scale-[0.98] duration-200 rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Masuk"}
                </Button>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-[#16161c] px-2 text-zinc-500">atau</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="h-12 w-full border-white/[0.08] bg-[#0a0a0c] text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all rounded-xl gap-2"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              MASUK DENGAN GOOGLE
            </Button>
          </div>

          {/* jalur trial: langsung ke page chat tanpa login */}
          <a
            href="/"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] text-[14px] font-medium text-zinc-300 transition-colors hover:border-white/[0.2] hover:bg-white/[0.06] hover:text-white"
          >
            Coba trial gratis
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <p className="mt-2.5 text-center text-[11.5px] text-zinc-600">
            Tanpa daftar, langsung ngobrol dengan ITZ AI
          </p>

          {/* nilai jual versi mobile */}
          <div className="mt-6 lg:hidden">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Kenapa ITZ AI
            </div>
            <div className="mt-3 border-t border-white/[0.07]">
              {VALUE_POINTS.map((v) => (
                <div key={v.title} className="group flex gap-3 border-b border-white/[0.07] py-3 transition-colors hover:bg-white/[0.02]">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors group-hover:border-white/[0.16] group-hover:bg-white/[0.06]">
                    <v.icon className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-zinc-200" />
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-zinc-200">{v.title}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <p
        suppressHydrationWarning
        className="relative z-10 mt-8 w-full text-center text-[11px] tracking-[0.06em] text-zinc-600"
      >
        © {new Date().getFullYear()} Mochammad Ginata Febryansyah
      </p>
    </div>
  );
}
