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
- For existing diagram subtypes (e.g. "diagram:wireframe"), return the exact key as listed

Existing diagram updates:
- Only return an existing diagram subtype (e.g. "diagram:sequence") when the conversation contains new information relevant to THAT SPECIFIC diagram type
- Do NOT return an existing diagram for update just because someone requested a different diagram type — that is a new diagram, not an update

New diagram creation:
You may suggest creating a NEW diagram when the conversation contains enough concrete detail that a diagram would genuinely aid understanding. Return "diagram:new:{type}" where {type} is a short lowercase hyphenated name (e.g. "diagram:new:er", "diagram:new:sequence", "diagram:new:flowchart", "diagram:new:wireframe").
- Be conservative — only suggest a diagram when there is substantial information to populate it (entities and relationships for ER, clear steps for sequence/flowchart, UI elements for wireframe)
- Prefer fewer diagrams over many — one well-justified diagram is better than three speculative ones
- Do not suggest a diagram type that already exists in the available types list
- Also create diagrams when someone explicitly asks for one (e.g. "I'd like a C4 diagram" → "diagram:new:c4")

Respond with ONLY a JSON array of artefact type strings. No markdown, no explanation.
Examples: ["spec", "diagram:wireframe"] or ["stories"] or ["diagram:new:er"] or []`;
}
