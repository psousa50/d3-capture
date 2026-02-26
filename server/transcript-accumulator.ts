import { insertChunk } from "./db/repositories/transcripts";
import { logger } from "./logger";

const log = logger.child({ module: "transcript" });

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  speaker?: string;
  timestamp: number;
}

export interface AccumulatedTranscript {
  chunks: TranscriptChunk[];
  fullText: string;
  startTime: number;
  endTime: number;
}

type TranscriptCallback = (transcript: AccumulatedTranscript) => void;

const SILENCE_THRESHOLD_MS = 4_000;
const MIN_INTERVAL_MS = 15_000;

export class TranscriptAccumulator {
  private chunks: TranscriptChunk[] = [];
  private onEmit: TranscriptCallback;
  private startTime: number = Date.now();
  private meetingId: string;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmitTime: number = Date.now();
  private lastChunkTime = new Map<string, number>();

  constructor(meetingId: string, onEmit: TranscriptCallback) {
    this.meetingId = meetingId;
    this.onEmit = onEmit;
  }

  addParticipant(socketId: string) {
    this.lastChunkTime.set(socketId, Date.now());
  }

  removeParticipant(socketId: string) {
    this.lastChunkTime.delete(socketId);
    this.checkAllSilent();
  }

  add(chunk: TranscriptChunk) {
    if (!chunk.isFinal) return;

    this.chunks.push(chunk);
    insertChunk(this.meetingId, chunk.text, chunk.speaker ?? null, chunk.timestamp).catch((err) => log.error({ err }, "failed to insert chunk"));

    if (chunk.speaker) {
      this.lastChunkTime.set(chunk.speaker, Date.now());
    }

    this.resetSilenceTimer();
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.checkAllSilent();
    }, SILENCE_THRESHOLD_MS);
  }

  private checkAllSilent() {
    if (this.chunks.length === 0) return;

    const now = Date.now();
    const allSilent = Array.from(this.lastChunkTime.values()).every(
      (t) => now - t >= SILENCE_THRESHOLD_MS
    );

    if (allSilent || this.lastChunkTime.size === 0) {
      this.tryEmit();
    }
  }

  private tryEmit() {
    if (this.chunks.length === 0) return;

    const timeSinceLastEmit = Date.now() - this.lastEmitTime;
    if (timeSinceLastEmit < MIN_INTERVAL_MS) {
      setTimeout(() => this.tryEmit(), MIN_INTERVAL_MS - timeSinceLastEmit);
      return;
    }

    this.emit();
  }

  private emit() {
    if (this.chunks.length === 0) return;

    const transcript: AccumulatedTranscript = {
      chunks: [...this.chunks],
      fullText: this.chunks.map((c) => c.text).join(" "),
      startTime: this.startTime,
      endTime: Date.now(),
    };

    this.onEmit(transcript);
    this.lastEmitTime = Date.now();
    this.startTime = Date.now();
    this.chunks = [];
  }

  flush(): AccumulatedTranscript | null {
    if (this.chunks.length === 0) return null;

    const transcript: AccumulatedTranscript = {
      chunks: [...this.chunks],
      fullText: this.chunks.map((c) => c.text).join(" "),
      startTime: this.startTime,
      endTime: Date.now(),
    };

    this.chunks = [];
    this.startTime = Date.now();
    return transcript;
  }

  stop() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.emit();
  }
}
