# Locus

An iMessage-based personal agent. Text a phone number, get back an answer with full context — backed by the Claude Agent SDK, persistent memory, schedulable automations, and integrations into Gmail / Calendar / Slack / GitHub / Notion / Linear and more.

## Stack

| Layer | What it does |
| --- | --- |
| **Claude Agent SDK** | The loop — dispatcher (Locus) routes turns to sub-agents that can use tools. |
| **Spectrum (Photon iMessage cloud)** | Streams inbound iMessage over gRPC, sends replies via `space.send()`. No Mac, no webhook. |
| **Convex** | Persistence — conversations, memory records (with vector embeddings), automations, agent run logs, settings. |
| **Composio** | Integration layer. One API key = OAuth + tool surfaces for ~1000 services. |
| **Express + WebSocket** | HTTP `/chat` endpoint for testing, WS broadcast for the debug UI. |
| **Vite + React** (debug only) | Local dashboard at `:5173` for inspecting agents, memory, automations, events, integrations. |

## Architecture

```
iMessage  →  Spectrum stream  →  Interaction agent (Locus)  →  Sub-agents (per task)
                                          │                            │
                                          ▼                            ▼
                                    Convex memory ←─────────────  Composio toolkits
```

The interaction agent is a dispatcher. It decides whether to answer directly (chit-chat, memory recall) or `spawn_agent` against a task. Sub-agents have access to whatever Composio toolkits the user has connected, plus a write-once draft system (the user confirms before any external action ships).

## Quick start

```bash
pnpm install
pnpm convex dev          # one-time: creates Convex project, generates types, populates .env.local
pnpm dev                 # boots server + convex watcher + debug dashboard at :5173
```

Required env vars (in `.env.local` or `.env`, see `.env.example`):

| Var | Required | Purpose |
| --- | :---: | --- |
| `ANTHROPIC_API_KEY` | ✓ | Used by the Claude Agent SDK to talk to Claude. |
| `CONVEX_URL`, `CONVEX_DEPLOYMENT` | ✓ | Written by `pnpm convex dev`. |
| `SPECTRUM_ENABLED=1`, `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET` | for iMessage | Without these, only the HTTP `/chat` endpoint works. |
| `COMPOSIO_API_KEY` | for integrations | Without this, sub-agents have no external tools. |
| `LOCUS_USER_PHONE` | for proactive notices | E.164 number that automation reach-outs are sent to. |
| `LOCUS_MODEL` | optional | Override the default Claude model (default: `claude-sonnet-4-6`). |
| `OPENAI_API_KEY` or `VOYAGE_API_KEY` | optional | Embedding provider. Falls back to local Transformers.js if neither is set. |

## Layout

```
server/             Express + agent runtime
  index.ts            HTTP/WS entrypoint, boots Spectrum + background loops
  spectrum.ts         iMessage stream → handleUserMessage; outbound sendImessage
  interaction-agent.ts  Dispatcher prompt, MCP server registration
  execution-agent.ts  Sub-agent runner with Composio + memory tools
  memory/             Vector recall, write_memory, decay, consolidation
  composio*           Toolkit loading, OAuth flow, tool surfaces
  convex-client.ts    HTTP client for Convex mutations/queries from the server

convex/             Schema + queries + mutations (Convex deployment)
debug/              Vite + React dashboard, runs alongside dev
scripts/            setup, dev orchestrator, preflight
```

## Deploying

The server runs as a single Node process. Anywhere that supports Node ≥ 20 + a long-running process works. The `start` script is `pnpm preflight && tsx server/index.ts`. Convex deploys separately (`pnpm convex deploy`) — get the URL into `CONVEX_URL` on the production host.

## License

MIT.
