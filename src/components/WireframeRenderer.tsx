"use client";

import { useMemo } from "react";

export function WireframeRenderer({ content }: { content: string }) {
  const html = useMemo(() => {
    if (!content) return "";
    return content.replace(/^```(?:html)?\n?/gm, "").replace(/```$/gm, "").trim();
  }, [content]);

  if (!html) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        No wireframe generated yet
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      sandbox="allow-same-origin"
      className="h-full w-full border-0 bg-white"
      title="Wireframe preview"
    />
  );
}
