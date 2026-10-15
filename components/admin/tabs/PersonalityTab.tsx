"use client";

import React from "react";
import { Brain, Mic2, Heart, Lightbulb, MessageSquare, Zap, ShieldCheck, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SectionHeader } from "../SectionHeader";
import {
  cardBase, cardHeaderCls, cardContentCls, tCard, tLabel,
  cSky, cViolet, cAmber, cEmerald, cRose, textareaCls,
} from "../adminStyles";

export type PersonalityData = { personality: string; tone: string; attitude: string; reasoning_style: string; criticism_style: string; response_behavior: string; prohibited_behavior: string };

const FIELDS = [
  { key: "personality", label: "Kepribadian", Icon: Brain, color: cViolet },
  { key: "tone", label: "Nada", Icon: Mic2, color: cSky },
  { key: "attitude", label: "Sikap", Icon: Heart, color: cRose },
  { key: "reasoning_style", label: "Gaya Penalaran", Icon: Lightbulb, color: cAmber },
  { key: "criticism_style", label: "Gaya Kritik", Icon: MessageSquare, color: cSky },
  { key: "response_behavior", label: "Perilaku Respons", Icon: Zap, color: cAmber },
  { key: "prohibited_behavior", label: "Perilaku Terlarang", Icon: ShieldCheck, color: cEmerald },
] as const;

export function PersonalityTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: PersonalityData;
  onChange: (next: PersonalityData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionHeader title="Kepribadian" desc="Menentukan karakter, nada, sikap, dan batasan perilaku AI." />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCard}>Personality</CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} grid gap-4`}>
          {FIELDS.map((item) => {
            const Ico = item.Icon;
            return (
              <div key={item.key} className="space-y-2">
                <Label className={tLabel}><span className="flex items-center gap-1.5"><Ico className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</span></Label>
                <Textarea rows={2} value={data[item.key] || ""} onChange={(e) => onChange({ ...data, [item.key]: e.target.value })} className={textareaCls} />
              </div>
            );
          })}
        </CardContent>
        <CardFooter className="justify-end p-5 pt-0">
          <Button onClick={onSave} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
            <Save className="h-4 w-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
