import { WebSocket } from "ws";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { ContextManager } from "./context-manager";
import { GenerationOrchestrator } from "./generation-orchestrator";

export class AudioPipeline {
  private ws: WebSocket;
  private accumulator: TranscriptAccumulator;
  private contextManager: ContextManager;
  private orchestrator: GenerationOrchestrator;
  private deepgramWs: WebSocket | null = null;

  constructor(ws: WebSocket, projectId: string, meetingId: string) {
    this.ws = ws;
    this.contextManager = new ContextManager(projectId);
    this.orchestrator = new GenerationOrchestrator(ws, this.contextManager);

    this.accumulator = new TranscriptAccumulator(meetingId, (transcript) => {
      this.contextManager.addTranscript(transcript);
      this.orchestrator.trigger();
    });
  }

  start() {
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      console.error("[audio] DEEPGRAM_API_KEY not set");
      this.ws.send(
        JSON.stringify({ type: "error", data: "Transcription service not configured" })
      );
      return;
    }

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
      headers: { Authorization: `Token ${deepgramKey}` },
    });

    this.deepgramWs.on("open", () => {
      console.log("[audio] Deepgram connection established");
    });

    this.deepgramWs.on("message", (data) => {
      const response = JSON.parse(data.toString());
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

        this.ws.send(
          JSON.stringify({
            type: "live-transcript",
            data: { text: transcript, isFinal, speaker },
          })
        );
      }
    });

    this.deepgramWs.on("error", (err) => {
      console.error("[audio] Deepgram error:", err);
      this.ws.send(
        JSON.stringify({ type: "error", data: "Transcription connection error" })
      );
    });

    this.deepgramWs.on("close", () => {
      console.log("[audio] Deepgram connection closed");
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const text = data.toString("utf-8");
        if (text.startsWith("{")) {
          const msg = JSON.parse(text);
          if (msg.type === "text-input") {
            console.log("[text-input]", msg.data.slice(0, 80));
            this.handleTextInput(msg.data);
            return;
          }
        }
      } catch {}

      if (this.deepgramWs?.readyState === WebSocket.OPEN) {
        this.deepgramWs.send(data);
      }
    });
  }

  private handleTextInput(text: string) {
    const now = Date.now();
    const transcript = {
      chunks: [{ text, isFinal: true as const, timestamp: now }],
      fullText: text,
      startTime: now,
      endTime: now,
    };

    this.ws.send(
      JSON.stringify({
        type: "live-transcript",
        data: { text, isFinal: true, speaker: 0 },
      })
    );

    this.contextManager.addTranscript(transcript);
    this.orchestrator.trigger();
  }

  stop() {
    this.accumulator.stop();
    if (this.deepgramWs?.readyState === WebSocket.OPEN) {
      this.deepgramWs.close();
    }
  }
}
