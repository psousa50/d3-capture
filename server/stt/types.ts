export interface TranscriptResult {
  text: string;
  isFinal: boolean;
}

export interface STTStream {
  send(audio: Buffer): void;
  close(): void;
}

export interface STTStreamOptions {
  onTranscript: (result: TranscriptResult) => void;
  onError: (err: Error) => void;
  onOpen: () => void;
  onClose: () => void;
}

export interface STTProvider {
  createStream(options: STTStreamOptions): STTStream;
}
