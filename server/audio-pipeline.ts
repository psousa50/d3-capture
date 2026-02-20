import WebSocket from "ws";
import type { Server } from "socket.io";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { ContextManager } from "./context-manager";
import { GenerationOrchestrator } from "./generation-orchestrator";

export class AudioPipeline {
  private io: Server;
  private room: string;
  private accumulator: TranscriptAccumulator;
  private contextManager: ContextManager;
  private orchestrator: GenerationOrchestrator;
  private deepgramWs: WebSocket | null = null;

  constructor(io: Server, room: string, projectId: string, meetingId: string) {
    this.io = io;
    this.room = room;
    this.contextManager = new ContextManager(projectId);
    this.orchestrator = new GenerationOrchestrator(this.io, this.room, this.contextManager);

    this.accumulator = new TranscriptAccumulator(meetingId, (transcript) => {
      this.contextManager.addTranscript(transcript);
      this.orchestrator.trigger();
    });
  }

  start() {
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      console.error("[audio] DEEPGRAM_API_KEY not set");
      this.emit("error", "Transcription service not configured");
      return;
    }

    this.connectDeepgram(deepgramKey);
  }

  handleAudio(socketId: string, data: Buffer) {
    if (this.deepgramWs?.readyState === WebSocket.OPEN) {
      this.deepgramWs.send(data);
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
    this.orchestrator.trigger();
  }

  stop() {
    this.accumulator.stop();
    if (this.deepgramWs?.readyState === WebSocket.OPEN) {
      this.deepgramWs.close();
    }
  }

  private connectDeepgram(apiKey: string) {
    const deepgramUrl =
      "wss://api.deepgram.com/v1/listen?" +
      new URLSearchParams({
        model: "nova-2",
        language: "en",
        smart_format: "true",
        diarize: "true",
        punctuate: "true",
        encoding: "linear16",
        sample_rate: "16000",
        channels: "1",
      }).toString();

    this.deepgramWs = new WebSocket(deepgramUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    this.deepgramWs.on("open", () => {
      console.log("[audio] Deepgram connection established");
    });

    this.deepgramWs.on("message", (data: unknown) => {
      const response = JSON.parse(String(data));
      const transcript = response.channel?.alternatives?.[0]?.transcript;

      if (transcript) {
        const isFinal = response.is_final;
        const speaker = response.channel?.alternatives?.[0]?.words?.[0]?.speaker;

        this.accumulator.add({
          text: transcript,
          isFinal,
          speaker: speaker !== undefined ? String(speaker) : undefined,
          timestamp: Date.now(),
        });

        this.emit("live-transcript", {
          text: transcript,
          isFinal,
          speaker: speaker ?? null,
        });
      }
    });

    this.deepgramWs.on("error", (err) => {
      console.error("[audio] Deepgram error:", err);
      this.emit("error", "Transcription connection error");
    });

    this.deepgramWs.on("close", () => {
      console.log("[audio] Deepgram connection closed");
    });
  }

  private emit(event: string, data: unknown) {
    this.io.to(this.room).emit(event, data);
  }
}
