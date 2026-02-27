import Anthropic from "@anthropic-ai/sdk";
import { loadPrompt } from "../prompts";
import { searchWeb } from "../../server/web-search";
import { logger } from "../../server/logger";

const log = logger.child({ module: "assistant" });

const SYSTEM_PROMPT = loadPrompt(new URL("./prompts/system.md", import.meta.url));
const MAX_TOOL_ROUNDS = 5;
const MODEL = process.env.ASSISTANT_MODEL ?? "claude-haiku-4-5-20251001";

const NOVA_PATTERN = /\bnova\b/i;

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information. Use when the question requires up-to-date facts, statistics, versions, or anything you're uncertain about.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_spec",
    description: "Read the current technical specification that has been generated from this meeting. Use when you need to understand what the team is building, technical decisions, requirements, or architecture.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "read_stories",
    description: "Read the user stories generated from this meeting. Use when you need to understand the planned work breakdown, acceptance criteria, or scope of individual features.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "read_diagram",
    description: "Read a specific diagram generated from this meeting. Call list_diagrams first to see available diagrams.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "The diagram type key (e.g. 'er', 'sequence', 'flowchart')" },
      },
      required: ["type"],
    },
  },
  {
    name: "list_diagrams",
    description: "List all diagrams that have been generated in this meeting.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

function handleToolCall(
  name: string,
  input: Record<string, unknown>,
  artefactStates: Record<string, string>,
): Promise<string> | string {
  switch (name) {
    case "web_search": {
      const query = String(input.query ?? "");
      log.info({ query }, "Nova searching web");
      return searchWeb(query).then((results) => {
        if (results.length === 0) return "No results found.";
        return results
          .map((r) => `**${r.title}** (${r.url})\n${r.content}`)
          .join("\n\n");
      });
    }
    case "read_spec":
      return artefactStates["spec"] || "No specification has been generated yet.";
    case "read_stories":
      return artefactStates["stories"] || "No user stories have been generated yet.";
    case "read_diagram": {
      const type = String(input.type ?? "");
      const key = `diagram:${type}`;
      return artefactStates[key] || `No diagram found for type "${type}".`;
    }
    case "list_diagrams": {
      const diagrams = Object.keys(artefactStates)
        .filter((k) => k.startsWith("diagram:"))
        .map((k) => k.slice("diagram:".length));
      return diagrams.length > 0
        ? `Available diagrams: ${diagrams.join(", ")}`
        : "No diagrams have been generated yet.";
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export function mentionsNova(text: string): boolean {
  return NOVA_PATTERN.test(text);
}

export async function runAssistant(
  context: string,
  artefactStates: Record<string, string>,
): Promise<string | null> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: context },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (response.stop_reason === "end_turn" || toolBlocks.length === 0) {
      const answer = textBlocks.map((b) => b.text).join("").trim();
      return answer || null;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await handleToolCall(block.name, block.input as Record<string, unknown>, artefactStates),
      })),
    );

    messages.push({ role: "user", content: toolResults });
  }

  log.warn("assistant hit max tool rounds without finishing");
  return null;
}
