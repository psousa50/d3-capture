"use client";

import type { Participant } from "../lib/socket-client";

const COLOURS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
];

function colourForId(id: string): string {
  const hash = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLOURS[hash % COLOURS.length];
}

function initialsFor(participant: Participant): string {
  if (participant.name) {
    return participant.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
  }
  return participant.role === "producer" ? "P" : "V";
}

export function PresenceIndicator({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) return null;

  const producers = participants.filter((p) => p.role === "producer");
  const viewers = participants.filter((p) => p.role === "viewer");

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-1.5">
        {participants.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className={`flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-zinc-950 text-[10px] font-semibold text-white ${colourForId(p.id)}`}
            title={p.name ?? p.role}
          >
            {initialsFor(p)}
          </div>
        ))}
        {participants.length > 5 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-zinc-950 bg-zinc-700 text-[10px] font-semibold text-zinc-300">
            +{participants.length - 5}
          </div>
        )}
      </div>
      <span className="text-xs text-zinc-500">
        {producers.length > 0 && `${producers.length} recording`}
        {producers.length > 0 && viewers.length > 0 && ", "}
        {viewers.length > 0 && `${viewers.length} viewing`}
      </span>
    </div>
  );
}
