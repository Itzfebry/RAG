"use client";

import React from "react";
import { Globe, Mic2, Type, Palette, Gauge, PenTool, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "../SectionHeader";
import {
  cardBase,
  cardHeaderCls,
  cardContentCls,
  tCard,
  tLabel,
  cSky,
  cViolet,
  cAmber,
  cEmerald,
  cRose,
  cZinc,
  inputCls,
} from "../adminStyles";

export type CommunicationData = {
  primary_language: string;
  tone: string;
  response_length: string;
  formatting_preference: string;
  technical_depth: string;
  explanation_style: string;
};

const FIELDS = [
  { key: "primary_language", label: "Bahasa Utama", Icon: Globe, color: cSky },
  { key: "tone", label: "Nada", Icon: Mic2, color: cRose },
  { key: "response_length", label: "Panjang Respons", Icon: Type, color: cZinc },
  { key: "formatting_preference", label: "Preferensi Format", Icon: Palette, color: cViolet },
  { key: "technical_depth", label: "Kedalaman Teknis", Icon: Gauge, color: cAmber },
  { key: "explanation_style", label: "Gaya Penjelasan", Icon: PenTool, color: cEmerald },
] as const;

export function CommunicationTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: CommunicationData;
  onChange: (next: CommunicationData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Gaya Komunikasi"
        desc="Pengaturan bahasa, panjang respons, format, dan kedalaman teknis."
      />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCard}>Communication</CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} grid gap-4`}>
          {FIELDS.map((item) => {
            const Ico = item.Icon;
            return (
              <div key={item.key} className="space-y-2">
                <Label className={tLabel}>
                  <span className="flex items-center gap-1.5">
                    <Ico className={`h-3.5 w-3.5 ${item.color}`} />
                    {item.label}
                  </span>
                </Label>
                <Input
                  value={data[item.key] || ""}
                  onChange={(e) => onChange({ ...data, [item.key]: e.target.value })}
                  className={inputCls}
                />
              </div>
            );
          })}
        </CardContent>
        <CardFooter className="justify-end p-5 pt-0">
          <Button
            onClick={onSave}
            disabled={saving}
            className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
