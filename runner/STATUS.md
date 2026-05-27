# Runner + MCP stack — current status (Stage D unblocked)

This document captures where the MCP/Runner integration left off so the
next session can pick it up without re-deriving everything.

> **2026-05-27 update — Stage D blocker fixed locally.** Root cause was
> in the SDK: `WebStandardStreamableHTTPServerTransport.handleRequest`
> *throws* on the second request when `sessionIdGenerator` is undefined
> (literal error: `"Stateless transport cannot be reused across requests.
> Create a new transport per request."`). We switched to stateful mode
> with a `sessionId → transport` map. Local handshake verified:
> `initialize → 200 + Mcp-Session-Id`, `notifications/initialized → 202`,
> `tools/list → 200` (19 tools). Needs deploy + Claude end-to-end check.

## What works

| Component | Status | Verified by |
|---|---|---|
| **MCP server** container (`anamnesis-mcp`) | ✅ Healthy, listens on `mcp:7800/mcp` (internal docker DNS), 16 tools registered | `curl http://mcp:7800/health` → 200; direct Node fetch with bearer → MCP init handshake returns full `serverInfo` + tools capability |
| **Runner** container (`anamnesis-runner`) | ✅ Healthy, listens on `runner:7900`, spawns claude CLI per request, streams stdout as SSE | `wget http://runner:7900/health` → 200; `POST /run {prompt:"PONG"}` works end-to-end |
| **Claude CLI auth** in runner | ✅ Uses MAX subscription OAuth tokens persisted in `/mnt/ssd/apps/anamnesis/runner-claude` Docker volume mounted at `/home/runner/.claude/.credentials.json` | `docker exec ix-anamnesis-runner-1 claude -p "say PONG"` returns `PONG` |
| **Network** backend → runner → mcp → backend | ✅ All internal docker DNS, no Tailscale roundtrip | `docker exec ix-anamnesis-backend-1 wget http://runner:7900/health` works |
| **OAuth credentials persistence** | ✅ Survive container restarts (volume mount) | Verified after `docker restart ix-anamnesis-runner-1` |

## What's broken (Stage D blocker)

**Claude → MCP handshake fails on the 2nd JSON-RPC message.**

Sequence observed in `mcp` container logs:

```
POST /mcp method=initialize id=0  → 200 OK
POST /mcp method=<notifications/initialized?> id=- → 500
```

The second POST is the standard MCP `notifications/initialized` (a JSON-RPC notification — no `id` field, no response expected). The
`@modelcontextprotocol/sdk` v1.29 `StreamableHTTPServerTransport`
returns 500 on it, even after switching to stateless mode via
`new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`.

End result: Claude reports `anamnesis: ✗ Failed to connect` and tools
aren't usable — but the runner can still spawn Claude for general
prompts (anything not needing Anamnesis MCP tools).

## Suspected causes

1. Stateless mode still validates session ID via `Mcp-Session-Id` header for non-init messages. SDK might need additional option to fully disable session checks.
2. The transport may expect a specific HTTP status (202 Accepted, not 200) for notifications.
3. Express's `express.json()` body-parser consumes the request body; SDK may want raw stream access. Quick test: try removing `req.body` arg from `transport.handleRequest(req, res)` and not parsing body in Express.

## Next steps (when resuming)

In priority order:

1. **Read `streamableHttp.js` source** in `mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js` — find branch where it returns 500 for notifications. Likely a session validation that fires before stateless mode check.
2. **Try `enableJsonResponse: true`** in transport options if available — forces JSON responses without SSE streaming, simpler.
3. **Fallback**: replace SDK with hand-rolled JSON-RPC over HTTP. The MCP protocol shape is: client POSTs JSON-RPC, server responds with JSON-RPC. Tool definitions ship in initialize response (`capabilities.tools`). Tool calls are method `"tools/call"`. ~50 lines of Express vs the SDK's complexity.

## What we'd still need after Stage D unblocks

| Stage | What | Already designed in plan |
|---|---|---|
| E | Backend integration: `services/claude-runner.js`, `POST /api/ai/run`, `ai_jobs` table | Yes, ENV `CLAUDE_RUNNER_URL=http://runner:7900` and `CLAUDE_RUNNER_TOKEN` already in prod env |
| F1 | UI: Spotlight AI (Cmd/Ctrl+K) modal | Yes |
| F2 | UI: AiChatSheet realtime via runner | Yes |
| F3 | UI: per-card AI buttons → direct run | Yes |
| F4 | UI: "Upload document → AI extract" one-click | Yes |

## Production state

- 4 containers running on TrueNAS: `backend`, `frontend`, `mcp`, `runner`
- 3 env tokens in `/mnt/ssd/apps/anamnesis/config/anamnesis.env`: `MCP_TOKEN`, `RUNNER_TOKEN`, `ANTHROPIC_API_KEY` (last one is currently unused since OAuth via credentials file works; can be removed for cleanliness)
- 1 Docker volume `/mnt/ssd/apps/anamnesis/runner-claude` with persistent Claude OAuth credentials
- Win VM `rhino-node-1` (10.0.1.173) — has obsolete Node + Claude + runner code; scheduled task `AnamnesisRunner` already deleted. Files in `C:\anamnesis-runner` can be removed if desired; VM itself can be turned off
- GHA workflow builds 4 images: `anamnesis-{backend,frontend,mcp,runner}`
