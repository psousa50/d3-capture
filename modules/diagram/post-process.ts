import { DiagramRenderer } from "../types";

const MERMAID_KEYWORDS =
  /^(?:graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram|flowchart|C4Context|C4Container|gantt|pie|gitGraph)\b/;

const MERMAID_PROSE_STRIP =
  /^[\s\S]*?\n((?:graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram|flowchart|C4Context|C4Container|gantt|pie|gitGraph)\b[\s\S]*)$/;

export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  const proseMatch = cleaned.match(MERMAID_PROSE_STRIP);
  if (proseMatch) cleaned = proseMatch[1];
  return cleaned.trim();
}

export function isValidMermaid(text: string): boolean {
  return MERMAID_KEYWORDS.test(text.trim());
}

export function stripMermaidStyles(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("style ")) return false;
      if (trimmed.startsWith("classDef ")) return false;
      if (trimmed.startsWith("class ") && !trimmed.startsWith("classDiagram"))
        return false;
      return true;
    })
    .map((line) => line.replace(/:::\w+/g, ""))
    .join("\n");
}

export function fixErDiagramAttributes(content: string): string {
  if (!content.trim().startsWith("erDiagram")) return content;

  const lines = content.split("\n");
  const result: string[] = [];
  const attrs = new Map<string, string[]>();

  const flush = () => {
    for (const [entity, list] of attrs) {
      result.push(`    ${entity} {`);
      for (const a of list) result.push(`        ${a}`);
      result.push(`    }`);
    }
    attrs.clear();
  };

  for (const line of lines) {
    const match = line.match(/^\s+(\w+)\s+:\s+(.+)$/);
    if (match && !line.includes("--")) {
      const [, entity, attr] = match;
      if (!attrs.has(entity)) attrs.set(entity, []);
      attrs.get(entity)!.push(attr.trim());
    } else {
      flush();
      result.push(line);
    }
  }
  flush();
  return result.join("\n");
}

export function postProcessDiagram(
  content: string,
  renderer: DiagramRenderer,
): { content: string; valid: boolean } {
  let processed = stripCodeFences(content);
  if (renderer === "mermaid") {
    processed = stripMermaidStyles(processed);
    processed = fixErDiagramAttributes(processed);
    return { content: processed, valid: isValidMermaid(processed) };
  }
  return { content: processed, valid: true };
}
