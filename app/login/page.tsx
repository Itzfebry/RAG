"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Loader2, Zap, MessageSquare, Wallet } from "lucide-react";
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
const REMEMBER_KEY = "itz_remember_username";

export default function UserLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("auth_error");
    if (p) {
      setAuthError(p);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (sp.get("mode") === "register") setMode("register");
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {}
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
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        try {
          if (rememberMe) localStorage.setItem(REMEMBER_KEY, username.trim().toLowerCase());
          else localStorage.removeItem(REMEMBER_KEY);
          sessionStorage.setItem("itz_welcome", "1");
        } catch {}
        router.push("/chat");
        router.refresh();
      } else {
        setAuthError(typeof data?.detail === "string" ? data.detail : "Login gagal");
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password !== confirmPassword) {
      setAuthError("Konfirmasi kata sandi tidak sama");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/python/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
          display_name: displayName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        setOtpCode("");
        setInfoMsg(`Kode verifikasi dikirim ke ${email.trim().toLowerCase()}.`);
        setMode("verify");
      } else {
        const detail = data?.detail;
        setAuthError(typeof detail === "string" ? detail : "Pendaftaran gagal");
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const postJson = async (path: string, body: object) => {
    const res = await fetch(`/api/python${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as any));
    return { ok: res.ok, data };
  };

  const errMsg = (data: any, fallback: string) =>
    typeof data?.detail === "string" ? data.detail : fallback;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const { ok, data } = await postJson("/user/verify-email", { email: email.trim().toLowerCase(), code: otpCode.trim() });
      if (ok) {
        try { sessionStorage.setItem("itz_welcome", "1"); } catch {}
        router.push("/chat?welcome=1");
        router.refresh();
      } else {
        setAuthError(errMsg(data, "Verifikasi gagal"));
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerify = async () => {
    setAuthError("");
    setInfoMsg("");
    try {
      const res = await fetch("/api/python/user/verify-email/send", { method: "POST" });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) setInfoMsg("Kode baru sudah dikirim.");
      else setAuthError(errMsg(data, "Gagal mengirim ulang kode"));
    } catch {
      setAuthError("Gagal terhubung ke server");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const { ok, data } = await postJson("/user/password/forgot", { email: email.trim().toLowerCase() });
      if (ok) {
        setOtpCode("");
        setInfoMsg(data?.message || "Jika email terdaftar, kode reset sudah dikirim.");
        setMode("reset");
      } else {
        setAuthError(errMsg(data, "Gagal mengirim kode"));
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password !== confirmPassword) {
      setAuthError("Konfirmasi kata sandi tidak sama");
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await postJson("/user/password/reset", {
        email: email.trim().toLowerCase(),
        code: otpCode.trim(),
        new_password: password,
      });
      if (ok) {
        try { sessionStorage.setItem("itz_welcome", "1"); } catch {}
        router.push("/chat");
        router.refresh();
      } else {
        setAuthError(errMsg(data, "Reset kata sandi gagal"));
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (next: "login" | "register" | "forgot" | "verify" | "reset") => {
    setMode(next);
    setAuthError("");
    setInfoMsg("");
    setPassword("");
    setConfirmPassword("");
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
      <div
        aria-hidden
        className="itz-drift pointer-events-none fixed left-1/2 top-1/2 h-[420px] w-[420px] rounded-full bg-white/[0.05] blur-[110px]"
      />

      <div className="relative z-10 grid w-full max-w-[1000px] items-center gap-8 lg:grid-cols-[1fr_400px] lg:gap-20">
        <div className="hidden lg:block">
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
              <Image src="/image/favicon.png" alt="ITZ" width={44} height={44} loading="eager" className="h-full w-full object-cover" />
            </motion.span>
            <div>
              <div className="text-[15px] font-semibold tracking-[0.12em] text-zinc-100">ITZ AI</div>
            </div>
          </motion.div>

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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
            className="mt-9 border-t border-white/[0.07]"
          >
            {VALUE_POINTS.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.85 + i * 0.1, ease: EASE }}
                whileHover={{ x: 4 }}
                className="group flex cursor-default gap-4 border-b border-white/[0.07] py-4 transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className="itz-float mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors group-hover:border-white/[0.16] group-hover:bg-white/[0.06]"
                  style={{ animationDelay: `${i * 0.5}s` }}
                >
                  <v.icon className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-200" />
                </span>
                <div>
                  <div className="text-[14px] font-medium text-zinc-200">{v.title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{v.desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

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
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#16161c] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:p-8">
            <h2 className="text-[20px] font-bold text-white mb-1">
              {{ login: "Masuk", register: "Daftar", verify: "Verifikasi Email", forgot: "Lupa Kata Sandi", reset: "Atur Ulang Kata Sandi" }[mode]}
            </h2>
            <p className="text-[12px] text-zinc-500 mb-8">
              {{
                login: "Masuk dengan nama pengguna dan kata sandi",
                register: "Buat akun baru untuk mulai memakai ITZ AI",
                verify: "Masukkan kode 6 digit yang kami kirim ke email Anda",
                forgot: "Masukkan email akun Anda, kami kirim kode reset",
                reset: "Masukkan kode dan kata sandi baru",
              }[mode]}
            </p>

            {infoMsg && (
              <div className="mb-4 rounded-lg border border-emerald-500/10 bg-emerald-950/20 px-3 py-2 text-[12px] text-emerald-200">
                {infoMsg}
              </div>
            )}

            {mode === "verify" && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kode OTP</label>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-center text-[18px] tracking-[0.4em] text-zinc-100 rounded-xl"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <AnimatePresence>
                  {authError && (
                    <motion.div
                      role="alert"
                      initial={{ height: 0, opacity: 0, y: -6 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-red-950/20 px-3 py-2 text-red-200 border border-red-500/10 overflow-hidden"
                    >
                      <motion.span animate={{ x: [0, -4, 4, -3, 3, 0] }} transition={{ duration: 0.45, delay: 0.1 }} className="shrink-0">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </motion.span>
                      <p className="text-[12px]">{authError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Button
                  type="submit"
                  className="h-12 w-full bg-zinc-100 text-[13px] font-bold text-black hover:bg-white rounded-xl"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Verifikasi"}
                </Button>
                <div className="flex justify-between text-[12px] text-zinc-500">
                  <button type="button" onClick={handleResendVerify} className="hover:text-zinc-200 underline-offset-4 hover:underline">
                    Kirim ulang kode
                  </button>
                  <button type="button" onClick={() => router.push("/chat")} className="hover:text-zinc-200 underline-offset-4 hover:underline">
                    Lewati dulu
                  </button>
                </div>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Email</label>
                  <Input
                    type="email"
                    autoComplete="email"
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 rounded-xl"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <AnimatePresence>
                  {authError && (
                    <motion.div
                      role="alert"
                      initial={{ height: 0, opacity: 0, y: -6 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-red-950/20 px-3 py-2 text-red-200 border border-red-500/10 overflow-hidden"
                    >
                      <motion.span animate={{ x: [0, -4, 4, -3, 3, 0] }} transition={{ duration: 0.45, delay: 0.1 }} className="shrink-0">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </motion.span>
                      <p className="text-[12px]">{authError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Button
                  type="submit"
                  className="h-12 w-full bg-zinc-100 text-[13px] font-bold text-black hover:bg-white rounded-xl"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Kirim kode"}
                </Button>
                <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-200">
                  Kembali ke masuk
                </button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kode OTP</label>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-center text-[18px] tracking-[0.4em] text-zinc-100 rounded-xl"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kata Sandi Baru</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 rounded-xl"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Ulangi Kata Sandi</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 rounded-xl"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <AnimatePresence>
                  {authError && (
                    <motion.div
                      role="alert"
                      initial={{ height: 0, opacity: 0, y: -6 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 rounded-lg bg-red-950/20 px-3 py-2 text-red-200 border border-red-500/10 overflow-hidden"
                    >
                      <motion.span animate={{ x: [0, -4, 4, -3, 3, 0] }} transition={{ duration: 0.45, delay: 0.1 }} className="shrink-0">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </motion.span>
                      <p className="text-[12px]">{authError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Button
                  type="submit"
                  className="h-12 w-full bg-zinc-100 text-[13px] font-bold text-black hover:bg-white rounded-xl"
                  disabled={isLoading || otpCode.length !== 6 || password.length < 8 || !confirmPassword}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Atur kata sandi"}
                </Button>
                <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-200">
                  Kembali ke masuk
                </button>
              </form>
            )}

            {(mode === "login" || mode === "register") && (
            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Email</label>
                    <Input
                      type="email"
                      autoComplete="email"
                      className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Nama Tampilan (opsional)</label>
                    <Input
                      autoComplete="nickname"
                      maxLength={64}
                      className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                      placeholder="Nama kamu"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{mode === "login" ? "Nama Pengguna atau Email" : "Nama Pengguna"}</label>
                <Input
                  autoComplete="username"
                  className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                  placeholder={mode === "login" ? "Username atau email" : "Username"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kata Sandi</label>
                <Input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : undefined}
                  className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === "register" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Ulangi Kata Sandi</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="h-12 border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/40 transition-all duration-300 rounded-xl"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              {mode === "login" && (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-400 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 accent-white"
                  />
                  Ingat akun ini
                </label>
              )}

              <AnimatePresence>
                {authError && (
                  <motion.div
                    role="alert"
                    initial={{ height: 0, opacity: 0, y: -6 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-red-950/20 px-3 py-2 text-red-200 border border-red-500/10 overflow-hidden"
                  >
                    <motion.span animate={{ x: [0, -4, 4, -3, 3, 0] }} transition={{ duration: 0.45, delay: 0.1 }} className="shrink-0">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </motion.span>
                    <p className="text-[12px]">{authError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="itz-cta-pulse h-12 w-full bg-zinc-100 text-[13px] font-bold text-black hover:bg-white transition-all active:scale-[0.98] duration-200 rounded-xl"
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
                disabled={
                  isLoading ||
                  !username.trim() ||
                  !password ||
                  (mode === "register" && (!email.trim() || password.length < 8 || !confirmPassword))
                }
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : mode === "login" ? "Masuk" : "Daftar"}
              </Button>
            </form>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="mt-3 w-full text-center text-[12px] text-zinc-500 hover:text-zinc-200"
              >
                Lupa kata sandi?
              </button>
            )}

            {(mode === "login" || mode === "register") && (
              <p className="mt-5 text-center text-[12px] text-zinc-500">
                {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                  className="font-medium text-zinc-200 underline-offset-4 hover:underline"
                >
                  {mode === "login" ? "Daftar" : "Masuk"}
                </button>
              </p>
            )}

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

          <a
            href="/chat"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] text-[14px] font-medium text-zinc-300 transition-colors hover:border-white/[0.2] hover:bg-white/[0.06] hover:text-white"
          >
            Coba trial gratis
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <p className="mt-2.5 text-center text-[11.5px] text-zinc-600">
            Tanpa daftar, langsung ngobrol dengan ITZ AI
          </p>
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
