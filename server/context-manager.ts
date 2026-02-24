import { AccumulatedTranscript } from "./transcript-accumulator";
import { getProviderForGenerator } from "./llm/config";
import { getArtefacts, upsertArtefact, deleteDiagramArtefacts, deleteArtefact } from "./db/repositories/artefacts";
import { getChunks } from "./db/repositories/transcripts";
import { getDocuments } from "./db/repositories/documents";

const VERBATIM_WINDOW_MS = 5 * 60 * 1000;
const SUMMARISE_INTERVAL_MS = 5 * 60 * 1000;

interface ContextWindow {
  summary: string;
  recentTranscripts: AccumulatedTranscript[];
  artefactStates: Record<string, string>;
}

export class ContextManager {
  private projectId: string;
  private transcripts: AccumulatedTranscript[] = [];
  private summary = "";
  private artefactStates: Record<string, string> = {};
  private lastSummarisedAt: number = Date.now();
  private summarising = false;

  constructor(projectId: string, meetingId: string) {
    this.projectId = projectId;
    this.hydrate(meetingId).catch(console.error);
  }

  private async hydrate(meetingId: string) {
    const rows = await getArtefacts(this.projectId);
    for (const row of rows) {
      this.artefactStates[row.type] = row.content;
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

  addTranscript(transcript: AccumulatedTranscript) {
    this.transcripts.push(transcript);
    this.maybeSummarise();
  }

  async updateArtefact(type: string, content: string) {
    this.artefactStates[type] = content;
    await upsertArtefact(this.projectId, type, content);
  }

  getContext(): ContextWindow {
    const cutoff = Date.now() - VERBATIM_WINDOW_MS;
    const recentTranscripts = this.transcripts.filter(
      (t) => t.endTime > cutoff
    );

    return {
      summary: this.summary,
      recentTranscripts,
      artefactStates: { ...this.artefactStates },
    };
  }

  buildPromptContext(generatorType: string, excludeKey?: string): string {
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

    if (generatorType === "diagram") {
      const diagramEntries = Object.entries(ctx.artefactStates)
        .filter(([key]) => key.startsWith("diagram:") && key !== excludeKey);
      if (diagramEntries.length > 0) {
        const diagramContext = diagramEntries
          .map(([key, content]) => `### ${key}\n${content}`)
          .join("\n\n");
        parts.push(`## Current diagrams (update based on the conversation)\n${diagramContext}`);
      }
    }

    return parts.join("\n\n");
  }

  getFullTranscript(): string {
    return this.transcripts.map((t) => t.fullText).join("\n\n");
  }

  getArtefactStates(): Record<string, string> {
    return { ...this.artefactStates };
  }

  async clearDiagramArtefacts() {
    for (const key of Object.keys(this.artefactStates)) {
      if (key.startsWith("diagram:")) {
        delete this.artefactStates[key];
      }
    }
    await deleteDiagramArtefacts(this.projectId);
  }

  async clearSingleDiagram(diagramType: string) {
    delete this.artefactStates[`diagram:${diagramType}`];
    await deleteArtefact(this.projectId, `diagram:${diagramType}`);
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
