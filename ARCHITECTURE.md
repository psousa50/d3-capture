# Architecture

Real-time meeting assistant that transcribes audio, generates specs/stories/diagrams via LLM, and streams results to all participants.

**Stack:** Next.js 16, React 19, Socket.IO 4, PostgreSQL (pg), multi-provider STT (Deepgram/Voxtral), multi-provider LLM (Anthropic/OpenAI/Groq), Tailwind CSS 4, TypeScript strict.

## Directory structure

```
server/
├── index.ts                     Custom HTTP server: Next.js SSR + Socket.IO on same port
├── meeting-manager.ts           Active meeting lifecycle, participant join/leave, presence, graceful shutdown (30s grace)
├── audio-handler.ts             Per-participant STT streams via provider, delegates to TranscriptAccumulator
├── transcript-accumulator.ts    Buffers transcript chunks, silence detection (4s), rate-limiting (15s min), DB writes
├── context-manager.ts           Two-tier context window (recent 5min verbatim + older summarised), builds LLM prompts, persists artefacts
├── generation-orchestrator.ts   Triage → parallel text generation (spec+stories) → auto-update existing diagrams, on-demand diagram creation, single-at-a-time queue
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
│   └── repositories/            CRUD per entity: projects, meetings, transcripts, artefacts, documents, guidance
└── ws.d.ts

modules/
├── types.ts                     Generator, ArtefactModuleDefinition, DiagramModuleDefinition interfaces
├── registry.ts                  Central module registry: getTextModules(), getDiagramModule(), triage helpers
├── spec/
│   ├── prompts.ts               Spec create/update prompt templates (pure strings, zero imports)
│   ├── generator.ts             SpecGenerator class
│   └── index.ts                 Module definition (type, description, aliases, generator)
├── stories/
│   ├── prompts.ts               Stories create/update prompt templates
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
│   │   ├── page.tsx             Project detail: meeting list, aggregated artefacts
│   │   └── meetings/[meetingId]/
│   │       └── page.tsx         Live meeting: recording, transcript, streaming artefacts
│   └── api/
│       ├── auth/[...nextauth]/  NextAuth.js Google OAuth handlers (catch-all route)
│       └── projects/            REST routes for project/meeting CRUD
├── components/
│   ├── ArtefactTabs.tsx         Tab interface switching between diagrams, spec, stories, documents
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
│   ├── use-meeting.ts           Main hook: Socket connection, audio capture, all meeting state
│   ├── socket-client.ts         MeetingSocket class: Socket.IO wrapper with reconnection (10 attempts)
│   └── audio-capture.ts         Web Audio API: mic → PCM16 → chunks via ScriptProcessorNode
└── middleware.ts                NextAuth `withAuth` guard: protects all routes, redirects to /login
```

## Data flow

```
Producer connects → MeetingManager.joinAsProducer() → creates AudioHandler
    ↓
Audio frames → per-participant STT stream (via STTProvider) → transcript chunks
    ↓
TranscriptAccumulator (silence 4s + rate limit 15s) → callback
    ↓
ContextManager.addTranscript() + GenerationOrchestrator.trigger() + triggerGuidance() + triggerAssistant()
    ↓                                                                    ↓                     ↓
triageArtefacts() → decides affected types                   Guidance: LLM outputs JSON   Nova: if "Nova" mentioned
    (spec, stories, existing diagram subtypes)               → parse → persist → broadcast  → Anthropic tool-use agent
                                                                                            → optional web search
                                                                                            → answer as transcript entry
    ↓
Text generators run in parallel (spec + stories) → stream chunks to room
    ↓
Existing diagrams auto-update if triage selects their subtype (e.g. diagram:er)
    ↓
New diagrams are user-initiated via add-diagram socket event → on-demand generation
    ↓
All artefacts persisted via upsertArtefact() + broadcast to room
```

## Database schema (PostgreSQL)

```
projects (id, name, created_at)
    └── meetings (id, project_id, started_at, ended_at, status, pending_transcript)
            ├── transcript_chunks (id auto, meeting_id, text, speaker, timestamp)
            ├── documents (id, meeting_id, content, created_at, name, doc_number)
            └── guidance_items (id, meeting_id, type, content, resolved, created_at) ON DELETE CASCADE
    └── artefacts (id, project_id, type, content, updated_at) UNIQUE(project_id, type)
```

## API surface

**REST** (Next.js API routes):
- `GET/POST /api/auth/[...nextauth]` — NextAuth.js Google OAuth handlers
- `GET/POST /api/projects` — list/create projects
- `GET/DELETE /api/projects/[projectId]` — get (with artefacts)/delete project
- `GET/POST /api/projects/[projectId]/meetings` — list/create meetings
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
- `meeting-state` — full snapshot on connect
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
- **Module system** — each artefact type is a self-contained module in `modules/` with prompts, generator, and definition; registry-driven discovery
- **Repository pattern** — one module per DB entity in `server/db/repositories/`
- **Room-based broadcasting** — Socket.IO rooms per meeting (`meeting:{id}`)
- **Guidance runs independently** — not gated by the artefact generation lock; lightweight JSON output parsed server-side, meeting-scoped
- **Nova (AI assistant) runs independently** — triggered by name mention ("Nova"), uses Anthropic tool-use agent loop with web search; responses stored as transcript chunks (speaker="Nova")
