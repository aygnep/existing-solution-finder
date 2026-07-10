# Roadmap

## Current State

Fixseek has a CLI and local no-account Web Solution Guide over one typed
discovery core. The Web flow supports planning, provider state, evidence/risk
inspection, selection, and report or skill export.

## Next Priorities

### 1. Measure real quality

- Create a versioned benchmark of real troubleshooting prompts.
- Record relevance, source coverage, warnings, latency, and empty-result rate.
- Tune queries and scores only against this regression set.

### 2. Strengthen evidence

- Extract bounded page content and highlights for web results.
- Identify official documentation and improve provenance confidence.
- Expand grouping beyond exact canonical URLs only after evaluation proves value.

### 3. Polish the Web Guide

- Add stack and constraint editors.
- Show generated queries and provider skip/failure messages clearly.
- Add an ESLint configuration before treating lint as a release gate.

### 4. Release confidence

- Exercise real mode with configured GitHub and web credentials.
- Keep npm publishing manual.
- Maintain unit, Web UI, and Playwright coverage.

## Later

Optional LLM evidence summaries, editor and CI integrations, persistence,
private sources, and team workflows remain later work.

## Document Map

| Need | Read |
| --- | --- |
| Active context | docs/AGENT_HANDOFF.md |
| Durable decisions | docs/LONG_TERM_MEMORY.md |
| Product scope | docs/PRODUCT_SPEC.md |
| Code boundaries | docs/ARCHITECTURE.md |
| Query, score, safety | SEARCH_STRATEGY.md, SCORING_RULES.md, SAFETY_RULES.md |
