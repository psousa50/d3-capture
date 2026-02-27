import { getProviderForGenerator } from "./llm/config";
import { buildTriagePrompt } from "../modules/triage/prompts";
import { getTriageDescriptions, getNormaliseMap } from "../modules/registry";
import { logger } from "./logger";

const log = logger.child({ module: "triage" });

const NEW_DIAGRAM_PREFIX = "diagram:new:";
const DELETE_DIAGRAM_PREFIX = "diagram:delete:";

function normalise(raw: string, artefactTypes: string[]): string | null {
  const key = raw.toLowerCase().trim();
  if (key.startsWith(NEW_DIAGRAM_PREFIX) && key.length > NEW_DIAGRAM_PREFIX.length) return key;
  if (key.startsWith(DELETE_DIAGRAM_PREFIX) && key.length > DELETE_DIAGRAM_PREFIX.length) return key;
  if (artefactTypes.includes(key)) return key;
  const map = getNormaliseMap();
  return map[key] ?? null;
}

export async function triageArtefacts(
  newTranscript: string,
  artefactTypes: string[],
): Promise<string[]> {
  const provider = getProviderForGenerator("triage");
  const systemPrompt = buildTriagePrompt(getTriageDescriptions());

  let json = "";
  for await (const chunk of provider.stream({
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Available artefact types: ${JSON.stringify(artefactTypes)}\n\nNew conversation:\n${newTranscript}`,
      },
    ],
    maxTokens: 128,
  })) {
    json += chunk;
  }

  try {
    const cleaned = json.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      log.warn({ response: json }, "response was not an array, running all generators");
      return artefactTypes;
    }

    const normalised = parsed
      .map((t: string) => normalise(t, artefactTypes))
      .filter((t): t is string => t !== null && (artefactTypes.includes(t) || t.startsWith(NEW_DIAGRAM_PREFIX) || t.startsWith(DELETE_DIAGRAM_PREFIX)));

    const unique = [...new Set(normalised)];
    log.info({ raw: cleaned, normalised: unique }, "triage result");
    return unique;
  } catch {
    log.error({ response: json }, "failed to parse response, running all generators");
    return artefactTypes;
  }
}
