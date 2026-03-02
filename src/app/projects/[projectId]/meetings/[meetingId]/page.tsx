"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMeeting } from "../../../../../lib/use-meeting";
import { TranscriptPanel } from "../../../../../components/TranscriptPanel";
import { ArtefactTabs } from "../../../../../components/ArtefactTabs";
import { MeetingControls } from "../../../../../components/MeetingControls";
import { PresenceIndicator } from "../../../../../components/PresenceIndicator";
import { TranscriptImportModal } from "../../../../../components/TranscriptImportModal";
import { GuidancePanel } from "../../../../../components/GuidancePanel";

export default function MeetingPage() {
  const { projectId, meetingId } = useParams<{ projectId: string; meetingId: string }>();
  const [importOpen, setImportOpen] = useState(false);
  const [transcriptCollapsed, setTranscriptCollapsed] = useState(false);
  const [guidanceCollapsed, setGuidanceCollapsed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const {
    status, scope, projectName, featureName, transcript, artefacts, documents, guidance, participants, error, elapsed,
    startMeeting, startRecording, stopRecording, stopMeeting,
    sendText, importTranscript, regenerateDiagrams, regenerateDiagram, editTranscript, deleteTranscript, deleteDocument,
    resolveGuidanceItem, unresolveGuidanceItem,
  } = useMeeting();

  useEffect(() => {
    if (status === "idle" && meetingId) {
      startMeeting(meetingId);
    }
    return () => stopMeeting();
  }, [meetingId, startMeeting, stopMeeting]);

  const isActive = status === "connected" || status === "recording";

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {projectName ?? "Project"}
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-800">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {scope === "feature" && featureName ? (
            <span className="font-medium text-zinc-300">{featureName}</span>
          ) : (
            <span className="font-medium text-zinc-300">Project Meeting</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <PresenceIndicator participants={participants} />

          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300"
          >
            {linkCopied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Copy link
              </>
            )}
          </button>

          {isActive && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
          )}

          {status === "recording" && (
            <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 ring-1 ring-red-500/20">
              <span className="inline-block h-2 w-2 animate-recording-pulse rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-400">REC</span>
            </div>
          )}
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <TranscriptPanel
          entries={transcript}
          collapsed={transcriptCollapsed}
          onEdit={editTranscript}
          onDelete={deleteTranscript}
        />

        <div className={`flex-1 transition-all duration-300 ${transcriptCollapsed ? "ml-0" : ""}`}>
          <ArtefactTabs
            artefacts={artefacts}
            documents={documents}
            visibleTabs={scope === "feature"
              ? ["spec", "stories", "diagrams", "transcripts"]
              : ["context", "diagrams", "transcripts"]
            }
            transcriptCollapsed={transcriptCollapsed}
            onToggleTranscript={() => setTranscriptCollapsed((v) => !v)}
            onDeleteDocument={deleteDocument}
            onRegenerateDiagrams={regenerateDiagrams}
            onRegenerateDiagram={regenerateDiagram}
          />
        </div>

        <GuidancePanel
          items={guidance}
          collapsed={guidanceCollapsed}
          onToggle={() => setGuidanceCollapsed((v) => !v)}
          onResolve={resolveGuidanceItem}
          onUnresolve={unresolveGuidanceItem}
        />
      </div>

      <MeetingControls
        status={status}
        elapsed={elapsed}
        error={error}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onStop={stopMeeting}
        onSendText={sendText}
      />

      <TranscriptImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(text, name) => {
          importTranscript(text, name);
          setImportOpen(false);
        }}
        loading={false}
        documents={documents}
      />
    </div>
  );
}
