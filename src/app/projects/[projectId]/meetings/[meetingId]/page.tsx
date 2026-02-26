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

export default function MeetingPage() {
  const { projectId, meetingId } = useParams<{ projectId: string; meetingId: string }>();
  const [importOpen, setImportOpen] = useState(false);
  const [transcriptCollapsed, setTranscriptCollapsed] = useState(false);
  const {
    status, transcript, artefacts, documents, participants, error, elapsed,
    startMeeting, startRecording, stopRecording, stopMeeting,
    sendText, importTranscript, addDiagram, regenerateDiagrams, regenerateDiagram, editTranscript, deleteTranscript, deleteDocument,
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
            Project
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-800">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium text-zinc-300">Meeting</span>
        </div>

        <div className="flex items-center gap-4">
          <PresenceIndicator participants={participants} />

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
          onToggle={() => setTranscriptCollapsed((v) => !v)}
          onEdit={editTranscript}
          onDelete={deleteTranscript}
        />

        <div className={`flex-1 transition-all duration-300 ${transcriptCollapsed ? "ml-0" : ""}`}>
          <ArtefactTabs
            artefacts={artefacts}
            documents={documents}
            onDeleteDocument={deleteDocument}
            onAddDiagram={addDiagram}
            onRegenerateDiagrams={regenerateDiagrams}
            onRegenerateDiagram={regenerateDiagram}
          />
        </div>
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
        onImport={(text) => {
          importTranscript(text);
          setImportOpen(false);
        }}
        loading={false}
      />
    </div>
  );
}
