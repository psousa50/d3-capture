import { DiagramPlan } from "../types";
import { LLMProvider } from "../../server/llm/types";
import { getProviderForGenerator } from "../../server/llm/config";
import { getTemplateStore } from "../../server/plugins/registry";

let diagramPrompts: Record<string, string> | null = null;

async function loadDiagramPrompts() {
  if (diagramPrompts) return diagramPrompts;
  const store = getTemplateStore();
  const [mermaidCreate, mermaidUpdate, htmlCreate, htmlUpdate] = await Promise.all([
    store.getTemplate("diagram/mermaid-create"),
    store.getTemplate("diagram/mermaid-update"),
    store.getTemplate("diagram/html-create"),
    store.getTemplate("diagram/html-update"),
  ]);
  diagramPrompts = { mermaidCreate, mermaidUpdate, htmlCreate, htmlUpdate };
  return diagramPrompts;
}

export async function* generateDiagram(
  provider: LLMProvider,
  context: string,
  plan: DiagramPlan,
  currentContent?: string,
): AsyncIterable<string> {
  const prompts = await loadDiagramPrompts();
  const isUpdate = !!currentContent;

  let systemPrompt: string;
  if (plan.renderer === "html") {
    systemPrompt = isUpdate ? prompts.htmlUpdate : prompts.htmlCreate;
  } else {
    systemPrompt = isUpdate ? prompts.mermaidUpdate : prompts.mermaidCreate;
  }

  const userPrompt = isUpdate
    ? `## Current diagram\n${currentContent}\n\n## New conversation\n${context}\n\nDiagram type: ${plan.type}\nFocus: ${plan.focus}`
    : `${context}\n\nDiagram type: ${plan.type}\nFocus: ${plan.focus}`;

  yield* provider.stream({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: plan.renderer === "html" ? 8192 : 2048,
  });
}

export function getDiagramProvider(): LLMProvider {
  return getProviderForGenerator("diagram");
}
