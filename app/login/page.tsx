"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setAuthError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/python/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({} as any));
        const msg = typeof (data as any).detail === "string" ? (data as any).detail : JSON.stringify((data as any).detail || "Login gagal");
        setAuthError(msg);
      }
    } catch {
      setAuthError("Gagal terhubung ke server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-black text-white relative overflow-hidden selection:bg-white selection:text-black">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_900px_500px_at_50%_-8%,rgba(255,255,255,0.05),transparent_62%)]" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-black/40" />

      <div className="relative flex w-full items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900">
              <img src="/image/favicon.png" alt="ITZ AI" width={36} height={36} className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-2 text-[10px] font-medium tracking-[0.16em] text-zinc-500">ITZ</h1>
          </div>

          <Card size="sm" className="border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.06)_inset] overflow-hidden">
            <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            <CardHeader className="flex flex-col items-center justify-center gap-2.5 pb-4 pt-5 text-center">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300">
                <User className="h-3.5 w-3.5" />
              </span>
              <div>
                <CardTitle className="text-[36px] font-bold tracking-[-0.03em] text-white leading-none">Login</CardTitle>
                <p className="mt-1.5 text-[10px] font-medium tracking-[0.18em] text-zinc-500 leading-none">USER</p>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="user-username" className="text-[10px] font-medium tracking-[0.08em] text-zinc-400">USERNAME</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden>
                      <User className="h-4 w-4" />
                    </span>
                    <Input
                      id="user-username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      aria-invalid={Boolean(authError)}
                      aria-describedby={authError ? "user-login-error" : undefined}
                      placeholder="username"
                      className="h-10 border-white/10 bg-zinc-800/60 pl-10 pr-3 text-[14px] text-white placeholder:text-zinc-500 focus-visible:border-white/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password" className="text-[10px] font-medium tracking-[0.08em] text-zinc-400">PASSWORD</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden>
                      <Lock className="h-4 w-4" />
                    </span>
                    <Input
                      id="user-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      aria-invalid={Boolean(authError)}
                      aria-describedby={authError ? "user-login-error" : undefined}
                      placeholder="••••••••••••"
                      className="h-10 border-white/10 bg-zinc-800/60 pl-10 pr-11 text-[14px] text-white placeholder:text-zinc-500 focus-visible:border-white/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div id="user-login-error" role="alert" aria-live="polite" className="flex gap-3 rounded-xl border border-red-500/15 bg-red-950/25 px-3.5 py-3">
                    <span className="mt-0.5 shrink-0 rounded-full bg-red-500/15 p-1" aria-hidden>
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-none text-red-300">Gagal masuk</p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-red-200/70 break-words">{authError}</p>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={isLoading} className="h-10 w-full bg-white text-[14px] font-medium text-black hover:bg-zinc-100 disabled:opacity-60 shadow-sm cursor-pointer gap-2">
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memproses…</>
                  ) : (
                    <><User className="h-4 w-4 opacity-70" aria-hidden /> Login <ArrowRight className="h-4 w-4 opacity-60" aria-hidden /></>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center border-t border-white/[0.06] bg-white/[0.02] py-3">
              <Button variant="ghost" nativeButton={false} render={<Link href="/" />} className="h-9 gap-1.5 text-[13px] font-normal text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Kembali
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
