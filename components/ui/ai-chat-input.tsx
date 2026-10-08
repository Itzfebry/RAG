"use client";

import * as React from "react";
import { Paperclip, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function AIChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Tanyakan apa saja kepada ITZ AI…",
  className,
}: Props) {
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 144)}px`;
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div className={cn("relative w-full", className)}>
      <div className="input-glow relative flex items-end gap-2.5 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0e0e10]/98 px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />
        
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-all duration-200 hover:bg-white/[0.08] hover:text-zinc-300 hover:scale-105 active:scale-95 focus-visible:outline-offset-0"
          aria-label="Attach file"
        >
          <Paperclip className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
        <input ref={fileRef} type="file" className="hidden" tabIndex={-1} />

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          className="relative z-10 max-h-36 min-h-[26px] flex-1 resize-none bg-transparent py-1.5 text-[14.5px] leading-[1.5] tracking-[-0.011em] text-zinc-100 placeholder:text-zinc-500 outline-none"
          aria-label="Message input"
        />

        <button
          type="button"
          onClick={() => canSend && onSubmit()}
          disabled={!canSend}
          className={cn(
            "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-offset-0",
            canSend 
              ? "bg-white text-black hover:bg-zinc-100 hover:scale-105 active:scale-95 shadow-[0_2px_12px_rgba(255,255,255,0.15)]" 
              : "bg-white/[0.08] text-zinc-600 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-700" />
          ) : (
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
}
export default AIChatInput;
