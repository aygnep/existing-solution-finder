# Architecture

## System Shape

~~~text
CLI or local Web UI
        ↓
DiscoveryRequest
        ↓
discovery-service
parse → query plan → provider runs → score → group keys → rank groups → evidence → validation
        ↓
DiscoveryResult
  ├─ CLI summarizer
  ├─ CLI JSON agent envelope
  ├─ Fastify gateway: POST /api/discover
  └─ React Web Solution Guide and Markdown exporters

authorized validation
        ↓
fixseek feedback → redacted, versioned JSONL outcome record
~~~

CLI and Web use the same discovery service. UI code must not create separate
scoring or safety behavior.

## Module Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Contract | src/types/discovery.ts | Request, plan, provider status, evidence, solution, and result types |
| Orchestration | src/core/discovery-service.ts | Parse, query, isolated provider runs, score, rank, group, validation |
| Trust | scorer.ts, ranker.ts | Deterministic fit, maintenance, safety penalties, order, explanation |
| Evidence | solution-grouper.ts, validation-guidance.ts | Group repository evidence before the result limit while keeping npm packages distinct; retain source evidence and non-executing validation |
| Providers | src/providers/ | External I/O and mock or real provider factory |
| Feedback | src/feedback/ | Problem fingerprints and redacted useful / not-useful / unsafe JSONL outcomes |
| Web | src/web/gateway.ts, web/src/ | Local credential boundary and session-only React workflow |
| Exports | src/exports/solution-report.ts | Sourced report and agent-skill draft |

## Provider Behavior

The CLI defaults to real mode; mock mode is deterministic and explicit. Real
mode uses GitHub when GITHUB_TOKEN exists, npm without a credential, and web
search when WEB_SEARCH_API_KEY exists. Missing credentials produce `skipped`,
legitimate zero results produce `empty`, query-level failures with retained
results produce `partial`, and full runtime failures produce `failed`.
Provider requests have bounded retry, concurrency, and short-lived in-process
caching; successful queries survive failures in sibling queries.

Agent JSON output retains the request, search plan, provider states, evidence,
warnings, provider-native provenance, and validation steps. It does not make an
implementation decision: the calling agent verifies sources and proposes the
change.

## Outcome Feedback

`fixseek feedback` appends a local JSONL record containing only a candidate URL,
a normalized problem fingerprint, an outcome, optional redacted notes, and a
timestamp. It does not store repository contents and does not silently affect
ranking yet. `FIXSEEK_OUTCOME_FILE` can override the default
`~/.config/fixseek/outcomes.jsonl` path.

## Local Web Runtime

React/Vite listens on 127.0.0.1:5173. Fastify listens on 127.0.0.1:4174.
The browser never receives provider keys or persistent storage.

## Invariants

1. Core behavior is deterministic and typed.
2. Provider code owns network I/O.
3. Scores, warnings, and evidence remain visible in exports.
4. Users decide whether to execute a candidate.
5. Provider failures are never represented as legitimate empty searches.
