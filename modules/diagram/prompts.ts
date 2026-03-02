export const MERMAID_CREATE_PROMPT = `Generate a Mermaid diagram based on the meeting conversation.

Rules:
- Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation
- Choose the correct Mermaid diagram syntax for the requested type
- Keep diagrams readable — no more than 15-20 nodes
- Use clear, concise labels
- Do NOT add style, classDef, or any custom styling — the renderer handles theming
- If the conversation lacks sufficient detail to produce a meaningful diagram, output ONLY the word SKIP — nothing else. Do NOT ask clarifying questions or explain what is missing.

Common Mermaid syntax patterns:
  graph TD / graph LR for flowcharts: A[Node] -->|label| B[Node]
  sequenceDiagram: participant A / A->>B: message
  erDiagram: relationships use TABLE_A ||--o{ TABLE_B : label
    Attributes MUST use curly brace blocks, NOT the colon syntax:
    CORRECT: TABLE { string name PK \\n string email }
    WRONG: TABLE : string name PK
  C4Context for C4 diagrams — Mermaid C4 syntax is DIFFERENT from PlantUML C4:
    WRONG (PlantUML — do not use):
      person(u, "User")
      container(s, "System", "Tech")
      u ->> s : uses
    CORRECT (Mermaid — always use this):
      C4Context
        title My System
        Person(u, "User", "Description")
        System(s, "My System", "Technology")
        System_Ext(e, "External System", "Description")
        Rel(u, s, "Uses")
        Rel(s, e, "Calls")
    Rules: PascalCase only (Person, System, Container, Rel). No arrows (->>). No lowercase keywords.
  stateDiagram-v2 for state machines
  classDiagram for class diagrams`;

export const MERMAID_UPDATE_PROMPT = `Update an existing Mermaid diagram based on new meeting conversation. You will receive the current diagram and new discussion.

Rules:
- Output ONLY valid Mermaid syntax — no code fences, no markdown, no explanation
- Preserve the existing structure where it is still accurate
- Only add, modify, or remove elements directly affected by the new conversation
- Keep diagrams readable — no more than 15-20 nodes
- Use clear, concise labels
- Do NOT add style, classDef, or any custom styling — the renderer handles theming
- If the conversation lacks sufficient detail to produce a meaningful diagram, output ONLY the word SKIP — nothing else. Do NOT ask clarifying questions or explain what is missing.`;

export const HTML_CREATE_PROMPT = `Generate a UI wireframe as self-contained HTML and CSS. This is a lo-fi wireframe mockup, not a production UI.

Rules:
- Output a COMPLETE HTML document with embedded CSS in a <style> tag
- Use a clean wireframe aesthetic: light grey backgrounds, thin borders, placeholder text
- Use system fonts only — no external resources, no JavaScript
- Include realistic placeholder content (not lorem ipsum)
- Show the layout, navigation, forms, buttons, and key UI elements discussed
- Keep it simple and readable — this is a wireframe, not a polished design
- Output ONLY the HTML — no code fences, no markdown, no explanation
- If the conversation lacks sufficient detail to produce a meaningful wireframe, output ONLY the word SKIP — nothing else. Do NOT ask clarifying questions or explain what is missing.`;

export const HTML_UPDATE_PROMPT = `Update an existing UI wireframe based on new meeting conversation. You will receive the current HTML wireframe and new discussion.

Rules:
- Output a COMPLETE HTML document with embedded CSS in a <style> tag
- Preserve the existing layout and elements where they are still accurate
- Only modify, add, or remove elements directly affected by the new conversation
- Use system fonts only — no external resources, no JavaScript
- Output ONLY the HTML — no code fences, no markdown, no explanation
- If the conversation lacks sufficient detail to produce a meaningful wireframe, output ONLY the word SKIP — nothing else. Do NOT ask clarifying questions or explain what is missing.`;
