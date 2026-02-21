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
          background: "#18181b",
          primaryColor: "#27272a",
          primaryTextColor: "#d4d4d8",
          primaryBorderColor: "#3f3f46",
          secondaryColor: "#27272a",
          secondaryTextColor: "#d4d4d8",
          secondaryBorderColor: "#3f3f46",
          tertiaryColor: "#27272a",
          tertiaryTextColor: "#d4d4d8",
          tertiaryBorderColor: "#3f3f46",
          lineColor: "#52525b",
          textColor: "#d4d4d8",
          mainBkg: "#27272a",
          nodeBorder: "#3f3f46",
          nodeTextColor: "#d4d4d8",
          clusterBkg: "#18181b",
          clusterBorder: "#3f3f46",
          titleColor: "#d4d4d8",
          edgeLabelBackground: "#18181b",
          actorBkg: "#27272a",
          actorBorder: "#3f3f46",
          actorTextColor: "#d4d4d8",
          signalColor: "#52525b",
          signalTextColor: "#d4d4d8",
          labelBoxBkgColor: "#27272a",
          labelBoxBorderColor: "#3f3f46",
          labelTextColor: "#d4d4d8",
          noteBkgColor: "#1e293b",
          noteBorderColor: "#334155",
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
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        No diagram generated yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div ref={containerRef} className={error ? "hidden" : ""} />
      {error && (
        <>
          <p className="mb-2 text-sm text-amber-400">{error}</p>
          <pre className="rounded bg-zinc-900 p-3 text-xs text-zinc-400 overflow-auto">
            {content}
          </pre>
        </>
      )}
    </div>
  );
}
