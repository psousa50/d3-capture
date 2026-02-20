import type { Server } from "socket.io";
import { Generator, DiagramPlan } from "../generators/types";
import { planDiagrams, generateDiagram, getDiagramProvider } from "../generators/diagram";
import { SpecGenerator } from "../generators/spec";
import { StoryGenerator } from "../generators/stories";
import { ContextManager } from "./context-manager";

const GENERATION_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class GenerationOrchestrator {
  private generators: Generator[];
  private contextManager: ContextManager;
  private io: Server;
  private room: string;
  private generating = false;
  private pendingTrigger = false;

  constructor(io: Server, room: string, contextManager: ContextManager) {
    this.io = io;
    this.room = room;
    this.contextManager = contextManager;
    this.generators = [new SpecGenerator(), new StoryGenerator()];
  }

  async trigger() {
    if (this.generating) {
      this.pendingTrigger = true;
      return;
    }
    this.generating = true;
    this.pendingTrigger = false;

    try {
      console.log("[orchestrator] Generation started");
      const tasks = [
        ...this.generators.map((g) =>
          withTimeout(this.runGenerator(g), GENERATION_TIMEOUT_MS, g.type)
        ),
        withTimeout(this.runDiagramGeneration(), GENERATION_TIMEOUT_MS, "diagrams"),
      ];
      await Promise.allSettled(tasks);
      console.log("[orchestrator] Generation complete");
    } finally {
      this.generating = false;
      if (this.pendingTrigger) {
        this.pendingTrigger = false;
        this.trigger();
      }
    }
  }

  private async runGenerator(generator: Generator) {
    const context = this.contextManager.buildPromptContext(generator.type);
    if (!context.trim()) return;

    let fullContent = "";

    this.emit("artefact-start", { artefactType: generator.type });

    try {
      for await (const chunk of generator.generate(context)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType: generator.type, chunk });
      }

      this.contextManager.updateArtefact(generator.type, fullContent);

      this.emit("artefact-complete", {
        artefactType: generator.type,
        content: fullContent,
      });
    } catch (err) {
      console.error(`[generator:${generator.type}] Error:`, err);
      this.emit("artefact-error", {
        artefactType: generator.type,
        error: "Generation failed",
      });
    }
  }

  private async runDiagramGeneration() {
    const context = this.contextManager.buildPromptContext("diagram");
    if (!context.trim()) return;

    this.emit("artefact-start", { artefactType: "diagram" });

    try {
      const provider = getDiagramProvider();
      const plan = await planDiagrams(provider, context);
      console.log("[diagram] Plan:", plan.map((p) => p.type).join(", "));

      const tasks = plan.map((entry) =>
        withTimeout(
          this.runSingleDiagram(provider, context, entry),
          GENERATION_TIMEOUT_MS,
          `diagram:${entry.type}`,
        )
      );
      await Promise.allSettled(tasks);

      this.emit("artefact-complete", { artefactType: "diagram" });
    } catch (err) {
      console.error("[generator:diagram] Error:", err);
      this.emit("artefact-error", {
        artefactType: "diagram",
        error: "Diagram generation failed",
      });
    }
  }

  private async runSingleDiagram(
    provider: Parameters<typeof generateDiagram>[0],
    context: string,
    entry: DiagramPlan,
  ) {
    const artefactType = `diagram:${entry.type}`;
    let fullContent = "";

    this.emit("artefact-start", { artefactType, renderer: entry.renderer });

    try {
      for await (const chunk of generateDiagram(provider, context, entry)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType, chunk });
      }

      this.contextManager.updateArtefact(artefactType, fullContent);

      this.emit("artefact-complete", { artefactType, content: fullContent });
    } catch (err) {
      console.error(`[generator:${artefactType}] Error:`, err);
      this.emit("artefact-error", {
        artefactType,
        error: "Generation failed",
      });
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    this.io.to(this.room).emit(event, data);
  }
}
