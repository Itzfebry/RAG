"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiErrorMessage, fetchApi, tryFetch } from "@/lib/fetch-api";

type LoginResponse = { email_verified?: boolean; email?: string };
type RegisterResponse = { email_sent?: boolean };
type AuthJson = { detail?: unknown; message?: string };

const REMEMBER_KEY = "itz_remember_username";
const FIELD =
  "h-11 rounded-lg border-white/[0.08] bg-[#0a0a0c] text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500";
const LABEL = "text-[12px] text-zinc-400";

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-950/20 px-3 py-2 text-red-200"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <p className="text-[12px]">{message}</p>
    </div>
  );
}

export default function UserLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
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
    if (sp.get("mode") === "verify") setMode("verify");
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {}
    // Tampilkan tombol Google hanya jika backend sudah dikonfigurasi.
    void tryFetch<{ enabled?: unknown }>("/api/python/auth/google-status").then((r) => {
      if (r.ok && r.data.enabled) setGoogleEnabled(Boolean(r.data.enabled));
    });
  }, []);

  // Layar verifikasi perlu email akun. Kalau belum ada di state (mis. halaman
  // di-reload, atau redirect dari /chat), ambil dari sesi login.
  useEffect(() => {
    if (mode !== "verify" || email) return;
    void tryFetch<{ email?: string }>("/api/python/user/me").then((r) => {
      if (r.ok && r.data.email) setEmail(r.data.email);
    });
  }, [mode, email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const r = await tryFetch<LoginResponse>(
        "/api/python/user/login",
        { json: { username: username.trim().toLowerCase(), password } },
        "Login gagal",
      );
      if (r.ok) {
        try {
          if (rememberMe) localStorage.setItem(REMEMBER_KEY, username.trim().toLowerCase());
          else localStorage.removeItem(REMEMBER_KEY);
          sessionStorage.setItem("itz_welcome", "1");
        } catch {}
        // Email belum diverifikasi -> arahkan ke layar verifikasi, jangan ke chat.
        if (r.data.email_verified === false && r.data.email) {
          setEmail(String(r.data.email));
          setOtpCode("");
          setInfoMsg(`Kode verifikasi dikirim ke ${r.data.email}.`);
          setMode("verify");
          return;
        }
        router.push("/chat");
        router.refresh();
      } else {
        setAuthError(r.error);
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
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setAuthError("Kata sandi harus minimal 8 karakter, mengandung huruf besar dan angka");
      return;
    }
    setIsLoading(true);
    try {
      const r = await tryFetch<RegisterResponse>(
        "/api/python/user/register",
        {
          json: {
            username: username.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            password,
            display_name: displayName.trim() || null,
          },
        },
        "Pendaftaran gagal",
      );
      if (r.ok) {
        setOtpCode("");
        if (r.data.email_sent === false) {
          setAuthError(
            "Akun dibuat, tapi email verifikasi gagal dikirim. Tekan 'Kirim ulang kode'.",
          );
        } else {
          setInfoMsg(`Kode verifikasi dikirim ke ${email.trim().toLowerCase()}.`);
        }
        setMode("verify");
      } else {
        setAuthError(r.error);
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  const postJson = async (path: string, body: object) => {
    try {
      const data = await fetchApi<AuthJson>(`/api/python${path}`, { json: body });
      return { ok: true, data };
    } catch (e) {
      // Network failure: helper memakai pesan default "Gagal terhubung ke server"
      // sebagai detail agar errMsg() menampilkan pesan yang sama seperti catch lama.
      const errData =
        e instanceof ApiError && e.data !== null
          ? (e.data as AuthJson)
          : { detail: apiErrorMessage(e, "Gagal terhubung ke server") };
      return { ok: false, data: errData };
    }
  };

  const errMsg = (data: AuthJson, fallback: string) =>
    typeof data?.detail === "string" ? data.detail : fallback;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const { ok, data } = await postJson("/user/verify-email", {
        email: email.trim().toLowerCase(),
        code: otpCode.trim(),
      });
      if (ok) {
        try {
          sessionStorage.setItem("itz_welcome", "1");
        } catch {}
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
      const r = await tryFetch<AuthJson>(
        "/api/python/user/verify-email/send",
        { method: "POST" },
        "Gagal mengirim ulang kode",
      );
      if (r.ok) setInfoMsg("Kode baru sudah dikirim.");
      else setAuthError(r.error);
    } catch {
      setAuthError("Gagal terhubung ke server");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");
    try {
      const { ok, data } = await postJson("/user/password/forgot", {
        email: email.trim().toLowerCase(),
      });
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
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setAuthError("Kata sandi harus minimal 8 karakter, mengandung huruf besar dan angka");
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
        try {
          sessionStorage.setItem("itz_welcome", "1");
        } catch {}
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
      const data = await fetchApi<{ url?: string } & AuthJson>(
        "/api/python/auth/google-login",
        {},
        { fallbackError: "Gagal terhubung ke server" },
      );
      if (data.url) {
        window.location.href = data.url;
      } else {
        setAuthError(typeof data.detail === "string" ? data.detail : "Gagal memulai login Google");
      }
    } catch (e) {
      setAuthError(apiErrorMessage(e, "Gagal terhubung ke server"));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const subheading = {
    login: "Masuk ke akun Anda.",
    register: "Buat akun baru.",
    verify: "Masukkan kode 6 digit dari email Anda.",
    forgot: "Kami kirim kode reset ke email akun Anda.",
    reset: "Masukkan kode dan kata sandi baru.",
  }[mode];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#101015] antialiased">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-[#16161c]">
              <Image
                src="/image/favicon.png"
                alt="ITZ"
                width={32}
                height={32}
                loading="eager"
                className="h-full w-full object-cover"
              />
            </span>
            <span className="text-[14px] font-semibold tracking-[0.1em] text-zinc-100">
              ITZ AI
            </span>
          </div>

          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">
            {
              {
                login: "Masuk",
                register: "Daftar",
                verify: "Verifikasi email",
                forgot: "Lupa kata sandi",
                reset: "Kata sandi baru",
              }[mode]
            }
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">{subheading}</p>

          <div className="mt-6 space-y-4">
            {infoMsg && (
              <div className="rounded-lg border border-emerald-500/10 bg-emerald-950/20 px-3 py-2 text-[12px] text-emerald-200">
                {infoMsg}
              </div>
            )}

            {mode === "verify" && (
              <form onSubmit={handleVerify} className="space-y-4">
                {email && (
                  <p className="text-[12px] text-zinc-500">
                    Kode dikirim ke <span className="text-zinc-300">{email}</span>
                  </p>
                )}
                <div className="space-y-1.5">
                  <label className={LABEL}>Kode OTP</label>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`${FIELD} text-center text-[17px] tracking-[0.35em]`}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <FormError message={authError} />
                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-zinc-100 text-[13px] font-semibold text-black hover:bg-white"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Verifikasi"}
                </Button>
                <div className="flex justify-between text-[12px] text-zinc-500">
                  <button
                    type="button"
                    onClick={handleResendVerify}
                    className="hover:text-zinc-200"
                  >
                    Kirim ulang kode
                  </button>
                  <button type="button" onClick={() => switchMode("login")} className="hover:text-zinc-200">
                    Kembali
                  </button>
                </div>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={LABEL}>Email</label>
                  <Input
                    type="email"
                    autoComplete="email"
                    className={FIELD}
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <FormError message={authError} />
                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-zinc-100 text-[13px] font-semibold text-black hover:bg-white"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Kirim kode"}
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-200"
                >
                  Kembali ke masuk
                </button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={LABEL}>Kode OTP</label>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`${FIELD} text-center text-[17px] tracking-[0.35em]`}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Kata sandi baru</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className={FIELD}
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Minimal 8 karakter, ada 1 huruf besar dan 1 angka.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Ulangi kata sandi</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className={FIELD}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <FormError message={authError} />
                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-zinc-100 text-[13px] font-semibold text-black hover:bg-white"
                  disabled={
                    isLoading ||
                    otpCode.length !== 6 ||
                    password.length < 8 ||
                    !/^(?=.*[A-Z])(?=.*\d)/.test(password) ||
                    !confirmPassword
                  }
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : "Simpan kata sandi"}
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-200"
                >
                  Kembali ke masuk
                </button>
              </form>
            )}

            {(mode === "login" || mode === "register") && (
              <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
                {mode === "register" && (
                  <>
                    <div className="space-y-1.5">
                      <label className={LABEL}>Email</label>
                      <Input
                        type="email"
                        autoComplete="email"
                        className={FIELD}
                        placeholder="nama@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={LABEL}>Nama tampilan</label>
                      <Input
                        autoComplete="nickname"
                        maxLength={64}
                        className={FIELD}
                        placeholder="Opsional"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className={LABEL}>
                    {mode === "login" ? "Nama pengguna atau email" : "Nama pengguna"}
                  </label>
                  <Input
                    autoComplete="username"
                    className={FIELD}
                    placeholder={mode === "login" ? "Username atau email" : "Username"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL}>Kata sandi</label>
                  <Input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={mode === "register" ? 8 : undefined}
                    className={FIELD}
                    placeholder={mode === "register" ? "Minimal 8 karakter" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === "register" && (
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Minimal 8 karakter, ada 1 huruf besar dan 1 angka.
                    </p>
                  )}
                </div>

                {mode === "register" && (
                  <div className="space-y-1.5">
                    <label className={LABEL}>Ulangi kata sandi</label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      className={FIELD}
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

                <FormError message={authError} />

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-zinc-100 text-[13px] font-semibold text-black hover:bg-white"
                  disabled={
                    isLoading ||
                    !username.trim() ||
                    !password ||
                    (mode === "register" &&
                      (!email.trim() ||
                        password.length < 8 ||
                        !/^(?=.*[A-Z])(?=.*\d)/.test(password) ||
                        !confirmPassword))
                  }
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : mode === "login" ? (
                    "Masuk"
                  ) : (
                    "Daftar"
                  )}
                </Button>
              </form>
            )}
          </div>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="mt-4 text-[12px] text-zinc-500 hover:text-zinc-200"
            >
              Lupa kata sandi?
            </button>
          )}

          {(mode === "login" || mode === "register") && (
            <>
              {googleEnabled && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/[0.08]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#101015] px-2 text-[11px] uppercase tracking-wider text-zinc-500">
                        atau
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                    className="h-11 w-full gap-2 rounded-lg border-white/[0.08] bg-[#0a0a0c] text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                    )}
                    Masuk dengan Google
                  </Button>
                </>
              )}

              <p className="mt-6 text-center text-[12px] text-zinc-500">
                {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                  className="font-medium text-zinc-200 hover:underline"
                >
                  {mode === "login" ? "Daftar" : "Masuk"}
                </button>
              </p>
            </>
          )}

          <a
            href="/chat"
            className="mt-3 block text-center text-[12px] text-zinc-500 hover:text-zinc-200"
          >
            Lanjut tanpa akun
          </a>
        </div>
      </main>

      <p
        suppressHydrationWarning
        className="px-4 pb-6 text-center text-[11px] text-zinc-600"
      >
        © {new Date().getFullYear()} Mochammad Ginata Febryansyah
      </p>
    </div>
  );
}
