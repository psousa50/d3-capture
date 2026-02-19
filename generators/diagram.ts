import { DiagramPlan, DiagramRenderer } from "./types";
import { getProviderForGenerator } from "../server/llm/config";
import { LLMProvider } from "../server/llm/types";

const PLANNING_PROMPT = `You are a technical architect. Analyse the meeting conversation and decide which diagrams would best capture the system being discussed.

Pick 2-4 diagrams. For each, choose the most appropriate type (e.g. sequence diagram, ER diagram, C4 system context, flowchart, wireframe, component diagram, state machine, deployment diagram — anything useful).

For each diagram, specify the renderer:
- "mermaid" for technical diagrams (flowcharts, sequence, ER, C4, state, etc.)
- "html" for UI wireframes, mockups, or page layouts

Respond with ONLY a JSON array, no markdown, no explanation:
[{"type": "sequence diagram", "focus": "brief description of what to show", "renderer": "mermaid"}, ...]`;

const MERMAID_PROMPT = `Generate a Mermaid diagram based on the meeting conversation.

Rules:
- Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation
- Choose the correct Mermaid diagram syntax for the requested type
- Keep diagrams readable — no more than 15-20 nodes
- Use clear, concise labels

Common Mermaid syntax patterns:
  graph TD / graph LR for flowcharts: A[Node] -->|label| B[Node]
  sequenceDiagram: participant A / A->>B: message
  erDiagram: TABLE ||--o{ OTHER : relationship
  C4Context / C4Container for C4 diagrams
  stateDiagram-v2 for state machines
  classDiagram for class diagrams`;

const HTML_PROMPT = `Generate a UI wireframe as self-contained HTML and CSS. This is a lo-fi wireframe mockup, not a production UI.

Rules:
- Output a COMPLETE HTML document with embedded CSS in a <style> tag
- Use a clean wireframe aesthetic: light grey backgrounds, thin borders, placeholder text
- Use system fonts only — no external resources, no JavaScript
- Include realistic placeholder content (not lorem ipsum)
- Show the layout, navigation, forms, buttons, and key UI elements discussed
- Keep it simple and readable — this is a wireframe, not a polished design
- Output ONLY the HTML — no code fences, no markdown, no explanation`;

export async function planDiagrams(
  provider: LLMProvider,
  context: string,
): Promise<DiagramPlan[]> {
  let json = "";
  for await (const chunk of provider.stream({
    system: PLANNING_PROMPT,
    messages: [{ role: "user", content: context }],
    maxTokens: 512,
  })) {
    json += chunk;
  }

  try {
    const cleaned = json.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty plan");

    return parsed
      .filter((entry: DiagramPlan) =>
        entry.type &&
        entry.focus &&
        (entry.renderer === "mermaid" || entry.renderer === "html")
      )
      .slice(0, 4);
  } catch (err) {
    console.error("[diagram] Failed to parse plan, falling back:", json);
    return [{ type: "flowchart", focus: "general system overview", renderer: "mermaid" }];
  }
}

export async function* generateDiagram(
  provider: LLMProvider,
  context: string,
  plan: DiagramPlan,
): AsyncIterable<string> {
  const systemPrompt = plan.renderer === "html" ? HTML_PROMPT : MERMAID_PROMPT;
  const userPrompt = `${context}\n\nDiagram type: ${plan.type}\nFocus: ${plan.focus}`;

  yield* provider.stream({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: plan.renderer === "html" ? 4096 : 2048,
  });
}

export function getDiagramProvider() {
  return getProviderForGenerator("diagram");
}
