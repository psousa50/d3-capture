"use client";

import { useState } from "react";
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
  onStop,
  onSendText,
}: {
  status: MeetingStatus;
  elapsed: number;
  error: string | null;
  onStop: () => void;
  onSendText: (text: string) => void;
}) {
  const [textInput, setTextInput] = useState("");

  const handleSubmit = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setTextInput("");
  };

  return (
    <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-3">
      <div className="flex shrink-0 items-center gap-4">
        {status === "connecting" && (
          <span className="text-sm text-zinc-400">Connecting...</span>
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
      </div>

      {status === "recording" && (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a meeting description..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
          >
            Send
          </button>
        </form>
      )}

      {error && <p className="shrink-0 text-sm text-red-400">{error}</p>}
    </div>
  );
}
