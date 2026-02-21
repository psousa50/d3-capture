import { getProviderForGenerator } from "./llm/config";

const SYSTEM_PROMPT = `You are a triage classifier for a meeting artefact generator. Given new meeting conversation and a list of artefact types, decide which artefacts need updating.

Rules:
- Only select artefacts where the new conversation is directly relevant
- If the conversation is small talk, greetings, or filler ("yeah", "makes sense", "ok"), return an empty array
- "spec" = technical specification document
- "stories" = user stories with acceptance criteria
- "diagram" = technical diagrams (architecture, ER, sequence, flowcharts, wireframes)
- When specific diagram subtypes are listed (e.g. "diagram:wireframe"), return those exact keys instead of "diagram"
- Only return "diagram" when no subtypes are listed or when ALL diagrams are affected

Respond with ONLY a JSON array of artefact type strings. No markdown, no explanation.
Examples: ["spec", "diagram:wireframe"] or ["stories"] or []`;

const NORMALISE_MAP: Record<string, string> = {
  diagrams: "diagram",
  diagram: "diagram",
  specifications: "spec",
  specification: "spec",
  spec: "spec",
  stories: "stories",
  "user stories": "stories",
  "user-stories": "stories",
};

function normalise(raw: string, artefactTypes: string[]): string | null {
  const key = raw.toLowerCase().trim();
  if (artefactTypes.includes(key)) return key;
  return NORMALISE_MAP[key] ?? null;
}

export async function triageArtefacts(
  newTranscript: string,
  artefactTypes: string[],
): Promise<string[]> {
  const provider = getProviderForGenerator("triage");

  let json = "";
  for await (const chunk of provider.stream({
    system: SYSTEM_PROMPT,
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
