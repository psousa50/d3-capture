"use client";

import type { MeetingStatus } from "../lib/use-meeting";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MeetingControls({
  status,
  elapsed,
  error,
  onStart,
  onStop,
}: {
  status: MeetingStatus;
  elapsed: number;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
      <div className="flex items-center gap-4">
        {status === "idle" && (
          <button
            onClick={onStart}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Start Meeting
          </button>
        )}
        {status === "connecting" && (
          <button
            disabled
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400"
          >
            Connecting...
          </button>
        )}
        {status === "recording" && (
          <>
            <button
              onClick={onStop}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              End Meeting
            </button>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording {formatTime(elapsed)}
            </div>
          </>
        )}
        {status === "error" && (
          <button
            onClick={onStart}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Retry
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
