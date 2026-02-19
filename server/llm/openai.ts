import OpenAI from "openai";
import { LLMProvider, StreamParams } from "./types";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model = "gpt-4o") {
    this.client = new OpenAI();
    this.model = model;
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
