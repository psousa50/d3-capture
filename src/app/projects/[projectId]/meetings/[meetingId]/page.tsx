"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMeeting } from "../../../../../lib/use-meeting";
import { TranscriptPanel } from "../../../../../components/TranscriptPanel";
import { ArtefactTabs } from "../../../../../components/ArtefactTabs";
import { MeetingControls } from "../../../../../components/MeetingControls";
import { PresenceIndicator } from "../../../../../components/PresenceIndicator";

export default function MeetingPage() {
  const { projectId, meetingId } = useParams<{ projectId: string; meetingId: string }>();
  const { status, transcript, artefacts, participants, error, elapsed, startMeeting, stopMeeting, sendText } =
    useMeeting();

  useEffect(() => {
    if (status === "idle" && meetingId) {
      startMeeting(meetingId);
    }
  }, [meetingId, status, startMeeting]);

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
          {status === "recording" && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 border-r border-zinc-800">
          <TranscriptPanel entries={transcript} />
        </div>
        <div className="flex-1">
          <ArtefactTabs artefacts={artefacts} />
        </div>
      </div>
      <MeetingControls
        status={status}
        elapsed={elapsed}
        error={error}
        onStop={stopMeeting}
        onSendText={sendText}
      />
    </div>
  );
}
