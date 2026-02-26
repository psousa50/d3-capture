import { LLMProvider } from "../server/llm/types";

export type DiagramRenderer = "mermaid" | "html";

export interface DiagramPlan {
  type: string;
  focus: string;
  renderer: DiagramRenderer;
}

export interface GenerateOptions {
  context: string;
  currentContent?: string;
}

export interface Generator {
  type: string;
  generate(options: GenerateOptions): AsyncIterable<string>;
}

export interface ArtefactModuleDefinition {
  type: string;
  description: string;
  aliases: string[];
  generator: Generator;
}

export interface DiagramModuleDefinition {
  type: "diagram";
  description: string;
  aliases: string[];
  planDiagrams(provider: LLMProvider, context: string): Promise<DiagramPlan[]>;
  generateDiagram(
    provider: LLMProvider,
    context: string,
    plan: DiagramPlan,
    currentContent?: string,
  ): AsyncIterable<string>;
  postProcess(
    content: string,
    renderer: DiagramRenderer,
  ): { content: string; valid: boolean };
  getProvider(): LLMProvider;
}

export type ModuleDefinition = ArtefactModuleDefinition | DiagramModuleDefinition;

export function isDiagramModule(
  m: ModuleDefinition,
): m is DiagramModuleDefinition {
  return m.type === "diagram";
}
