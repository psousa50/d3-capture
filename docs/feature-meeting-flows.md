# Feature Meeting: Speech Processing Flows

How spoken input is processed in a feature meeting, from audio to artefact updates.

## Common Entry Path

All speech follows the same path until routing diverges:

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant AH as AudioHandler
    participant STT as STT Provider
    participant TA as TranscriptAccumulator
    participant CM as ContextManager
    participant GO as GenerationOrchestrator
    participant R as Routing LLM

    U->>AH: audio-data (PCM16 frames)
    AH->>STT: send(buffer)
    STT-->>AH: onTranscript(text, isFinal)
    AH->>TA: add(chunk)
    Note over TA: Buffers chunks until<br/>4s silence + 15s min interval
    TA->>CM: addTranscript(accumulated)
    TA->>GO: trigger(accumulated)
    GO->>R: routeTranscript(text, summary, artefacts, "feature")
    Note over R: Single tool-use LLM call<br/>Feature tools exposed:<br/>no_action, update_context,<br/>update_spec, create_diagram,<br/>update_diagram, delete_diagram,<br/>update_project_diagram
```

---

## Scenario 1: Irrelevant Speech (no_action)

Small talk, filler words, greetings, off-topic conversation.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM

    GO->>R: routeTranscript("yeah that makes sense, ok")
    R-->>GO: tool: no_action
    Note over GO: hasWork = false<br/>Early return, no generators run
```

The transcript is still stored in the database and added to the context window, but no artefact generation is triggered.

---

## Scenario 2: Feature Specification Update (update_spec)

User describes what the system should do, features, capabilities, requirements.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant Spec as SpecGenerator
    participant Stories as StoryGenerator
    participant LLM as LLM Provider
    participant WS as Socket.IO Room

    GO->>R: routeTranscript("users should be able to share transactions...")
    R-->>GO: tool: update_spec

    GO->>CM: buildPromptContext("spec")
    CM-->>GO: context (docs as reference + conversation)
    GO->>CM: getArtefactStates()
    CM-->>GO: {context: "...", spec: "...", ...}

    GO->>WS: artefact-start {type: "spec"}
    loop Streaming
        Spec->>LLM: stream(prompt with PROJECT_CONTEXT + TRANSCRIPT)
        LLM-->>Spec: chunk
        Spec-->>GO: yield chunk
        GO->>WS: artefact-chunk {type: "spec", chunk}
    end
    GO->>CM: updateArtefact("spec", content)
    GO->>WS: artefact-complete {type: "spec"}

    Note over GO: Stories always follow spec

    GO->>WS: artefact-start {type: "stories"}
    loop Streaming
        Stories->>LLM: stream(prompt with spec as input)
        LLM-->>Stories: chunk
        Stories-->>GO: yield chunk
        GO->>WS: artefact-chunk {type: "stories", chunk}
    end
    GO->>CM: updateArtefact("stories", content)
    GO->>WS: artefact-complete {type: "stories"}
```

Spec and stories run sequentially (stories depend on the spec output). The spec prompt receives uploaded documents as labelled "Reference Documents" and spoken words as "Conversation", so the LLM focuses on what was discussed rather than reproducing background material.

---

## Scenario 3: Project Context Update (update_context)

User discusses project vision, goals, scope, constraints, domain.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant Ctx as ContextGenerator
    participant LLM as LLM Provider
    participant WS as Socket.IO Room

    GO->>R: routeTranscript("the goal of this project is...")
    R-->>GO: tool: update_context

    GO->>CM: buildPromptContext("context")
    GO->>WS: artefact-start {type: "context"}
    loop Streaming
        Ctx->>LLM: stream(prompt)
        LLM-->>Ctx: chunk
        Ctx-->>GO: yield chunk
        GO->>WS: artefact-chunk {type: "context", chunk}
    end
    GO->>CM: updateArtefact("context", content)
    Note over CM: type="context" in feature meeting<br/>saves to project scope (featureId=null)
    GO->>WS: artefact-complete {type: "context"}
```

Even in a feature meeting, the context artefact is always project-scoped.

---

## Scenario 4: New Diagram (create_diagram)

User describes entities, flows, or components that warrant a new visualisation.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant DM as diagram module
    participant LLM as LLM Provider
    participant WS as Socket.IO Room

    GO->>R: routeTranscript("we need a sequence diagram for the sharing flow")
    R-->>GO: tool: create_diagram {name: "Sequence Diagram", renderer: "mermaid"}

    GO->>GO: generateDiagramSlug("Sequence Diagram")
    Note over GO: slug = "diagram:sequence-diagram"<br/>Checks for conflicts, appends -2 if needed

    GO->>CM: buildPromptContext("diagram", "diagram:sequence-diagram")
    Note over CM: Includes spec/context as background<br/>+ conversation
    GO->>DM: getDiagramProvider()
    DM-->>GO: LLM provider

    GO->>WS: artefact-start {type: "diagram:sequence-diagram", renderer: "mermaid", name: "Sequence Diagram"}
    loop Streaming
        GO->>DM: generateDiagram(provider, context, plan)
        DM->>LLM: stream(systemPrompt + userPrompt)
        LLM-->>DM: chunk
        DM-->>GO: yield chunk
        GO->>WS: artefact-chunk {type: "diagram:sequence-diagram", chunk}
    end
    GO->>DM: postProcess(content, "mermaid")
    Note over GO: Validates mermaid syntax,<br/>strips fences, fixes styles.<br/>Returns null if insufficient context.
    GO->>CM: updateArtefact("diagram:sequence-diagram", processed, "Sequence Diagram")
    GO->>WS: artefact-complete {type: "diagram:sequence-diagram"}
```

The routing LLM chooses the renderer: `mermaid` for technical diagrams (ER, sequence, flowchart) or `html` for wireframes/mockups.

---

## Scenario 5: Update Existing Diagram (update_diagram)

User mentions something that affects an existing diagram.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant DM as diagram module
    participant LLM as LLM Provider
    participant WS as Socket.IO Room

    Note over R: Routing prompt includes:<br/>"Available diagrams: abc123 (ER Diagram),<br/>def456 (Sequence Diagram)"

    GO->>R: routeTranscript("add a permissions field to the shared_access table")
    R-->>GO: tool: update_diagram {id: "abc123"}

    GO->>CM: getArtefactEntryById("abc123")
    CM-->>GO: {type: "diagram:er-diagram", content: "...", name: "ER Diagram"}
    GO->>GO: inferRendererFromContent(content)

    GO->>CM: buildDiagramContext("abc123")
    Note over CM: Includes spec/context as background<br/>+ current diagram content<br/>+ conversation
    GO->>DM: getDiagramProvider()

    GO->>WS: artefact-start {type: "diagram:er-diagram", renderer: "mermaid"}
    loop Streaming
        GO->>DM: generateDiagram(provider, context, plan, currentContent)
        DM->>LLM: stream(systemPrompt + current diagram + context)
        LLM-->>DM: chunk
        DM-->>GO: yield chunk
    end
    GO->>DM: postProcess(content, "mermaid")
    GO->>CM: updateArtefact("diagram:er-diagram", processed, "ER Diagram")
    GO->>WS: artefact-complete {type: "diagram:er-diagram"}
```

Multiple diagram updates run in parallel via `Promise.allSettled`.

---

## Scenario 6: Delete Diagram (delete_diagram)

User explicitly asks to remove a diagram.

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant WS as Socket.IO Room

    GO->>R: routeTranscript("remove the wireframe diagram, we don't need it")
    R-->>GO: tool: delete_diagram {id: "ghi789"}

    GO->>CM: getArtefactEntryById("ghi789")
    CM-->>GO: {type: "diagram:wireframe", name: "Wireframe"}
    GO->>CM: deleteArtefactById("ghi789")
    Note over CM: Deletes from DB + removes from in-memory map
    GO->>WS: artefact-deleted {type: "diagram:wireframe"}
```

Deletes are processed before creates/updates in the same routing cycle.

---

## Scenario 7: Update Project Diagram from Feature (update_project_diagram)

Feature discussion affects a project-level diagram (e.g. the sharing feature adds a new entity to the project ER diagram).

```mermaid
sequenceDiagram
    participant GO as GenerationOrchestrator
    participant R as Routing LLM
    participant CM as ContextManager
    participant DM as diagram module
    participant LLM as LLM Provider

    Note over R: Feature tools include:<br/>"Available project diagrams:<br/>xyz999 (ER Diagram)"

    GO->>R: routeTranscript("sharing needs a new shared_access table")
    R-->>GO: tool: update_project_diagram {id: "xyz999"}

    GO->>CM: buildDiagramContext("xyz999")
    Note over CM: Uses project context (not spec)<br/>as background for project-scoped diagrams
    GO->>DM: getDiagramProvider()

    loop Streaming
        GO->>DM: generateDiagram(provider, context, plan, currentContent)
        DM->>LLM: stream(systemPrompt + current diagram + context)
        LLM-->>DM: chunk
        DM-->>GO: yield chunk
    end
    GO->>DM: postProcess(content, "mermaid")
    GO->>CM: updateProjectArtefact(type, processed, name)
    Note over CM: Saves with featureId=null (project scope)
```

This is unique to feature meetings. The project diagram is updated in-place at project scope, so other features and the project view see the change immediately.

---

## Execution Order Within a Single Routing Cycle

When routing returns multiple tool calls (e.g. `update_spec` + `update_diagram` + `create_diagram`):

```mermaid
flowchart TD
    A[Routing LLM returns tool calls] --> B{Has context or spec updates?}
    B -->|Yes| C[Run text artefacts sequentially]
    C --> C1[Context generator]
    C1 --> C2[Spec generator]
    C2 --> C3[Stories generator]
    C3 --> D
    B -->|No| D{Has diagram deletes?}
    D -->|Yes| E[Delete diagrams sequentially]
    E --> F
    D -->|No| F{Has diagram updates?}
    F -->|Yes| G[Update diagrams in parallel]
    G --> H
    F -->|No| H{Has diagram creates?}
    H -->|Yes| I[Create diagrams sequentially]
    I --> J
    H -->|No| J{Has project diagram updates?}
    J -->|Yes| K[Update project diagrams sequentially]
    K --> L[Done]
    J -->|No| L
```

The entire cycle is guarded by `generating = false`. If new speech arrives during generation, it queues as `pendingTranscript` and triggers a new cycle when the current one finishes.
