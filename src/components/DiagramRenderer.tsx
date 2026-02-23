"use client";

import { useEffect, useRef, useState } from "react";

export function DiagramRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content || !containerRef.current) return;

    setError(null);
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          darkMode: true,
          background: "#0c0c0e",
          primaryColor: "#1e1e24",
          primaryTextColor: "#d4d4d8",
          primaryBorderColor: "#2e2e36",
          secondaryColor: "#1e1e24",
          secondaryTextColor: "#d4d4d8",
          secondaryBorderColor: "#2e2e36",
          tertiaryColor: "#1e1e24",
          tertiaryTextColor: "#d4d4d8",
          tertiaryBorderColor: "#2e2e36",
          lineColor: "#4b4b57",
          textColor: "#d4d4d8",
          mainBkg: "#1e1e24",
          nodeBorder: "#3f3f50",
          nodeTextColor: "#d4d4d8",
          clusterBkg: "#0c0c0e",
          clusterBorder: "#2e2e36",
          titleColor: "#d4d4d8",
          edgeLabelBackground: "#0c0c0e",
          actorBkg: "#1e1e24",
          actorBorder: "#3f3f50",
          actorTextColor: "#d4d4d8",
          signalColor: "#4b4b57",
          signalTextColor: "#d4d4d8",
          labelBoxBkgColor: "#1e1e24",
          labelBoxBorderColor: "#2e2e36",
          labelTextColor: "#d4d4d8",
          noteBkgColor: "#1a1a2e",
          noteBorderColor: "#2d2d4a",
          noteTextColor: "#d4d4d8",
        },
      });

      const cleaned = content.replace(/^```(?:mermaid)?\n?/gm, "").replace(/```$/gm, "").trim();
      const id = `diagram-${Date.now()}`;
      const { svg } = await mermaid.render(id, cleaned);
      if (!cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    }

    render().catch((err) => {
      console.error("[mermaid]", err);
      if (!cancelled) {
        if (containerRef.current) containerRef.current.innerHTML = "";
        setError("Invalid diagram syntax");
      }
    });
    return () => { cancelled = true; };
  }, [content]);

  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-centre">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
          <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
        </svg>
        <p className="text-xs text-zinc-600">No diagram generated yet</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div ref={containerRef} className={`flex justify-center ${error ? "hidden" : ""}`} />
      {error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {error}
          </div>
          <pre className="rounded-lg bg-zinc-900 p-4 text-xs text-zinc-500 overflow-auto border border-zinc-800/50">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
