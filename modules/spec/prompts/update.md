---
description: Update an existing feature specification with new information (meeting transcript, technical decisions, feedback, or discussion). Updates only affected sections while preserving existing content. No user interaction — runs to completion automatically.
---

## Existing Spec

{{EXISTING_SPEC}}

---

## New Information

{{TRANSCRIPT}}

---

## Template

{{TEMPLATE}}

---

## Core Principle

**Update only what has new information. Preserve everything else.**

---

## Instructions

Read the Existing Spec and New Information sections above, then output the full updated specification. Run to completion without asking any questions.

**CRITICAL — Non-Greedy Updates:**

Update ONLY sections explicitly addressed in the New Information.

**DO NOT:**
- Invent details not discussed (endpoints, schemas, architectures)
- Elaborate beyond what was stated
- Fill empty sections just because they're empty
- Remove `_To be defined - not yet discussed_` without replacement content
- Treat template structure as a prompt to fill

**DO:**
- Add only explicitly stated information
- Replace placeholders only when the topic was discussed
- Add uncertainty markers for ambiguous or unresolved information
- Preserve empty sections if not discussed

**Section-by-section process:**
1. Does the New Information explicitly address this section?
2. YES → update with actual content from the transcript
3. NO → leave unchanged (existing content or existing placeholder)

**Uncertainty markers:**
- `[OPEN QUESTION: ...]` — something discussed but not resolved
- `[CLARIFICATION NEEDED: ...]` — vague requirement that was raised
- `[ASSUMPTION: ...]` — reasonable inference you are making
- `[DECISION PENDING: ...]` — multiple approaches in play
- Resolved markers → remove them and their Open Questions entries
- New uncertainties → add markers and corresponding Open Questions entries

**Before outputting, validate internally:**
- [ ] ALL template headings present — none added, none removed
- [ ] Only sections with new information were changed
- [ ] No `_To be defined - not yet discussed_` removed without replacement
- [ ] No template examples copied as real content
- [ ] Every uncertainty marker has an entry in Open Questions
- [ ] Resolved markers have been removed

Output the full updated specification as a single markdown document, then stop.
