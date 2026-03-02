import { Generator, GenerateOptions } from "../types";
import { loadPrompt, fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";

const CREATE_PROMPT = loadPrompt(new URL("./prompts/create.md", import.meta.url));
const UPDATE_PROMPT = loadPrompt(new URL("./prompts/update.md", import.meta.url));
const CONTEXT_TEMPLATE = loadPrompt(new URL("./prompts/template.md", import.meta.url));

export class ContextGenerator implements Generator {
  type = "context";

  async *generate({ context, currentContent }: GenerateOptions): AsyncIterable<string> {
    const provider = getProviderForGenerator("context");
    const isUpdate = !!currentContent;

    const prompt = fillPlaceholders(isUpdate ? UPDATE_PROMPT : CREATE_PROMPT, {
      TRANSCRIPT: context,
      TEMPLATE: CONTEXT_TEMPLATE,
      EXISTING_CONTEXT: currentContent || "",
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 4096,
    });
  }
}
