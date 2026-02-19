"use client";

import { useEffect, useRef, useState } from "react";

export function DiagramRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastContentRef = useRef<string>("");

  useEffect(() => {
    if (!content || !containerRef.current || content === lastContentRef.current) return;

    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#18181b",
          primaryColor: "#3b82f6",
          primaryTextColor: "#e4e4e7",
          lineColor: "#71717a",
        },
      });

      const cleaned = content.replace(/^```(?:mermaid)?\n?/gm, "").replace(/```$/gm, "").trim();
      const id = `diagram-${Date.now()}`;
      const { svg } = await mermaid.render(id, cleaned);
      if (!cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
        lastContentRef.current = content;
        setError(null);
      }
    }

    render().catch((err) => {
      console.error("[mermaid]", err);
      if (!cancelled) setError("Invalid diagram syntax");
    });
    return () => { cancelled = true; };
  }, [content]);

  if (!content && !lastContentRef.current) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        No diagram generated yet
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <p className="mb-2 text-sm text-amber-400">{error}</p>
        <pre className="rounded bg-zinc-900 p-3 text-xs text-zinc-400 overflow-auto">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto p-4"
    />
  );
}
