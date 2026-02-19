"use client";

import { useMeeting } from "../lib/use-meeting";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { ArtefactTabs } from "../components/ArtefactTabs";
import { MeetingControls } from "../components/MeetingControls";

export default function Home() {
  const { status, transcript, artefacts, error, elapsed, startMeeting, stopMeeting, sendText } =
    useMeeting();

  if (status === "idle") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Meeting Artefact Generator</h1>
          <p className="mt-3 text-lg text-zinc-400">
            Start a meeting to capture live transcription and generate diagrams, specs, and
            stories.
          </p>
        </div>
        <button
          onClick={startMeeting}
          className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-medium text-white transition-colors hover:bg-blue-500"
        >
          Start Meeting
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-medium text-zinc-300">Meeting Artefact Generator</h1>
        {status === "recording" && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording
          </div>
        )}
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
        onStart={startMeeting}
        onStop={stopMeeting}
        onSendText={sendText}
      />
    </div>
  );
}
