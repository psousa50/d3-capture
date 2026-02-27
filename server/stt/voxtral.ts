import WebSocket from "ws";
import { logger } from "../logger";
import type { STTProvider, STTStream, STTStreamOptions } from "./types";

const log = logger.child({ module: "stt:voxtral" });

const DEFAULT_BASE_URL = "wss://api.mistral.ai";
const MODEL = "voxtral-mini-transcribe-realtime-2602";

export class VoxtralProvider implements STTProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) throw new Error("MISTRAL_API_KEY not set");
    this.apiKey = key;
    this.baseUrl = process.env.VOXTRAL_BASE_URL || DEFAULT_BASE_URL;
  }

  createStream(options: STTStreamOptions): STTStream {
    const url = `${this.baseUrl}/v1/audio/transcriptions/realtime?model=${MODEL}`;

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

      switch (data.type) {
        case "realtime_transcription_session_created":
          sessionReady = true;
          log.info("session ready");
          options.onOpen();
          break;

        case "transcription_stream_text_delta":
          buffer += data.delta;
          options.onTranscript({ text: buffer, isFinal: false });
          break;

        case "transcription_stream_done":
          if (buffer) {
            options.onTranscript({ text: buffer, isFinal: true });
            buffer = "";
          }
          break;

        case "realtime_transcription_error":
          log.error({ error: data }, "server error");
          options.onError(new Error(data.detail?.message || "Voxtral server error"));
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

    return {
      send(audio: Buffer) {
        if (ws.readyState !== WebSocket.OPEN || !sessionReady) return;
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: audio.toString("base64"),
          })
        );
      },
      close() {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit", final: true }));
        ws.close();
      },
    };
  }
}
