# d3-capture

Real-time meeting assistant that transcribes audio, generates specs/stories/diagrams via LLM, and streams results to all participants.

## Prerequisites

- Node.js 20+
- PostgreSQL
- [Deepgram](https://deepgram.com) API key (speech-to-text)
- At least one LLM provider key (Anthropic, OpenAI, or Groq)
- Google OAuth credentials (for auth)

## Setup

```bash
npm install
cp .env.example .env
# fill in .env — see Configuration below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DEEPGRAM_API_KEY` | Yes | Speech-to-text |
| `NEXTAUTH_URL` | Yes | Base URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth app secret |
| `ALLOWED_EMAIL_DOMAIN` | No | Restrict sign-in to one domain (e.g. `yourcompany.com`) |
| `ANTHROPIC_API_KEY` | No | Required if using Anthropic provider |
| `OPENAI_API_KEY` | No | Required if using OpenAI provider |
| `GROQ_API_KEY` | No | Required if using Groq provider |
| `LLM_DEFAULT_PROVIDER` | No | `anthropic` (default), `openai`, `groq`, or `claude-code` |
| `LLM_PROVIDER_TRIAGE` | No | Override provider for triage step |
| `LLM_PROVIDER_SPEC` | No | Override provider for spec generation |
| `LLM_PROVIDER_STORIES` | No | Override provider for story generation |
| `LLM_PROVIDER_DIAGRAM` | No | Override provider for diagram generation |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Production server |
