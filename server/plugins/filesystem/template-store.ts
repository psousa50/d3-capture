import { readFileSync } from "fs";
import { join } from "path";
import type { TemplateStore } from "../types/template-store";
import {
  MERMAID_CREATE_PROMPT,
  MERMAID_UPDATE_PROMPT,
  HTML_CREATE_PROMPT,
  HTML_UPDATE_PROMPT,
} from "../../../modules/diagram/prompts";

const MODULES_DIR = join(__dirname, "..", "..", "..", "modules");

const FILE_MAP: Record<string, string> = {
  "context/create": "context/prompts/create.md",
  "context/update": "context/prompts/update.md",
  "context/template": "context/prompts/template.md",
  "spec/create": "spec/prompts/create.md",
  "spec/update": "spec/prompts/update.md",
  "spec/template": "spec/prompts/spec.md",
  "stories/create": "stories/prompts/create.md",
  "stories/template": "stories/prompts/story.md",
  "guidance/system": "guidance/prompts/system.md",
  "assistant/system": "assistant/prompts/system.md",
};

const INLINE_MAP: Record<string, string> = {
  "diagram/mermaid-create": MERMAID_CREATE_PROMPT,
  "diagram/mermaid-update": MERMAID_UPDATE_PROMPT,
  "diagram/html-create": HTML_CREATE_PROMPT,
  "diagram/html-update": HTML_UPDATE_PROMPT,
};

export class FilesystemTemplateStore implements TemplateStore {
  private cache = new Map<string, string>();

  async getTemplate(key: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const inline = INLINE_MAP[key];
    if (inline !== undefined) {
      this.cache.set(key, inline);
      return inline;
    }

    const relativePath = FILE_MAP[key];
    if (!relativePath) {
      throw new Error(`Unknown template key: ${key}`);
    }

    const content = readFileSync(join(MODULES_DIR, relativePath), "utf-8");
    this.cache.set(key, content);
    return content;
  }
}
