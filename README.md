# Talkie‑Lab

Talkie‑Lab is an experimental LLM agent platform focused on observability, reproducibility, and
controlled execution.

It is designed as an **internal‑grade AI workspace** where prompts, models, and agent decisions
are **versioned, inspectable, and replayable** at runtime.

This project was built to explore:

- How far **LLM systems can be treated as deterministic software**
- How to **measure latency, tokens, and reasoning at the streaming level**
- And how to design **agent‑first architectures** beyond simple chat demos

Everything—from routing, streaming, metrics, prompt CMS, and inspection UI—
is implemented as a **single‑developer, full‑stack engineering project**.

## Preview

![Chat UI](./docs/screenshots/chat-1.png)

Talkie‑Lab is designed as an **internal‑grade AI workspace** where every conversation,
prompt, and agent decision can be **versioned, replayed, and measured**.

- ✅ Reproducible conversation state (snapshot‑based)
- ✅ Prompt metadata + versioning CMS
- ✅ Multi‑hop agent with tool & artifact tracing
- ✅ Streaming‑level latency & token metrics (first‑token, overhead, provider)
- ✅ OpenAI Responses–compatible router & provider abstraction

This project is **designed and implemented as a solo engineering project** to explore real‑world LLM
platform
architecture using Next.js, React 19, Prisma, and PostgreSQL.

## What makes it different

Talkie‑Lab is not focused on building a prettier chat UI.  
It is focused on treating **LLM systems as debuggable, observable software systems**.

Key differentiators:

- **Streaming‑level observability**
    - First‑token latency, overhead latency, provider latency, and token usage are measured at the
      chunk level
    - Metrics are visualized in real time during inference

- **Reproducible conversation state**
    - Conversations are snapshot‑based instead of being treated as ephemeral message logs
    - A full agent run can be replayed with its original configuration

- **Agent‑first execution model**
    - Multi‑hop tool routing uses an OpenAI Responses–style loop
    - Tool calls, artifacts, and reasoning traces are persisted and inspectable

- **Prompt CMS as a production primitive**
    - Prompts are versioned, searchable, taggable, and rollback‑capable
    - Prompt selection is integrated directly into live inference

- **Infra‑grade architecture, not a demo stack**
    - Provider‑agnostic LLM routing
    - Strict schema validation with Zod
    - Metrics, prompts, agents, and messages share a single coherent data model

The goal is not just to “chat with an LLM”, but to **inspect, reproduce, and control how LLM systems
actually behave in
production‑like conditions**.

### Agent-driven prompt evolution (Preview)

![Agent demo](./docs/screenshots/agent-prompt-demo.png)

## Features

- Streaming chat workspace
    - NDJSON/SSE stream from `/api/chat`
    - Persisted conversations/messages and retryable errors
    - Message metrics (latency, tokens/usage)
    - Side inspector for model/system prompt/reasoning/sampling/token limits
- Agent / auto mode
    - OpenAI Responses–style router with a multi‑hop loop
    - Built‑in tools: calculator, prompt lookup/search/commit, web search stub
    - Artifact panel showing tool runs and reasoning logs
- Prompt CMS
    - Create/update prompt metadata and versions
    - Tags, alias/note/response example, archive/undo, search with pagination
- Auth & data
    - GitHub OAuth via NextAuth (database sessions)
    - Prisma/PostgreSQL schema for conversations, messages, metrics, prompts, tags
- Typed + tested
    - Zod validation in server actions, strict TypeScript
    - Vitest unit tests; Playwright e2e setup

## Tech stack

- App: Next.js App Router, React 19 (React Compiler enabled), Tailwind CSS v4, shadcn/ui, Radix
  primitives, lucide-react
- Data: Prisma (PostgreSQL) with generated client at `src/generated/prisma`
- Auth: NextAuth (GitHub OAuth, database sessions)
- LLM: `src/lib/ai/llm` (model registry, Responses helpers, provider router/stream); agent loop in
  `src/lib/ai/agents`
- Tests: Vitest + jsdom; Playwright for e2e
- Package manager: pnpm

## Requirements

- Node.js 20+ (recommended) and pnpm (see `package.json` → `packageManager`)
- PostgreSQL 14+ (Docker compose provided)
- An OpenAI Responses–compatible LLM endpoint and API key
- GitHub OAuth app for local auth (optional but recommended)

## Quickstart

1) Install dependencies

```bash
pnpm install
```

2) Start PostgreSQL (Docker)

```bash
docker compose up -d postgres
```

Defaults (see `docker-compose.yaml`):

- User: `naruto`
- Password: `sasuke`
- DB: `postgres`
- Port: `55432` exposed → container `5432`

3) Create `.env`

```ini
# Database (adjust user/pass/host/port as needed)
DATABASE_URL="postgresql://naruto:sasuke@localhost:55432/postgres?schema=public"

# LLM provider (OpenAI Responses–compatible)
LLM_API_KEY="<your_api_key>"
# Optional provider hints
# LLM_BASE_URL="https://api.openai.com/v1"
# LLM_PROVIDER="openai"

# NextAuth (GitHub OAuth)
AUTH_GITHUB_ID="<github_oauth_client_id>"
AUTH_GITHUB_SECRET="<github_oauth_client_secret>"
NEXTAUTH_SECRET="<generate_a_strong_secret>"
NEXTAUTH_URL="http://localhost:3000"
```

GitHub OAuth callback (typical): `http://localhost:3000/api/auth/callback/github`.

4) Prepare the database and start the app

```bash
pnpm db:push   # apply Prisma schema and generate client
pnpm dev       # open http://localhost:3000
```

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- `pnpm db:push`
- `pnpm test` / `pnpm test:watch` / `pnpm test:ui` / `pnpm test:e2e`

## Project structure (selected)

- Chat UI & flow: `src/components/chat.tsx`, `src/hooks/use-chat.ts`, `src/app/(chat)/chat`
- Chat API & metrics: `src/app/(chat)/api/chat/route.ts`,
  `src/lib/repositories/conversation-repository.ts`,
  `prisma/schema.prisma`
- Inspector & config: `src/components/chat-inspector.tsx`,
  `src/components/inference-config-provider.tsx`
- Agent + tools: `src/lib/ai/agents/loop.ts`, `src/lib/ai/agents/tools/*`, router
  `src/lib/ai/llm/router.ts`
- Prompt CMS: `src/app/(prompts)/prompts`, `src/components/prompts.tsx`,
  `src/lib/repositories/prompt-repository.ts`,
  `src/schemas/prompt.ts`
- Auth: `src/app/(auth)/auth.ts`, `src/app/(auth)/login/page.tsx`

## Development notes

- `/api/chat` expects OpenAI Responses–compatible streaming. A non‑stream fallback uses
  `createTextResponseAction`.
- Model limits and reasoning controls are gated by the registry in
  `src/lib/ai/llm/model-registry.ts`.
- Prisma config reads `DATABASE_URL` from `.env` (see `prisma.config.ts`). If you see a Prisma error
  like “Argument
  \"url\" is missing in data source block \"db\"”, ensure `DATABASE_URL` is set before running
  Prisma commands.
- Home page (`/`) renders `public/README.mdx`. Keep it concise; this README is the canonical project
  documentation.

## Testing

- Unit tests: Vitest + jsdom
    - `pnpm test` / `pnpm test:watch` / `pnpm test:ui`
- End‑to‑end: Playwright
    - `pnpm test:e2e`

## Troubleshooting

- PostgreSQL connection errors
    - Confirm Docker is running and the exposed port is `55432`
    - Verify `DATABASE_URL` user/password/host/port
- NextAuth GitHub OAuth
    - Double‑check the callback URL matches your GitHub app settings
    - Set `NEXTAUTH_URL` to your local URL during development
- LLM provider
    - Ensure your API key is valid and the provider is OpenAI Responses–compatible
    - If using a non‑default base URL, set `LLM_BASE_URL`

## Contributing

This is an experiment‑oriented workspace. Issues and PRs are welcome. See `Agents.md` for additional
implementation
guidelines used in this repo.
