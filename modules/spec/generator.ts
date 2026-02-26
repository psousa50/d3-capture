import { Generator, GenerateOptions } from "../types";
import { loadPrompt, fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";

const CREATE_PROMPT = loadPrompt(new URL("./prompts/create.md", import.meta.url));
const UPDATE_PROMPT = loadPrompt(new URL("./prompts/update.md", import.meta.url));
const SPEC_TEMPLATE = loadPrompt(new URL("./prompts/spec.md", import.meta.url));

export class SpecGenerator implements Generator {
  type = "spec";

  async *generate({ context, currentContent }: GenerateOptions): AsyncIterable<string> {
    const provider = getProviderForGenerator("spec");
    const isUpdate = !!currentContent;

    const prompt = fillPlaceholders(isUpdate ? UPDATE_PROMPT : CREATE_PROMPT, {
      TRANSCRIPT: context,
      TEMPLATE: SPEC_TEMPLATE,
      EXISTING_SPEC: currentContent || "",
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 8192,
    });
  }
}
