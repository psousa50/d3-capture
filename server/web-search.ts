import { logger } from "./logger";

const log = logger.child({ module: "web-search" });

const TAVILY_URL = "https://api.tavily.com/search";
const TIMEOUT_MS = 3_000;
const DEFAULT_MAX_RESULTS = 5;

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export async function searchWeb(query: string, maxResults = DEFAULT_MAX_RESULTS): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    log.warn("TAVILY_API_KEY not set, skipping web search");
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
    });

    if (!response.ok) {
      log.error({ status: response.status }, "Tavily request failed");
      return [];
    }

    const data = await response.json();

    return (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? ""),
    }));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      log.warn({ query }, "web search timed out");
    } else {
      log.error({ err, query }, "web search failed");
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
