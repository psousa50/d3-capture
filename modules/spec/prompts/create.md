---
description: Create a feature specification from the transcript below. Outputs a unified markdown document containing both Product and Technical sections. Fills only known information and marks uncertainties. No user interaction — runs to completion automatically.
---

## Input

{{TRANSCRIPT}}

---

## Core Principle

**Fill only what you know. Empty sections are better than hallucinated content.**

---

## Instructions

Read the Input above and generate a complete specification using the Template below. Run to completion without asking any questions.

**Derive the title from the input. Do not ask for confirmation.**

**CRITICAL RULES:**

1. **Create FULL structure — NEVER omit a section:**
   - ALL section headings from both templates MUST appear in the output
   - A section with placeholder text is correct. A missing section is ALWAYS wrong.

2. **Fill ONLY what was discussed:**
   - Discussed → real content
   - NOT discussed → `_To be defined - not yet discussed_`
   - Template examples (like `POST /api/path`) are structure guides, NOT content to copy

3. **NEVER invent:**
   - Endpoints, schemas, architectures, error codes, technology choices
   - When in doubt: placeholder, not guess

4. **Mark uncertainties with inline markers:**
   - `[OPEN QUESTION: ...]` — something discussed but not resolved
   - `[CLARIFICATION NEEDED: ...]` — vague requirement that was raised
   - `[ASSUMPTION: ...]` — reasonable inference you are making
   - `[DECISION PENDING: ...]` — multiple approaches in play
   - These go in sections that HAVE content — not as a substitute for placeholder text in empty sections
   - Every marker must have a corresponding entry in the relevant Open Questions section

**Before outputting, validate internally:**
- [ ] ALL template headings present — count them against the templates below
- [ ] No sections skipped or merged
- [ ] Each discussed section has real content
- [ ] Each non-discussed section has `_To be defined - not yet discussed_`
- [ ] No template examples copied as real content
- [ ] Every uncertainty marker has an entry in Open Questions

Output the full specification as a single markdown document, then stop.

---

## Template

{{TEMPLATE}}
