"use client";

import { useEffect, useRef } from "react";

interface TranscriptEntry {
  text: string;
  speaker?: number;
  isFinal: boolean;
}

const SPEAKER_COLOURS = [
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-rose-400",
  "text-cyan-400",
];

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400">
        Transcript
      </h2>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-zinc-600">Waiting for speech...</p>
        )}
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`text-sm ${entry.isFinal ? "text-zinc-200" : "text-zinc-500"}`}
          >
            {entry.speaker !== undefined && (
              <span
                className={`font-medium ${SPEAKER_COLOURS[entry.speaker % SPEAKER_COLOURS.length]}`}
              >
                Speaker {entry.speaker + 1}:{" "}
              </span>
            )}
            {entry.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
