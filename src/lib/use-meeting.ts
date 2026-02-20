"use client";

import { useCallback, useRef, useState } from "react";
import { MeetingSocket, type ArtefactUpdate, type MeetingSnapshot } from "./socket-client";
import { AudioCapture } from "./audio-capture";

export type MeetingStatus = "idle" | "connecting" | "recording" | "error";

interface TranscriptEntry {
  text: string;
  speaker?: string | number | null;
  isFinal: boolean;
}

export interface ArtefactState {
  content: string;
  updating: boolean;
  pendingContent: string;
}

export interface DiagramState extends ArtefactState {
  label: string;
  renderer: "mermaid" | "html";
}

export interface MeetingArtefacts {
  spec: ArtefactState;
  stories: ArtefactState;
  diagrams: Record<string, DiagramState>;
  diagramsUpdating: boolean;
}

function diagramLabel(subType: string): string {
  return subType
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const EMPTY_ARTEFACT: ArtefactState = { content: "", updating: false, pendingContent: "" };

export function useMeeting() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [artefacts, setArtefacts] = useState<MeetingArtefacts>({
    spec: { ...EMPTY_ARTEFACT },
    stories: { ...EMPTY_ARTEFACT },
    diagrams: {},
    diagramsUpdating: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const socketRef = useRef<MeetingSocket | null>(null);
  const audioRef = useRef<AudioCapture | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleArtefactStart = useCallback((data: ArtefactUpdate) => {
    const key = data.artefactType;
    if (key === "diagram") {
      setArtefacts((prev) => ({ ...prev, diagramsUpdating: true }));
    } else if (key.startsWith("diagram:")) {
      const subType = key.slice("diagram:".length);
      setArtefacts((prev) => ({
        ...prev,
        diagrams: {
          ...prev.diagrams,
          [subType]: {
            content: prev.diagrams[subType]?.content ?? "",
            updating: true,
            pendingContent: "",
            label: diagramLabel(subType),
            renderer: data.renderer ?? "mermaid",
          },
        },
      }));
    } else {
      setArtefacts((prev) => ({
        ...prev,
        [key]: { ...prev[key as "spec" | "stories"], updating: true, pendingContent: "" },
      }));
    }
  }, []);

  const handleArtefactChunk = useCallback((data: ArtefactUpdate) => {
    const key = data.artefactType;
    if (key.startsWith("diagram:")) {
      const subType = key.slice("diagram:".length);
      setArtefacts((prev) => ({
        ...prev,
        diagrams: {
          ...prev.diagrams,
          [subType]: {
            ...prev.diagrams[subType],
            pendingContent: prev.diagrams[subType].pendingContent + (data.chunk ?? ""),
          },
        },
      }));
    } else {
      setArtefacts((prev) => ({
        ...prev,
        [key]: {
          ...prev[key as "spec" | "stories"],
          pendingContent: prev[key as "spec" | "stories"].pendingContent + (data.chunk ?? ""),
        },
      }));
    }
  }, []);

  const handleArtefactComplete = useCallback((data: ArtefactUpdate) => {
    const key = data.artefactType;
    if (key === "diagram") {
      setArtefacts((prev) => ({ ...prev, diagramsUpdating: false }));
    } else if (key.startsWith("diagram:")) {
      const subType = key.slice("diagram:".length);
      setArtefacts((prev) => ({
        ...prev,
        diagrams: {
          ...prev.diagrams,
          [subType]: {
            ...prev.diagrams[subType],
            content: data.content ?? "",
            updating: false,
            pendingContent: "",
          },
        },
      }));
    } else {
      setArtefacts((prev) => ({
        ...prev,
        [key]: { content: data.content ?? "", updating: false, pendingContent: "" },
      }));
    }
  }, []);

  const handleArtefactError = useCallback((data: ArtefactUpdate) => {
    const key = data.artefactType;
    if (key === "diagram") {
      setArtefacts((prev) => ({ ...prev, diagramsUpdating: false }));
    } else if (key.startsWith("diagram:")) {
      const subType = key.slice("diagram:".length);
      setArtefacts((prev) => ({
        ...prev,
        diagrams: {
          ...prev.diagrams,
          [subType]: { ...prev.diagrams[subType], updating: false },
        },
      }));
    } else {
      setArtefacts((prev) => ({
        ...prev,
        [key]: { ...prev[key as "spec" | "stories"], updating: false },
      }));
    }
  }, []);

  const handleMeetingState = useCallback((snapshot: MeetingSnapshot) => {
    setTranscript(snapshot.transcript.map((t) => ({
      text: t.text,
      speaker: t.speaker,
      isFinal: t.isFinal,
    })));

    setArtefacts((prev) => {
      const next = { ...prev };
      for (const [type, content] of Object.entries(snapshot.artefacts)) {
        if (type === "spec" || type === "stories") {
          next[type] = { content, updating: false, pendingContent: "" };
        } else if (type.startsWith("diagram:")) {
          const subType = type.slice("diagram:".length);
          next.diagrams = {
            ...next.diagrams,
            [subType]: {
              content,
              updating: false,
              pendingContent: "",
              label: diagramLabel(subType),
              renderer: "mermaid",
            },
          };
        }
      }
      return next;
    });
  }, []);

  const startMeeting = useCallback(async (meetingId: string) => {
    try {
      setStatus("connecting");
      setError(null);

      const socket = new MeetingSocket();
      socketRef.current = socket;
      await socket.connect(meetingId, "producer");

      socket.onMeetingState(handleMeetingState);
      socket.onLiveTranscript((data) => {
        setTranscript((prev) => {
          const entry: TranscriptEntry = {
            text: data.text,
            speaker: data.speaker,
            isFinal: data.isFinal,
          };
          if (!data.isFinal && prev.length > 0 && !prev[prev.length - 1].isFinal) {
            return [...prev.slice(0, -1), entry];
          }
          return [...prev, entry];
        });
      });
      socket.onArtefactStart(handleArtefactStart);
      socket.onArtefactChunk(handleArtefactChunk);
      socket.onArtefactComplete(handleArtefactComplete);
      socket.onArtefactError(handleArtefactError);
      socket.onError((msg) => setError(msg));

      const audio = new AudioCapture();
      audioRef.current = audio;
      await audio.start((data) => socket.sendAudio(data));

      setStatus("recording");

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to start meeting");
    }
  }, [handleMeetingState, handleArtefactStart, handleArtefactChunk, handleArtefactComplete, handleArtefactError]);

  const sendText = useCallback((text: string) => {
    socketRef.current?.sendText(text);
  }, []);

  const stopMeeting = useCallback(() => {
    audioRef.current?.stop();
    audioRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("idle");
  }, []);

  return {
    status,
    transcript,
    artefacts,
    error,
    elapsed,
    startMeeting,
    stopMeeting,
    sendText,
  };
}
