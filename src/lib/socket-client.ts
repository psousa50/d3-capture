import { io, Socket } from "socket.io-client";

export interface LiveTranscript {
  id?: number;
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

export interface DocumentEntry {
  id: string;
  content: string;
  createdAt: number;
}

export interface MeetingSnapshot {
  transcript: { id?: number; text: string; speaker: string | null; isFinal: boolean }[];
  artefacts: Record<string, string>;
  documents: DocumentEntry[];
}

export interface Participant {
  id: string;
  role: "producer" | "viewer";
  name?: string;
}

export interface PresenceUpdate {
  participants: Participant[];
}

type EventHandler<T> = (data: T) => void;

export class MeetingSocket {
  private socket: Socket | null = null;

  connect(meetingId: string, role: "producer" | "viewer" = "producer"): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io({
        query: { meetingId, role },
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

  onPresence(handler: EventHandler<PresenceUpdate>) {
    this.socket?.on("presence", handler);
    return () => { this.socket?.off("presence", handler); };
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

  importTranscript(text: string) {
    this.socket?.emit("import-transcript", text);
  }

  addDiagram(type: string, renderer: "mermaid" | "html") {
    this.socket?.emit("add-diagram", { type, renderer });
  }

  regenerateDiagrams() {
    this.socket?.emit("regenerate-diagrams");
  }

  regenerateDiagram(type: string, renderer: "mermaid" | "html") {
    this.socket?.emit("regenerate-diagram", { type, renderer });
  }

  startRecording() {
    this.socket?.emit("start-recording");
  }

  stopRecording() {
    this.socket?.emit("stop-recording");
  }

  editTranscript(id: number, text: string) {
    this.socket?.emit("edit-transcript", { id, text });
  }

  deleteTranscript(id: number) {
    this.socket?.emit("delete-transcript", { id });
  }

  onTranscriptEdited(handler: EventHandler<{ id: number; text: string }>) {
    this.socket?.on("transcript-edited", handler);
    return () => { this.socket?.off("transcript-edited", handler); };
  }

  onTranscriptDeleted(handler: EventHandler<{ id: number }>) {
    this.socket?.on("transcript-deleted", handler);
    return () => { this.socket?.off("transcript-deleted", handler); };
  }

  deleteDocument(id: string) {
    this.socket?.emit("delete-document", { id });
  }

  onDocumentAdded(handler: EventHandler<DocumentEntry>) {
    this.socket?.on("document-added", handler);
    return () => { this.socket?.off("document-added", handler); };
  }

  onDocumentDeleted(handler: EventHandler<{ id: string }>) {
    this.socket?.on("document-deleted", handler);
    return () => { this.socket?.off("document-deleted", handler); };
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
