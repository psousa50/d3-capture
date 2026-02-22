"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "../lib/use-meeting";

const SPEAKER_COLOURS = [
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-rose-400",
  "text-cyan-400",
];

function speakerColour(speaker: string | number): string {
  const index = typeof speaker === "number"
    ? speaker
    : Array.from(speaker).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SPEAKER_COLOURS[index % SPEAKER_COLOURS.length];
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
      <div className="space-y-1">
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
          className="w-full resize-none rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
          <button onClick={handleCancel} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className={`text-sm ${entry.isFinal ? "text-zinc-200" : "text-zinc-500"}`}>
        {entry.speaker != null && (
          <span className={`font-medium ${speakerColour(entry.speaker)}`}>
            {speakerLabel(entry.speaker)}:{" "}
          </span>
        )}
        {entry.text}
      </div>
      {canManage && (
        <div className="absolute -top-1 right-0 hidden gap-1 group-hover:flex">
          <button
            onClick={() => { setEditText(entry.text); setEditing(true); }}
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete!(entry.id!)}
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-red-400 hover:text-red-300"
          >
            Delete
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
  onEdit,
  onDelete,
}: {
  entries: TranscriptEntry[];
  onEdit?: (id: number, text: string) => void;
  onDelete?: (id: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const groups = groupConsecutiveEntries(entries);

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400">
        Transcript
      </h2>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-zinc-600">No transcript yet.</p>
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
            <div key={`group-${group.entries[0].id ?? i}`} className="text-sm text-zinc-200">
              {group.speaker != null && (
                <span className={`font-medium ${speakerColour(group.speaker)}`}>
                  {speakerLabel(group.speaker)}:{" "}
                </span>
              )}
              {group.text}
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
