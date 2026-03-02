import { AccumulatedTranscript } from "./transcript-accumulator";
import { getProviderForGenerator } from "./llm/config";
import {
  upsertArtefact,
  deleteDiagramArtefacts,
  deleteArtefact,
  deleteArtefactById,
  getProjectArtefacts,
  getFeatureArtefacts,
  getArtefact,
} from "./db/repositories/artefacts";
import { getChunks } from "./db/repositories/transcripts";
import { getDocuments } from "./db/repositories/documents";
import type { ArtefactInfo } from "./routing";
import { logger } from "./logger";

const log = logger.child({ module: "context" });

const PROJECT_SCOPE = "__project__";
const VERBATIM_WINDOW_MS = 5 * 60 * 1000;
const SUMMARISE_INTERVAL_MS = 5 * 60 * 1000;

export interface ArtefactEntry {
  id: string;
  type: string;
  name: string;
  content: string;
  scope: "project" | "feature";
}

interface ContextWindow {
  summary: string;
  recentTranscripts: AccumulatedTranscript[];
}

export class ContextManager {
  private projectId: string;
  private featureId: string | null;
  private transcripts: AccumulatedTranscript[] = [];
  private summary = "";
  private artefactEntries = new Map<string, ArtefactEntry>();
  private lastSummarisedAt: number = Date.now();
  private summarising = false;

  constructor(projectId: string, meetingId: string, featureId: string | null) {
    this.projectId = projectId;
    this.featureId = featureId;
    this.hydrate(meetingId).catch((err) => log.error({ err }, "hydration failed"));
  }

  private async hydrate(meetingId: string) {
    if (this.featureId) {
      const featureRows = await getFeatureArtefacts(this.projectId, this.featureId);
      for (const row of featureRows) {
        this.artefactEntries.set(row.type, {
          id: row.id,
          type: row.type,
          name: row.name,
          content: row.content,
          scope: "feature",
        });
      }
      const contextRow = await getArtefact(this.projectId, "context");
      if (contextRow) {
        this.artefactEntries.set("context", {
          id: contextRow.id,
          type: "context",
          name: contextRow.name,
          content: contextRow.content,
          scope: "project",
        });
      }
      const projectRows = await getProjectArtefacts(this.projectId);
      for (const row of projectRows) {
        if (row.type.startsWith("diagram:") && !this.artefactEntries.has(row.type)) {
          this.artefactEntries.set(`project:${row.type}`, {
            id: row.id,
            type: row.type,
            name: row.name,
            content: row.content,
            scope: "project",
          });
        }
      }
    } else {
      const rows = await getProjectArtefacts(this.projectId);
      for (const row of rows) {
        this.artefactEntries.set(row.type, {
          id: row.id,
          type: row.type,
          name: row.name,
          content: row.content,
          scope: "project",
        });
      }
    }

    const chunks = await getChunks(meetingId);
    const docs = await getDocuments(meetingId);

    for (const chunk of chunks) {
      this.transcripts.push({
        chunks: [{ text: chunk.text, isFinal: true, timestamp: chunk.timestamp }],
        fullText: chunk.text,
        startTime: chunk.timestamp,
        endTime: chunk.timestamp,
      });
    }

    for (const doc of docs) {
      this.transcripts.push({
        chunks: [{ text: doc.content, isFinal: true, timestamp: doc.created_at }],
        fullText: doc.content,
        startTime: doc.created_at,
        endTime: doc.created_at,
      });
    }
  }

  getProjectId(): string {
    return this.projectId;
  }

  getFeatureId(): string | null {
    return this.featureId;
  }

  addTranscript(transcript: AccumulatedTranscript) {
    this.transcripts.push(transcript);
    this.maybeSummarise();
  }

  getArtefactSummary(): ArtefactInfo[] {
    const result: ArtefactInfo[] = [];
    for (const entry of this.artefactEntries.values()) {
      result.push({ id: entry.id, type: entry.type, name: entry.name, scope: entry.scope });
    }
    return result;
  }

  getArtefactEntry(mapKey: string): ArtefactEntry | undefined {
    return this.artefactEntries.get(mapKey);
  }

  getArtefactEntryById(id: string): ArtefactEntry | undefined {
    for (const entry of this.artefactEntries.values()) {
      if (entry.id === id) return entry;
    }
    return undefined;
  }

  async updateArtefact(type: string, content: string, name?: string) {
    const scope = this.featureId ?? PROJECT_SCOPE;
    const isProjectContext = type === "context" && this.featureId;
    const featureId = isProjectContext ? PROJECT_SCOPE : scope;

    const entry = this.artefactEntries.get(type);
    const artefactName = name ?? entry?.name ?? "";

    const id = await upsertArtefact(this.projectId, type, content, featureId, artefactName);

    this.artefactEntries.set(type, {
      id,
      type,
      name: artefactName,
      content,
      scope: isProjectContext ? "project" : (this.featureId ? "feature" : "project"),
    });
  }

  async updateProjectArtefact(type: string, content: string, name?: string) {
    const entry = this.findEntryByType(type, "project");
    const artefactName = name ?? entry?.name ?? "";

    const id = await upsertArtefact(this.projectId, type, content, PROJECT_SCOPE, artefactName);

    const mapKey = this.featureId ? `project:${type}` : type;
    this.artefactEntries.set(mapKey, {
      id,
      type,
      name: artefactName,
      content,
      scope: "project",
    });
  }

  async deleteArtefactById(id: string) {
    await deleteArtefactById(id);
    for (const [key, entry] of this.artefactEntries.entries()) {
      if (entry.id === id) {
        this.artefactEntries.delete(key);
        break;
      }
    }
  }

  private findEntryByType(type: string, scope: "project" | "feature"): ArtefactEntry | undefined {
    for (const entry of this.artefactEntries.values()) {
      if (entry.type === type && entry.scope === scope) return entry;
    }
    return undefined;
  }

  getArtefactStates(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of this.artefactEntries.values()) {
      if (entry.scope === "project" && this.featureId && entry.type.startsWith("diagram:")) continue;
      result[entry.type] = entry.content;
    }
    return result;
  }

  getContext(): ContextWindow {
    const cutoff = Date.now() - VERBATIM_WINDOW_MS;
    const recentTranscripts = this.transcripts.filter(
      (t) => t.endTime > cutoff
    );

    return { summary: this.summary, recentTranscripts };
  }

  buildPromptContext(generatorType: string, excludeKey?: string, latestText?: string): string {
    const ctx = this.getContext();
    const parts: string[] = [];

    if (ctx.summary) {
      parts.push(`## Earlier in the meeting (summary)\n${ctx.summary}`);
    }

    if (ctx.recentTranscripts.length > 0) {
      const recentText = ctx.recentTranscripts
        .map((t) => t.fullText)
        .join("\n\n");
      parts.push(`## Recent conversation\n${recentText}`);
    } else if (!ctx.summary && this.transcripts.length > 0) {
      const allText = this.transcripts.map((t) => t.fullText).join("\n\n");
      parts.push(`## Meeting conversation\n${allText}`);
    }

    if (generatorType === "diagram" && excludeKey) {
      const entry = this.artefactEntries.get(excludeKey);
      if (entry) {
        parts.push(`## Current diagram\n${entry.content}`);
      }
    }

    if (latestText) {
      parts.push(`## What was just said (respond to this)\n${latestText}`);
    }

    return parts.join("\n\n");
  }

  buildDiagramContext(artefactId: string): string {
    const parts: string[] = [];
    const ctx = this.getContext();

    const entry = this.getArtefactEntryById(artefactId);

    const textArtefact = entry?.scope === "project"
      ? this.artefactEntries.get("context")
      : (this.artefactEntries.get("spec") ?? this.artefactEntries.get("context"));

    if (textArtefact?.content) {
      parts.push(`## Background\n${textArtefact.content}`);
    }

    if (entry?.content) {
      parts.push(`## Current diagram\n${entry.content}`);
    }

    if (ctx.summary) {
      parts.push(`## Earlier in the meeting (summary)\n${ctx.summary}`);
    }

    if (ctx.recentTranscripts.length > 0) {
      const recentText = ctx.recentTranscripts.map((t) => t.fullText).join("\n\n");
      parts.push(`## Recent conversation\n${recentText}`);
    } else if (!ctx.summary && this.transcripts.length > 0) {
      const allText = this.transcripts.map((t) => t.fullText).join("\n\n");
      parts.push(`## Meeting conversation\n${allText}`);
    }

    return parts.join("\n\n");
  }

  getFullTranscript(): string {
    return this.transcripts.map((t) => t.fullText).join("\n\n");
  }

  getConversationSummary(): string | undefined {
    return this.summary || undefined;
  }

  getRecentTranscriptText(): string {
    const ctx = this.getContext();
    if (ctx.recentTranscripts.length > 0) {
      return ctx.recentTranscripts.map((t) => t.fullText).join("\n\n");
    }
    return this.transcripts.map((t) => t.fullText).join("\n\n");
  }

  async clearDiagramArtefacts() {
    for (const [key, entry] of this.artefactEntries.entries()) {
      if (entry.type.startsWith("diagram:") && entry.scope !== "project") {
        this.artefactEntries.delete(key);
      }
    }
    await deleteDiagramArtefacts(this.projectId, this.featureId ?? PROJECT_SCOPE);
  }

  async clearSingleDiagram(diagramType: string) {
    const fullType = `diagram:${diagramType}`;
    this.artefactEntries.delete(fullType);
    await deleteArtefact(this.projectId, fullType, this.featureId ?? PROJECT_SCOPE);
  }

  private async maybeSummarise() {
    if (this.summarising) return;
    if (Date.now() - this.lastSummarisedAt < SUMMARISE_INTERVAL_MS) return;

    const cutoff = Date.now() - VERBATIM_WINDOW_MS;
    const oldTranscripts = this.transcripts.filter((t) => t.endTime <= cutoff);
    if (oldTranscripts.length === 0) return;

    this.summarising = true;

    try {
      const textToSummarise = oldTranscripts
        .map((t) => t.fullText)
        .join("\n\n");

      const provider = getProviderForGenerator("spec");
      let result = "";

      for await (const chunk of provider.stream({
        system:
          "Summarise the following meeting transcript into concise bullet points. " +
          "Preserve key decisions, action items, and technical details. " +
          "Be brief but don't lose important information.",
        messages: [
          {
            role: "user",
            content: this.summary
              ? `Previous summary:\n${this.summary}\n\nNew transcript to incorporate:\n${textToSummarise}`
              : textToSummarise,
          },
        ],
        maxTokens: 1024,
      })) {
        result += chunk;
      }

      this.summary = result;
      this.transcripts = this.transcripts.filter((t) => t.endTime > cutoff);
      this.lastSummarisedAt = Date.now();
    } finally {
      this.summarising = false;
    }
  }
}
