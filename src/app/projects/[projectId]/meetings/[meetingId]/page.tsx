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
  const {
    status, transcript, artefacts, documents, participants, error, elapsed,
    startMeeting, startRecording, stopRecording, stopMeeting,
    sendText, importTranscript, regenerateDiagrams, regenerateDiagram, editTranscript, deleteTranscript, deleteDocument,
  } = useMeeting();

  useEffect(() => {
    if (status === "idle" && meetingId) {
      startMeeting(meetingId);
    }
    return () => stopMeeting();
  }, [meetingId, startMeeting, stopMeeting]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Back to project
          </Link>
          <span className="text-zinc-700">|</span>
          <h1 className="text-sm font-medium text-zinc-300">Meeting</h1>
        </div>
        <div className="flex items-center gap-4">
          <PresenceIndicator participants={participants} />
          {(status === "connected" || status === "recording") && (
            <button
              onClick={() => setImportOpen(true)}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              Import Transcript
            </button>
          )}
          {status === "recording" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/4 border-r border-zinc-800">
          <TranscriptPanel
            entries={transcript}
            onEdit={editTranscript}
            onDelete={deleteTranscript}
          />
        </div>
        <div className="flex-1">
          <ArtefactTabs artefacts={artefacts} documents={documents} onDeleteDocument={deleteDocument} onRegenerateDiagrams={regenerateDiagrams} onRegenerateDiagram={regenerateDiagram} />
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
