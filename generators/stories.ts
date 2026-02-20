import { Generator, GenerateOptions } from "./types";
import { getProviderForGenerator } from "../server/llm/config";

const CREATE_PROMPT = `You are a meeting user story generator. Based on the meeting conversation provided, generate user stories in standard format.

Rules:
- Use the format: "As a [role], I want [feature], so that [benefit]"
- Include acceptance criteria as a checklist under each story
- Prioritise stories mentioned explicitly, then infer from discussion
- Group related stories under epics if there are enough
- Use markdown format`;

const UPDATE_PROMPT = `You are a meeting user story updater. You will receive existing user stories and new meeting conversation. Update only the stories affected by the new discussion.

Rules:
- Preserve all existing stories that are still valid
- Modify acceptance criteria if the new conversation refines requirements
- Add new stories only if the conversation introduces new features
- Remove stories only if explicitly cancelled in the conversation
- Keep the standard format: "As a [role], I want [feature], so that [benefit]"
- Use markdown format
- Output all stories (existing + updated + new)`;

export class StoryGenerator implements Generator {
  type = "stories" as const;

  async *generate({ context, currentContent }: GenerateOptions): AsyncIterable<string> {
    const provider = getProviderForGenerator("stories");
    const isUpdate = !!currentContent;

    const userContent = isUpdate
      ? `## Current stories\n${currentContent}\n\n## New conversation\n${context}`
      : context;

    yield* provider.stream({
      system: isUpdate ? UPDATE_PROMPT : CREATE_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 4096,
    });
  }
}
