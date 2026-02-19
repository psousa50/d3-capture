const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export class AudioCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onData: ((data: ArrayBuffer) => void) | null = null;

  async start(onData: (data: ArrayBuffer) => void): Promise<void> {
    this.onData = onData;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
      },
    });

    this.context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const source = this.context.createMediaStreamSource(this.stream);

    this.processor = this.context.createScriptProcessor(BUFFER_SIZE, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(inputData);
      this.onData?.(pcm16.buffer as ArrayBuffer);
    };

    source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop() {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context?.close();
    this.processor = null;
    this.stream = null;
    this.context = null;
    this.onData = null;
  }
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}
