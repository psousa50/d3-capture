import WebSocket from "ws";
import { voxtralLogger } from "../logger";
import type { STTProvider, STTStream, STTStreamOptions } from "./types";

const log = voxtralLogger.child({ module: "stt:voxtral" });

const DEFAULT_BASE_URL = "wss://api.mistral.ai";
const MODEL = "voxtral-mini-transcribe-realtime-2602";

export class VoxtralProvider implements STTProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) throw new Error("MISTRAL_API_KEY not set");
    log.info({ keyLength: key.length, keySuffix: key.slice(-4) }, "loaded API key");
    this.apiKey = key;
    this.baseUrl = process.env.VOXTRAL_BASE_URL || DEFAULT_BASE_URL;
  }

  createStream(options: STTStreamOptions): STTStream {
    const url = `${this.baseUrl}/v1/audio/transcriptions/realtime?model=${MODEL}`;

    log.info({ url }, "connecting");

    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    let buffer = "";
    let sessionReady = false;

    ws.on("open", () => {
      log.info("stream open, waiting for session handshake");
    });

    ws.on("message", (raw: unknown) => {
      const data = JSON.parse(String(raw));
      log.debug({ type: data.type, data }, "message received");

      switch (data.type) {
        case "session.created":
          sessionReady = true;
          log.info("session ready");
          options.onOpen();
          break;

        case "transcription.text.delta":
          buffer += data.text;
          break;

        case "transcription.done":
          if (data.text) {
            buffer = "";
            options.onTranscript({ text: data.text, isFinal: true });
          }
          break;

        case "error":
          log.error({ error: data }, "server error");
          options.onError(new Error(data.error?.message || "Voxtral server error"));
          break;
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

    let hasPendingAudio = false;

    const flushInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && sessionReady && hasPendingAudio) {
        ws.send(JSON.stringify({ type: "input_audio.flush" }));
        hasPendingAudio = false;
      }
    }, 2000);

    return {
      send(audio: Buffer) {
        if (ws.readyState !== WebSocket.OPEN || !sessionReady) return;
        hasPendingAudio = true;
        ws.send(
          JSON.stringify({
            type: "input_audio.append",
            audio: audio.toString("base64"),
          })
        );
      },
      close() {
        clearInterval(flushInterval);
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "input_audio.end" }));
        ws.close();
      },
    };
  }
}
