import { readFileSync } from "fs";

export function loadPrompt(url: URL): string {
  return readFileSync(url, "utf-8");
}

export function fillPlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
