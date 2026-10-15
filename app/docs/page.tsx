"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface CommandDoc {
  name: string;
  purpose: string;
  instruction: string;
  output_format: string;
  rules: string[];
  example: string;
}

export default function DocsPage() {
  const [commands, setCommands] = useState<CommandDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/python/commands")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Server ${r.status}`);
        const j = await r.json();
        setCommands(j.commands as CommandDoc[]);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-[860px] px-5 py-10 text-zinc-200">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Dokumentasi Command ITZ AI</h1>
          <p className="mt-1 text-[13.5px] text-zinc-500">
            Ketik command di awal pesan chat. Maksimal 2 command per pesan, contoh: <code className="font-mono">/explain REST API</code>
          </p>
        </div>
        <Link href="/chat" className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-[13px] text-zinc-300 hover:bg-white/[0.06]">
          Ke chat
        </Link>
      </header>

      <section className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-zinc-400">
        <h2 className="mb-2 text-[14px] font-medium text-zinc-200">Aturan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Command hanya dikenali di awal pesan. Garis miring di tengah kalimat tidak dianggap command.</li>
          <li>Command tidak dikenal tidak dijalankan. Jika dikirim sendirian (mis. <code className="font-mono">/foo</code>), daftar command akan ditampilkan. Jika ada teks lain (mis. <code className="font-mono">/home lagi error</code>), pesan dikirim sebagai chat biasa.</li>
          <li>Command saja tanpa teks (mis. <code className="font-mono">/explain</code>) menampilkan daftar command dan tidak memakai kuota.</li>
          <li>Jika dua command dipakai bersamaan, format utama mengikuti command dengan prioritas tertinggi (urutan prioritas diatur backend, bukan urutan penulisan). Command lain hanya memperkaya isi.</li>
          <li>Command hanya berlaku untuk pesan itu saja.</li>
        </ul>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          Gagal memuat dokumentasi: {error}
        </p>
      )}
      {!error && !commands && <p className="text-[13px] text-zinc-500">Memuat...</p>}

      <div className="space-y-5">
        {commands?.map((c) => (
          <article key={c.name} id={c.name} className="rounded-xl border border-white/[0.08] bg-[#111114] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[16px] text-emerald-300">/{c.name}</h2>
              <code className="font-mono text-[12.5px] text-zinc-500">{c.example}</code>
            </div>
            <p className="mt-2 text-[14px] text-zinc-300">{c.purpose}</p>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div>
                <dt className="text-zinc-500">Instruksi</dt>
                <dd className="mt-0.5 text-zinc-300">{c.instruction}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Format output</dt>
                <dd className="mt-0.5 text-zinc-300">{c.output_format}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Execution rules</dt>
                <dd className="mt-0.5">
                  <ul className="list-disc space-y-1 pl-5 text-zinc-400">
                    {c.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </main>
  );
}
