"use client";

import React from "react";
import { User, History, Heart, Briefcase, Rocket, Settings2, MapPin, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  textareaCls,
} from "../adminStyles";

export type PersonalData = {
  profile: string;
  background: string;
  interests: string;
  experience: string;
  projects: string;
  preferences: string;
  relevant_context: string;
};

const FIELDS = [
  { key: "profile", label: "Profil", Icon: User, color: cSky },
  { key: "background", label: "Latar Belakang", Icon: History, color: cAmber },
  { key: "interests", label: "Minat", Icon: Heart, color: cRose },
  { key: "experience", label: "Pengalaman", Icon: Briefcase, color: cViolet },
  { key: "projects", label: "Proyek", Icon: Rocket, color: cEmerald },
  { key: "preferences", label: "Preferensi", Icon: Settings2, color: cZinc },
  { key: "relevant_context", label: "Konteks Relevan", Icon: MapPin, color: cSky },
] as const;

export function PersonalTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: PersonalData;
  onChange: (next: PersonalData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Informasi Personal"
        desc="Informasi mengenai owner yang dipakai sebagai konteks AI."
      />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCard}>Personal Information</CardTitle>
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
                <Textarea
                  rows={2}
                  value={data[item.key] || ""}
                  onChange={(e) => onChange({ ...data, [item.key]: e.target.value })}
                  className={textareaCls}
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
