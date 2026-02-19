export type DiagramSubType =
  | "c4-system"
  | "c4-container"
  | "sequence"
  | "erd"
  | "flowchart";

export interface DiagramPlan {
  type: DiagramSubType;
  focus: string;
}

export interface Generator {
  type: "spec" | "stories";
  generate(context: string): AsyncIterable<string>;
}
