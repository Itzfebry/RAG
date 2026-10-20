"use client";

import { Fingerprint, Briefcase, ScrollText, Brain, Target, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  inputCls,
  textareaCls,
} from "../adminStyles";

export type IdentityData = {
  name: string;
  role: string;
  description: string;
  identity: string;
  purpose: string;
};

export function IdentityTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: IdentityData;
  onChange: (next: IdentityData) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Identitas AI"
        desc="Menentukan identitas dasar, nama, peran, dan tujuan ITZ AI."
      />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCard}>Identitas</CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} grid gap-4`}>
          <div className="space-y-2">
            <Label className={tLabel}>
              <span className="flex items-center gap-1.5">
                <Fingerprint className={`h-3.5 w-3.5 ${cSky}`} />
                Nama AI
              </span>
            </Label>
            <Input
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>
              <span className="flex items-center gap-1.5">
                <Briefcase className={`h-3.5 w-3.5 ${cViolet}`} />
                Peran
              </span>
            </Label>
            <Input
              value={data.role}
              onChange={(e) => onChange({ ...data, role: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>
              <span className="flex items-center gap-1.5">
                <ScrollText className={`h-3.5 w-3.5 ${cAmber}`} />
                Deskripsi
              </span>
            </Label>
            <Textarea
              rows={2}
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              className={textareaCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>
              <span className="flex items-center gap-1.5">
                <Brain className={`h-3.5 w-3.5 ${cEmerald}`} />
                Pernyataan Identitas
              </span>
            </Label>
            <Textarea
              rows={3}
              value={data.identity}
              onChange={(e) => onChange({ ...data, identity: e.target.value })}
              className={textareaCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>
              <span className="flex items-center gap-1.5">
                <Target className={`h-3.5 w-3.5 ${cRose}`} />
                Tujuan
              </span>
            </Label>
            <Textarea
              rows={3}
              value={data.purpose}
              onChange={(e) => onChange({ ...data, purpose: e.target.value })}
              className={textareaCls}
            />
          </div>
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
