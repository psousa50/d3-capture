import { Generator, GenerateOptions } from "../types";
import { loadPrompt, fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";

const CREATE_PROMPT = loadPrompt(new URL("./prompts/create.md", import.meta.url));
const STORY_TEMPLATE = loadPrompt(new URL("./prompts/story.md", import.meta.url));

export class StoryGenerator implements Generator {
  type = "stories";

  async *generate({ artefactStates }: GenerateOptions): AsyncIterable<string> {
    const spec = artefactStates?.["spec"];
    if (!spec) return;

    const provider = getProviderForGenerator("stories");

    const prompt = fillPlaceholders(CREATE_PROMPT, {
      SPEC: spec,
      STORY_TEMPLATE: STORY_TEMPLATE,
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 8192,
    });
  }
}
