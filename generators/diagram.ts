import { Generator } from "./types";
import { getProviderForGenerator } from "../server/llm/config";

const SYSTEM_PROMPT = `You are a meeting diagram generator. Based on the meeting conversation provided, generate a Mermaid diagram that captures the system architecture, data flow, or process being discussed.

Rules:
- Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation
- Keep diagrams readable — no more than 15-20 nodes
- Use clear, concise labels

Arrow syntax examples (use these exact patterns):
  A --> B
  A -->|label| B
  A ==> B
  A -.-> B

Example output:
graph TD
    A[Client] -->|HTTP Request| B[Server]
    B -->|Query| C[Database]
    C -->|Result| B
    B -->|Response| A`;

export class DiagramGenerator implements Generator {
  type = "diagram" as const;

  async *generate(context: string): AsyncIterable<string> {
    const provider = getProviderForGenerator("diagram");

    yield* provider.stream({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
      maxTokens: 2048,
    });
  }
}
