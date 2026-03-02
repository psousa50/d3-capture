---
description: Update an existing project context document with new information. Updates only affected sections while preserving existing content. No user interaction — runs to completion automatically.
---

## Existing Context

{{EXISTING_CONTEXT}}

---

## New Information

{{TRANSCRIPT}}

---

## Template

{{TEMPLATE}}

---

## Instructions

Read the Existing Context and New Information sections above, then output the full updated project context. Run to completion without asking any questions.

**Update only what has new information. Preserve everything else.**

**DO NOT:**
- Invent details not discussed
- Elaborate beyond what was stated
- Fill empty sections just because they are empty
- Remove `_To be defined - not yet discussed_` without replacement content

**DO:**
- Add only explicitly stated information
- Replace placeholders only when the topic was discussed
- Preserve empty sections if not discussed

**Section-by-section process:**
1. Does the New Information explicitly address this section?
2. YES → update with actual content
3. NO → leave unchanged

Output the full updated project context as a single markdown document, then stop.
