import { io, Socket } from "socket.io-client";

export interface LiveTranscript {
  text: string;
  isFinal: boolean;
  speaker?: string | number | null;
}

export interface ArtefactUpdate {
  artefactType: string;
  chunk?: string;
  content?: string;
  error?: string;
  renderer?: "mermaid" | "html";
}

export interface MeetingSnapshot {
  transcript: { text: string; speaker: string | null; isFinal: boolean }[];
  artefacts: Record<string, string>;
}

type EventHandler<T> = (data: T) => void;

export class MeetingSocket {
  private socket: Socket | null = null;

  connect(meetingId: string, role: "producer" | "viewer" = "producer"): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io({
        query: { meetingId, role },
        auth: { password: "" },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => resolve());
      this.socket.on("connect_error", (err) => reject(err));
    });
  }

  onMeetingState(handler: EventHandler<MeetingSnapshot>) {
    this.socket?.on("meeting-state", handler);
    return () => { this.socket?.off("meeting-state", handler); };
  }

  onLiveTranscript(handler: EventHandler<LiveTranscript>) {
    this.socket?.on("live-transcript", handler);
    return () => { this.socket?.off("live-transcript", handler); };
  }

  onArtefactStart(handler: EventHandler<ArtefactUpdate>) {
    this.socket?.on("artefact-start", handler);
    return () => { this.socket?.off("artefact-start", handler); };
  }

  onArtefactChunk(handler: EventHandler<ArtefactUpdate>) {
    this.socket?.on("artefact-chunk", handler);
    return () => { this.socket?.off("artefact-chunk", handler); };
  }

  onArtefactComplete(handler: EventHandler<ArtefactUpdate>) {
    this.socket?.on("artefact-complete", handler);
    return () => { this.socket?.off("artefact-complete", handler); };
  }

  onArtefactError(handler: EventHandler<ArtefactUpdate>) {
    this.socket?.on("artefact-error", handler);
    return () => { this.socket?.off("artefact-error", handler); };
  }

  onError(handler: EventHandler<string>) {
    this.socket?.on("error", handler);
    return () => { this.socket?.off("error", handler); };
  }

  sendAudio(data: ArrayBuffer) {
    this.socket?.emit("audio-data", data);
  }

  sendText(text: string) {
    this.socket?.emit("text-input", text);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
