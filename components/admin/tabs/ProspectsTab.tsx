"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, RefreshCw, ChevronRight, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cardBase } from "../adminStyles";
import { SectionHeader } from "../SectionHeader";
import { fetchApi, apiErrorMessage } from "@/lib/fetch-api";
import type { DiscoveryBrief } from "@/lib/api-types";

/* Bentuk baris discovery_briefs dari backend admin. */
interface BriefRow {
  id: string;
  session_key?: string;
  name?: string | null;
  contact_channel?: string | null;
  contact_value?: string | null;
  summary?: string | null;
  brief?: DiscoveryBrief | null;
  transcript?: { role?: string; content?: string }[] | null;
  status?: string;
  notes?: string | null;
  turn_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

type PushToast = (kind: "success" | "error" | "info", title: string, desc?: string) => void;

const STATUS_LABEL: Record<string, string> = {
  new: "Baru",
  contacted: "Dihubungi",
  quoted: "Penawaran",
  won: "Deal",
  lost: "Gagal",
};

const STATUS_STYLE: Record<string, string> = {
  new: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  contacted: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  quoted: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  won: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  lost: "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
};

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelLabel(channel?: string | null): string {
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp";
  return "Kontak";
}

/**
 * Detail satu prospek. Dipasang dengan key={row.id} supaya catatan/status
 * selalu mulai dari nilai baris yang dipilih tanpa perlu effect sinkronisasi.
 */
function BriefDetail({
  row,
  pushToast,
  onSaved,
}: {
  row: BriefRow;
  pushToast?: PushToast;
  onSaved: (row: BriefRow) => void;
}) {
  const [status, setStatus] = useState(row.status || "new");
  const [notes, setNotes] = useState(row.notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await fetchApi<{ brief: BriefRow }>(
        `/api/python/admin/discovery/briefs/${row.id}`,
        { method: "PATCH", json: { status, notes } },
      );
      onSaved({ ...row, ...data.brief });
      pushToast?.("success", "Prospek diperbarui", STATUS_LABEL[status] ?? status);
    } catch (e) {
      pushToast?.("error", "Gagal menyimpan", apiErrorMessage(e, "Coba lagi."));
    } finally {
      setSaving(false);
    }
  };

  const brief = row.brief;

  return (
    <div className="space-y-3.5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Proyek</p>
        <h3 className="mt-0.5 text-[16px] font-medium text-zinc-100">
          {brief?.project_title || "Tanpa judul"}
        </h3>
        <p className="mt-1 text-[13px] text-zinc-400">
          {row.name || "Tanpa nama"} · {channelLabel(row.contact_channel)}:{" "}
          <span className="text-zinc-200">{row.contact_value || "—"}</span>
        </p>
      </div>

      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-lg border border-white/10 bg-[#0a0b12] px-2 text-[12.5px] text-zinc-200"
          aria-label="Status prospek"
        >
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={saving}
          className="h-8 gap-1.5 bg-white text-black hover:bg-white/90"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Simpan
        </Button>
        <span className="ml-auto self-center font-mono text-[10.5px] text-zinc-600">
          {fmtDate(row.created_at)}
        </span>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          Catatan internal
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[#0a0b12] px-2.5 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
          placeholder="Hasil follow-up, kendala, jadwal…"
        />
      </div>

      {brief && (
        <div className="max-h-[42vh] space-y-3 overflow-y-auto rounded-lg border border-white/[0.07] bg-black/20 p-3 text-[12.5px] leading-[1.65]">
          {[
            ["Masalah", brief.problem],
            ["Solusi", brief.recommended_solution],
          ].map(([label, value]) =>
            value ? (
              <div key={label}>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-zinc-300">{value}</p>
              </div>
            ) : null,
          )}

          {brief.integrations?.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Integrasi
              </p>
              <ul className="mt-1 space-y-0.5 text-zinc-300">
                {brief.integrations.map((i) => (
                  <li key={i.name}>
                    <span className="text-zinc-200">{i.name}</span>
                    {i.why ? <span className="text-zinc-500"> — {i.why}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.next_steps?.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Langkah berikutnya
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-zinc-300">
                {brief.next_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Estimasi
            </p>
            <p className="mt-0.5 text-zinc-300">
              {[brief.estimate?.range, brief.estimate?.timeline].filter(Boolean).join(" · ") ||
                "Belum diisi"}
            </p>
            {brief.estimate?.note ? (
              <p className="mt-0.5 text-zinc-500">{brief.estimate.note}</p>
            ) : null}
          </div>
        </div>
      )}

      {row.transcript && row.transcript.length > 0 && (
        <details className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
          <summary className="cursor-pointer text-[12.5px] text-zinc-400">
            Transkrip ({row.transcript.length} pesan)
          </summary>
          <div className="mt-2 max-h-[36vh] space-y-2 overflow-y-auto">
            {row.transcript.map((m, i) => (
              <p key={i} className="text-[12px] leading-[1.6]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                  {m.role === "user" ? "Klien" : "Konsultan"}:
                </span>{" "}
                <span className="text-zinc-300">{m.content}</span>
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Tab Prospek: lead yang masuk dari halaman discovery. Menampilkan brief,
 * transkrip, dan status follow-up (new -> contacted -> quoted -> won/lost).
 */
export function ProspectsTab({ pushToast }: { pushToast?: PushToast }) {
  const [rows, setRows] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const data = await fetchApi<{ briefs: BriefRow[] }>(
        `/api/python/admin/discovery/briefs${qs}`,
      );
      setRows(data.briefs || []);
    } catch (e) {
      setError(apiErrorMessage(e, "Gagal memuat prospek."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status || "new"] = (out[r.status || "new"] || 0) + 1;
    return out;
  }, [rows]);

  const applySaved = (updated: BriefRow) =>
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Prospek"
        desc="Lead dari halaman discovery. Setiap baris berisi brief proyek dan kontak yang dikirim klien."
      />

      <div className="flex flex-wrap items-center gap-2">
        {["", "new", "contacted", "quoted", "won", "lost"].map((key) => (
          <Button
            key={key || "all"}
            variant={filter === key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(key)}
            className={`h-8 rounded-full px-3 text-[12.5px] ${
              filter === key ? "bg-white/[0.10] text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {key ? (STATUS_LABEL[key] ?? key) : "Semua"}
            {key && counts[key] ? <span className="ml-1 text-zinc-500">{counts[key]}</span> : null}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="ml-auto h-8 gap-1.5 text-zinc-400 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Muat ulang
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-[13px] text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Daftar lead */}
        <Card className={cardBase}>
          <CardContent className="p-0">
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat prospek…
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-zinc-500">
                <Inbox className="h-6 w-6" />
                <p className="text-[13.5px]">Belum ada brief masuk.</p>
                <p className="max-w-[34ch] text-[12px] leading-[1.6] text-zinc-600">
                  Lead muncul di sini setelah pengunjung menyimpan brief di halaman discovery.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {rows.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                          active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium text-zinc-100">
                              {r.brief?.project_title || r.name || "Brief tanpa judul"}
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${
                                STATUS_STYLE[r.status || "new"] ?? STATUS_STYLE.new
                              }`}
                            >
                              {STATUS_LABEL[r.status || "new"] ?? r.status}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                            {r.name || "Tanpa nama"} · {channelLabel(r.contact_channel)}{" "}
                            {r.contact_value || ""}
                          </p>
                          <p className="mt-0.5 font-mono text-[10.5px] text-zinc-600">
                            {fmtDate(r.created_at)} · {r.turn_count ?? 0} pesan
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className={cardBase}>
          <CardContent className="p-4">
            {!selected ? (
              <p className="py-12 text-center text-[13px] text-zinc-500">
                Pilih salah satu prospek untuk melihat brief dan transkripnya.
              </p>
            ) : (
              <BriefDetail
                key={selected.id}
                row={selected}
                pushToast={pushToast}
                onSaved={applySaved}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
