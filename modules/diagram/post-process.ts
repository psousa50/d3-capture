import { DiagramRenderer } from "../types";

export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:mermaid|html)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  return cleaned.trim();
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
): string {
  let processed = stripCodeFences(content);
  if (renderer === "mermaid") {
    processed = stripMermaidStyles(processed);
    processed = fixErDiagramAttributes(processed);
  }
  return processed;
}
