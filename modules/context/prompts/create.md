---
description: Create a project context document from the input below. Synthesises a structured overview of the project from meeting transcripts or uploaded documents. Fills only known information. No user interaction — runs to completion automatically.
---

## Input

{{TRANSCRIPT}}

---

## Instructions

Read the Input above and generate a project context document using the Template below. Run to completion without asking any questions.

**Derive the project name from the input. Do not ask for confirmation.**

This is a project-level overview, NOT a feature specification. Focus on:
- What the project is and why it exists
- Who it serves
- Key domain concepts and terminology
- Scope boundaries
- Known constraints

**CRITICAL RULES:**

1. **Create FULL structure — NEVER omit a section:**
   - ALL section headings from the template MUST appear in the output
   - A section with placeholder text is correct. A missing section is ALWAYS wrong.

2. **Fill ONLY what was discussed:**
   - Discussed → real content
   - NOT discussed → `_To be defined - not yet discussed_`

3. **NEVER invent:**
   - Technology choices, architectures, or implementation details
   - When in doubt: placeholder, not guess

Output the full project context as a single markdown document, then stop.

---

## Template

{{TEMPLATE}}
