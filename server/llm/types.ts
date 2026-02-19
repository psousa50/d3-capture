export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface StreamParams {
  system: string;
  messages: Message[];
  maxTokens?: number;
}

export interface LLMProvider {
  stream(params: StreamParams): AsyncIterable<string>;
}
