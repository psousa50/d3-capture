"use client";

import { useCallback, useRef, useState } from "react";
import { MeetingWebSocket, LiveTranscript, ServerMessage } from "./websocket-client";
import { AudioCapture } from "./audio-capture";

export type MeetingStatus = "idle" | "connecting" | "recording" | "error";
export type ArtefactType = "diagram" | "spec" | "stories";

interface TranscriptEntry {
  text: string;
  speaker?: number;
  isFinal: boolean;
}

interface ArtefactState {
  content: string;
  updating: boolean;
  pendingContent: string;
}

export function useMeeting() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [artefacts, setArtefacts] = useState<Record<ArtefactType, ArtefactState>>({
    diagram: { content: "", updating: false, pendingContent: "" },
    spec: { content: "", updating: false, pendingContent: "" },
    stories: { content: "", updating: false, pendingContent: "" },
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

      case "artefact-start":
        setArtefacts((prev) => ({
          ...prev,
          [message.data.artefactType]: {
            ...prev[message.data.artefactType as ArtefactType],
            updating: true,
            pendingContent: "",
          },
        }));
        break;

      case "artefact-chunk":
        setArtefacts((prev) => ({
          ...prev,
          [message.data.artefactType]: {
            ...prev[message.data.artefactType as ArtefactType],
            pendingContent:
              prev[message.data.artefactType as ArtefactType].pendingContent +
              (message.data.chunk ?? ""),
          },
        }));
        break;

      case "artefact-complete":
        setArtefacts((prev) => ({
          ...prev,
          [message.data.artefactType]: {
            content: message.data.content ?? "",
            updating: false,
            pendingContent: "",
          },
        }));
        break;

      case "artefact-error":
        setArtefacts((prev) => ({
          ...prev,
          [message.data.artefactType]: {
            ...prev[message.data.artefactType as ArtefactType],
            updating: false,
          },
        }));
        break;

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
  };
}
