"use client";

import React from "react";
import { Cog, ScrollText, ShieldCheck, Layers3, GitBranch, FileCode, Save } from "lucide-react";
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

export type InstructionsData = {
  behavioral_rules: string;
  response_rules: string;
  safety_rules: string;
  knowledge_priority: string;
  reasoning_constraints: string;
  formatting_rules: string;
};

const FIELDS = [
  { key: "behavioral_rules", label: "Behavioral Rules", Icon: Cog, color: cZinc },
  { key: "response_rules", label: "Response Rules", Icon: ScrollText, color: cAmber },
  { key: "safety_rules", label: "Safety Rules", Icon: ShieldCheck, color: cEmerald },
  { key: "knowledge_priority", label: "Knowledge Priority", Icon: Layers3, color: cViolet },
  { key: "reasoning_constraints", label: "Reasoning Constraints", Icon: GitBranch, color: cSky },
  { key: "formatting_rules", label: "Formatting Rules", Icon: FileCode, color: cRose },
] as const;

export function InstructionsTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: InstructionsData;
  onChange: (next: InstructionsData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Instruksi Sistem"
        desc="Layer dengan prioritas tertinggi untuk behavioral rules, safety rules, dan knowledge priority."
      />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCard}>System Instructions</CardTitle>
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
