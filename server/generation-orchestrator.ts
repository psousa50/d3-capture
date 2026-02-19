import { WebSocket } from "ws";
import { Generator } from "../generators/types";
import { DiagramGenerator } from "../generators/diagram";
import { SpecGenerator } from "../generators/spec";
import { StoryGenerator } from "../generators/stories";
import { ContextManager } from "./context-manager";

export class GenerationOrchestrator {
  private generators: Generator[];
  private contextManager: ContextManager;
  private ws: WebSocket;
  private generating = false;

  constructor(ws: WebSocket, contextManager: ContextManager) {
    this.ws = ws;
    this.contextManager = contextManager;
    this.generators = [
      new DiagramGenerator(),
      new SpecGenerator(),
      new StoryGenerator(),
    ];
  }

  async trigger() {
    if (this.generating) return;
    this.generating = true;

    try {
      const tasks = this.generators.map((generator) =>
        this.runGenerator(generator)
      );
      await Promise.allSettled(tasks);
    } finally {
      this.generating = false;
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

  private send(message: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
