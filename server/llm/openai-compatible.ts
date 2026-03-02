import OpenAI from "openai";
import { LLMProvider, StreamParams, ToolCallParams, ToolCallResult } from "./types";

export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(opts: { apiKey: string; baseURL: string; model: string }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
    });
    this.model = opts.model;
  }

  async *stream(params: StreamParams): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
      messages: [
        { role: "system", content: params.system },
        ...params.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  async toolCall(params: ToolCallParams): Promise<ToolCallResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      messages: [
        { role: "system", content: params.system },
        ...params.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      tools: params.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    });

    const choice = response.choices[0];
    const toolCalls = (choice?.message?.tool_calls ?? [])
      .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
      .map((tc) => ({
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

    return { toolCalls, text: choice?.message?.content ?? undefined };
  }
}
