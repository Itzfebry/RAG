"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, Copy, FileJson, AlertCircle } from "lucide-react";
import type { AdminImportData } from "@/lib/api-types";

type JsonImportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonText: string;
  setJsonText: (value: string) => void;
  jsonError: string;
  setJsonError: React.Dispatch<React.SetStateAction<string>>;
  jsonDrag: boolean;
  setJsonDrag: (value: boolean) => void;
  jsonFileRef: React.RefObject<HTMLInputElement | null>;
  handleBulkDownloadExample: () => void;
  handleJsonApplyFromText: () => void;
  handleJsonFile: (file: File) => void;
  applyImportedDataToState: (data: AdminImportData) => void;
  setSaveSuccess: (value: boolean) => void;
  saving: boolean;
};

export function JsonImportModal({
  open,
  onOpenChange,
  jsonText,
  setJsonText,
  jsonError,
  setJsonError,
  jsonDrag,
  setJsonDrag,
  jsonFileRef,
  handleBulkDownloadExample,
  handleJsonApplyFromText,
  handleJsonFile,
  applyImportedDataToState,
  setSaveSuccess,
  saving,
}: JsonImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col p-0 border-white/10 bg-zinc-900 text-white rounded-xl overflow-hidden">
        <DialogHeader className="border-b border-white/[0.07] p-6 pb-4 px-5 pt-5">
          <DialogTitle className="text-[14px] font-semibold tracking-[0.08em] uppercase text-white">
            Import JSON
          </DialogTitle>
          <DialogDescription className="text-[16px] leading-relaxed text-zinc-500">
            Tempel JSON atau upload file untuk mengisi konfigurasi admin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b border-white/[0.07] p-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setJsonDrag(true);
            }}
            onDragLeave={() => setJsonDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setJsonDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleJsonFile(f);
            }}
            className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-[16px] ${jsonDrag ? "border-white/20 bg-white/[0.06] text-white" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>{jsonDrag ? "Lepaskan file..." : "Drag & drop .json atau"}</span>
            <Button
              variant="link"
              size="sm"
              type="button"
              onClick={() => jsonFileRef.current?.click()}
              className="h-auto p-0 text-[16px] underline text-zinc-400"
            >
              pilih file
            </Button>
            <Input
              ref={jsonFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleJsonFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDownloadExample}
            className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5"
          >
            <FileJson className="h-3.5 w-3.5" /> Example
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([jsonText || "{}"], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "admin-config.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> .json
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(jsonText || "");
              } catch {}
            }}
            className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {jsonError && (
            <Alert variant="destructive" className="mb-3 border-red-500/30 bg-red-500/10">
              <AlertCircle className="text-red-400 h-4 w-4" />
              <AlertTitle className="text-red-300 text-[16px]">JSON error</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap text-red-200/70 text-[14px] leading-relaxed">
                {jsonError}
              </AlertDescription>
            </Alert>
          )}
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder='{"ai_identity": {...}, ...}'
            className="text-[14px] leading-relaxed border-white/10 bg-white/[0.03] text-white font-mono"
          />
        </div>

        <DialogFooter className="border-t border-white/[0.07] p-5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]"
          >
            Batal
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                applyImportedDataToState(JSON.parse(jsonText));
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
              } catch (e) {
                setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
            className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]"
          >
            Isi form saja
          </Button>
          <Button
            onClick={handleJsonApplyFromText}
            disabled={saving || !jsonText.trim()}
            className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium"
          >
            {saving ? "Mengimpor..." : "Validasi & Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
