"use client";

import React, { useState } from "react";
import { X, Trash2, Plus } from "lucide-react";

export interface ChatSummary {
  id: string;
  title: string;
  updated_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: ChatSummary[];
  activeId: string | null;
  limit: number;
  retentionDays: number;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default function ChatHistoryPanel({
  open,
  onClose,
  items,
  activeId,
  limit,
  retentionDays,
  onOpenChat,
  onDeleteChat,
  onNewChat,
}: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!open) return null;
  const full = items.length >= limit;
  const pending = items.find((c) => c.id === confirmId) ?? null;

  return (
    <div className="fixed inset-0 z-[80] flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Riwayat chat"
        className="relative flex h-full w-[300px] max-w-[85vw] flex-col border-r border-white/[0.08] bg-[#0c0c10] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <h3 className="text-[15px] font-semibold text-white">Riwayat chat</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-white/[0.07] px-4 py-3.5">
          <p className="text-[12.5px] tabular-nums text-zinc-300">
            {items.length} <span className="text-zinc-600">/ {limit}</span> chat tersimpan
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-600">
            Chat otomatis dihapus setelah {retentionDays} hari.
            {full ? " Hapus salah satu untuk membuat chat baru." : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-zinc-500">
              Belum ada chat tersimpan.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${activeId === c.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                >
                  <button onClick={() => onOpenChat(c.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13.5px] text-zinc-200">{c.title}</span>
                    <span className="block text-[11px] text-zinc-500">{fmtDate(c.updated_at)}</span>
                  </button>
                  <button
                    onClick={() => setConfirmId(c.id)}
                    aria-label={`Hapus chat ${c.title}`}
                    className="rounded-md p-1.5 text-zinc-500 opacity-70 hover:bg-red-500/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/[0.07] p-3">
          <button
            onClick={onNewChat}
            disabled={full}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[13.5px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Chat baru
          </button>
        </div>
      </aside>

      {/* Konfirmasi hapus chat */}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[5px]"
            onClick={() => setConfirmId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi hapus chat"
            className="relative w-full max-w-[340px] rounded-2xl border border-white/[0.1] bg-[#0c0c10] p-6 shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-300 fill-mode-both"
          >
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
              Hapus chat ini?
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">&ldquo;{pending.title}&rdquo;</span> akan
              dihapus permanen dan tidak bisa dikembalikan.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setConfirmId(null)}
                autoFocus
                className="h-10 flex-1 rounded-xl border border-white/[0.1] text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setConfirmId(null);
                  onDeleteChat(pending.id);
                }}
                className="h-10 flex-1 rounded-xl bg-red-500 text-[14px] font-semibold text-white transition-colors hover:bg-red-600"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
