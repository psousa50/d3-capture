"use client";

import { useEffect, useState } from "react";
import type { DocumentEntry } from "../lib/socket-client";

export function TranscriptImportModal({
  open,
  onClose,
  onImport,
  loading,
  documents = [],
}: {
  open: boolean;
  onClose: () => void;
  onImport: (transcript: string, name: string) => void;
  loading: boolean;
  documents?: DocumentEntry[];
}) {
  const nextDefault = `Doc ${Math.max(0, ...documents.map((d) => d.docNumber)) + 1}`;
  const [text, setText] = useState("");
  const [name, setName] = useState(nextDefault);

  useEffect(() => {
    if (open) {
      setText("");
      setName(nextDefault);
    }
  }, [open, nextDefault]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onImport(trimmed, name.trim() || nextDefault);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Import Document</h2>
            <p className="text-xs text-zinc-500">Paste a document to generate specs, stories, and diagrams</p>
          </div>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
          disabled={loading}
          className="mt-5 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 disabled:opacity-50"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your content here..."
          disabled={loading}
          className="mt-3 h-64 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/25 disabled:opacity-50"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
