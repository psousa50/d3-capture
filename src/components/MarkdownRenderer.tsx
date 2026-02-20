"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownRenderer({
  content,
  placeholder,
}: {
  content: string;
  placeholder: string;
}) {
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-sm h-full max-w-none overflow-y-auto p-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
