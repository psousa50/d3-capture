"use client";

import { useEffect, useRef } from "react";
import type { GuidanceItem } from "../lib/socket-client";

function QuestionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SuggestionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function GuidanceItemRow({
  item,
  onToggleResolved,
}: {
  item: GuidanceItem;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const isQuestion = item.type === "question";

  return (
    <div className={`group flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/30 ${item.resolved ? "opacity-50" : ""}`}>
      <button
        onClick={() => onToggleResolved(item.id, !item.resolved)}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          item.resolved
            ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-400"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        {item.resolved && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className={isQuestion ? "text-amber-400" : "text-indigo-400"}>
            {isQuestion ? <QuestionIcon /> : <SuggestionIcon />}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isQuestion ? "text-amber-400/70" : "text-indigo-400/70"}`}>
            {item.type}
          </span>
        </div>
        <p className={`text-sm leading-relaxed ${item.resolved ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
          {item.content}
        </p>
      </div>
    </div>
  );
}

export function GuidancePanel({
  items,
  collapsed,
  onToggle,
  onResolve,
  onUnresolve,
}: {
  items: GuidanceItem[];
  collapsed: boolean;
  onToggle: () => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  const unresolvedCount = items.filter((i) => !i.resolved).length;

  const unresolved = items.filter((i) => !i.resolved);
  const resolved = items.filter((i) => i.resolved);

  const handleToggle = (id: string, shouldResolve: boolean) => {
    if (shouldResolve) {
      onResolve(id);
    } else {
      onUnresolve(id);
    }
  };

  return (
    <div className={`relative flex h-full flex-col border-l border-zinc-800/50 bg-zinc-950 transition-all duration-300 ${collapsed ? "w-0 overflow-hidden border-l-0" : "w-80"}`}>
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Guidance</h2>
        </div>
        {unresolvedCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500/15 px-1.5 text-[10px] font-medium tabular-nums text-indigo-400 ring-1 ring-indigo-500/25">
            {unresolvedCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-0.5">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-centre">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <p className="text-xs text-zinc-600">Items will appear as the conversation progresses</p>
          </div>
        )}

        {unresolved.map((item) => (
          <GuidanceItemRow key={item.id} item={item} onToggleResolved={handleToggle} />
        ))}

        {resolved.length > 0 && unresolved.length > 0 && (
          <div className="mx-3 my-2 border-t border-zinc-800/50" />
        )}

        {resolved.map((item) => (
          <GuidanceItemRow key={item.id} item={item} onToggleResolved={handleToggle} />
        ))}

        <div ref={bottomRef} />
      </div>

      <button
        onClick={onToggle}
        className="absolute -left-8 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-800 hover:text-zinc-300 z-10"
        title={collapsed ? "Show guidance" : "Hide guidance"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? "" : "rotate-180"}`}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}
