import { Generator, GenerateOptions } from "../types";
import { fillPlaceholders } from "../prompts";
import { getProviderForGenerator } from "../../server/llm/config";
import { getTemplateStore } from "../../server/plugins/registry";

let templates: { create: string; template: string } | null = null;

async function loadTemplates() {
  if (templates) return templates;
  const store = getTemplateStore();
  const [create, template] = await Promise.all([
    store.getTemplate("stories/create"),
    store.getTemplate("stories/template"),
  ]);
  templates = { create, template };
  return templates;
}

export class StoryGenerator implements Generator {
  type = "stories";

  async *generate({ artefactStates }: GenerateOptions): AsyncIterable<string> {
    const spec = artefactStates?.["spec"];
    if (!spec) return;

    const t = await loadTemplates();
    const provider = getProviderForGenerator("stories");

    const prompt = fillPlaceholders(t.create, {
      SPEC: spec,
      STORY_TEMPLATE: t.template,
    });

    yield* provider.stream({
      system: prompt,
      messages: [{ role: "user", content: "Generate." }],
      maxTokens: 8192,
    });
  }
}
