"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tLabel, inputCls, textareaCls } from "../adminStyles";
import type { KnowledgeCategory } from "@/lib/api-types";

export type KnowledgeEntryForm = {
  id: string;
  title: string;
  content: string;
  category_id: string;
};

type KnowledgeEntryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryForm: KnowledgeEntryForm;
  setEntryForm: React.Dispatch<React.SetStateAction<KnowledgeEntryForm>>;
  onSave: (e: React.FormEvent) => void;
  categories: KnowledgeCategory[];
  selectedCategorySlug: string;
  setSelectedCategorySlug: (slug: string) => void;
  saving?: boolean;
};

export function KnowledgeEntryModal({
  open,
  onOpenChange,
  entryForm,
  setEntryForm,
  onSave,
  categories,
  selectedCategorySlug,
  setSelectedCategorySlug,
  saving = false,
}: KnowledgeEntryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-900 text-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold tracking-[0.08em] uppercase text-white">
            Tambah Knowledge Baru
          </DialogTitle>
          <DialogDescription className="text-[16px] leading-relaxed text-zinc-500">
            Buat entri pengetahuan baru yang akan di-embedding dan dipakai sebagai konteks AI.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label className={tLabel}>Judul / Topik</Label>
            <Input
              value={entryForm.title}
              onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
              required
              placeholder="Misal: Arsitektur Backend ITZ AI"
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>Kategori</Label>
            <Select
              value={selectedCategorySlug}
              onValueChange={(v) => setSelectedCategorySlug(v ?? selectedCategorySlug)}
            >
              <SelectTrigger className="border-white/10 bg-zinc-800 text-white text-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-900 text-white">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>Konten Pengetahuan</Label>
            <Textarea
              rows={5}
              value={entryForm.content}
              onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })}
              required
              placeholder="Tuliskan pengetahuan detail yang akan diserap oleh AI..."
              className={textareaCls}
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]"
          >
            Batal
          </Button>
          <Button
            onClick={(e) => onSave(e)}
            disabled={saving}
            className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan & Generate Embedding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
