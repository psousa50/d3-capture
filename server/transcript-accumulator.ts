export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  speaker?: number;
  timestamp: number;
}

export interface AccumulatedTranscript {
  chunks: TranscriptChunk[];
  fullText: string;
  startTime: number;
  endTime: number;
}

type TranscriptCallback = (transcript: AccumulatedTranscript) => void;

const EMIT_INTERVAL_MS = 30_000;

export class TranscriptAccumulator {
  private chunks: TranscriptChunk[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onEmit: TranscriptCallback;
  private startTime: number = Date.now();

  constructor(onEmit: TranscriptCallback) {
    this.onEmit = onEmit;
    this.intervalId = setInterval(() => this.emit(), EMIT_INTERVAL_MS);
  }

  add(chunk: TranscriptChunk) {
    if (chunk.isFinal) {
      this.chunks.push(chunk);
    }
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
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
