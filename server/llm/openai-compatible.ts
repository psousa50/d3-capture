import OpenAI from "openai";
import { LLMProvider, StreamParams } from "./types";

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
}
