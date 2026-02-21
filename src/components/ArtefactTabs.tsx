"use client";

import { useEffect, useState } from "react";
import { DiagramRenderer } from "./DiagramRenderer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { WireframeRenderer } from "./WireframeRenderer";
import type { MeetingArtefacts } from "../lib/use-meeting";
import { ConfirmModal } from "./ConfirmModal";
import type { DocumentEntry } from "../lib/socket-client";

type TopTab = "diagrams" | "spec" | "stories" | "transcripts";

const TABS: { key: TopTab; label: string }[] = [
  { key: "diagrams", label: "Diagrams" },
  { key: "spec", label: "Spec" },
  { key: "stories", label: "Stories" },
  { key: "transcripts", label: "Transcripts" },
];

interface ArtefactTabsProps {
  artefacts: MeetingArtefacts;
  documents?: DocumentEntry[];
  onDeleteDocument?: (id: string) => void;
  onRegenerateDiagrams?: () => void;
  onRegenerateDiagram?: (type: string, renderer: "mermaid" | "html") => void;
}

export function ArtefactTabs({ artefacts, documents, onDeleteDocument, onRegenerateDiagrams, onRegenerateDiagram }: ArtefactTabsProps) {
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
              : tab.key === "transcripts"
              ? false
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
            onRegenerate={onRegenerateDiagrams}
            onRegenerateSingle={onRegenerateDiagram}
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
        {activeTab === "transcripts" && (
          <DocumentsPanel
            documents={documents ?? []}
            onDelete={onDeleteDocument}
          />
        )}
      </div>
    </div>
  );
}

function DocumentsPanel({
  documents,
  onDelete,
}: {
  documents: DocumentEntry[];
  onDelete?: (id: string) => void;
}) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (documents.length > 0 && (!activeDoc || !documents.find((d) => d.id === activeDoc))) {
      setActiveDoc(documents[0].id);
    }
  }, [documents, activeDoc]);

  if (documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        No documents imported yet
      </div>
    );
  }

  const active = documents.find((d) => d.id === activeDoc);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800/50 bg-zinc-900/50 px-2 pt-1">
        {documents.map((doc, i) => (
          <button
            key={doc.id}
            onClick={() => setActiveDoc(doc.id)}
            className={`relative rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              activeDoc === doc.id
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Document {i + 1}
          </button>
        ))}
      </div>
      {active && (
        <div className="min-h-0 flex-1 overflow-auto">
          {onDelete && (
            <div className="flex justify-end border-b border-zinc-800/50 px-3 py-1.5">
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-zinc-500 transition-colors hover:text-red-400"
              >
                Delete
              </button>
            </div>
          )}
          <pre className="whitespace-pre-wrap p-4 text-sm text-zinc-300">{active.content}</pre>
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        title="Delete document"
        message="This will permanently delete this imported document."
        onConfirm={() => {
          if (active && onDelete) onDelete(active.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
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
  onRegenerate,
  onRegenerateSingle,
}: {
  diagrams: MeetingArtefacts["diagrams"];
  diagramKeys: string[];
  activeDiagram: string | null;
  onSelectDiagram: (key: string) => void;
  planning: boolean;
  error: string | null;
  onRegenerate?: () => void;
  onRegenerateSingle?: (type: string, renderer: "mermaid" | "html") => void;
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
      <div className="flex items-center border-b border-zinc-800/50 bg-zinc-900/50 px-2 pt-1">
        <div className="flex flex-1 gap-1">
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
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Regenerate All
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {active?.renderer === "html"
          ? <WireframeRenderer content={active.content} />
          : <DiagramRenderer content={active?.content ?? ""} />
        }
        {activeDiagram && active && onRegenerateSingle && !active.updating && (
          <button
            onClick={() => onRegenerateSingle(activeDiagram, active.renderer)}
            className="absolute right-3 top-3 rounded border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
