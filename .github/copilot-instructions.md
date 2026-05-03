# Copilot instructions for `openclaw-a2a-gateway`

## Build and test commands

Run `npm install` in the repository root before local development work; the root package relies on dev dependencies like `tsx` and `typescript`.

| Scope | Command | Notes |
| --- | --- | --- |
| Root plugin | `npm test` | Runs the full gateway test suite with Node's built-in test runner via `tsx`. |
| Root plugin | `./node_modules/.bin/tsc --noEmit` | CI typecheck command for the root plugin (`.github/workflows/test.yml` runs typecheck + `npm test`). |
| Root plugin | `node --import tsx --test tests/a2a-gateway.test.ts` | Run a single test file. |
| Root plugin | `node --import tsx --test --test-name-pattern='zero-config' tests/a2a-gateway.test.ts` | Run a single named test inside one file. |
| Root plugin | `node --import tsx --test tests/benchmark.test.ts` | Runs the benchmark-style bio-inspired feature suite documented in the README. |
| Companion CLI (`cli/`) | `cd cli && npm install` | Install CLI-specific dependencies. |
| Companion CLI (`cli/`) | `cd cli && npm run build` | Builds the standalone `a2a` devtools CLI. |
| Companion CLI (`cli/`) | `cd cli && npm test` | Runs the CLI package tests. |

## High-level architecture

- `index.ts` is both the OpenClaw plugin entrypoint and the runtime composition root. It parses plugin config, creates all managers/stores, registers gateway RPC methods (`a2a.send`, `a2a.metrics`, `a2a.audit`, push notification helpers), exposes the `a2a_send_file` tool, mounts Express A2A endpoints, and starts a gRPC server on `server.port + 1`. When `agentCard.grpcUrl` is `true`, the Agent Card derives gRPC from the same base URL as JSON-RPC/REST and appends `/grpc`; it does not change the listener port.
- Inbound A2A traffic flows through `DefaultRequestHandler` from `@a2a-js/sdk`, backed by `FileTaskStore` for durable task persistence and `QueueingAgentExecutor` for concurrency limits, queue rejection, and optional Michaelis-Menten soft backpressure.
- `OpenClawAgentExecutor` is the bridge from A2A tasks into OpenClaw gateway RPC. It flattens inbound `TextPart`/`FilePart`/`DataPart` content into agent-readable text, streams progress, and promotes outbound `mediaUrl`/`mediaUrls` back into A2A `FilePart`s.
- Outbound peer calls from `a2a.send` and `a2a_send_file` go through `src/client.ts`. That client resolves Agent Cards, applies peer auth, tries transports in JSON-RPC -> REST -> gRPC order, and can adapt the ordering based on recent per-peer transport success/latency.
- Peer management is split across resilience/discovery modules: `peer-health.ts` tracks health and circuit state, `peer-retry.ts` wraps retries, `dns-discovery.ts` discovers peers, `quorum-discovery.ts` adapts polling frequency, and `dns-responder.ts` advertises this gateway via mDNS.
- Observability and durability are first-class: `telemetry.ts` produces the metrics snapshot, `audit.ts` writes JSONL audit records, `push-notifications.ts` handles webhook registration/retry, `task-recovery.ts` restores non-terminal tasks at startup, and `task-cleanup.ts` enforces TTL cleanup.
- `src/internal/*` is intentionally separate from the public A2A surface. Those files implement OpenClaw-specific gateway mesh extensions, not standard A2A protocol behavior.
- `cli/` is a separate npm package for the `a2a` debugging/devtools CLI. Treat it as its own build/test surface when a change touches that directory.

## Key conventions

- This is a strict TypeScript ESM codebase. Source files use `.js` import specifiers even inside `.ts` files; keep that pattern when adding imports.
- Config changes are two-sided: update `openclaw.plugin.json` for schema/defaults and update `parseConfig()` in `index.ts` for runtime parsing/normalization. The schema alone is not enough.
- The gateway is designed to stay backward-compatible when optional features are not configured. Bio-inspired routing/discovery/backpressure features should remain additive, not mandatory.
- Static and discovered peers are intentionally merged with static peers taking precedence on name collisions (`mergeWithStaticPeers` in the `index.ts` flow).
- Security helpers are fail-closed. Reuse `file-security.ts` for URI, MIME, and size checks instead of ad hoc validation; it blocks private/reserved IPs and avoids re-resolving URLs after validation.
- Durable tasks are filesystem-backed JSON files under `storage.tasksDir`. Startup recovery and periodic TTL cleanup are part of the normal lifecycle, so task-related changes usually need to consider `task-store.ts`, `task-recovery.ts`, and `task-cleanup.ts` together.
- Tests use Node's built-in `node:test` runner with `assert/strict`, not Jest/Vitest. Shared plugin harnesses and mock OpenClaw/WebSocket helpers live in `tests/helpers.ts`.
- The plugin intentionally treats gRPC as non-fatal: HTTP/JSON-RPC/REST startup should still succeed if the gRPC listener on `port + 1` cannot bind.
- When updating `.ai/joblog.md`, prepend the new entry at the top of the file instead of appending it at the end.
