import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider, StreamParams, ToolCallParams, ToolCallResult } from "./types";

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

  async toolCall(params: ToolCallParams): Promise<ToolCallResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
    });

    const toolCalls = response.content
      .filter((block): block is Anthropic.ContentBlock & { type: "tool_use" } => block.type === "tool_use")
      .map((block) => ({
        name: block.name,
        input: block.input as Record<string, unknown>,
      }));

    const textBlock = response.content.find(
      (block): block is Anthropic.ContentBlock & { type: "text" } => block.type === "text",
    );

    return { toolCalls, text: textBlock?.text };
  }
}
