import { WebSocket } from "ws";
import { Generator } from "../generators/types";
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
  private ws: WebSocket;
  private generating = false;
  private pendingTrigger = false;

  constructor(ws: WebSocket, contextManager: ContextManager) {
    this.ws = ws;
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

    this.send({
      type: "artefact-start",
      data: { artefactType: generator.type },
    });

    try {
      for await (const chunk of generator.generate(context)) {
        fullContent += chunk;
        this.send({
          type: "artefact-chunk",
          data: { artefactType: generator.type, chunk },
        });
      }

      this.contextManager.updateArtefact(generator.type, fullContent);

      this.send({
        type: "artefact-complete",
        data: { artefactType: generator.type, content: fullContent },
      });
    } catch (err) {
      console.error(`[generator:${generator.type}] Error:`, err);
      this.send({
        type: "artefact-error",
        data: {
          artefactType: generator.type,
          error: "Generation failed",
        },
      });
    }
  }

  private async runDiagramGeneration() {
    const context = this.contextManager.buildPromptContext("diagram");
    if (!context.trim()) return;

    this.send({
      type: "artefact-start",
      data: { artefactType: "diagram" },
    });

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

      this.send({
        type: "artefact-complete",
        data: { artefactType: "diagram" },
      });
    } catch (err) {
      console.error("[generator:diagram] Error:", err);
      this.send({
        type: "artefact-error",
        data: { artefactType: "diagram", error: "Diagram generation failed" },
      });
    }
  }

  private async runSingleDiagram(
    provider: Parameters<typeof generateDiagram>[0],
    context: string,
    entry: { type: Parameters<typeof generateDiagram>[2]; focus: string },
  ) {
    const artefactType = `diagram:${entry.type}`;
    let fullContent = "";

    this.send({
      type: "artefact-start",
      data: { artefactType },
    });

    try {
      for await (const chunk of generateDiagram(provider, context, entry.type, entry.focus)) {
        fullContent += chunk;
        this.send({
          type: "artefact-chunk",
          data: { artefactType, chunk },
        });
      }

      this.contextManager.updateArtefact(artefactType, fullContent);

      this.send({
        type: "artefact-complete",
        data: { artefactType, content: fullContent },
      });
    } catch (err) {
      console.error(`[generator:${artefactType}] Error:`, err);
      this.send({
        type: "artefact-error",
        data: { artefactType, error: "Generation failed" },
      });
    }
  }

  private send(message: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
