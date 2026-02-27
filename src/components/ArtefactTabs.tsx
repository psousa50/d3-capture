"use client";

import { useEffect, useState } from "react";
import { DiagramRenderer } from "./DiagramRenderer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { WireframeRenderer } from "./WireframeRenderer";
import type { MeetingArtefacts } from "../lib/use-meeting";
import { ConfirmModal } from "./ConfirmModal";
import type { DocumentEntry } from "../lib/socket-client";

type TopTab = "diagrams" | "spec" | "stories" | "transcripts";

function TabIcon({ tab }: { tab: TopTab }) {
  const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (tab) {
    case "diagrams":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>;
    case "spec":
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
    case "stories":
      return <svg {...props}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
    case "transcripts":
      return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
  }
}

const TABS: { key: TopTab; label: string }[] = [
  { key: "diagrams", label: "Diagrams" },
  { key: "spec", label: "Spec" },
  { key: "stories", label: "Stories" },
  { key: "transcripts", label: "Documents" },
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
    if (activeDiagram && artefacts.diagrams[activeDiagram]) return;
    if (diagramKeys.length > 0) {
      setActiveDiagram(diagramKeys[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramKeys.join(",")]);

  const diagramsHaveActivity =
    artefacts.diagramsUpdating || diagramKeys.some((k) => artefacts.diagrams[k].updating);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-zinc-800/50 px-4">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const isUpdating =
              tab.key === "diagrams"
                ? diagramsHaveActivity
                : tab.key === "transcripts"
                ? false
                : artefacts[tab.key].updating;

            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-zinc-800/50 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
                }`}
              >
                <TabIcon tab={tab.key} />
                {tab.label}
                {isUpdating && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`min-h-0 flex-1 ${activeTab !== "diagrams" && activeTab !== "transcripts" && (activeTab === "spec" ? artefacts.spec.updating : artefacts.stories.updating) ? "animate-shimmer" : ""}`}>
        {activeTab === "diagrams" && (
          <DiagramPanel
            diagrams={artefacts.diagrams}
            diagramKeys={diagramKeys}
            activeDiagram={activeDiagram}
            onSelectDiagram={setActiveDiagram}
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
      <div className="flex h-full flex-col items-center justify-center text-centre">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p className="text-xs text-zinc-600">No documents imported yet</p>
      </div>
    );
  }

  const active = documents.find((d) => d.id === activeDoc);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-800/30 bg-zinc-900/30 px-3 py-1.5">
        {documents.map((doc, i) => (
          <button
            key={doc.id}
            onClick={() => setActiveDoc(doc.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              activeDoc === doc.id
                ? "bg-zinc-800/50 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {doc.name}
          </button>
        ))}
        {active && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto rounded-md p-1 text-zinc-600 transition-colors hover:text-red-400"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
      {active && (
        <div className="min-h-0 flex-1 overflow-auto">
          <pre className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-zinc-300">{active.content}</pre>
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${active?.name}"`}
        message={`This will permanently delete "${active?.name}".`}
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
  error,
  onRegenerate,
  onRegenerateSingle,
}: {
  diagrams: MeetingArtefacts["diagrams"];
  diagramKeys: string[];
  activeDiagram: string | null;
  onSelectDiagram: (key: string) => void;
  error: string | null;
  onRegenerate?: () => void;
  onRegenerateSingle?: (type: string, renderer: "mermaid" | "html") => void;
}) {
  if (diagramKeys.length === 0 && error) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-sm text-amber-400">{error}</p>
      </div>
    );
  }

  if (diagramKeys.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-centre">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
          <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
        </svg>
        <p className="text-xs text-zinc-600">No diagrams yet</p>
      </div>
    );
  }

  const active = activeDiagram ? diagrams[activeDiagram] : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-zinc-800/30 bg-zinc-900/30 px-3 py-1.5">
        <div className="flex flex-1 gap-1">
          {diagramKeys.map((key) => (
            <button
              key={key}
              onClick={() => onSelectDiagram(key)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeDiagram === key
                  ? "bg-zinc-800/50 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {diagrams[key].label}
              {diagrams[key].updating && (
                <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {activeDiagram && active && onRegenerateSingle && !active.updating && (
            <button
              onClick={() => onRegenerateSingle(activeDiagram, active.renderer)}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              Regenerate
            </button>
          )}
          {onRegenerate && diagramKeys.length > 0 && (
            <button
              onClick={onRegenerate}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              Regen All
            </button>
          )}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${active?.updating ? "animate-shimmer" : ""}`}>
        {active?.renderer === "html"
          ? <WireframeRenderer content={active.content} />
          : <DiagramRenderer content={active?.content ?? ""} />
        }
      </div>
    </div>
  );
}
