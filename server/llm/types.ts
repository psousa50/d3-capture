export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface StreamParams {
  system: string;
  messages: Message[];
  maxTokens?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCallParams {
  system: string;
  messages: Message[];
  tools: ToolDefinition[];
  maxTokens?: number;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallResult {
  toolCalls: ToolCall[];
  text?: string;
}

export interface LLMProvider {
  stream(params: StreamParams): AsyncIterable<string>;
  toolCall(params: ToolCallParams): Promise<ToolCallResult>;
}
