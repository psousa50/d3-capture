"use client";

import { useState } from "react";

export function TranscriptImportModal({
  open,
  onClose,
  onImport,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (transcript: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onImport(trimmed);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-lg font-medium text-zinc-200">Import Transcript</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Paste a meeting transcript to generate specs, stories, and diagrams.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your meeting transcript here..."
          disabled={loading}
          className="mt-4 h-64 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
