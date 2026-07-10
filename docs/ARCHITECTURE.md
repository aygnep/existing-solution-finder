# Architecture

## System Shape

~~~text
CLI or local Web UI
        ↓
DiscoveryRequest
        ↓
discovery-service
parse → query plan → provider runs → score → rank → group → validation
        ↓
DiscoveryResult
  ├─ CLI summarizer
  ├─ Fastify gateway: POST /api/discover
  └─ React Web Solution Guide and Markdown exporters
~~~

CLI and Web use the same discovery service. UI code must not create separate
scoring or safety behavior.

## Module Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Contract | src/types/discovery.ts | Request, plan, provider status, evidence, solution, and result types |
| Orchestration | src/core/discovery-service.ts | Parse, query, isolated provider runs, score, rank, group, validation |
| Trust | scorer.ts, ranker.ts | Deterministic fit, maintenance, safety penalties, order, explanation |
| Evidence | solution-grouper.ts, validation-guidance.ts | Conservative canonical-URL grouping and non-executing validation |
| Providers | src/providers/ | External I/O and mock or real provider factory |
| Web | src/web/gateway.ts, web/src/ | Local credential boundary and session-only React workflow |
| Exports | src/exports/solution-report.ts | Sourced report and agent-skill draft |

## Provider Behavior

Mock mode is deterministic. Real mode uses GitHub when GITHUB_TOKEN exists,
npm without a credential, and optional web search when WEB_SEARCH_API_KEY
exists. Missing credentials produce skipped; runtime problems produce failed;
both preserve results from other providers.

## Local Web Runtime

React/Vite listens on 127.0.0.1:5173. Fastify listens on 127.0.0.1:4174.
The browser never receives provider keys or persistent storage.

## Invariants

1. Core behavior is deterministic and typed.
2. Provider code owns network I/O.
3. Scores, warnings, and evidence remain visible in exports.
4. Users decide whether to execute a candidate.
