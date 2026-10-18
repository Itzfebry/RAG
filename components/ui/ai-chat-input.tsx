"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeCommandsFromInput, suggestCommands } from "@/lib/chat-commands";

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
  const suggestions = React.useMemo(() => suggestCommands(value), [value]);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const activeCmds = React.useMemo(() => activeCommandsFromInput(value), [value]);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [suggestions.length, value]);

  React.useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 144)}px`;
  }, [value]);

  const applySuggestion = (name: string) => {
    onChange(`/${name} `);
    taRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applySuggestion(suggestions[activeIdx].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div className={cn("relative w-full", className)}>
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Daftar command"
          className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#16161c] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
        >
          {suggestions.map((c, i) => (
            <li
              key={c.name}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); applySuggestion(c.name); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2", i === activeIdx ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
            >
              <span className="font-mono text-[13px] text-zinc-100">/{c.name}</span>
              <span className="truncate text-[12px] text-zinc-500">{c.purpose}</span>
            </li>
          ))}
        </ul>
      )}
      {activeCmds.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Mode aktif">
          <span className="text-[11.5px] text-zinc-500">Mode:</span>
          {activeCmds.map((n) => (
            <span key={n} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-300">
              /{n}
            </span>
          ))}
        </div>
      )}
      <div className="input-glow relative flex items-end gap-2.5 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0e0e10]/98 px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />

        <textarea
          ref={taRef}
          id="itz-chat-input"
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
