"use client";

import { useState } from "react";
import {
  Building2,
  CircleAlert,
  HelpCircle,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Workflow,
  X,
} from "lucide-react";
import type {
  DiscoveryField,
  DiscoveryItem,
  DiscoveryListField,
  DiscoveryStage,
  DiscoveryState,
  DiscoveryStatus,
} from "@/lib/api-types";

interface Props {
  state: DiscoveryState | null;
  loading?: boolean;
  className?: string;
  /** Dipanggil saat user mengoreksi/menambah isi panel (state disimpan di client). */
  onChange?: (next: DiscoveryState) => void;
}

const STAGES: { key: DiscoveryStage; label: string }[] = [
  { key: "not_started", label: "Belum mulai" },
  { key: "information_gathering", label: "Mengumpulkan info" },
  { key: "business_understanding", label: "Memahami bisnis" },
  { key: "problem_identified", label: "Masalah teridentifikasi" },
  { key: "solution_exploration", label: "Eksplorasi solusi" },
  { key: "assessment_ready", label: "Siap asesmen" },
];

const STATUS: Record<DiscoveryStatus, { label: string; dot: string; text: string }> = {
  confirmed: { label: "Terkonfirmasi", dot: "bg-emerald-400", text: "text-emerald-300/80" },
  inferred: { label: "Perkiraan", dot: "bg-amber-400", text: "text-amber-300/80" },
  needs_validation: { label: "Perlu cek", dot: "bg-sky-400", text: "text-sky-300/80" },
  unknown: { label: "Belum ada", dot: "bg-white/25", text: "text-white/30" },
};

/** Kerangka kosong: panel tetap bisa diisi manual sebelum model mengekstrak apa pun. */
const EMPTY_STATE: DiscoveryState = {
  business_profile: {
    business_name: { value: "", status: "unknown" },
    industry: { value: "", status: "unknown" },
    business_model: { value: "", status: "unknown" },
    products_services: { value: [], status: "unknown" },
    target_customers: { value: [], status: "unknown" },
    business_scale: { value: "", status: "unknown" },
  },
  business_challenges: [],
  business_objectives: [],
  current_workflows: [],
  existing_systems: [],
  technology_opportunities: [],
  recommendations: [],
  open_questions: [],
  discovery_stage: "not_started",
};

function clone(state: DiscoveryState): DiscoveryState {
  return JSON.parse(JSON.stringify(state)) as DiscoveryState;
}

function Badge({ status }: { status: DiscoveryStatus }) {
  const s = STATUS[status] ?? STATUS.unknown;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[9.5px] uppercase tracking-[0.1em] ${s.text}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11.5px] leading-[1.55] text-white/30">{text}</p>;
}

/** Input terkendali-lepas: commit saat blur/Enter, batalkan saat Escape. */
function EditLine({
  value,
  onCommit,
  align = "right",
  ariaLabel,
  placeholder = "Isi…",
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  align?: "left" | "right";
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      className={`min-w-0 flex-1 rounded-md border-b border-transparent bg-transparent px-1 py-0.5 text-[12px] leading-[1.45] text-white/85 outline-none transition-colors placeholder:text-white/20 hover:border-white/10 focus:border-[color:var(--spectral-violet)]/60 focus:bg-white/[0.04] ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    />
  );
}

function ProfileRow({
  label,
  field,
  listField,
  onCommit,
}: {
  label: string;
  field?: DiscoveryField;
  listField?: DiscoveryListField;
  onCommit: (next: { value: string; status: DiscoveryStatus }) => void;
}) {
  const isList = Boolean(listField);
  const shown = listField ? listField.value.join(", ") : (field?.value ?? "");
  const status: DiscoveryStatus = listField ? listField.status : (field?.status ?? "unknown");
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-[74px] shrink-0 text-[11px] text-white/35">{label}</span>
      <EditLine
        value={shown}
        ariaLabel={label}
        placeholder={isList ? "pisahkan dengan koma" : "—"}
        onCommit={(v) =>
          onCommit({
            value: v,
            status: v ? "confirmed" : "unknown",
          })
        }
      />
      {shown && <Badge status={status} />}
    </div>
  );
}

/** Daftar yang bisa diedit: ubah, hapus, atau tambah item baru. */
function EditableList({
  title,
  icon: Icon,
  items,
  empty,
  addLabel,
  onChange,
}: {
  title: string;
  icon: typeof Target;
  items: DiscoveryItem[];
  empty: string;
  addLabel: string;
  onChange?: (next: DiscoveryItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const commitItem = (index: number, value: string) => {
    if (!onChange) return;
    const next = items.filter((_, i) => i !== index);
    if (value) next.splice(index, 0, { value, status: "confirmed" });
    onChange(next);
  };
  const removeItem = (index: number) => {
    if (!onChange) return;
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    const v = draft.trim();
    if (!v || !onChange) return;
    onChange([...items, { value: v, status: "confirmed" }]);
    setDraft("");
  };

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-white/40" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">{title}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.length === 0 && <Empty text={empty} />}
        {items.map((item, i) => (
          <div key={`${item.value}-${i}`} className="flex items-start gap-1.5">
            <EditLine
              value={item.value}
              align="left"
              ariaLabel={`${title} ${i + 1}`}
              placeholder="Isi…"
              onCommit={(v) => commitItem(i, v)}
            />
            <Badge status={item.status} />
            {onChange && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                aria-label={`Hapus ${title} ${i + 1}`}
                className="mt-0.5 shrink-0 rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/70"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {onChange && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            placeholder={addLabel}
            aria-label={addLabel}
            className="min-w-0 flex-1 rounded-md bg-white/[0.03] px-2 py-1 text-[11.5px] text-white/80 outline-none placeholder:text-white/25 focus:bg-white/[0.06]"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!draft.trim()}
            aria-label={addLabel}
            className="shrink-0 rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-30"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

/** Peluang solusi: kartu bernomor, lebih menonjol daripada daftar biasa. */
function OpportunityList({ items, onChange }: { items: DiscoveryItem[]; onChange?: (n: DiscoveryItem[]) => void }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--spectral-cyan)]/20 bg-[linear-gradient(180deg,rgba(120,180,255,0.07),rgba(255,255,255,0.02))] p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--spectral-cyan),var(--spectral-violet))]">
          <Lightbulb className="size-3 text-[#08090f]" aria-hidden />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
          Peluang solusi
        </span>
        {items.length > 0 && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[9.5px] text-white/45">
            {items.length}
          </span>
        )}
      </div>
      <div className="mt-2.5 space-y-2">
        {items.length === 0 && <Empty text="Peluang solusi muncul setelah masalah dan tujuan jelas." />}
        {items.map((item, i) => (
          <div
            key={`${item.value}-${i}`}
            className="group flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 p-2.5 transition-colors hover:border-[color:var(--spectral-cyan)]/35 hover:bg-black/35"
          >
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--spectral-cyan)]/30 font-mono text-[10px] text-[color:var(--spectral-cyan)]/90">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <EditLine
                value={item.value}
                align="left"
                ariaLabel={`Peluang solusi ${i + 1}`}
                placeholder="Isi…"
                onCommit={(v) => {
                  if (!onChange) return;
                  const next = items.filter((_, idx) => idx !== i);
                  if (v) next.splice(i, 0, { value: v, status: "confirmed" });
                  onChange(next);
                }}
                className="text-[12.5px] text-white/85"
              />
              {item.evidence && (
                <p className="mt-0.5 px-1 text-[10.5px] leading-[1.45] text-white/30">{item.evidence}</p>
              )}
            </div>
            <Badge status={item.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BusinessIntelligencePanel({ state, loading, className = "", onChange }: Props) {
  const stageIndex = state ? STAGES.findIndex((s) => s.key === state.discovery_stage) : -1;
  const stageLabel = stageIndex >= 0 ? STAGES[stageIndex].label : STAGES[0].label;
  const progress = stageIndex <= 0 ? 0 : (stageIndex / (STAGES.length - 1)) * 100;
  const profile = (state ?? EMPTY_STATE).business_profile;

  const patch = (mutator: (next: DiscoveryState) => void) => {
    if (!onChange) return;
    const next = clone(state ?? EMPTY_STATE);
    mutator(next);
    onChange(next);
  };

  const setProfile = (key: keyof DiscoveryState["business_profile"], field: DiscoveryField | DiscoveryListField) => {
    patch((next) => {
      (next.business_profile as Record<string, DiscoveryField | DiscoveryListField>)[key] = field;
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            Discovery
          </span>
          {loading && <Loader2 className="size-3 animate-spin text-white/40" aria-hidden />}
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-white/85">{stageLabel}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--spectral-cyan),var(--spectral-violet))] transition-[width] duration-500"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-[1.5] text-white/35">
          {onChange
            ? "Klik teks mana pun untuk mengoreksi. Perubahan langsung dipakai di sesi ini."
            : "Diperbarui dari kelengkapan informasi, bukan jumlah pesan."}
        </p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center gap-2">
          <Building2 className="size-3.5 text-white/40" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            Profil bisnis
          </span>
        </div>
        <div className="mt-2 divide-y divide-white/[0.05]">
          <ProfileRow
            label="Nama"
            field={profile.business_name}
            onCommit={(f) => setProfile("business_name", f)}
          />
          <ProfileRow
            label="Industri"
            field={profile.industry}
            onCommit={(f) => setProfile("industry", f)}
          />
          <ProfileRow
            label="Model"
            field={profile.business_model}
            onCommit={(f) => setProfile("business_model", f)}
          />
          <ProfileRow
            label="Skala"
            field={profile.business_scale}
            onCommit={(f) => setProfile("business_scale", f)}
          />
          <ProfileRow
            label="Produk / jasa"
            listField={profile.products_services}
            onCommit={(f) =>
              setProfile("products_services", {
                value: f.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                status: f.status,
              })
            }
          />
          <ProfileRow
            label="Pelanggan"
            listField={profile.target_customers}
            onCommit={(f) =>
              setProfile("target_customers", {
                value: f.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                status: f.status,
              })
            }
          />
        </div>
        {!state && (
          <p className="mt-2 text-[11px] leading-[1.5] text-white/25">
            Boleh diisi sekarang, atau biarkan terisi otomatis dari percakapan.
          </p>
        )}
      </section>

      <EditableList
        title="Tantangan"
        icon={CircleAlert}
        items={(state ?? EMPTY_STATE).business_challenges}
        empty="Belum ada masalah yang teridentifikasi."
        addLabel="Tambah tantangan"
        onChange={onChange && ((next) => patch((s) => void (s.business_challenges = next)))}
      />

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center gap-2">
          <Target className="size-3.5 text-white/40" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            Tujuan
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {(state ?? EMPTY_STATE).business_objectives.length === 0 ? (
            <Empty text="Belum ada target bisnis yang disebut." />
          ) : (
            (state ?? EMPTY_STATE).business_objectives.slice(0, 6).map((item) => (
              <div key={item.value} className="flex items-start justify-between gap-2">
                <span className="text-[12px] leading-[1.5] text-white/75">{item.value}</span>
                <Badge status={item.status} />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center gap-2">
          <Workflow className="size-3.5 text-white/40" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            Alur &amp; sistem
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {[...(state ?? EMPTY_STATE).current_workflows, ...(state ?? EMPTY_STATE).existing_systems]
            .length === 0 ? (
            <Empty text="Belum ada info soal proses atau sistem yang dipakai." />
          ) : (
            [...(state ?? EMPTY_STATE).current_workflows, ...(state ?? EMPTY_STATE).existing_systems]
              .slice(0, 6)
              .map((item, i) => (
                <div key={`${item.value}-${i}`} className="flex items-start justify-between gap-2">
                  <span className="text-[12px] leading-[1.5] text-white/75">{item.value}</span>
                  <Badge status={item.status} />
                </div>
              ))
          )}
        </div>
      </section>

      <OpportunityList
        items={(state ?? EMPTY_STATE).technology_opportunities}
        onChange={onChange && ((next) => patch((s) => void (s.technology_opportunities = next)))}
      />

      {state && state.recommendations.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-white/40" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              Rekomendasi
            </span>
          </div>
          <div className="mt-2 space-y-2.5">
            {state.recommendations.slice(0, 3).map((rec) => (
              <div key={rec.name} className="rounded-lg bg-black/25 p-2.5">
                <p className="text-[12.5px] font-medium text-white/85">{rec.name}</p>
                {rec.problem && (
                  <p className="mt-0.5 text-[11px] leading-[1.5] text-white/45">{rec.problem}</p>
                )}
                {(rec.complexity || rec.cost_category || rec.priority) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {rec.complexity && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                        Kompleksitas: {rec.complexity}
                      </span>
                    )}
                    {rec.cost_category && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                        Biaya: {rec.cost_category}
                      </span>
                    )}
                    {rec.priority && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                        Prioritas: {rec.priority}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {state && state.open_questions.length > 0 && (
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-3.5 text-white/40" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              Perlu dikonfirmasi
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {state.open_questions.slice(0, 5).map((q) => (
              <li key={q} className="text-[11.5px] leading-[1.5] text-white/55">
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
