import type { Server } from "socket.io";
import { Generator, DiagramPlan } from "../modules/types";
import {
  getTextModules,
  getDiagramModule,
  getAllModules,
} from "../modules/registry";
import { ContextManager } from "./context-manager";
import { triageArtefacts } from "./triage";
import { AccumulatedTranscript } from "./transcript-accumulator";

const GENERATION_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class GenerationOrchestrator {
  private contextManager: ContextManager;
  private io: Server;
  private room: string;
  private generating = false;
  private pendingTranscript: AccumulatedTranscript | null = null;

  constructor(io: Server, room: string, contextManager: ContextManager) {
    this.io = io;
    this.room = room;
    this.contextManager = contextManager;
  }

  private getTriageTypes(): string[] {
    const baseTypes = getAllModules().map((m) => m.type);
    const diagramKeys = Object.keys(this.contextManager.getArtefactStates())
      .filter((k) => k.startsWith("diagram:"));
    if (diagramKeys.length > 0) {
      return baseTypes.filter((t) => t !== "diagram").concat(diagramKeys);
    }
    return baseTypes;
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
          const module = getTextModules().find((m) => m.type === type);
          if (module) {
            textTasks.push(withTimeout(this.runGenerator(module.generator), GENERATION_TIMEOUT_MS, type));
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

      const diagramMod = getDiagramModule();
      if (!diagramMod) return;

      const currentContent = this.contextManager.getArtefactStates()[diagramKey];
      const provider = diagramMod.getProvider();
      const plan: DiagramPlan = { type: diagramType, focus: `update ${diagramType}`, renderer };

      await withTimeout(
        this.runSingleDiagram(plan, currentContent),
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
      for (const module of getTextModules()) {
        textTasks.push(withTimeout(this.runGenerator(module.generator), GENERATION_TIMEOUT_MS, module.type));
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
    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const baseContext = this.contextManager.buildPromptContext("diagram");
    if (!baseContext.trim()) {
      console.warn("[diagram] Empty context, skipping diagram generation");
      return;
    }

    this.emit("artefact-start", { artefactType: "diagram" });

    try {
      const provider = diagramMod.getProvider();
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
        plan = await diagramMod.planDiagrams(provider, baseContext);
        console.log("[diagram] Plan:", plan.map((p) => `${p.type} (${p.renderer})`).join(", "));
      }

      const diagramTasks = plan.map((entry) => {
        const diagramKey = `diagram:${entry.type}`;
        const currentContent = artefactStates[diagramKey];
        console.log(`[diagram] Generating: ${diagramKey}`);
        return withTimeout(
          this.runSingleDiagram(entry, currentContent),
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
    entry: DiagramPlan,
    currentContent?: string,
  ) {
    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const artefactType = `diagram:${entry.type}`;
    const context = this.contextManager.buildPromptContext("diagram", artefactType);
    const provider = diagramMod.getProvider();
    let fullContent = "";

    this.emit("artefact-start", { artefactType, renderer: entry.renderer });

    try {
      for await (const chunk of diagramMod.generateDiagram(provider, context, entry, currentContent)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType, chunk });
      }

      const { content: processed, valid } = diagramMod.postProcess(fullContent, entry.renderer);

      if (!valid) {
        console.error(`[generator:${artefactType}] Invalid Mermaid syntax, discarding`);
        this.emit("artefact-error", { artefactType, error: "Generated invalid diagram syntax" });
        return;
      }

      await this.contextManager.updateArtefact(artefactType, processed);

      this.emit("artefact-complete", { artefactType, content: processed });
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
