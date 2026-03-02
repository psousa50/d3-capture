# Architecture

Real-time meeting assistant that transcribes audio, generates specs/stories/diagrams via LLM, and streams results to all participants.

**Stack:** Next.js 16, React 19, Socket.IO 4, PostgreSQL (pg), multi-provider STT (Deepgram/Voxtral), multi-provider LLM (Anthropic/OpenAI/Groq), Tailwind CSS 4, TypeScript strict.

## Directory structure

```
server/
├── index.ts                     Custom HTTP server: Next.js SSR + Socket.IO on same port
├── meeting-manager.ts           Active meeting lifecycle, participant join/leave, presence, scope-aware snapshots, graceful shutdown (30s grace)
├── audio-handler.ts             Per-participant STT streams via provider, delegates to TranscriptAccumulator
├── transcript-accumulator.ts    Buffers transcript chunks, silence detection (4s), rate-limiting (15s min), DB writes
├── context-manager.ts           Two-tier context window (recent 5min verbatim + older summarised), scope-aware artefact loading, builds LLM prompts
├── generation-orchestrator.ts   Scope-aware triage → sequential text generation → auto-update diagrams, single-at-a-time queue
├── diagram-consolidator.ts     Merges feature-level diagrams into project-level via LLM, debounced fire-and-forget
├── triage.ts                    LLM classifier deciding which artefacts are affected by new transcript, normalises output
├── web-search.ts                Tavily web search wrapper with timeout (3s), used by assistant module
├── stt/
│   ├── types.ts                 STTProvider interface: createStream(options) → STTStream
│   ├── config.ts                Factory with provider routing via STT_PROVIDER env var
│   ├── deepgram.ts              Deepgram WebSocket implementation (default)
│   ├── voxtral.ts               Mistral Voxtral Realtime implementation
│   └── index.ts                 Barrel export
├── llm/
│   ├── types.ts                 LLMProvider interface: stream(params) → AsyncIterable<string>
│   ├── config.ts                Factory with per-generator provider routing via env vars
│   ├── anthropic.ts             Anthropic SDK wrapper (default: claude-haiku-4-5)
│   ├── openai.ts                OpenAI SDK wrapper (default: gpt-4o)
│   ├── openai-compatible.ts     Generic OpenAI-compatible provider (Groq)
│   └── claude-code.ts           Claude Code CLI provider (uses Max subscription via `claude -p`)
├── db/
│   ├── connection.ts            PostgreSQL pool singleton, BIGINT type parser
│   ├── schema.ts                Table creation and migrations (async)
│   └── repositories/            CRUD per entity: projects, features, meetings, transcripts, artefacts, documents, guidance
└── ws.d.ts

modules/
├── types.ts                     Generator, ArtefactModuleDefinition, DiagramModuleDefinition interfaces
├── registry.ts                  Central module registry: getTextModules(), getDiagramModule(), triage helpers
├── context/
│   ├── prompts/                 Context create/update prompt templates (project vision, goals, scope, domain)
│   ├── generator.ts             ContextGenerator class
│   └── index.ts                 Module definition (type, description, aliases, generator)
├── spec/
│   ├── prompts/                 Spec create/update prompt templates (includes project context as background)
│   ├── generator.ts             SpecGenerator class
│   └── index.ts                 Module definition (type, description, aliases, generator)
├── stories/
│   ├── prompts/                 Stories create/update prompt templates
│   ├── generator.ts             StoryGenerator class
│   └── index.ts                 Module definition
├── diagram/
│   ├── prompts.ts               Diagram prompts (planning, mermaid create/update, html create/update)
│   ├── post-process.ts          Mermaid validation, code fence stripping, style removal, ER fix
│   ├── generator.ts             planDiagrams(), generateDiagram(), getDiagramProvider()
│   └── index.ts                 Module definition
├── guidance/
│   ├── prompts/system.md        System prompt: analyse conversation, output JSON array of questions/suggestions
│   └── generator.ts             generateGuidanceItems() — collects full LLM response, parses JSON, returns structured items
├── assistant/
│   ├── prompts/system.md        Nova system prompt: concise meeting participant, uses web_search tool when needed
│   └── generator.ts             mentionsNova() trigger check, runAssistant() agent loop with Anthropic tool use
└── triage/
    └── prompts.ts               buildTriagePrompt() — dynamic from module descriptions

src/
├── app/
│   ├── layout.tsx               Root layout, dark theme (class="dark"), Geist fonts
│   ├── page.tsx                 Dashboard: project list, create/delete
│   ├── login/page.tsx           Google OAuth sign-in page
│   ├── projects/[projectId]/
│   │   ├── page.tsx             Project detail: project artefacts (context + diagrams), features list, meetings
│   │   ├── features/[featureId]/
│   │   │   └── page.tsx         Feature detail: feature artefacts (spec + stories + diagrams), feature meetings
│   │   └── meetings/[meetingId]/
│   │       └── page.tsx         Live meeting: recording, transcript, scope-aware streaming artefacts
│   └── api/
│       ├── auth/[...nextauth]/  NextAuth.js Google OAuth handlers (catch-all route)
│       └── projects/            REST routes for project/feature/meeting CRUD
├── components/
│   ├── ArtefactTabs.tsx         Tab interface with configurable visibleTabs prop, switches between context, diagrams, spec, stories, documents
│   ├── DiagramRenderer.tsx      Mermaid rendering with dark theme
│   ├── WireframeRenderer.tsx    HTML iframe sandbox for wireframes
│   ├── MarkdownRenderer.tsx     react-markdown with prose styling
│   ├── GuidancePanel.tsx        Collapsible right panel: AI-generated questions/suggestions with resolve toggle
│   ├── TranscriptPanel.tsx      Scrollable transcript with edit/delete per entry, Nova (AI) entries in sky-blue
│   ├── MeetingControls.tsx      Record/stop, elapsed timer, text input, connection status
│   ├── PresenceIndicator.tsx    Active participant avatars with role badges
│   ├── TranscriptImportModal.tsx  Paste external transcripts
│   └── ConfirmModal.tsx         Generic confirmation dialog
├── lib/
│   ├── use-meeting.ts           Main hook: Socket connection, audio capture, all meeting state, exposes scope
│   ├── socket-client.ts         MeetingSocket class: Socket.IO wrapper with reconnection (10 attempts)
│   └── audio-capture.ts         Web Audio API: mic → PCM16 → chunks via ScriptProcessorNode
└── middleware.ts                NextAuth `withAuth` guard: protects all routes, redirects to /login
```

## Two-level artefact model

Artefacts are scoped to either the **project** or a **feature**:

- **Project-level**: `context` (project vision/goals/scope) + `diagram:*` (architecture, ER, domain model)
- **Feature-level**: `spec` + `stories` + `diagram:*` (feature-specific diagrams like sequence, wireframe)

Each feature is an explicit entity under a project. Meetings are optionally linked to a feature via `feature_id`. The meeting's scope determines which artefact types are available for generation:

- **Project meeting** (no feature): triage considers `context` + project diagram types
- **Feature meeting**: triage considers `spec` + feature diagram types; stories always follow spec

Project context is automatically included as background in spec generation prompts for feature meetings.

## Data flow

```
Producer connects → MeetingManager.joinAsProducer(featureId) → creates AudioHandler(featureId)
    ↓
Audio frames → per-participant STT stream (via STTProvider) → transcript chunks
    ↓
TranscriptAccumulator (silence 4s + rate limit 15s) → callback
    ↓
ContextManager.addTranscript() + GenerationOrchestrator.trigger() + triggerGuidance() + triggerAssistant()
    ↓                                                                    ↓                     ↓
triageArtefacts() → decides affected types                   Guidance: LLM outputs JSON   Nova: if "Nova" mentioned
    (scope-filtered: project=context+diagrams,               → parse → persist → broadcast  → Anthropic tool-use agent
     feature=spec+diagrams)                                                                 → optional web search
                                                                                            → answer as transcript entry
    ↓
Text generators run sequentially (project: context | feature: spec → stories) → stream chunks to room
    ↓
Existing diagrams auto-update if triage selects their subtype (e.g. diagram:er)
    ↓
New diagrams are user-initiated via add-diagram socket event → on-demand generation
    ↓
All artefacts persisted via upsertArtefact(featureId) + broadcast to room
```

## Database schema (PostgreSQL)

```
projects (id, name, created_at)
    └── features (id, project_id, name, created_at)
    └── meetings (id, project_id, feature_id?, started_at, ended_at, status, pending_transcript)
            ├── transcript_chunks (id auto, meeting_id, text, speaker, timestamp)
            ├── documents (id, meeting_id, content, created_at, name, doc_number)
            └── guidance_items (id, meeting_id, type, content, resolved, created_at) ON DELETE CASCADE
    └── artefacts (id, project_id, feature_id, type, content, updated_at)
            — feature_id='__project__' for project-level artefacts
            — feature_id=<uuid> for feature-level artefacts
            — UNIQUE(project_id, feature_id, type)
```

## API surface

**REST** (Next.js API routes):
- `GET/POST /api/auth/[...nextauth]` — NextAuth.js Google OAuth handlers
- `GET/POST /api/projects` — list/create projects
- `GET/DELETE /api/projects/[projectId]` — get (with project artefacts + features)/delete project
- `GET/POST /api/projects/[projectId]/features` — list/create features
- `GET/DELETE /api/projects/[projectId]/features/[featureId]` — get (with feature artefacts)/delete feature
- `GET/POST /api/projects/[projectId]/meetings` — list/create meetings (POST accepts optional featureId)
- `DELETE /api/projects/[projectId]/meetings/[meetingId]` — delete meeting

**Socket.IO** (client → server):
- `audio-data`, `start-recording`, `stop-recording` — audio pipeline
- `text-input`, `import-transcript` — manual text entry
- `edit-transcript`, `delete-transcript` — transcript mutations
- `add-diagram` — create a new diagram of a specific type on demand
- `regenerate-diagrams`, `regenerate-diagram` — trigger regeneration of existing diagrams
- `delete-document` — remove imported document
- `resolve-guidance`, `unresolve-guidance` — toggle guidance item resolution

**Socket.IO** (server → client):
- `meeting-state` — full snapshot on connect (includes `scope: "project" | "feature"`)
- `live-transcript` — real-time transcript chunks
- `artefact-start/chunk/complete/error` — streaming generation
- `presence` — participant list updates
- `transcript-edited/deleted`, `document-added/deleted` — mutation confirmations
- `guidance-items-added`, `guidance-item-resolved/unresolved` — guidance updates

## LLM configuration

Provider interface (`LLMProvider.stream()`) with four implementations. Per-generator routing via env vars:
- `LLM_DEFAULT_PROVIDER` (default: anthropic)
- `LLM_PROVIDER_{NAME}` — optional per-module overrides (e.g. `LLM_PROVIDER_SPEC`, `LLM_PROVIDER_STORIES`)

The assistant module (Nova) uses the Anthropic SDK directly for tool use (web search). Model configurable via `ASSISTANT_MODEL` env var. Web search via Tavily (`TAVILY_API_KEY`).

## Auth

Google OAuth via NextAuth.js v4. `NEXTAUTH_SECRET` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars. Optional `ALLOWED_EMAIL_DOMAIN` to restrict sign-in to a single email domain. Next.js middleware (`withAuth`) protects all routes, redirecting to `/login`. Socket.IO verifies the `next-auth.session-token` cookie from the WebSocket upgrade headers using `getToken` from `next-auth/jwt`.

## Key patterns

- **No external state management** — React hooks + local state only, Socket.IO events drive updates
- **Streaming-first** — artefacts stream via `artefact-chunk` events, UI shows live generation
- **Single-at-a-time generation queue** — prevents overlapping LLM calls
- **Per-participant audio streams** — each producer gets own STT stream via pluggable provider (`STT_PROVIDER` env var, default: deepgram)
- **Two-level artefact scoping** — project-level artefacts (context, diagrams) vs feature-level artefacts (spec, stories, diagrams); scope determined by meeting's feature association
- **Project context as background** — the `context` artefact provides project-level background (vision, goals, scope, domain) that is automatically included in spec generation prompts for feature meetings
- **Module system** — each artefact type is a self-contained module in `modules/` with prompts, generator, and definition; registry-driven discovery
- **Repository pattern** — one module per DB entity in `server/db/repositories/`
- **Room-based broadcasting** — Socket.IO rooms per meeting (`meeting:{id}`)
- **Guidance runs independently** — not gated by the artefact generation lock; lightweight JSON output parsed server-side, meeting-scoped
- **Nova (AI assistant) runs independently** — triggered by name mention ("Nova"), uses Anthropic tool-use agent loop with web search; responses stored as transcript chunks (speaker="Nova")
- **Diagram consolidation** — when a feature-level diagram is saved, the orchestrator schedules (debounced, 5s) a background consolidation that loads all feature diagrams of that type, merges them with the current project-level diagram via LLM, and saves the result at project scope; fire-and-forget, failures logged but do not affect feature meetings
