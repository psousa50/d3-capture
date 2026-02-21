"use client";

import { useEffect, useState } from "react";
import { DiagramRenderer } from "./DiagramRenderer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { WireframeRenderer } from "./WireframeRenderer";
import type { MeetingArtefacts } from "../lib/use-meeting";

type TopTab = "diagrams" | "spec" | "stories";

const TABS: { key: TopTab; label: string }[] = [
  { key: "diagrams", label: "Diagrams" },
  { key: "spec", label: "Spec" },
  { key: "stories", label: "Stories" },
];

export function ArtefactTabs({ artefacts }: { artefacts: MeetingArtefacts }) {
  const [activeTab, setActiveTab] = useState<TopTab>("diagrams");
  const [activeDiagram, setActiveDiagram] = useState<string | null>(null);

  const diagramKeys = Object.keys(artefacts.diagrams);

  useEffect(() => {
    if (diagramKeys.length > 0 && (!activeDiagram || !artefacts.diagrams[activeDiagram])) {
      setActiveDiagram(diagramKeys[0]);
    }
  }, [diagramKeys, activeDiagram, artefacts.diagrams]);

  const diagramsHaveActivity =
    artefacts.diagramsUpdating || diagramKeys.some((k) => artefacts.diagrams[k].updating);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-zinc-800">
        {TABS.map((tab) => {
          const isUpdating =
            tab.key === "diagrams"
              ? diagramsHaveActivity
              : artefacts[tab.key].updating;

          return (
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
              {isUpdating && (
                <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "diagrams" && (
          <DiagramPanel
            diagrams={artefacts.diagrams}
            diagramKeys={diagramKeys}
            activeDiagram={activeDiagram}
            onSelectDiagram={setActiveDiagram}
            planning={artefacts.diagramsUpdating && diagramKeys.length === 0}
            error={artefacts.diagramsError}
          />
        )}
        {activeTab === "spec" && (
          <MarkdownRenderer
            content={artefacts.spec.updating ? artefacts.spec.pendingContent : artefacts.spec.content}
            placeholder="No spec generated yet"
          />
        )}
        {activeTab === "stories" && (
          <MarkdownRenderer
            content={artefacts.stories.updating ? artefacts.stories.pendingContent : artefacts.stories.content}
            placeholder="No stories generated yet"
          />
        )}
      </div>
    </div>
  );
}

function DiagramPanel({
  diagrams,
  diagramKeys,
  activeDiagram,
  onSelectDiagram,
  planning,
  error,
}: {
  diagrams: MeetingArtefacts["diagrams"];
  diagramKeys: string[];
  activeDiagram: string | null;
  onSelectDiagram: (key: string) => void;
  planning: boolean;
  error: string | null;
}) {
  if (planning) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        Planning diagrams...
      </div>
    );
  }

  if (diagramKeys.length === 0 && error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-amber-400">
        Diagram generation failed: {error}
      </div>
    );
  }

  if (diagramKeys.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        No diagrams generated yet
      </div>
    );
  }

  const active = activeDiagram ? diagrams[activeDiagram] : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-zinc-800/50 bg-zinc-900/50 px-2 pt-1">
        {diagramKeys.map((key) => (
          <button
            key={key}
            onClick={() => onSelectDiagram(key)}
            className={`relative rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              activeDiagram === key
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {diagrams[key].label}
            {diagrams[key].updating && (
              <span className="ml-1.5 inline-block h-1 w-1 animate-pulse rounded-full bg-blue-400" />
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {active?.renderer === "html"
          ? <WireframeRenderer content={active.content} />
          : <DiagramRenderer content={active?.content ?? ""} />
        }
      </div>
    </div>
  );
}
