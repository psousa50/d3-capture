import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider, StreamParams } from "./types";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model = "claude-haiku-4-5-20251001") {
    this.client = new Anthropic();
    this.model = model;
  }

  async *stream(params: StreamParams): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
