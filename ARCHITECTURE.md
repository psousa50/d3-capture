# Architecture

Real-time meeting assistant that transcribes audio, generates specs/stories/diagrams via LLM, and streams results to all participants.

**Stack:** Next.js 16, React 19, Socket.IO 4, SQLite (better-sqlite3), Deepgram (speech-to-text), multi-provider LLM (Anthropic/OpenAI/Groq), Tailwind CSS 4, TypeScript strict.

## Directory structure

```
server/
├── index.ts                     Custom HTTP server: Next.js SSR + Socket.IO on same port
├── meeting-manager.ts           Active meeting lifecycle, participant join/leave, presence, graceful shutdown (30s grace)
├── audio-handler.ts             Per-participant Deepgram WebSocket streams, delegates to TranscriptAccumulator
├── transcript-accumulator.ts    Buffers transcript chunks, silence detection (4s), rate-limiting (15s min), DB writes
├── context-manager.ts           Two-tier context window (recent 5min verbatim + older summarised), builds LLM prompts, persists artefacts
├── generation-orchestrator.ts   Triage → parallel text generation (spec+stories) → sequential diagram generation, single-at-a-time queue
├── triage.ts                    LLM classifier deciding which artefacts are affected by new transcript, normalises output
├── llm/
│   ├── types.ts                 LLMProvider interface: stream(params) → AsyncIterable<string>
│   ├── config.ts                Factory with per-generator provider routing via env vars
│   ├── anthropic.ts             Anthropic SDK wrapper (default: claude-haiku-4-5)
│   ├── openai.ts                OpenAI SDK wrapper (default: gpt-4o)
│   ├── openai-compatible.ts     Generic OpenAI-compatible provider (Groq)
│   └── claude-code.ts           Claude Code CLI provider (uses Max subscription via `claude -p`)
├── db/
│   ├── connection.ts            SQLite singleton, WAL mode, foreign keys on
│   ├── schema.ts                Table creation and migrations
│   └── repositories/            CRUD per entity: projects, meetings, transcripts, artefacts, documents
└── ws.d.ts

generators/
├── types.ts                     Generator interface: type + generate(options) → AsyncIterable<string>
├── spec.ts                      Spec generation (create/update prompts)
├── stories.ts                   User story generation
└── diagram.ts                   Diagram planning + per-type rendering (inline in orchestrator)

src/
├── app/
│   ├── layout.tsx               Root layout, dark theme (class="dark"), Geist fonts
│   ├── page.tsx                 Dashboard: project list, create/delete
│   ├── login/page.tsx           Password auth form
│   ├── projects/[projectId]/
│   │   ├── page.tsx             Project detail: meeting list, aggregated artefacts
│   │   └── meetings/[meetingId]/
│   │       └── page.tsx         Live meeting: recording, transcript, streaming artefacts
│   └── api/                     REST routes for project/meeting CRUD + auth
├── components/
│   ├── ArtefactTabs.tsx         Tab interface switching between diagrams, spec, stories, documents
│   ├── DiagramRenderer.tsx      Mermaid rendering with dark theme
│   ├── WireframeRenderer.tsx    HTML iframe sandbox for wireframes
│   ├── MarkdownRenderer.tsx     react-markdown with prose styling
│   ├── TranscriptPanel.tsx      Scrollable transcript with edit/delete per entry
│   ├── MeetingControls.tsx      Record/stop, elapsed timer, text input, connection status
│   ├── PresenceIndicator.tsx    Active participant avatars with role badges
│   ├── TranscriptImportModal.tsx  Paste external transcripts
│   └── ConfirmModal.tsx         Generic confirmation dialog
├── lib/
│   ├── use-meeting.ts           Main hook: Socket connection, audio capture, all meeting state
│   ├── socket-client.ts         MeetingSocket class: Socket.IO wrapper with reconnection (10 attempts)
│   └── audio-capture.ts         Web Audio API: mic → PCM16 → chunks via ScriptProcessorNode
└── middleware.ts                Auth guard: cookie check, redirects to /login
```

## Data flow

```
Producer connects → MeetingManager.joinAsProducer() → creates AudioHandler
    ↓
Audio frames → per-participant Deepgram WebSocket → transcript chunks
    ↓
TranscriptAccumulator (silence 4s + rate limit 15s) → callback
    ↓
ContextManager.addTranscript() + GenerationOrchestrator.trigger()
    ↓
triageArtefacts() → decides affected types (spec, stories, diagram)
    ↓
Text generators run in parallel (spec + stories) → stream chunks to room
    ↓
Diagram generation runs sequentially after text → planDiagrams() → per-type render
    ↓
All artefacts persisted via upsertArtefact() + broadcast to room
```

## Database schema (SQLite)

```
projects (id, name, created_at)
    └── meetings (id, project_id, started_at, ended_at, status, pending_transcript)
            ├── transcript_chunks (id auto, meeting_id, text, speaker, timestamp)
            └── documents (id, meeting_id, content, created_at)
    └── artefacts (id, project_id, type, content, updated_at) UNIQUE(project_id, type)
```

## API surface

**REST** (Next.js API routes):
- `POST /api/auth` — password auth, sets cookie
- `GET/POST /api/projects` — list/create projects
- `GET/DELETE /api/projects/[projectId]` — get (with artefacts)/delete project
- `GET/POST /api/projects/[projectId]/meetings` — list/create meetings
- `DELETE /api/projects/[projectId]/meetings/[meetingId]` — delete meeting

**Socket.IO** (client → server):
- `audio-data`, `start-recording`, `stop-recording` — audio pipeline
- `text-input`, `import-transcript` — manual text entry
- `edit-transcript`, `delete-transcript` — transcript mutations
- `regenerate-diagrams`, `regenerate-diagram` — trigger regeneration
- `delete-document` — remove imported document

**Socket.IO** (server → client):
- `meeting-state` — full snapshot on connect
- `live-transcript` — real-time transcript chunks
- `artefact-start/chunk/complete/error` — streaming generation
- `presence` — participant list updates
- `transcript-edited/deleted`, `document-added/deleted` — mutation confirmations

## LLM configuration

Provider interface (`LLMProvider.stream()`) with four implementations. Per-generator routing via env vars:
- `LLM_DEFAULT_PROVIDER` (default: anthropic)
- `LLM_PROVIDER_{TRIAGE|SPEC|STORIES|DIAGRAM}` — optional overrides

## Auth

Password-based: `AUTH_SECRET` env var. Cookie `auth-token` (7 day expiry). Next.js middleware protects all routes except `/login` and `/api/auth`. Socket.IO checks `auth.password` in handshake.

## Key patterns

- **No external state management** — React hooks + local state only, Socket.IO events drive updates
- **Streaming-first** — artefacts stream via `artefact-chunk` events, UI shows live generation
- **Single-at-a-time generation queue** — prevents overlapping LLM calls
- **Per-participant audio streams** — each producer gets own Deepgram WebSocket
- **Repository pattern** — one module per DB entity in `server/db/repositories/`
- **Room-based broadcasting** — Socket.IO rooms per meeting (`meeting:{id}`)
