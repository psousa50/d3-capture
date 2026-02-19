export interface GeneratorResult {
  content: string;
  type: "diagram" | "spec" | "stories";
}

export interface Generator {
  type: "diagram" | "spec" | "stories";
  generate(context: string): AsyncIterable<string>;
}
