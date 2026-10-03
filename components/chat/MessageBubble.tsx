"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Bot, User } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string | any;
  isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  isStreaming = false,
}) => {
  const [copied, setCopied] = useState(false);

  const displayContent = 
    typeof content === "string" 
      ? content 
      : Array.isArray(content)
      ? content.map(c => (typeof c === "object" ? c.text || JSON.stringify(c) : c)).join(" ")
      : typeof content === "object" && content !== null
      ? content.text || JSON.stringify(content)
      : String(content || "");

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === "user";

  return (
    <div className={`flex w-full gap-3 py-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all ${
          isUser
            ? "bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-100"
            : "border border-zinc-800 bg-zinc-900/60 text-zinc-200 backdrop-blur-xs"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        ) : (
          <div className="prose prose-invert max-w-none text-zinc-200 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent || (isStreaming ? "..." : "")}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block h-3.5 w-1.5 animate-pulse bg-zinc-400 ml-1 rounded-xs" />
            )}
          </div>
        )}

        {!isUser && displayContent && !isStreaming && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-6 right-2 flex items-center gap-1 text-[11px] text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
            title="Copy response"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
