export function buildTriagePrompt(
  descriptions: Record<string, string>,
): string {
  const typeLines = Object.entries(descriptions)
    .map(([type, desc]) => `- "${type}" = ${desc}`)
    .join("\n");

  return `You are a triage classifier for a meeting artefact generator. Given new meeting conversation and a list of artefact types, decide which artefacts need updating.

Rules:
- Only select artefacts where the new conversation is directly relevant
- If the conversation is small talk, greetings, or filler ("yeah", "makes sense", "ok"), return an empty array
${typeLines}
- When specific diagram subtypes are listed (e.g. "diagram:wireframe"), return those exact keys instead of "diagram"
- Only return "diagram" when no subtypes are listed or when ALL diagrams are affected

Respond with ONLY a JSON array of artefact type strings. No markdown, no explanation.
Examples: ["spec", "diagram:wireframe"] or ["stories"] or []`;
}
