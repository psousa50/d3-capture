import WebSocket from "ws";
import type { Server } from "socket.io";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { ContextManager } from "./context-manager";
import { GenerationOrchestrator } from "./generation-orchestrator";

interface ParticipantStream {
  socketId: string;
  deepgramWs: WebSocket;
}

export class AudioHandler {
  private io: Server;
  private room: string;
  private accumulator: TranscriptAccumulator;
  private contextManager: ContextManager;
  private orchestrator: GenerationOrchestrator;
  private participants = new Map<string, ParticipantStream>();
  private deepgramKey: string | null = null;

  constructor(io: Server, room: string, projectId: string, meetingId: string) {
    this.io = io;
    this.room = room;
    this.contextManager = new ContextManager(projectId);
    this.orchestrator = new GenerationOrchestrator(this.io, this.room, this.contextManager);

    this.accumulator = new TranscriptAccumulator(meetingId, (transcript) => {
      this.contextManager.addTranscript(transcript);
      this.orchestrator.trigger(transcript);
    });
  }

  start() {
    this.deepgramKey = process.env.DEEPGRAM_API_KEY ?? null;
    if (!this.deepgramKey) {
      console.error("[audio] DEEPGRAM_API_KEY not set");
      this.emit("error", "Transcription service not configured");
    }
  }

  addParticipant(socketId: string) {
    if (this.participants.has(socketId)) return;
    if (!this.deepgramKey) return;

    const deepgramWs = this.connectDeepgram(this.deepgramKey, socketId);
    this.participants.set(socketId, { socketId, deepgramWs });
    this.accumulator.addParticipant(socketId);

    console.log(`[audio] Participant ${socketId} added (${this.participants.size} total)`);
  }

  removeParticipant(socketId: string) {
    const participant = this.participants.get(socketId);
    if (!participant) return;

    if (participant.deepgramWs.readyState === WebSocket.OPEN) {
      participant.deepgramWs.close();
    }

    this.participants.delete(socketId);
    this.accumulator.removeParticipant(socketId);

    console.log(`[audio] Participant ${socketId} removed (${this.participants.size} total)`);
  }

  handleAudio(socketId: string, data: Buffer) {
    const participant = this.participants.get(socketId);
    if (participant?.deepgramWs.readyState === WebSocket.OPEN) {
      participant.deepgramWs.send(data);
    }
  }

  handleTextInput(text: string) {
    const now = Date.now();
    const transcript = {
      chunks: [{ text, isFinal: true as const, timestamp: now }],
      fullText: text,
      startTime: now,
      endTime: now,
    };

    this.emit("live-transcript", { text, isFinal: true, speaker: null });

    this.contextManager.addTranscript(transcript);
    this.orchestrator.trigger(transcript);
  }

  stop() {
    this.accumulator.stop();
    for (const participant of this.participants.values()) {
      if (participant.deepgramWs.readyState === WebSocket.OPEN) {
        participant.deepgramWs.close();
      }
    }
    this.participants.clear();
  }

  private connectDeepgram(apiKey: string, socketId: string): WebSocket {
    const deepgramUrl =
      "wss://api.deepgram.com/v1/listen?" +
      new URLSearchParams({
        model: "nova-2",
        language: "en",
        smart_format: "true",
        punctuate: "true",
        encoding: "linear16",
        sample_rate: "16000",
        channels: "1",
      }).toString();

    const ws = new WebSocket(deepgramUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    ws.on("open", () => {
      console.log(`[audio] Deepgram stream open for ${socketId}`);
    });

    ws.on("message", (data: unknown) => {
      const response = JSON.parse(String(data));
      const transcript = response.channel?.alternatives?.[0]?.transcript;

      if (transcript) {
        const isFinal = response.is_final;

        this.accumulator.add({
          text: transcript,
          isFinal,
          speaker: socketId,
          timestamp: Date.now(),
        });

        this.emit("live-transcript", {
          text: transcript,
          isFinal,
          speaker: socketId,
        });
      }
    });

    ws.on("error", (err) => {
      console.error(`[audio] Deepgram error for ${socketId}:`, err);
    });

    ws.on("close", () => {
      console.log(`[audio] Deepgram stream closed for ${socketId}`);
    });

    return ws;
  }

  private emit(event: string, data: unknown) {
    this.io.to(this.room).emit(event, data);
  }
}
