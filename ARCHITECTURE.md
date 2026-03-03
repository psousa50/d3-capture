# Architecture

Real-time meeting assistant that transcribes audio, generates specs/stories/diagrams via LLM, and streams results to all participants.

**Stack:** Next.js 16, React 19, Socket.IO 4, PostgreSQL (Prisma), multi-provider STT (Deepgram/Voxtral), multi-provider LLM (Anthropic/OpenAI/Groq), Tailwind CSS 4, TypeScript strict.

## Directory structure

```
server/
├── index.ts                     Custom HTTP server: Next.js SSR + Socket.IO on same port
├── meeting-manager.ts           Active meeting lifecycle, participant join/leave, presence, scope-aware snapshots, graceful shutdown (30s grace)
├── audio-handler.ts             Per-participant STT streams via provider, delegates to TranscriptAccumulator
├── transcript-accumulator.ts    Buffers transcript chunks, silence detection (4s), rate-limiting (15s min), DB writes
├── context-manager.ts           Two-tier context window (recent 5min verbatim + older summarised), scope-aware artefact loading with ArtefactEntry map, builds LLM prompts
├── generation-orchestrator.ts   Tool-use routing → sequential text generation → diagram CRUD by ID, single-at-a-time queue
├── routing.ts                   Single-shot tool-use LLM call deciding which artefacts to create/update/delete; scope enforced by exposed tools
├── web-search.ts                Tavily web search wrapper with timeout (3s), used by assistant module
├── stt/
│   ├── types.ts                 STTProvider interface: createStream(options) → STTStream
│   ├── config.ts                Factory with provider routing via STT_PROVIDER env var
│   ├── deepgram.ts              Deepgram WebSocket implementation (default)
│   ├── voxtral.ts               Mistral Voxtral Realtime implementation
│   └── index.ts                 Barrel export
├── llm/
│   ├── types.ts                 LLMProvider interface: stream() for generation, toolCall() for structured routing
│   ├── config.ts                Factory with per-generator provider routing via env vars
│   ├── anthropic.ts             Anthropic SDK wrapper (default: claude-haiku-4-5)
│   ├── openai.ts                OpenAI SDK wrapper (default: gpt-4o)
│   ├── openai-compatible.ts     Generic OpenAI-compatible provider (Groq)
│   └── claude-code.ts           Claude Code CLI provider (uses Max subscription via `claude -p`)
├── plugins/
│   ├── types/                   Store interfaces: ProjectStore, MeetingStore, ArtefactStore, TemplateStore
│   ├── registry.ts              Singleton registry: register/get for each store type
│   ├── prisma/                  PostgreSQL implementations wrapping Prisma client
│   ├── filesystem/              FilesystemTemplateStore: reads prompt templates from modules/*/prompts/ files
│   └── github/                  GitHub-backed implementations: persists meetings/artefacts/templates as files in a GitHub repo
├── db/
│   └── client.ts                Prisma client singleton with BigInt-to-Number extension
└── ws.d.ts

modules/
├── types.ts                     Generator, ArtefactModuleDefinition, DiagramModuleDefinition interfaces
├── registry.ts                  Central module registry: getTextModules(), getDiagramModule()
├── context/
│   ├── prompts/                 Context create/update prompt templates (project vision, goals, scope, domain)
│   ├── generator.ts             ContextGenerator class
│   └── index.ts                 Module definition (type, generator)
├── spec/
│   ├── prompts/                 Spec create/update prompt templates (includes project context as background)
│   ├── generator.ts             SpecGenerator class
│   └── index.ts                 Module definition (type, generator)
├── stories/
│   ├── prompts/                 Stories create/update prompt templates
│   ├── generator.ts             StoryGenerator class
│   └── index.ts                 Module definition
├── diagram/
│   ├── prompts.ts               Diagram prompts (mermaid create/update, html create/update)
│   ├── post-process.ts          Mermaid validation, code fence stripping, style removal, ER fix
│   ├── generator.ts             generateDiagram(), getDiagramProvider()
│   └── index.ts                 Module definition
├── guidance/
│   ├── prompts/system.md        System prompt: analyse conversation, output JSON array of questions/suggestions
│   └── generator.ts             generateGuidanceItems() — collects full LLM response, parses JSON, returns structured items
└── assistant/
    ├── prompts/system.md        Nova system prompt: concise meeting participant, uses web_search tool when needed
    └── generator.ts             mentionsNova() trigger check, runAssistant() agent loop with Anthropic tool use

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

- **Project meeting** (no feature): routing exposes `update_context`, `create_diagram`, `update_diagram`, `delete_diagram`
- **Feature meeting**: routing exposes all project tools plus `update_spec` and `update_project_diagram` — feature meetings can directly update project-level diagrams by ID

Project context is automatically included as background in spec generation prompts for feature meetings.

Artefacts have a `name` column for human-readable display names (e.g. "ER Diagram", "Sequence Diagram"). Diagrams are referenced by database ID, not by name strings.

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
routeTranscript() — single tool-use LLM call                 Guidance: LLM outputs JSON   Nova: if "Nova" mentioned
    decides: update_context, update_spec,                     → parse → persist → broadcast  → Anthropic tool-use agent
    create_diagram, update_diagram,                                                           → optional web search
    delete_diagram, update_project_diagram                                                    → answer as transcript entry
    (scope enforced by which tools are exposed)
    ↓
Text generators run sequentially (project: context | feature: spec → stories) → stream chunks to room
    ↓
Diagram updates run in parallel by ID → diagram generator with targeted context
    ↓
New diagrams: slug generated from name, sequential creation via diagram generator
    ↓
Project diagram updates (feature meetings): update project-level diagrams directly by ID
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
            └── guidance_items (id, meeting_id, type, content, resolved, created_at)
All child foreign keys use ON DELETE CASCADE (meetings cascade to project/feature deletes, chunks/documents/guidance cascade to meeting deletes, artefacts cascade to project/feature deletes).
    └── artefacts (id, project_id, feature_id?, type, name, content, updated_at)
            — feature_id=NULL for project-level artefacts
            — feature_id=<uuid> for feature-level artefacts
            — UNIQUE(project_id, feature_id, type) NULLS NOT DISTINCT
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
- `add-diagram` — create a new diagram (accepts type, name, renderer)
- `regenerate-diagrams`, `regenerate-diagram` — trigger regeneration of existing diagrams
- `delete-document` — remove imported document
- `resolve-guidance`, `unresolve-guidance` — toggle guidance item resolution

**Socket.IO** (server → client):
- `meeting-state` — full snapshot on connect (includes `scope`, `artefactMeta` with IDs and names)
- `live-transcript` — real-time transcript chunks
- `artefact-start/chunk/complete/error` — streaming generation (start includes `name` for diagrams)
- `presence` — participant list updates
- `transcript-edited/deleted`, `document-added/deleted` — mutation confirmations
- `guidance-items-added`, `guidance-item-resolved/unresolved` — guidance updates

## LLM configuration

Provider interface (`LLMProvider`) with two methods:
- `stream()` — async iterable for streaming text generation
- `toolCall()` — single-shot structured tool-use call (used by routing)

Four implementations: Anthropic, OpenAI, OpenAI-compatible (Groq), Claude Code (stream only).

Per-generator routing via env vars:
- `LLM_DEFAULT_PROVIDER` (default: anthropic)
- `LLM_PROVIDER_{NAME}` — optional per-module overrides (e.g. `LLM_PROVIDER_SPEC`, `LLM_PROVIDER_ROUTING`)

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
- **Tool-use routing** — a single LLM call with tool definitions replaces the triage classifier; scope is enforced by which tools are exposed (feature meetings get `update_spec` and `update_project_diagram`); diagrams are referenced by database ID
- **Module system** — each artefact type is a self-contained module in `modules/` with prompts, generator, and definition; registry-driven discovery
- **Prisma ORM** — schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`, generated client in `src/generated/prisma`
- **Plugin-based storage** — four store interfaces (ProjectStore, MeetingStore, ArtefactStore, TemplateStore) in `server/plugins/types/`, with Prisma, filesystem, and GitHub implementations; backends are independently swappable via the singleton registry in `server/plugins/registry.ts`; stores registered at startup in `server/index.ts`; `STORAGE_BACKEND=github` activates GitHub-backed stores for meetings, artefacts, and templates (ProjectStore remains Prisma); GitHub stores persist data as JSON files in a GitHub repo via the Octokit API, with meeting aggregates (meeting + chunks + documents + guidance in one file), one-file-per-artefact, and GitHub-first template resolution with filesystem fallback
- **Room-based broadcasting** — Socket.IO rooms per meeting (`meeting:{id}`)
- **Guidance runs independently** — not gated by the artefact generation lock; lightweight JSON output parsed server-side, meeting-scoped
- **Nova (AI assistant) runs independently** — triggered by name mention ("Nova"), uses Anthropic tool-use agent loop with web search; responses stored as transcript chunks (speaker="Nova")
