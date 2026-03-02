import { DiagramPlan } from "../types";
import { LLMProvider } from "../../server/llm/types";
import { getProviderForGenerator } from "../../server/llm/config";
import {
  MERMAID_CREATE_PROMPT,
  MERMAID_UPDATE_PROMPT,
  HTML_CREATE_PROMPT,
  HTML_UPDATE_PROMPT,
} from "./prompts";

export async function* generateDiagram(
  provider: LLMProvider,
  context: string,
  plan: DiagramPlan,
  currentContent?: string,
): AsyncIterable<string> {
  const isUpdate = !!currentContent;

  let systemPrompt: string;
  if (plan.renderer === "html") {
    systemPrompt = isUpdate ? HTML_UPDATE_PROMPT : HTML_CREATE_PROMPT;
  } else {
    systemPrompt = isUpdate ? MERMAID_UPDATE_PROMPT : MERMAID_CREATE_PROMPT;
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
