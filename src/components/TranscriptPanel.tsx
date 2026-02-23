"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "../lib/use-meeting";

const SPEAKER_COLOURS = [
  "text-indigo-400",
  "text-emerald-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-violet-400",
];

const SPEAKER_BG_COLOURS = [
  "bg-indigo-500/10",
  "bg-emerald-500/10",
  "bg-amber-500/10",
  "bg-rose-500/10",
  "bg-cyan-500/10",
  "bg-violet-500/10",
];

function speakerIndex(speaker: string | number): number {
  return typeof speaker === "number"
    ? speaker
    : Array.from(speaker).reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function speakerColour(speaker: string | number): string {
  return SPEAKER_COLOURS[speakerIndex(speaker) % SPEAKER_COLOURS.length];
}

function speakerBgColour(speaker: string | number): string {
  return SPEAKER_BG_COLOURS[speakerIndex(speaker) % SPEAKER_BG_COLOURS.length];
}

function speakerLabel(speaker: string | number): string {
  return typeof speaker === "number" ? `Speaker ${speaker + 1}` : speaker;
}

function TranscriptEntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TranscriptEntry;
  onEdit?: (id: number, text: string) => void;
  onDelete?: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canManage = entry.id != null && onEdit && onDelete;

  const handleSave = () => {
    const trimmed = editText.trim();
    if (!trimmed || !entry.id) return;
    onEdit!(entry.id, trimmed);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(entry.text);
    setEditing(false);
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg bg-zinc-900/50 p-2">
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">Save</button>
          <button onClick={handleCancel} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-lg px-3 py-2 transition-colors hover:bg-zinc-800/30">
      {entry.speaker != null && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${speakerBgColour(entry.speaker)} ${speakerColour(entry.speaker)}`}>
            {speakerLabel(entry.speaker).charAt(0).toUpperCase()}
          </span>
          <span className={`text-xs font-medium ${speakerColour(entry.speaker)}`}>
            {speakerLabel(entry.speaker)}
          </span>
        </div>
      )}
      <p className={`text-sm leading-relaxed ${entry.isFinal ? "text-zinc-300" : "text-zinc-600 italic"}`}>
        {entry.text}
      </p>
      {canManage && (
        <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
          <button
            onClick={() => { setEditText(entry.text); setEditing(true); }}
            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete!(entry.id!)}
            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

interface GroupedEntry {
  entries: TranscriptEntry[];
  speaker: string | number | null | undefined;
  text: string;
  isFinal: boolean;
}

function groupConsecutiveEntries(entries: TranscriptEntry[]): GroupedEntry[] {
  const groups: GroupedEntry[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === entry.speaker && last.isFinal && entry.isFinal) {
      last.entries.push(entry);
      last.text += " " + entry.text;
    } else {
      groups.push({
        entries: [entry],
        speaker: entry.speaker,
        text: entry.text,
        isFinal: entry.isFinal,
      });
    }
  }
  return groups;
}

export function TranscriptPanel({
  entries,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
}: {
  entries: TranscriptEntry[];
  collapsed: boolean;
  onToggle: () => void;
  onEdit?: (id: number, text: string) => void;
  onDelete?: (id: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const groups = groupConsecutiveEntries(entries);

  return (
    <div className={`relative flex h-full flex-col border-r border-zinc-800/50 bg-zinc-950 transition-all duration-300 ${collapsed ? "w-0 overflow-hidden border-r-0" : "w-80"}`}>
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Transcript</h2>
        </div>
        {entries.length > 0 && (
          <span className="text-[10px] tabular-nums text-zinc-600">{entries.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-0.5">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-centre">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <p className="text-xs text-zinc-600">Start recording or type to begin</p>
          </div>
        )}
        {groups.map((group, i) => (
          group.entries.length === 1 ? (
            <TranscriptEntryRow
              key={group.entries[0].id ?? `live-${i}`}
              entry={group.entries[0]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <div key={`group-${group.entries[0].id ?? i}`} className="rounded-lg px-3 py-2">
              {group.speaker != null && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${speakerBgColour(group.speaker)} ${speakerColour(group.speaker)}`}>
                    {speakerLabel(group.speaker).charAt(0).toUpperCase()}
                  </span>
                  <span className={`text-xs font-medium ${speakerColour(group.speaker)}`}>
                    {speakerLabel(group.speaker)}
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed text-zinc-300">{group.text}</p>
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-8 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800 transition-colors hover:bg-zinc-800 hover:text-zinc-300 z-10"
        title={collapsed ? "Show transcript" : "Hide transcript"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${collapsed ? "rotate-180" : ""}`}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}
