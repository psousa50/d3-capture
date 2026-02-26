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
- When someone explicitly requests a NEW diagram type that does not exist yet (e.g. "we should have a gantt chart", "can we get a mind map", "let's add a sequence diagram"), return "diagram:new:{type}" where {type} is a short lowercase hyphenated name (e.g. "diagram:new:gantt", "diagram:new:mind-map", "diagram:new:wireframe")
- Only create new diagrams when there is clear intent — not just because a diagram type is mentioned in passing

Respond with ONLY a JSON array of artefact type strings. No markdown, no explanation.
Examples: ["spec", "diagram:wireframe"] or ["stories"] or ["diagram:new:gantt"] or []`;
}
