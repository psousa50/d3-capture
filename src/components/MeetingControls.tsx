"use client";

import { useState } from "react";
import type { MeetingStatus } from "../lib/use-meeting";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MeetingControls({
  status,
  elapsed,
  error,
  onStartRecording,
  onStopRecording,
  onStop,
  onSendText,
}: {
  status: MeetingStatus;
  elapsed: number;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
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

  const isActive = status === "connected" || status === "recording";

  return (
    <div className="flex justify-center px-4 py-3">
      <div className="flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-zinc-800/50 bg-zinc-900/80 px-4 py-2.5 shadow-lg backdrop-blur-sm">
        {status === "connecting" && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
            Connecting...
          </div>
        )}

        {isActive && (
          <button
            onClick={onStop}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            End
          </button>
        )}

        {status === "connected" && (
          <button
            onClick={onStartRecording}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-500"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white" />
            Record
          </button>
        )}

        {status === "recording" && (
          <div className="shrink-0 flex items-center gap-3">
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-700"
            >
              <span className="inline-block h-2 w-2 rounded-sm bg-zinc-400" />
              Stop
            </button>
            <div className="flex items-center gap-2 text-sm tabular-nums text-zinc-400">
              <span className="inline-block h-2 w-2 animate-recording-pulse rounded-full bg-red-500" />
              {formatTime(elapsed)}
            </div>
          </div>
        )}

        {isActive && (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Describe what's being discussed..."
              className="flex-1 rounded-lg border-0 bg-transparent px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        )}

        {error && (
          <p className="shrink-0 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
