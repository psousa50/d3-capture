import WebSocket from "ws";
import { logger } from "../logger";
import type { STTProvider, STTStream, STTStreamOptions } from "./types";

const log = logger.child({ module: "stt:deepgram" });

export class DeepgramProvider implements STTProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY not set");
    this.apiKey = key;
  }

  createStream(options: STTStreamOptions): STTStream {
    const url =
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

    const ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    ws.on("open", () => {
      log.info("stream open");
      options.onOpen();
    });

    ws.on("message", (data: unknown) => {
      const response = JSON.parse(String(data));
      const transcript = response.channel?.alternatives?.[0]?.transcript;

      if (transcript) {
        options.onTranscript({
          text: transcript,
          isFinal: response.is_final,
        });
      }
    });

    ws.on("error", (...args: unknown[]) => {
      const err = args[0] instanceof Error ? args[0] : new Error(String(args[0]));
      log.error({ err }, "stream error");
      options.onError(err);
    });

    ws.on("close", () => {
      log.info("stream closed");
      options.onClose();
    });

    return {
      send(audio: Buffer) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audio);
        }
      },
      close() {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      },
    };
  }
}
