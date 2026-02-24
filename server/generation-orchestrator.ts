import type { Server } from "socket.io";
import { Generator, DiagramPlan } from "../generators/types";
import { planDiagrams, generateDiagram, getDiagramProvider } from "../generators/diagram";
import { SpecGenerator } from "../generators/spec";
import { StoryGenerator } from "../generators/stories";
import { ContextManager } from "./context-manager";
import { triageArtefacts } from "./triage";
import { AccumulatedTranscript } from "./transcript-accumulator";

const GENERATION_TIMEOUT_MS = 120_000;

const MERMAID_KEYWORDS = /^(?:graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram|flowchart|C4Context|C4Container|gantt|pie|gitGraph)\b/;
const MERMAID_PROSE_STRIP = /^[\s\S]*?\n((?:graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram|flowchart|C4Context|C4Container|gantt|pie|gitGraph)\b[\s\S]*)$/;

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  const proseMatch = cleaned.match(MERMAID_PROSE_STRIP);
  if (proseMatch) cleaned = proseMatch[1];
  return cleaned.trim();
}

function isValidMermaid(text: string): boolean {
  return MERMAID_KEYWORDS.test(text.trim());
}

function stripMermaidStyles(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("style ")) return false;
      if (trimmed.startsWith("classDef ")) return false;
      if (trimmed.startsWith("class ") && !trimmed.startsWith("classDiagram")) return false;
      return true;
    })
    .map((line) => line.replace(/:::\w+/g, ""))
    .join("\n");
}

function fixErDiagramAttributes(content: string): string {
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
const BASE_ARTEFACT_TYPES = ["spec", "stories", "diagram"];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class GenerationOrchestrator {
  private generators: Map<string, Generator> = new Map();
  private contextManager: ContextManager;
  private io: Server;
  private room: string;
  private generating = false;
  private pendingTranscript: AccumulatedTranscript | null = null;

  constructor(io: Server, room: string, contextManager: ContextManager) {
    this.io = io;
    this.room = room;
    this.contextManager = contextManager;

    const spec = new SpecGenerator();
    const stories = new StoryGenerator();
    this.generators.set(spec.type, spec);
    this.generators.set(stories.type, stories);
  }

  private getTriageTypes(): string[] {
    const diagramKeys = Object.keys(this.contextManager.getArtefactStates())
      .filter((k) => k.startsWith("diagram:"));
    if (diagramKeys.length > 0) return ["spec", "stories", ...diagramKeys];
    return BASE_ARTEFACT_TYPES;
  }

  async trigger(transcript: AccumulatedTranscript) {
    if (this.generating) {
      this.pendingTranscript = transcript;
      return;
    }
    this.generating = true;
    this.pendingTranscript = null;

    try {
      const affected = await triageArtefacts(transcript.fullText, this.getTriageTypes());
      console.log("[orchestrator] Triage result:", affected.length === 0 ? "nothing to update" : affected.join(", "));

      if (affected.length === 0) return;

      const textTasks: Promise<void>[] = [];
      const diagramTypes: string[] = [];
      let needsAllDiagrams = false;

      for (const type of affected) {
        if (type === "diagram") {
          needsAllDiagrams = true;
        } else if (type.startsWith("diagram:")) {
          diagramTypes.push(type.slice("diagram:".length));
        } else {
          const generator = this.generators.get(type);
          if (generator) {
            textTasks.push(withTimeout(this.runGenerator(generator), GENERATION_TIMEOUT_MS, type));
          }
        }
      }

      if (textTasks.length > 0) {
        await Promise.allSettled(textTasks);
        console.log("[orchestrator] Text artefacts complete");
      }

      if (needsAllDiagrams) {
        console.log("[orchestrator] Starting diagram generation (all)");
        await withTimeout(this.runDiagramGeneration(), GENERATION_TIMEOUT_MS, "diagrams")
          .catch((err) => console.error("[orchestrator] Diagram generation failed:", err));
      } else if (diagramTypes.length > 0) {
        console.log("[orchestrator] Starting diagram generation:", diagramTypes.join(", "));
        await withTimeout(this.runDiagramGeneration(diagramTypes), GENERATION_TIMEOUT_MS, "diagrams")
          .catch((err) => console.error("[orchestrator] Diagram generation failed:", err));
      }

      console.log("[orchestrator] Generation complete");
    } finally {
      this.generating = false;
      if (this.pendingTranscript) {
        const pending = this.pendingTranscript;
        this.pendingTranscript = null;
        this.trigger(pending);
      }
    }
  }

  async regenerateDiagrams() {
    if (this.generating) return;
    this.generating = true;

    try {
      console.log("[orchestrator] Regenerating all diagrams (manual)");
      await this.contextManager.clearDiagramArtefacts();
      await withTimeout(this.runDiagramGeneration(), GENERATION_TIMEOUT_MS, "diagrams")
        .catch((err) => console.error("[orchestrator] Diagram regeneration failed:", err));
    } finally {
      this.generating = false;
    }
  }

  async regenerateSingleDiagram(diagramType: string, renderer: "mermaid" | "html" = "mermaid") {
    if (this.generating) return;
    this.generating = true;

    try {
      const diagramKey = `diagram:${diagramType}`;
      console.log(`[orchestrator] Regenerating ${diagramKey} (manual)`);

      const currentContent = this.contextManager.getArtefactStates()[diagramKey];
      const provider = getDiagramProvider();
      const plan: DiagramPlan = { type: diagramType, focus: `update ${diagramType}`, renderer };

      await withTimeout(
        this.runSingleDiagram(provider, plan, currentContent),
        GENERATION_TIMEOUT_MS,
        diagramKey,
      );
    } catch (err) {
      console.error(`[orchestrator] Single diagram regeneration failed:`, err);
    } finally {
      this.generating = false;
    }
  }

  async triggerAll(transcript: AccumulatedTranscript) {
    if (this.generating) {
      this.pendingTranscript = transcript;
      return;
    }
    this.generating = true;
    this.pendingTranscript = null;

    try {
      console.log("[orchestrator] Generating all artefacts (transcript import)");

      const textTasks: Promise<void>[] = [];
      for (const generator of this.generators.values()) {
        textTasks.push(withTimeout(this.runGenerator(generator), GENERATION_TIMEOUT_MS, generator.type));
      }

      if (textTasks.length > 0) {
        await Promise.allSettled(textTasks);
        console.log("[orchestrator] Text artefacts complete");
      }

      console.log("[orchestrator] Starting diagram generation");
      await withTimeout(this.runDiagramGeneration(), GENERATION_TIMEOUT_MS, "diagrams")
        .catch((err) => console.error("[orchestrator] Diagram generation failed:", err));

      console.log("[orchestrator] Generation complete");
    } finally {
      this.generating = false;
      if (this.pendingTranscript) {
        const pending = this.pendingTranscript;
        this.pendingTranscript = null;
        this.trigger(pending);
      }
    }
  }

  private async runGenerator(generator: Generator) {
    const context = this.contextManager.buildPromptContext(generator.type);
    if (!context.trim()) return;

    const currentContent = this.contextManager.getArtefactStates()[generator.type];
    let fullContent = "";

    this.emit("artefact-start", { artefactType: generator.type });

    try {
      for await (const chunk of generator.generate({ context, currentContent })) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType: generator.type, chunk });
      }

      await this.contextManager.updateArtefact(generator.type, fullContent);

      this.emit("artefact-complete", {
        artefactType: generator.type,
        content: fullContent,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      console.error(`[generator:${generator.type}] Error:`, err);
      this.emit("artefact-error", {
        artefactType: generator.type,
        error: message,
      });
    }
  }

  private async runDiagramGeneration(onlyTypes?: string[]) {
    const baseContext = this.contextManager.buildPromptContext("diagram");
    if (!baseContext.trim()) {
      console.warn("[diagram] Empty context, skipping diagram generation");
      return;
    }

    this.emit("artefact-start", { artefactType: "diagram" });

    try {
      const provider = getDiagramProvider();
      const artefactStates = this.contextManager.getArtefactStates();

      const existingDiagrams = Object.entries(artefactStates)
        .filter(([key]) => key.startsWith("diagram:"))
        .map(([key, content]) => ({
          type: key.slice("diagram:".length),
          content,
        }));

      let plan: DiagramPlan[];

      if (existingDiagrams.length > 0) {
        const toUpdate = onlyTypes
          ? existingDiagrams.filter((d) => onlyTypes.includes(d.type))
          : existingDiagrams;
        console.log("[diagram] Updating diagrams:", toUpdate.map((d) => d.type).join(", "));
        plan = toUpdate.map((d) => ({
          type: d.type,
          focus: `update ${d.type}`,
          renderer: (d.content.trimStart().startsWith("<") || d.content.includes("<!DOCTYPE") || d.content.trimStart().startsWith("```html")) ? "html" as const : "mermaid" as const,
        }));
      } else {
        console.log("[diagram] Planning diagrams...");
        plan = await planDiagrams(provider, baseContext);
        console.log("[diagram] Plan:", plan.map((p) => `${p.type} (${p.renderer})`).join(", "));
      }

      const diagramTasks = plan.map((entry) => {
        const diagramKey = `diagram:${entry.type}`;
        const currentContent = artefactStates[diagramKey];
        console.log(`[diagram] Generating: ${diagramKey}`);
        return withTimeout(
          this.runSingleDiagram(provider, entry, currentContent),
          GENERATION_TIMEOUT_MS,
          diagramKey,
        ).then(
          () => console.log(`[diagram] Complete: ${diagramKey}`),
          (err) => console.error(`[diagram] Failed: ${diagramKey}`, err),
        );
      });

      await Promise.allSettled(diagramTasks);

      this.emit("artefact-complete", { artefactType: "diagram" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Diagram generation failed";
      console.error("[generator:diagram] Error:", err);
      this.emit("artefact-error", {
        artefactType: "diagram",
        error: message,
      });
    }
  }

  private async runSingleDiagram(
    provider: Parameters<typeof generateDiagram>[0],
    entry: DiagramPlan,
    currentContent?: string,
  ) {
    const artefactType = `diagram:${entry.type}`;
    const context = this.contextManager.buildPromptContext("diagram", artefactType);
    let fullContent = "";

    this.emit("artefact-start", { artefactType, renderer: entry.renderer });

    try {
      for await (const chunk of generateDiagram(provider, context, entry, currentContent)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType, chunk });
      }

      fullContent = stripCodeFences(fullContent);

      if (entry.renderer === "mermaid") {
        fullContent = stripMermaidStyles(fullContent);
        fullContent = fixErDiagramAttributes(fullContent);
        if (!isValidMermaid(fullContent)) {
          console.error(`[generator:${artefactType}] Invalid Mermaid syntax, discarding`);
          this.emit("artefact-error", { artefactType, error: "Generated invalid diagram syntax" });
          return;
        }
      }

      await this.contextManager.updateArtefact(artefactType, fullContent);

      this.emit("artefact-complete", { artefactType, content: fullContent });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      console.error(`[generator:${artefactType}] Error:`, err);
      this.emit("artefact-error", {
        artefactType,
        error: message,
      });
    }
  }


  private emit(event: string, data: Record<string, unknown>) {
    this.io.to(this.room).emit(event, data);
  }
}
