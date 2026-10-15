"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SectionHeader } from "../SectionHeader";
import {
  cardBase, cardHeaderCls, cardContentCls, tCard, tLabel, inputCls, textareaCls,
} from "../adminStyles";

export type ResponseStyle = { id: string; name: string; description: string; prompt: string };

export function StylesTab({
  styles,
  onChange,
  onSave,
  saving,
}: {
  styles: ResponseStyle[];
  onChange: (next: ResponseStyle[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (idx: number, patch: Partial<ResponseStyle>) =>
    onChange(styles.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionHeader title="Gaya Respons" desc="Tentukan template gaya jawaban AI. User hanya bisa memilih, tidak bisa custom." />
      {styles.map((s, idx) => (
        <Card key={s.id || idx} className={cardBase}>
          <CardHeader className={cardHeaderCls}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className={tCard}>{s.name || `Gaya ${idx + 1}`}</CardTitle>
              <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[13px] text-zinc-500">id: {s.id}</span>
            </div>
          </CardHeader>
          <CardContent className={`${cardContentCls} grid gap-4`}>
            <div className="space-y-2">
              <Label className={tLabel}>Nama Gaya</Label>
              <Input value={s.name} onChange={(e) => update(idx, { name: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label className={tLabel}>Deskripsi (untuk user)</Label>
              <Textarea rows={2} value={s.description} onChange={(e) => update(idx, { description: e.target.value })} className={textareaCls} />
            </div>
            <div className="space-y-2">
              <Label className={tLabel}>Instruksi Prompt (dikirim ke model)</Label>
              <Textarea rows={5} value={s.prompt} onChange={(e) => update(idx, { prompt: e.target.value })} className={textareaCls} />
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="h-10 bg-white px-6 text-[15px] font-semibold text-black hover:bg-zinc-200">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Simpan Gaya Respons
        </Button>
      </div>
    </motion.div>
  );
}
