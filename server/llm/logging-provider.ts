import { LLMProvider, StreamParams, ToolCallParams, ToolCallResult } from "./types";
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

  async toolCall(params: ToolCallParams): Promise<ToolCallResult> {
    log.debug(
      { provider: this.label, system: params.system, messages: params.messages, tools: params.tools.map((t) => t.name) },
      "tool-call request",
    );

    const result = await this.inner.toolCall(params);

    log.debug(
      { provider: this.label, toolCalls: result.toolCalls, text: result.text },
      "tool-call response",
    );

    return result;
  }
}
