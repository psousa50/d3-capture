import { getProviderForGenerator } from "./llm/config";

const SYSTEM_PROMPT = `You are a triage classifier for a meeting artefact generator. Given new meeting conversation and a list of artefact types, decide which artefacts need updating.

Rules:
- Only select artefacts where the new conversation is directly relevant
- If the conversation is small talk, greetings, or filler ("yeah", "makes sense", "ok"), return an empty array
- "spec" = technical specification document
- "stories" = user stories with acceptance criteria
- "diagram" = technical diagrams (architecture, ER, sequence, flowcharts, wireframes)

Respond with ONLY a JSON array of artefact type strings. No markdown, no explanation.
Examples: ["spec", "diagram"] or ["stories"] or []`;

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
    if (!Array.isArray(parsed)) return artefactTypes;
    return parsed.filter((t: string) => artefactTypes.includes(t));
  } catch {
    console.error("[triage] Failed to parse response, running all generators:", json);
    return artefactTypes;
  }
}
