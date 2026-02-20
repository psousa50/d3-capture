import type { Server } from "socket.io";
import { Generator, DiagramPlan } from "../generators/types";
import { planDiagrams, generateDiagram, getDiagramProvider } from "../generators/diagram";
import { SpecGenerator } from "../generators/spec";
import { StoryGenerator } from "../generators/stories";
import { ContextManager } from "./context-manager";
import { triageArtefacts } from "./triage";
import { AccumulatedTranscript } from "./transcript-accumulator";

const GENERATION_TIMEOUT_MS = 60_000;
const ARTEFACT_TYPES = ["spec", "stories", "diagram"];

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

  async trigger(transcript: AccumulatedTranscript) {
    if (this.generating) {
      this.pendingTranscript = transcript;
      return;
    }
    this.generating = true;
    this.pendingTranscript = null;

    try {
      const affected = await triageArtefacts(transcript.fullText, ARTEFACT_TYPES);
      console.log("[orchestrator] Triage result:", affected.length === 0 ? "nothing to update" : affected.join(", "));

      if (affected.length === 0) return;

      const tasks: Promise<void>[] = [];

      for (const type of affected) {
        if (type === "diagram") {
          tasks.push(withTimeout(this.runDiagramGeneration(), GENERATION_TIMEOUT_MS, "diagrams"));
        } else {
          const generator = this.generators.get(type);
          if (generator) {
            tasks.push(withTimeout(this.runGenerator(generator), GENERATION_TIMEOUT_MS, type));
          }
        }
      }

      await Promise.allSettled(tasks);
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

      const artefactStates = this.contextManager.getArtefactStates();

      const tasks = plan.map((entry) => {
        const diagramKey = `diagram:${entry.type}`;
        const currentContent = artefactStates[diagramKey];
        return withTimeout(
          this.runSingleDiagram(provider, context, entry, currentContent),
          GENERATION_TIMEOUT_MS,
          diagramKey,
        );
      });
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
    currentContent?: string,
  ) {
    const artefactType = `diagram:${entry.type}`;
    let fullContent = "";

    this.emit("artefact-start", { artefactType, renderer: entry.renderer });

    try {
      for await (const chunk of generateDiagram(provider, context, entry, currentContent)) {
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
