type MessageHandler = (message: ServerMessage) => void;

export interface LiveTranscript {
  text: string;
  isFinal: boolean;
  speaker?: number;
}

export interface ArtefactUpdate {
  artefactType: "diagram" | "spec" | "stories";
  chunk?: string;
  content?: string;
  error?: string;
}

export type ServerMessage =
  | { type: "live-transcript"; data: LiveTranscript }
  | { type: "artefact-start"; data: ArtefactUpdate }
  | { type: "artefact-chunk"; data: ArtefactUpdate }
  | { type: "artefact-complete"; data: ArtefactUpdate }
  | { type: "artefact-error"; data: ArtefactUpdate }
  | { type: "error"; data: string };

export class MeetingWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/audio`);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));

      this.ws.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        const typeHandlers = this.handlers.get(message.type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(message));
        }
        const allHandlers = this.handlers.get("*");
        if (allHandlers) {
          allHandlers.forEach((handler) => handler(message));
        }
      };

      this.ws.onclose = () => {
        console.log("[ws] Connection closed");
      };
    });
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  sendAudio(data: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
