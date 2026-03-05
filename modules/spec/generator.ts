import { Generator, GenerateOptions } from "../types";
import { fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";
import { getTemplateStore } from "../../server/plugins/registry";

let templates: { create: string; update: string; template: string } | null = null;

async function loadTemplates() {
  if (templates) return templates;
  const store = getTemplateStore();
  const [create, update, template] = await Promise.all([
    store.getTemplate("spec/create"),
    store.getTemplate("spec/update"),
    store.getTemplate("spec/template"),
  ]);
  templates = { create, update, template };
  return templates;
}

export class SpecGenerator implements Generator {
  type = "spec";

  async *generate({ context, currentContent, artefactStates, meetingScope }: GenerateOptions): AsyncIterable<string> {
    const t = await loadTemplates();
    const provider = getProviderForGenerator("spec");
    const isUpdate = !!currentContent;

    const prompt = fillPlaceholders(isUpdate ? t.update : t.create, {
      TRANSCRIPT: context,
      TEMPLATE: t.template,
      EXISTING_SPEC: currentContent || "",
      PROJECT_CONTEXT: artefactStates?.["context"] || "_No project context available_",
      MEETING_SCOPE: meetingScope || "feature",
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 8192,
    });
  }
}
