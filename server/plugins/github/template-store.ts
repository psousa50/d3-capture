import type { TemplateStore } from "../types/template-store";
import { readRawFile } from "./client";

export class GitHubTemplateStore implements TemplateStore {
  private cache = new Map<string, string>();
  private fallback: TemplateStore;

  constructor(fallback: TemplateStore) {
    this.fallback = fallback;
  }

  async getTemplate(key: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const result = await readRawFile(`templates/${key}.md`);
    if (result) {
      this.cache.set(key, result.data);
      return result.data;
    }

    const content = await this.fallback.getTemplate(key);
    this.cache.set(key, content);
    return content;
  }
}
