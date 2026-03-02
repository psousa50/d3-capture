import { Generator, GenerateOptions } from "../types";
import { fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";
import { getTemplateStore } from "../../server/plugins/registry";

let templates: { create: string; update: string; template: string } | null = null;

async function loadTemplates() {
  if (templates) return templates;
  const store = getTemplateStore();
  const [create, update, template] = await Promise.all([
    store.getTemplate("context/create"),
    store.getTemplate("context/update"),
    store.getTemplate("context/template"),
  ]);
  templates = { create, update, template };
  return templates;
}

export class ContextGenerator implements Generator {
  type = "context";

  async *generate({ context, currentContent }: GenerateOptions): AsyncIterable<string> {
    const t = await loadTemplates();
    const provider = getProviderForGenerator("context");
    const isUpdate = !!currentContent;

    const prompt = fillPlaceholders(isUpdate ? t.update : t.create, {
      TRANSCRIPT: context,
      TEMPLATE: t.template,
      EXISTING_CONTEXT: currentContent || "",
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 4096,
    });
  }
}
