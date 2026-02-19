"use client";

import { useState } from "react";
import { DiagramRenderer } from "./DiagramRenderer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { ArtefactType } from "../lib/use-meeting";

interface ArtefactState {
  content: string;
  updating: boolean;
  pendingContent: string;
}

const TABS: { key: ArtefactType; label: string }[] = [
  { key: "diagram", label: "Diagram" },
  { key: "spec", label: "Spec" },
  { key: "stories", label: "Stories" },
];

export function ArtefactTabs({
  artefacts,
}: {
  artefacts: Record<ArtefactType, ArtefactState>;
}) {
  const [activeTab, setActiveTab] = useState<ArtefactType>("diagram");
  const active = artefacts[activeTab];
  const displayContent = active.updating ? active.pendingContent : active.content;

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {artefacts[tab.key].updating && (
              <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "diagram" && <DiagramRenderer content={displayContent} updating={active.updating} />}
        {activeTab === "spec" && (
          <MarkdownRenderer content={displayContent} placeholder="No spec generated yet" />
        )}
        {activeTab === "stories" && (
          <MarkdownRenderer
            content={displayContent}
            placeholder="No stories generated yet"
          />
        )}
      </div>
    </div>
  );
}
