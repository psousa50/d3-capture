import { Generator } from "./types";
import { getProviderForGenerator } from "../server/llm/config";

const SYSTEM_PROMPT = `You are a meeting specification generator. Based on the meeting conversation provided, generate a structured technical specification document.

Rules:
- Use markdown format
- Include sections as appropriate: Overview, Requirements, Technical Approach, Constraints, Open Questions
- Only include sections that have relevant content from the conversation
- Be concise but capture all technical details discussed
- Flag any contradictions or unresolved decisions
- If updating a previous spec, preserve existing content and add/modify based on new conversation`;

export class SpecGenerator implements Generator {
  type = "spec" as const;

  async *generate(context: string): AsyncIterable<string> {
    const provider = getProviderForGenerator("spec");

    yield* provider.stream({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
      maxTokens: 4096,
    });
  }
}
