import type { Server } from "socket.io";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { ContextManager } from "./context-manager";
import { GenerationOrchestrator } from "./generation-orchestrator";
import { insertChunk } from "./db/repositories/transcripts";
import { insertDocument } from "./db/repositories/documents";
import { getSTTProvider, type STTProvider, type STTStream } from "./stt";
import { logger } from "./logger";

const log = logger.child({ module: "audio" });

interface ParticipantStream {
  socketId: string;
  speakerName: string;
  sttStream: STTStream;
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
  private sttProvider: STTProvider | null = null;

  constructor(io: Server, room: string, projectId: string, meetingId: string) {
    this.io = io;
    this.room = room;
    this.meetingId = meetingId;
    this.contextManager = new ContextManager(projectId, meetingId);
    this.orchestrator = new GenerationOrchestrator(this.io, this.room, meetingId, this.contextManager);

    this.accumulator = new TranscriptAccumulator(meetingId, (transcript) => {
      this.contextManager.addTranscript(transcript);
      this.orchestrator.trigger(transcript);
      this.orchestrator.triggerGuidance();
      this.orchestrator.triggerAssistant(transcript.fullText);
    });
  }

  start() {
    try {
      this.sttProvider = getSTTProvider();
    } catch (err) {
      log.error({ err }, "STT provider not available");
      this.emit("error", "Transcription service not configured");
    }
  }

  addParticipant(socketId: string, userName?: string | null) {
    if (this.participants.has(socketId)) return;
    if (!this.sttProvider) return;

    const fallbackIndex = this.nextSpeakerIndex++;
    const speakerName = userName || `Speaker ${fallbackIndex + 1}`;

    const sttStream = this.sttProvider.createStream({
      onTranscript: (result) => {
        this.accumulator.add({
          text: result.text,
          isFinal: result.isFinal,
          speaker: speakerName,
          timestamp: Date.now(),
        });

        this.emit("live-transcript", {
          text: result.text,
          isFinal: result.isFinal,
          speaker: speakerName,
        });
      },
      onError: (err) => {
        log.error({ err, socketId }, "STT stream error");
      },
      onOpen: () => {
        log.info({ socketId }, "STT stream open");
      },
      onClose: () => {
        log.info({ socketId }, "STT stream closed");
      },
    });

    this.participants.set(socketId, { socketId, speakerName, sttStream });
    this.accumulator.addParticipant(socketId);

    log.info({ socketId, speakerName, total: this.participants.size }, "participant added");
  }

  removeParticipant(socketId: string) {
    const participant = this.participants.get(socketId);
    if (!participant) return;

    participant.sttStream.close();
    this.participants.delete(socketId);
    this.accumulator.removeParticipant(socketId);

    log.info({ socketId, total: this.participants.size }, "participant removed");
  }

  handleAudio(socketId: string, data: Buffer) {
    const participant = this.participants.get(socketId);
    participant?.sttStream.send(data);
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
    this.orchestrator.triggerGuidance();
    this.orchestrator.triggerAssistant(text);
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
    this.orchestrator.triggerGuidance();
  }

  async addDiagram(diagramType: string, renderer: "mermaid" | "html" = "mermaid") {
    await this.orchestrator.addDiagram(diagramType, renderer);
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
      participant.sttStream.close();
    }
    this.participants.clear();
  }

  private emit(event: string, data: unknown) {
    this.io.to(this.room).emit(event, data);
  }
}
