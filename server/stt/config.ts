import { logger } from "../logger";
import type { STTProvider } from "./types";
import { DeepgramProvider } from "./deepgram";
import { VoxtralProvider } from "./voxtral";

const log = logger.child({ module: "stt" });

type STTProviderName = "deepgram" | "voxtral";

let provider: STTProvider | null = null;

function createProvider(name: STTProviderName): STTProvider {
  switch (name) {
    case "deepgram":
      return new DeepgramProvider();
    case "voxtral":
      return new VoxtralProvider();
    default:
      throw new Error(`Unknown STT provider: ${name}`);
  }
}

export function getSTTProvider(): STTProvider {
  if (provider) return provider;

  const name = (process.env.STT_PROVIDER as STTProviderName) || "deepgram";
  log.info({ provider: name }, "initialising STT provider");
  provider = createProvider(name);
  return provider;
}
