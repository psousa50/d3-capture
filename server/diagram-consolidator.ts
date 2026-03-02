import { getFeatureDiagramsByType, getProjectArtefacts, upsertArtefact } from "./db/repositories/artefacts";
import { getDiagramModule } from "../modules/registry";
import { postProcessDiagram } from "../modules/diagram/post-process";
import { logger } from "./logger";

const PROJECT_SCOPE = "__project__";
const log = logger.child({ module: "consolidator" });

const MERMAID_PROMPT = `You are merging multiple feature-level Mermaid diagrams into a single unified project-level diagram.

You will receive diagrams from different features. Combine them into one coherent diagram that represents the full project.

Rules:
- Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation
- Merge overlapping entities/nodes: if two features reference the same entity, combine their attributes
- Preserve ALL unique entities, relationships, and attributes from every feature
- Resolve naming conflicts by using the most descriptive label
- Keep diagrams readable — no more than 25-30 nodes
- Do NOT add style, classDef, or any custom styling
- For erDiagram: attributes MUST use curly brace blocks, NOT the colon syntax`;

const HTML_PROMPT = `You are merging multiple feature-level HTML wireframes into a single unified project-level wireframe.

You will receive wireframes from different features. Combine them into one coherent wireframe that represents the full project layout.

Rules:
- Output a COMPLETE HTML document with embedded CSS in a <style> tag
- Merge overlapping UI sections: if two features share a page/section, combine them
- Preserve ALL unique pages, sections, and UI elements from every feature
- Use system fonts only — no external resources, no JavaScript
- Output ONLY the HTML — no code fences, no markdown, no explanation`;

function canonicalSubtype(subtype: string): string {
  return subtype.toLowerCase().replace(/\s*diagram$/i, "").trim();
}

function inferRenderer(contents: (string | undefined)[]): "mermaid" | "html" {
  for (const content of contents) {
    if (!content) continue;
    const trimmed = content.trimStart();
    if (trimmed.startsWith("<") || trimmed.includes("<!DOCTYPE")) return "html";
  }
  return "mermaid";
}

export async function consolidateProjectDiagram(
  projectId: string,
  diagramSubtype: string,
): Promise<void> {
  const featureType = `diagram:${diagramSubtype}`;
  const canonical = canonicalSubtype(diagramSubtype);

  const featureDiagrams = await getFeatureDiagramsByType(projectId, featureType);
  if (featureDiagrams.length === 0) return;

  const diagramMod = getDiagramModule();
  if (!diagramMod) return;

  const projectArtefacts = await getProjectArtefacts(projectId);
  const existingProject = projectArtefacts.find(
    (a) => a.type.startsWith("diagram:") && canonicalSubtype(a.type.slice("diagram:".length)) === canonical,
  );

  const targetType = existingProject?.type ?? featureType;

  const renderer = inferRenderer([
    featureDiagrams[0].content,
    existingProject?.content,
  ]);

  const parts: string[] = [];

  if (existingProject) {
    parts.push(`## Current project-level diagram\n${existingProject.content}`);
  }

  for (const fd of featureDiagrams) {
    parts.push(`## Feature: ${fd.feature_name}\n${fd.content}`);
  }

  parts.push(`Diagram type: ${canonical}`);

  const provider = diagramMod.getProvider();
  let fullContent = "";

  for await (const chunk of provider.stream({
    system: renderer === "html" ? HTML_PROMPT : MERMAID_PROMPT,
    messages: [{ role: "user", content: parts.join("\n\n") }],
    maxTokens: renderer === "html" ? 8192 : 2048,
  })) {
    fullContent += chunk;
  }

  const processed = postProcessDiagram(fullContent, renderer);
  if (processed === null) {
    log.info({ projectId, diagramSubtype }, "consolidation skipped — invalid output");
    return;
  }
  await upsertArtefact(projectId, targetType, processed, PROJECT_SCOPE);

  log.info(
    { projectId, targetType, featureCount: featureDiagrams.length },
    "project diagram consolidated",
  );
}
