---
description: Decompose a feature specification into INVEST-compliant user stories. Outputs a markdown document containing all stories. No user interaction — runs to completion automatically.
---

## Spec

{{SPEC}}

---

## Story Template

{{STORY_TEMPLATE}}

---

## Core Principle: INVEST-Driven Decomposition

Every story must follow INVEST:
- **Independent:** Minimise dependencies, enable parallel development
- **Negotiable:** Scope adapted to real constraints (size, uncertainty, risk)
- **Valuable:** Delivers a complete user workflow with a demonstrable outcome
- **Estimable:** Clear scope with 3–12 acceptance criteria
- **Small:** 1–10 days of work (split if larger)
- **Testable:** Given-When-Then acceptance criteria

**Default strategy:** One user workflow = one full-stack story (Backend + Frontend + Infrastructure)

---

## Instructions

Read the Spec above and decompose it into user stories using the Story Template above. Run to completion without asking any questions.

**Step 1 — Identify workflows**

Extract all distinct user workflows from the spec. Each workflow becomes one story candidate. Use the Product sections for workflows, the Technical sections for implementation notes.

**Step 2 — Apply INVEST to each candidate**

For each story candidate, validate internally:
- [ ] Independent: can be built with minimal dependency on other stories?
- [ ] Valuable: delivers a complete, demonstrable user workflow?
- [ ] Estimable: scope is clear enough to size?
- [ ] Small: fits within 1–10 days? (3–5 ACs = ~1–3 days, 5–8 ACs = ~3–5 days, 8–12 ACs = ~5–10 days)
- [ ] Testable: all ACs can be written as Given-When-Then?

If a story fails Small: split by scope or risk boundary, never by layer.
If a story fails Valuable: merge with a related workflow.
Only output stories that pass all checks.

**Step 3 — Write stories using the Story Template**

For each story:
- User Story: As [persona], I want [capability], so that [benefit]
- Value: what user capability this delivers
- Acceptance Criteria: 3–12 Given-When-Then scenarios covering happy path, errors, and edge cases
- Technical Notes: relevant details from the Technical sections of the spec
- Dependencies: other stories that must complete first (if any)

**Step 4 — Validate before outputting**

- [ ] Every workflow from the spec is covered by at least one story
- [ ] No story exceeds 10 days / 12 ACs
- [ ] No story has fewer than 3 ACs
- [ ] All ACs are Given-When-Then
- [ ] Dependencies are minimal and explicit
- [ ] Uncertainty markers from the spec are noted in affected stories

Output all stories as a single markdown document, then stop.

---

## Size Reference

| Size | Days | ACs |
|------|------|-----|
| Small | 1–3 | 3–5 |
| Medium | 3–5 | 5–8 |
| Large | 5–10 | 8–12 |
| Too large — split | >10 | >12 |
