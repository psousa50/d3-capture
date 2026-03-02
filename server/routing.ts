import { getProviderForGenerator } from "./llm/config";
import type { ToolDefinition } from "./llm/types";
import { logger } from "./logger";

const log = logger.child({ module: "routing" });

export interface ArtefactInfo {
  id: string;
  type: string;
  name: string;
  scope: "project" | "feature";
}

export interface RoutingResult {
  updateContext: boolean;
  updateSpec: boolean;
  diagramCreates: { name: string; renderer: "mermaid" | "html" }[];
  diagramUpdates: { id: string }[];
  diagramDeletes: { id: string }[];
  projectDiagramUpdates: { id: string }[];
}

const SYSTEM_PROMPT = `You are a routing classifier for a meeting artefact generator. Given new meeting conversation and a list of existing artefacts, decide what to update by calling the appropriate tools.

When to call tools:
- Someone describes what the system should do, features, capabilities → update_spec
- Someone discusses project vision, goals, scope, constraints → update_context
- Someone mentions entities, data, relationships, components that affect an existing diagram → update_diagram with that diagram's ID
- Someone requests a new diagram type or the conversation warrants a new visualisation → create_diagram
- Someone explicitly asks to remove/delete a diagram → delete_diagram
- In a feature meeting, if someone discusses something that affects a project-level diagram → update_project_diagram

When to call nothing:
- Small talk, greetings, filler ("yeah", "makes sense", "ok"), off-topic conversation

If no diagrams exist and the conversation contains enough substance about system design, data models, or user flows, consider creating initial diagrams.

IMPORTANT: When in doubt, call tools rather than doing nothing. Missing an update is worse than triggering an unnecessary one.`;

function buildProjectTools(artefacts: ArtefactInfo[]): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: "update_context",
      description: "Update the project context (vision, goals, scope, domain model)",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "create_diagram",
      description: "Create a new diagram. Choose renderer: 'mermaid' for technical diagrams, 'html' for wireframes/mockups.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short diagram type name, 2-3 words max. E.g. 'ER Diagram', 'Sequence Diagram', 'Wireframe'. Do NOT include the project name." },
          renderer: { type: "string", enum: ["mermaid", "html"], description: "Rendering engine" },
        },
        required: ["name", "renderer"],
      },
    },
  ];

  const diagrams = artefacts.filter((a) => a.type.startsWith("diagram:"));
  if (diagrams.length > 0) {
    tools.push({
      name: "update_diagram",
      description: `Update an existing diagram by ID. Available diagrams: ${diagrams.map((d) => `${d.id} (${d.name || d.type})`).join(", ")}`,
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The diagram's ID" },
        },
        required: ["id"],
      },
    });

    tools.push({
      name: "delete_diagram",
      description: "Delete an existing diagram by ID. Only when explicitly requested.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The diagram's ID" },
        },
        required: ["id"],
      },
    });
  }

  return tools;
}

function buildFeatureTools(artefacts: ArtefactInfo[]): ToolDefinition[] {
  const tools = buildProjectTools(artefacts);

  tools.push({
    name: "update_spec",
    description: "Update the feature specification (user stories auto-follow)",
    input_schema: { type: "object", properties: {}, required: [] },
  });

  const projectDiagrams = artefacts.filter((a) => a.scope === "project" && a.type.startsWith("diagram:"));
  if (projectDiagrams.length > 0) {
    tools.push({
      name: "update_project_diagram",
      description: `Update a project-level diagram from this feature meeting. Available project diagrams: ${projectDiagrams.map((d) => `${d.id} (${d.name || d.type})`).join(", ")}`,
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The project diagram's ID" },
        },
        required: ["id"],
      },
    });
  }

  return tools;
}

function buildUserMessage(
  newTranscript: string,
  conversationSummary: string | undefined,
  artefacts: ArtefactInfo[],
): string {
  const parts: string[] = [];

  if (artefacts.length > 0) {
    const listing = artefacts
      .map((a) => `- [${a.scope}] ${a.type} (id: ${a.id}${a.name ? `, name: "${a.name}"` : ""})`)
      .join("\n");
    parts.push(`## Existing artefacts\n${listing}`);
  } else {
    parts.push("## Existing artefacts\nNone yet.");
  }

  if (conversationSummary) {
    parts.push(`## Conversation summary\n${conversationSummary}`);
  }

  parts.push(`## New transcript\n${newTranscript}`);

  return parts.join("\n\n");
}

function emptyResult(): RoutingResult {
  return {
    updateContext: false,
    updateSpec: false,
    diagramCreates: [],
    diagramUpdates: [],
    diagramDeletes: [],
    projectDiagramUpdates: [],
  };
}

export async function routeTranscript(
  newTranscript: string,
  conversationSummary: string | undefined,
  artefacts: ArtefactInfo[],
  meetingScope: "project" | "feature",
): Promise<RoutingResult> {
  const provider = getProviderForGenerator("routing");
  const tools = meetingScope === "feature"
    ? buildFeatureTools(artefacts)
    : buildProjectTools(artefacts);

  const userMessage = buildUserMessage(newTranscript, conversationSummary, artefacts);

  const response = await provider.toolCall({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tools,
    maxTokens: 512,
  });

  const result = emptyResult();
  const validIds = new Set(artefacts.map((a) => a.id));

  for (const call of response.toolCalls) {
    switch (call.name) {
      case "update_context":
        result.updateContext = true;
        break;

      case "update_spec":
        result.updateSpec = true;
        break;

      case "create_diagram": {
        const name = call.input.name as string;
        const renderer = call.input.renderer as "mermaid" | "html";
        if (name && renderer) {
          result.diagramCreates.push({ name, renderer });
        }
        break;
      }

      case "update_diagram": {
        const id = call.input.id as string;
        if (id && validIds.has(id)) {
          result.diagramUpdates.push({ id });
        } else {
          log.warn({ id }, "update_diagram referenced invalid ID, skipping");
        }
        break;
      }

      case "delete_diagram": {
        const id = call.input.id as string;
        if (id && validIds.has(id)) {
          result.diagramDeletes.push({ id });
        } else {
          log.warn({ id }, "delete_diagram referenced invalid ID, skipping");
        }
        break;
      }

      case "update_project_diagram": {
        const id = call.input.id as string;
        if (id && validIds.has(id)) {
          result.projectDiagramUpdates.push({ id });
        } else {
          log.warn({ id }, "update_project_diagram referenced invalid ID, skipping");
        }
        break;
      }

      default:
        log.warn({ tool: call.name }, "unknown tool call, skipping");
    }
  }

  log.info(
    {
      context: result.updateContext,
      spec: result.updateSpec,
      creates: result.diagramCreates.length,
      updates: result.diagramUpdates.length,
      deletes: result.diagramDeletes.length,
      projectUpdates: result.projectDiagramUpdates.length,
    },
    "routing result",
  );

  return result;
}
