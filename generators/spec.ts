import { Generator, GenerateOptions } from "./types";
import { getProviderForGenerator } from "../server/llm/config";

const CREATE_PROMPT = `You are a meeting specification generator. Based on the meeting conversation provided, generate a structured technical specification document.

Rules:
- Use markdown format
- Include sections as appropriate: Overview, Requirements, Technical Approach, Constraints, Open Questions
- Only include sections that have relevant content from the conversation
- Be concise but capture all technical details discussed
- Flag any contradictions or unresolved decisions`;

const UPDATE_PROMPT = `You are a meeting specification updater. You will receive the current spec and new meeting conversation. Update only the sections affected by the new discussion.

Rules:
- Use markdown format
- Preserve all existing content that is still valid
- Only modify, add, or remove sections directly affected by the new conversation
- Do not rewrite sections that haven't changed
- Flag any contradictions between existing spec and new discussion
- Output the complete updated spec`;

export class SpecGenerator implements Generator {
  type = "spec" as const;

  async *generate({ context, currentContent }: GenerateOptions): AsyncIterable<string> {
    const provider = getProviderForGenerator("spec");
    const isUpdate = !!currentContent;

    const userContent = isUpdate
      ? `## Current spec\n${currentContent}\n\n## New conversation\n${context}`
      : context;

    yield* provider.stream({
      system: isUpdate ? UPDATE_PROMPT : CREATE_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 4096,
    });
  }
}
