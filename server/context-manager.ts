import { AccumulatedTranscript } from "./transcript-accumulator";
import { getProviderForGenerator } from "./llm/config";

const VERBATIM_WINDOW_MS = 5 * 60 * 1000;
const SUMMARISE_INTERVAL_MS = 5 * 60 * 1000;

interface ContextWindow {
  summary: string;
  recentTranscripts: AccumulatedTranscript[];
  artefactStates: Record<string, string>;
}

export class ContextManager {
  private transcripts: AccumulatedTranscript[] = [];
  private summary = "";
  private artefactStates: Record<string, string> = {};
  private lastSummarisedAt: number = Date.now();
  private summarising = false;

  addTranscript(transcript: AccumulatedTranscript) {
    this.transcripts.push(transcript);
    this.maybeSummarise();
  }

  updateArtefact(type: string, content: string) {
    this.artefactStates[type] = content;
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

  buildPromptContext(generatorType: string): string {
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
    }

    const currentArtefact = ctx.artefactStates[generatorType];
    if (currentArtefact) {
      parts.push(
        `## Current ${generatorType} (update this based on the conversation)\n${currentArtefact}`
      );
    }

    return parts.join("\n\n");
  }

  getFullTranscript(): string {
    return this.transcripts.map((t) => t.fullText).join("\n\n");
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
