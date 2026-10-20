"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

/**
 * Merapikan output AI sebelum dirender: rapatkan baris kosong berlebih,
 * buang baris berisi spasi saja, dan samakan tanda bullet/strip (– — •) ke
 * "-" standar markdown. Segmen di dalam code fence (```) tidak disentuh.
 */
function normalizeSegment(segment: string): string {
  return segment
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[^\S\n]+$/gm, "")
    .replace(/^(\s*)[–—]\s+/gm, "$1- ")
    .replace(/^(\s*)•\s+/gm, "$1- ")
    .replace(/^(\s*)▪\s+/gm, "$1- ")
    .replace(/^(#{1,6})\s*(\S)/gm, "$1 $2"); // pastikan spasi setelah heading
}

function tidyOutput(raw: string): string {
  if (!raw) return raw;
  // Pecah per code fence: segmen genap = teks biasa, ganjil = isi code block.
  const parts = raw.split("```");
  return parts.map((seg, i) => (i % 2 === 1 ? seg : normalizeSegment(seg))).join("```");
}

/**
 * Client-only markdown renderer. Kept in its own module so react-markdown,
 * remark-gfm and rehype-raw are all code-split out of the chat entry chunk.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        br: () => <br />,
      }}
    >
      {tidyOutput(children)}
    </ReactMarkdown>
  );
}
