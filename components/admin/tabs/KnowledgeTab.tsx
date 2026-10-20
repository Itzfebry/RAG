"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { SectionHeader } from "../SectionHeader";
import { cardBase, cardHeaderCls, cardContentCls, tCard } from "../adminStyles";

export type KnowledgeCategory = { id: string; name: string; slug: string };
export type KnowledgeEntry = { id: string; title: string; content: string; category_id: string };

export function KnowledgeTab({
  categories,
  entries,
  selectedCategorySlug,
  onSelectCategory,
  onAddEntry,
  onDeleteEntry,
}: {
  categories: KnowledgeCategory[];
  entries: KnowledgeEntry[];
  selectedCategorySlug: string;
  onSelectCategory: (slug: string) => void;
  onAddEntry: () => void;
  onDeleteEntry: (id: string) => void;
}) {
  const visible = entries.filter((e) => {
    const cat = categories.find((c) => c.id === e.category_id);
    return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <SectionHeader
        title="Basis Pengetahuan"
        desc="Pengetahuan owner terstruktur dan persisten dengan pencarian embedding semantik."
      />
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className={tCard}>Knowledge Entries</CardTitle>
            <Button
              onClick={onAddEntry}
              className="h-8 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Knowledge</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className={`${cardContentCls} space-y-4`}>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategorySlug === cat.slug ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectCategory(cat.slug)}
                className={`h-8 text-[14px] ${selectedCategorySlug === cat.slug ? "bg-white text-black hover:bg-zinc-100 border border-white" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <div className="space-y-3">
            {visible.map((entry) => (
              <Card key={entry.id} className="rounded-xl border border-white/[0.07] bg-zinc-900/60">
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-[16px] font-medium text-zinc-200 leading-relaxed">
                      {entry.title}
                    </h4>
                    <p className="line-clamp-2 text-[14px] leading-relaxed text-zinc-500">
                      {entry.content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteEntry(entry.id)}
                    className="shrink-0 h-8 w-8 text-zinc-500 hover:text-red-300 hover:bg-red-500/10"
                    title="Hapus entri"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {visible.length === 0 && (
              <Card className="border-dashed border-white/10 bg-zinc-900/40 rounded-xl">
                <CardContent className="p-8 text-center text-[16px] text-zinc-500">
                  Belum ada knowledge pada kategori ini. Klik &quot;Tambah Knowledge&quot; untuk
                  membuat entri baru.
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
