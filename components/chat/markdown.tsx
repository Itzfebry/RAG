"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

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
      {children}
    </ReactMarkdown>
  );
}
