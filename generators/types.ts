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
  type: "spec" | "stories";
  generate(options: GenerateOptions): AsyncIterable<string>;
}
