import type { Server } from "socket.io";
import { Generator, DiagramPlan } from "../modules/types";
import {
  getTextModules,
  getDiagramModule,
} from "../modules/registry";
import { ContextManager } from "./context-manager";
import { routeTranscript } from "./routing";
import { AccumulatedTranscript } from "./transcript-accumulator";
import { logger } from "./logger";
import { generateGuidanceItems } from "../modules/guidance/generator";
import type { MeetingStore } from "./plugins/types/meeting-store";
import { mentionsNova, runAssistant } from "../modules/assistant/generator";

const log = logger.child({ module: "orchestrator" });

const GENERATION_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export class GenerationOrchestrator {
  private contextManager: ContextManager;
  private meetingStore: MeetingStore;
  private io: Server;
  private room: string;
  private meetingId: string;

  private generating = false;
  private pendingTranscript: AccumulatedTranscript | null = null;
  private guidanceRunning = false;
  private assistantRunning = false;

  constructor(io: Server, room: string, meetingId: string, contextManager: ContextManager, meetingStore: MeetingStore) {
    this.io = io;
    this.room = room;
    this.meetingId = meetingId;
    this.contextManager = contextManager;
    this.meetingStore = meetingStore;
  }

  private isFeatureScoped(): boolean {
    return this.contextManager.getFeatureId() !== null;
  }

  private getMeetingScope(): "project" | "feature" {
    return this.isFeatureScoped() ? "feature" : "project";
  }

  private generateDiagramSlug(name: string): string {
    const slug = slugify(name);
    const prefix = `diagram:${slug}`;
    const existingTypes = new Set(
      this.contextManager.getArtefactSummary().map((a) => a.type),
    );

    if (!existingTypes.has(prefix)) return prefix;

    for (let i = 2; i < 100; i++) {
      const candidate = `${prefix}-${i}`;
      if (!existingTypes.has(candidate)) return candidate;
    }

    return `${prefix}-${Date.now()}`;
  }

  async trigger(transcript: AccumulatedTranscript) {
    if (this.generating) {
      this.pendingTranscript = transcript;
      return;
    }
    this.generating = true;
    this.pendingTranscript = null;

    try {
      const artefacts = this.contextManager.getArtefactSummary();
      const summary = this.contextManager.getConversationSummary();

      const result = await routeTranscript(
        transcript.fullText,
        summary,
        artefacts,
        this.getMeetingScope(),
      );

      const hasWork = result.updateContext || result.updateSpec
        || result.diagramCreates.length > 0
        || result.diagramUpdates.length > 0
        || result.diagramDeletes.length > 0
        || result.projectDiagramUpdates.length > 0;

      if (!hasWork) return;

      if (result.updateContext || result.updateSpec) {
        await this.runTextArtefacts(result.updateContext, result.updateSpec);
      }

      for (const { id } of result.diagramDeletes) {
        const entry = this.contextManager.getArtefactEntryById(id);
        if (entry) {
          log.info({ id, type: entry.type }, "deleting diagram");
          await this.contextManager.deleteArtefactById(id);
          this.emit("artefact-deleted", { artefactType: entry.type });
        }
      }

      if (result.diagramUpdates.length > 0) {
        log.info({ count: result.diagramUpdates.length }, "updating existing diagrams");
        const tasks = result.diagramUpdates.map(({ id }) => {
          const entry = this.contextManager.getArtefactEntryById(id);
          if (!entry) return Promise.resolve();

          const renderer = this.inferRendererFromContent(entry.content);
          return withTimeout(
            this.runSingleDiagramById(id, entry.type, entry.name, renderer),
            GENERATION_TIMEOUT_MS,
            entry.type,
          ).catch((err) => log.error({ err, id, type: entry.type }, "diagram update failed"));
        });
        await Promise.allSettled(tasks);
      }

      for (const { name, renderer } of result.diagramCreates) {
        const typeSlug = this.generateDiagramSlug(name);
        log.info({ name, typeSlug, renderer }, "creating new diagram");
        await withTimeout(
          this.addDiagramInternal(typeSlug.slice("diagram:".length), renderer, name),
          GENERATION_TIMEOUT_MS,
          typeSlug,
        ).catch((err) => log.error({ err, name, typeSlug }, "new diagram failed"));
      }

      for (const { id } of result.projectDiagramUpdates) {
        const entry = this.contextManager.getArtefactEntryById(id);
        if (!entry) continue;

        log.info({ id, type: entry.type }, "updating project diagram from feature");
        const renderer = this.inferRendererFromContent(entry.content);
        await withTimeout(
          this.runProjectDiagramUpdate(id, entry.type, entry.name, renderer),
          GENERATION_TIMEOUT_MS,
          `project:${entry.type}`,
        ).catch((err) => log.error({ err, id, type: entry.type }, "project diagram update failed"));
      }

      log.info("generation complete");
    } finally {
      this.generating = false;
      if (this.pendingTranscript) {
        const pending = this.pendingTranscript;
        this.pendingTranscript = null;
        this.trigger(pending);
      }
    }
  }

  async triggerGuidance() {
    if (this.guidanceRunning) return;
    this.guidanceRunning = true;

    try {
      const context = this.contextManager.buildPromptContext("guidance");
      if (!context.trim()) return;

      const existing = await this.meetingStore.getGuidanceItems(this.meetingId);
      const result = await generateGuidanceItems(context, existing);

      for (const id of result.resolve) {
        await this.meetingStore.resolveGuidanceItem(id);
        this.emit("guidance-item-resolved", { id });
      }

      if (result.add.length > 0) {
        const inserted = await this.meetingStore.insertGuidanceItems(this.meetingId, result.add);
        this.emit("guidance-items-added", { items: inserted });
      }

      if (result.resolve.length > 0 || result.add.length > 0) {
        log.info({ resolved: result.resolve.length, added: result.add.length }, "guidance updated");
      }
    } catch (err) {
      log.error({ err }, "guidance generation failed");
    } finally {
      this.guidanceRunning = false;
    }
  }

  async triggerAssistant(latestText: string) {
    if (!mentionsNova(latestText)) return;
    if (this.assistantRunning) return;
    this.assistantRunning = true;

    try {
      const context = this.contextManager.buildPromptContext("assistant", undefined, latestText);
      if (!context.trim()) return;

      const artefactStates = this.contextManager.getArtefactStates();
      const answer = await runAssistant(context, artefactStates);
      if (!answer) return;

      const row = await this.meetingStore.insertChunk(this.meetingId, answer, "Nova", Date.now());
      this.emit("live-transcript", { id: row.id, text: answer, isFinal: true, speaker: "Nova" });
      log.info("Nova responded");
    } catch (err) {
      log.error({ err }, "assistant generation failed");
    } finally {
      this.assistantRunning = false;
    }
  }

  async regenerateDiagrams() {
    if (this.generating) return;
    this.generating = true;

    try {
      const artefactStates = this.contextManager.getArtefactStates();
      const plans: DiagramPlan[] = Object.entries(artefactStates)
        .filter(([key]) => key.startsWith("diagram:"))
        .map(([key, content]) => ({
          type: key.slice("diagram:".length),
          focus: key.slice("diagram:".length),
          renderer: this.inferRendererFromContent(content),
        }));

      if (plans.length === 0) return;

      log.info("regenerating all diagrams (manual)");
      await this.contextManager.clearDiagramArtefacts();

      this.emit("artefact-start", { artefactType: "diagram" });

      const tasks = plans.map((plan) =>
        withTimeout(this.runSingleDiagram(plan), GENERATION_TIMEOUT_MS, `diagram:${plan.type}`)
          .then(() => log.info({ diagram: plan.type }, "diagram complete"))
          .catch((err) => log.error({ err, diagram: plan.type }, "diagram failed")),
      );
      await Promise.allSettled(tasks);

      this.emit("artefact-complete", { artefactType: "diagram" });
    } catch (err) {
      log.error({ err }, "diagram regeneration failed");
    } finally {
      this.generating = false;
    }
  }

  async addDiagram(diagramType: string, renderer: "mermaid" | "html" = "mermaid", name?: string) {
    if (this.generating) return;
    this.generating = true;

    try {
      await this.addDiagramInternal(diagramType, renderer, name);
    } finally {
      this.generating = false;
    }
  }

  private async addDiagramInternal(diagramType: string, renderer: "mermaid" | "html", name?: string) {
    const diagramKey = `diagram:${diagramType}`;
    log.info({ diagram: diagramKey }, "adding diagram");

    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const plan: DiagramPlan = { type: diagramType, focus: diagramType, renderer };
    await this.runSingleDiagram(plan, undefined, name);
  }

  private inferRendererFromContent(content: string): "mermaid" | "html" {
    const trimmed = content.trimStart();
    if (trimmed.startsWith("<") || content.includes("<!DOCTYPE") || trimmed.startsWith("```html")) {
      return "html";
    }
    return "mermaid";
  }

  async regenerateSingleDiagram(diagramType: string, renderer: "mermaid" | "html" = "mermaid") {
    if (this.generating) return;
    this.generating = true;

    try {
      const diagramKey = `diagram:${diagramType}`;
      log.info({ diagram: diagramKey }, "regenerating diagram (manual)");

      const diagramMod = getDiagramModule();
      if (!diagramMod) return;

      const currentContent = this.contextManager.getArtefactStates()[diagramKey];
      const plan: DiagramPlan = { type: diagramType, focus: `update ${diagramType}`, renderer };

      await withTimeout(
        this.runSingleDiagram(plan, currentContent),
        GENERATION_TIMEOUT_MS,
        diagramKey,
      );
    } catch (err) {
      log.error({ err }, "single diagram regeneration failed");
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
      const isFeature = this.isFeatureScoped();
      log.info({ scope: isFeature ? "feature" : "project" }, "generating text artefacts (transcript import)");
      await this.runTextArtefacts(!isFeature, isFeature);
      log.info("generation complete");
    } finally {
      this.generating = false;
      if (this.pendingTranscript) {
        const pending = this.pendingTranscript;
        this.pendingTranscript = null;
        this.trigger(pending);
      }
    }
  }

  private async runTextArtefacts(includeContext: boolean, includeSpec: boolean) {
    const textModules = getTextModules();
    const contextMod = textModules.find((m) => m.type === "context");
    const specMod = textModules.find((m) => m.type === "spec");
    const storiesMod = textModules.find((m) => m.type === "stories");

    if (includeContext && contextMod) {
      await withTimeout(this.runGenerator(contextMod.generator), GENERATION_TIMEOUT_MS, "context");
      log.info("context complete");
    }

    if (includeSpec && specMod) {
      await withTimeout(this.runGenerator(specMod.generator), GENERATION_TIMEOUT_MS, "spec");
      log.info("spec complete");
    }

    if (includeSpec && storiesMod) {
      await withTimeout(this.runGenerator(storiesMod.generator), GENERATION_TIMEOUT_MS, "stories");
      log.info("stories complete");
    }
  }

  private async runGenerator(generator: Generator) {
    const context = this.contextManager.buildPromptContext(generator.type);
    if (!context.trim() && generator.type !== "stories") return;

    const artefactStates = this.contextManager.getArtefactStates();
    const currentContent = artefactStates[generator.type];
    let fullContent = "";

    this.emit("artefact-start", { artefactType: generator.type });

    try {
      for await (const chunk of generator.generate({ context, currentContent, artefactStates })) {
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
      log.error({ err, generator: generator.type }, "generator error");
      this.emit("artefact-error", {
        artefactType: generator.type,
        error: message,
      });
    }
  }

  private async runSingleDiagram(
    entry: DiagramPlan,
    currentContent?: string,
    name?: string,
  ) {
    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const artefactType = `diagram:${entry.type}`;
    const context = this.contextManager.buildPromptContext("diagram", artefactType);
    const provider = diagramMod.getProvider();
    let fullContent = "";

    this.emit("artefact-start", { artefactType, renderer: entry.renderer, ...(name ? { name } : {}) });

    try {
      for await (const chunk of diagramMod.generateDiagram(provider, context, entry, currentContent)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType, chunk });
      }

      const processed = diagramMod.postProcess(fullContent, entry.renderer);

      if (processed === null) {
        log.info({ artefactType }, "diagram skipped — insufficient context");
        this.emit("artefact-complete", { artefactType, content: "" });
        return;
      }

      await this.contextManager.updateArtefact(artefactType, processed, name);

      this.emit("artefact-complete", { artefactType, content: processed });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      log.error({ err, artefactType }, "diagram generator error");
      this.emit("artefact-error", {
        artefactType,
        error: message,
      });
    }
  }

  private async runSingleDiagramById(
    id: string,
    type: string,
    name: string,
    renderer: "mermaid" | "html",
  ) {
    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const context = this.contextManager.buildDiagramContext(id);
    const provider = diagramMod.getProvider();
    const entry = this.contextManager.getArtefactEntryById(id);
    const currentContent = entry?.content;

    const plan: DiagramPlan = {
      type: type.slice("diagram:".length),
      focus: `update ${name || type}`,
      renderer,
    };

    let fullContent = "";

    this.emit("artefact-start", { artefactType: type, renderer });

    try {
      for await (const chunk of diagramMod.generateDiagram(provider, context, plan, currentContent)) {
        fullContent += chunk;
        this.emit("artefact-chunk", { artefactType: type, chunk });
      }

      const processed = diagramMod.postProcess(fullContent, renderer);

      if (processed === null) {
        log.info({ type }, "diagram skipped — insufficient context");
        this.emit("artefact-complete", { artefactType: type, content: "" });
        return;
      }

      await this.contextManager.updateArtefact(type, processed, name);

      this.emit("artefact-complete", { artefactType: type, content: processed });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      log.error({ err, type }, "diagram update error");
      this.emit("artefact-error", { artefactType: type, error: message });
    }
  }

  private async runProjectDiagramUpdate(
    id: string,
    type: string,
    name: string,
    renderer: "mermaid" | "html",
  ) {
    const diagramMod = getDiagramModule();
    if (!diagramMod) return;

    const context = this.contextManager.buildDiagramContext(id);
    const provider = diagramMod.getProvider();
    const entry = this.contextManager.getArtefactEntryById(id);
    const currentContent = entry?.content;

    const plan: DiagramPlan = {
      type: type.slice("diagram:".length),
      focus: `update ${name || type}`,
      renderer,
    };

    let fullContent = "";

    try {
      for await (const chunk of diagramMod.generateDiagram(provider, context, plan, currentContent)) {
        fullContent += chunk;
      }

      const processed = diagramMod.postProcess(fullContent, renderer);

      if (processed === null) {
        log.info({ type }, "project diagram skipped — insufficient context");
        return;
      }

      await this.contextManager.updateProjectArtefact(type, processed, name);
      log.info({ type, name }, "project diagram updated");
    } catch (err) {
      log.error({ err, type }, "project diagram update error");
    }
  }

  private emit(event: string, data: Record<string, unknown>) {
    this.io.to(this.room).emit(event, data);
  }
}
