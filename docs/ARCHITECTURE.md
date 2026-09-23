# Architecture

## System Shape

~~~text
CLI or local Web UI
        ↓
DiscoveryRequest
        ↓
discovery-service
parse → query plan → provider runs → score → group keys → rule shortlist
  → optional System One Noul rerank (hosted Jev or local Laya)
  → final candidates and short handoff
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
| Decision rerankers | src/providers/system-one-reranker.ts | Optional TypeSafe or loopback Laya HTTP calls over bounded, redacted candidate evidence |
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

Jev is explicit opt-in. It evaluates a wider rule shortlist using three atomic
Noul questions per candidate, then orders the final candidates by the weaker
of relevance and compatibility followed by evidence probability, while leaving blocked candidates last. The top three
non-blocked candidates form the agent handoff. If Jev is unavailable or any
response is invalid, the entire rerank falls back to rule order. The browser
never receives `TYPESAFE_API_KEY`; opt-in sends the problem and bounded source
text to TypeSafe AI from the CLI or loopback gateway.

Laya is a separate opt-in with the same question and response shape. Fixseek
connects only to `127.0.0.1:8766` by default and sends a shorter state for
Laya's smaller context window. Laya's Router selects English or multilingual
weights. Its output is labeled `decision.provider: laya`; the agent JSON schema
is 1.3. The handoff preserves the first non-blocked rule candidate, then takes
Laya-ranked candidates. A stopped or invalid local service falls back to rules.

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
