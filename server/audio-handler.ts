import WebSocket from "ws";
import type { Server } from "socket.io";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { ContextManager } from "./context-manager";
import { GenerationOrchestrator } from "./generation-orchestrator";
import { insertChunk } from "./db/repositories/transcripts";
import { insertDocument } from "./db/repositories/documents";

interface ParticipantStream {
  socketId: string;
  speakerName: string;
  deepgramWs: WebSocket;
}

export class AudioHandler {
  private io: Server;
  private room: string;
  private meetingId: string;
  private accumulator: TranscriptAccumulator;
  private contextManager: ContextManager;
  private orchestrator: GenerationOrchestrator;
  private participants = new Map<string, ParticipantStream>();
  private nextSpeakerIndex = 0;
  private deepgramKey: string | null = null;

  constructor(io: Server, room: string, projectId: string, meetingId: string) {
    this.io = io;
    this.room = room;
    this.meetingId = meetingId;
    this.contextManager = new ContextManager(projectId, meetingId);
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

  addParticipant(socketId: string, userName?: string | null) {
    if (this.participants.has(socketId)) return;
    if (!this.deepgramKey) return;

    const fallbackIndex = this.nextSpeakerIndex++;
    const speakerName = userName || `Speaker ${fallbackIndex + 1}`;
    const deepgramWs = this.connectDeepgram(this.deepgramKey, socketId, speakerName);
    this.participants.set(socketId, { socketId, speakerName, deepgramWs });
    this.accumulator.addParticipant(socketId);

    console.log(`[audio] Participant ${socketId} (${speakerName}) added (${this.participants.size} total)`);
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

  async handleTextInput(text: string, userName?: string | null) {
    const now = Date.now();
    const speaker = userName || "You";
    const row = await insertChunk(this.meetingId, text, speaker, now);

    this.emit("live-transcript", { id: row.id, text, isFinal: true, speaker });

    const transcript = {
      chunks: [{ text, isFinal: true as const, timestamp: now }],
      fullText: text,
      startTime: now,
      endTime: now,
    };
    this.contextManager.addTranscript(transcript);
    this.orchestrator.trigger(transcript);
  }

  async handleTranscriptImport(text: string) {
    const doc = await insertDocument(this.meetingId, text);
    this.emit("document-added", { id: doc.id, content: doc.content, createdAt: doc.created_at });

    const now = Date.now();
    const transcript = {
      chunks: [{ text, isFinal: true as const, timestamp: now }],
      fullText: text,
      startTime: now,
      endTime: now,
    };

    this.contextManager.addTranscript(transcript);
    await this.orchestrator.triggerAll(transcript);
  }

  async regenerateDiagrams() {
    await this.orchestrator.regenerateDiagrams();
  }

  async regenerateSingleDiagram(diagramType: string, renderer: "mermaid" | "html" = "mermaid") {
    await this.orchestrator.regenerateSingleDiagram(diagramType, renderer);
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

  private connectDeepgram(apiKey: string, socketId: string, speakerName: string): WebSocket {
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
          speaker: speakerName,
          timestamp: Date.now(),
        });

        this.emit("live-transcript", {
          text: transcript,
          isFinal,
          speaker: speakerName,
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
