import { getProviderForGenerator } from "./llm/config";
import { buildTriagePrompt } from "../modules/triage/prompts";
import { getTriageDescriptions, getNormaliseMap } from "../modules/registry";

function normalise(raw: string, artefactTypes: string[]): string | null {
  const key = raw.toLowerCase().trim();
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
      console.warn("[triage] Response was not an array, running all generators:", json);
      return artefactTypes;
    }

    const normalised = parsed
      .map((t: string) => normalise(t, artefactTypes))
      .filter((t): t is string => t !== null && artefactTypes.includes(t));

    const unique = [...new Set(normalised)];
    console.log("[triage] Raw LLM response:", cleaned, "→ normalised:", unique);
    return unique;
  } catch {
    console.error("[triage] Failed to parse response, running all generators:", json);
    return artefactTypes;
  }
}
