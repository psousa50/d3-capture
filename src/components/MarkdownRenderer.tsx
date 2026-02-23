"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({
  content,
  placeholder,
}: {
  content: string;
  placeholder: string;
}) {
  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-centre">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p className="text-xs text-zinc-600">{placeholder}</p>
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-sm h-full max-w-none overflow-y-auto p-6 prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-p:leading-relaxed prose-a:text-indigo-400 prose-strong:text-zinc-200 prose-code:text-indigo-300 prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800/50">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
