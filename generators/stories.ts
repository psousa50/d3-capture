import { Generator } from "./types";
import { getProviderForGenerator } from "../server/llm/config";

const SYSTEM_PROMPT = `You are a meeting user story generator. Based on the meeting conversation provided, generate user stories in standard format.

Rules:
- Use the format: "As a [role], I want [feature], so that [benefit]"
- Include acceptance criteria as a checklist under each story
- Prioritise stories mentioned explicitly, then infer from discussion
- Group related stories under epics if there are enough
- Use markdown format
- If updating previous stories, preserve existing ones and add/modify based on new conversation`;

export class StoryGenerator implements Generator {
  type = "stories" as const;

  async *generate(context: string): AsyncIterable<string> {
    const provider = getProviderForGenerator("stories");

    yield* provider.stream({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
      maxTokens: 4096,
    });
  }
}
