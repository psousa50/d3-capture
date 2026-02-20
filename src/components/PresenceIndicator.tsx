"use client";

import type { Participant } from "../lib/socket-client";

const COLOURS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function colourForId(id: string): string {
  const hash = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLOURS[hash % COLOURS.length];
}

export function PresenceIndicator({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) return null;

  const producers = participants.filter((p) => p.role === "producer");
  const viewers = participants.filter((p) => p.role === "viewer");

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-1.5">
        {participants.slice(0, 6).map((p) => (
          <div
            key={p.id}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-950 text-[10px] font-medium text-white ${colourForId(p.id)}`}
            title={`${p.id} (${p.role})`}
          >
            {p.role === "producer" ? "P" : "V"}
          </div>
        ))}
      </div>
      <span className="text-xs text-zinc-500">
        {producers.length} recording{viewers.length > 0 ? `, ${viewers.length} viewing` : ""}
      </span>
    </div>
  );
}
