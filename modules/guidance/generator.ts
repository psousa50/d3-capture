import { getProviderForGenerator } from "../../server/llm/config";
import { getTemplateStore } from "../../server/plugins/registry";
import type { GuidanceItem } from "../../server/plugins/types/meeting-store";

let systemPrompt: string | null = null;

async function loadSystemPrompt() {
  if (systemPrompt) return systemPrompt;
  systemPrompt = await getTemplateStore().getTemplate("guidance/system");
  return systemPrompt;
}

interface RawGuidanceItem {
  type: "question" | "suggestion";
  content: string;
}

export interface GuidanceGenerationResult {
  resolve: string[];
  add: RawGuidanceItem[];
}

function parseResponse(text: string, validIds: Set<string>): GuidanceGenerationResult {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { resolve: [], add: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed !== "object" || parsed === null) return { resolve: [], add: [] };

    const resolve = Array.isArray(parsed.resolve)
      ? parsed.resolve.filter((id: unknown): id is string => typeof id === "string" && validIds.has(id))
      : [];

    const add = Array.isArray(parsed.add)
      ? parsed.add.filter(
          (item: unknown): item is RawGuidanceItem =>
            typeof item === "object" &&
            item !== null &&
            "type" in item &&
            "content" in item &&
            (item.type === "question" || item.type === "suggestion") &&
            typeof item.content === "string" &&
            item.content.trim().length > 0,
        )
      : [];

    return { resolve, add };
  } catch {
    return { resolve: [], add: [] };
  }
}

export async function generateGuidanceItems(
  context: string,
  existingItems: GuidanceItem[],
): Promise<GuidanceGenerationResult> {
  const prompt = await loadSystemPrompt();
  const provider = getProviderForGenerator("guidance");

  const parts: string[] = [context];

  const unresolved = existingItems.filter((i) => !i.resolved);
  if (unresolved.length > 0) {
    parts.push("\n\n## Existing unresolved items (resolve if addressed, do NOT duplicate)\n");
    for (const item of unresolved) {
      parts.push(`- [id=${item.id}] [${item.type}] ${item.content}`);
    }
  }

  const validIds = new Set(unresolved.map((i) => i.id));

  let result = "";
  for await (const chunk of provider.stream({
    system: prompt,
    messages: [{ role: "user", content: parts.join("\n") }],
    maxTokens: 1024,
  })) {
    result += chunk;
  }

  return parseResponse(result, validIds);
}
