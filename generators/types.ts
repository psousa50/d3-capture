export type DiagramRenderer = "mermaid" | "html";

export interface DiagramPlan {
  type: string;
  focus: string;
  renderer: DiagramRenderer;
}

export interface Generator {
  type: "spec" | "stories";
  generate(context: string): AsyncIterable<string>;
}
