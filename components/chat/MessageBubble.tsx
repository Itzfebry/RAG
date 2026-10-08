"use client";

import React, { useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Check, Copy } from "lucide-react";
import { TripleDotSpinner } from "@/components/ui/triple-dot-spinner";
import { motion } from "framer-motion";

interface Props {
  role: "user" | "assistant";
  content: string | any;
  isStreaming?: boolean;
  durationMs?: number;
}

function fmtSec(ms: number) {
  if (ms < 1000) return `${(ms / 1000).toFixed(2)} dtk`;
  return `${(ms / 1000).toFixed(2)} dtk`;
}

export const MessageBubble: React.FC<Props> = ({ role, content, isStreaming = false, durationMs }) => {
  const [copied, setCopied] = useState(false);
  const raw =
    typeof content === "string"
      ? content
      : Array.isArray(content)
      ? content.map((c) => (typeof c === "object" ? (c as any).text || JSON.stringify(c) : c)).join(" ")
      : typeof content === "object" && content !== null
      ? (content as any).text || JSON.stringify(content)
      : String(content || "");

  const onCopy = async () => {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (role === "user") {
    return (
      <motion.div 
        className="flex justify-end"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-[76%] rounded-[18px] bg-gradient-to-br from-white/[0.11] to-white/[0.07] px-4 py-3 shadow-lg ring-1 ring-white/[0.10] backdrop-blur-sm">
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.68] tracking-[-0.012em] text-zinc-50">{raw}</p>
        </div>
      </motion.div>
    );
  }

  // strip "---" hr; normalisasi <br> agar tidak tampil literal di tabel sel
  const cleaned = raw
    .replace(/^---+\s*/gm, "")
    .replace(/\n---+\s*/g, "\n")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/\\<br\s*\/?>/gi, "<br>")
    .trim();

  if (isStreaming && !cleaned) {
    return (
      <motion.div 
        className="flex gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 shadow-md mt-1">
          <Image src="/image/favicon.png" alt="ITZ" width={32} height={32} className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-2.5 pt-1.5">
          <TripleDotSpinner size={20} />
          <span className="text-[12.5px] tracking-wide text-zinc-500">Memproses…</span>
          {typeof durationMs === "number" && durationMs > 0 && (
            <span className="text-[11px] tracking-wide text-zinc-500">· {fmtSec(durationMs)}</span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="group flex gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 shadow-md mt-1">
        <Image src="/image/favicon.png" alt="ITZ" width={32} height={32} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="prose prose-itz max-w-none text-[15px] font-[450] leading-[1.72] tracking-[-0.012em] text-zinc-200 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-zinc-100 prose-strong:font-semibold prose-strong:text-white prose-a:text-[#8ab4ff] prose-a:no-underline hover:prose-a:underline prose-code:rounded-md prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-medium prose-code:text-zinc-100 prose-code:ring-1 prose-code:ring-white/[0.09] prose-li:marker:text-zinc-500 prose-hr:hidden prose-table:w-full prose-th:text-left prose-th:text-zinc-100 prose-td:text-zinc-300 prose-td:align-top">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              br: () => <br />,
            }}
          >
            {cleaned}
          </ReactMarkdown>
          {isStreaming && !!cleaned && (
            <span className="ml-1 inline-block h-[15px] w-[2.5px] translate-y-[2px] animate-pulse rounded-full bg-zinc-300" />
          )}
        </div>
        {isStreaming && !!cleaned && typeof durationMs === "number" && (
          <div className="mt-2.5 text-[11px] tracking-wide text-zinc-500">{fmtSec(durationMs)}</div>
        )}
        {!!cleaned && !isStreaming && (
          <motion.div 
            className="mt-2.5 flex items-center gap-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {typeof durationMs === "number" && (
              <span className="text-[11px] tracking-wide text-zinc-500">{fmtSec(durationMs)}</span>
            )}
            <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden />
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[11px] tracking-wide text-zinc-500 opacity-0 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-zinc-300 hover:scale-105 group-hover:opacity-100 focus-visible:opacity-100"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
