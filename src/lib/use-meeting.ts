"use client";

import { useCallback, useRef, useState } from "react";
import { MeetingWebSocket, type ServerMessage } from "./websocket-client";
import { AudioCapture } from "./audio-capture";

export type MeetingStatus = "idle" | "connecting" | "recording" | "error";

interface TranscriptEntry {
  text: string;
  speaker?: number;
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

  const wsRef = useRef<MeetingWebSocket | null>(null);
  const audioRef = useRef<AudioCapture | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "live-transcript":
        setTranscript((prev) => {
          const entry: TranscriptEntry = {
            text: message.data.text,
            speaker: message.data.speaker,
            isFinal: message.data.isFinal,
          };
          if (!message.data.isFinal && prev.length > 0 && !prev[prev.length - 1].isFinal) {
            return [...prev.slice(0, -1), entry];
          }
          return [...prev, entry];
        });
        break;

      case "artefact-start": {
        const key = message.data.artefactType;
        if (key === "diagram") {
          setArtefacts((prev) => ({
            ...prev,
            diagramsUpdating: true,
          }));
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
                renderer: message.data.renderer ?? "mermaid",
              },
            },
          }));
        } else {
          setArtefacts((prev) => ({
            ...prev,
            [key]: { ...prev[key as "spec" | "stories"], updating: true, pendingContent: "" },
          }));
        }
        break;
      }

      case "artefact-chunk": {
        const key = message.data.artefactType;
        if (key.startsWith("diagram:")) {
          const subType = key.slice("diagram:".length);
          setArtefacts((prev) => ({
            ...prev,
            diagrams: {
              ...prev.diagrams,
              [subType]: {
                ...prev.diagrams[subType],
                pendingContent: prev.diagrams[subType].pendingContent + (message.data.chunk ?? ""),
              },
            },
          }));
        } else {
          setArtefacts((prev) => ({
            ...prev,
            [key]: {
              ...prev[key as "spec" | "stories"],
              pendingContent:
                prev[key as "spec" | "stories"].pendingContent + (message.data.chunk ?? ""),
            },
          }));
        }
        break;
      }

      case "artefact-complete": {
        const key = message.data.artefactType;
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
                content: message.data.content ?? "",
                updating: false,
                pendingContent: "",
              },
            },
          }));
        } else {
          setArtefacts((prev) => ({
            ...prev,
            [key]: {
              content: message.data.content ?? "",
              updating: false,
              pendingContent: "",
            },
          }));
        }
        break;
      }

      case "artefact-error": {
        const key = message.data.artefactType;
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
        break;
      }

      case "error":
        setError(message.data);
        break;
    }
  }, []);

  const startMeeting = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      const ws = new MeetingWebSocket();
      wsRef.current = ws;
      ws.on("*", handleMessage);
      await ws.connect();

      const audio = new AudioCapture();
      audioRef.current = audio;
      await audio.start((data) => ws.sendAudio(data));

      setStatus("recording");

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to start meeting");
    }
  }, [handleMessage]);

  const sendText = useCallback((text: string) => {
    wsRef.current?.sendText(text);
  }, []);

  const stopMeeting = useCallback(() => {
    audioRef.current?.stop();
    audioRef.current = null;
    wsRef.current?.disconnect();
    wsRef.current = null;
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
