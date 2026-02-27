import { LLMProvider, StreamParams } from "./types";
import { promptLogger } from "../logger";

const log = promptLogger.child({ module: "llm" });

export class LoggingProvider implements LLMProvider {
  constructor(
    private inner: LLMProvider,
    private label: string,
  ) {}

  async *stream(params: StreamParams): AsyncIterable<string> {
    log.debug(
      { provider: this.label, system: params.system, messages: params.messages, maxTokens: params.maxTokens },
      "request",
    );

    let full = "";
    for await (const chunk of this.inner.stream(params)) {
      full += chunk;
      yield chunk;
    }

    log.debug({ provider: this.label, chars: full.length, response: full }, "response");
  }
}
