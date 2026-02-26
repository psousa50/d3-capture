import { Generator, GenerateOptions } from "../types";
import { getProviderForGenerator } from "../../server/llm/config";
import { CREATE_PROMPT } from "./prompts/create";
import { UPDATE_PROMPT } from "./prompts/update";

export class StoryGenerator implements Generator {
  type = "stories";

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
