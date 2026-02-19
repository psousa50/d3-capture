import { DiagramPlan, DiagramSubType } from "./types";
import { getProviderForGenerator } from "../server/llm/config";
import { LLMProvider } from "../server/llm/types";

const PLANNING_PROMPT = `You are a technical architect. Analyse the meeting conversation and decide which diagrams would best capture the system being discussed.

Pick 2-4 from this list:
- c4-system: C4 System Context diagram showing external actors and system boundaries
- c4-container: C4 Container diagram showing internal services and components
- sequence: Sequence diagram showing key interactions between components
- erd: Entity Relationship diagram showing the data model
- flowchart: Flowchart showing a process or decision flow

Respond with ONLY a JSON array, no markdown, no explanation:
[{"type": "c4-system", "focus": "brief description of what to show"}, ...]`;

const DIAGRAM_PROMPTS: Record<DiagramSubType, string> = {
  "c4-system": `Generate a Mermaid C4 System Context diagram. Use the C4Context syntax.

Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation.

Example:
C4Context
    title System Context
    Person(user, "User", "End user of the system")
    System(app, "Application", "Main application")
    System_Ext(email, "Email Service", "Sends emails")
    Rel(user, app, "Uses")
    Rel(app, email, "Sends via")`,

  "c4-container": `Generate a Mermaid C4 Container diagram. Use the C4Container syntax.

Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation.

Example:
C4Container
    title Container Diagram
    Person(user, "User", "End user")
    Container_Boundary(app, "Application") {
        Container(web, "Web App", "Next.js", "Serves frontend")
        Container(api, "API", "Node.js", "Handles requests")
        ContainerDb(db, "Database", "PostgreSQL", "Stores data")
    }
    Rel(user, web, "Uses", "HTTPS")
    Rel(web, api, "Calls", "JSON/HTTPS")
    Rel(api, db, "Reads/Writes", "SQL")`,

  sequence: `Generate a Mermaid sequence diagram.

Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation.

Example:
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database
    U->>F: Click button
    F->>B: POST /api/action
    B->>D: INSERT INTO table
    D-->>B: OK
    B-->>F: 200 JSON
    F-->>U: Show result`,

  erd: `Generate a Mermaid Entity Relationship diagram.

Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation.

Example:
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    USER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created_at
        int user_id FK
    }`,

  flowchart: `Generate a Mermaid flowchart diagram.

Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation.

Arrow syntax (use these exact patterns):
  A --> B
  A -->|label| B
  A ==> B
  A -.-> B

Example:
graph TD
    A[Start] -->|Request| B[Server]
    B -->|Query| C[Database]
    C -->|Result| B
    B -->|Response| A`,
};

export async function planDiagrams(
  provider: LLMProvider,
  context: string,
): Promise<DiagramPlan[]> {
  let json = "";
  for await (const chunk of provider.stream({
    system: PLANNING_PROMPT,
    messages: [{ role: "user", content: context }],
    maxTokens: 256,
  })) {
    json += chunk;
  }

  try {
    const cleaned = json.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty plan");

    const validTypes = new Set<string>(["c4-system", "c4-container", "sequence", "erd", "flowchart"]);
    return parsed
      .filter((entry: DiagramPlan) => validTypes.has(entry.type) && entry.focus)
      .slice(0, 4);
  } catch (err) {
    console.error("[diagram] Failed to parse plan, falling back:", json);
    return [{ type: "flowchart", focus: "general system overview" }];
  }
}

export async function* generateDiagram(
  provider: LLMProvider,
  context: string,
  subType: DiagramSubType,
  focus: string,
): AsyncIterable<string> {
  const systemPrompt = DIAGRAM_PROMPTS[subType];
  const userPrompt = `${context}\n\nFocus: ${focus}`;

  yield* provider.stream({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2048,
  });
}

export function getDiagramProvider() {
  return getProviderForGenerator("diagram");
}
