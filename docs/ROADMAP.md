# Roadmap

## Current State

Fixseek has a CLI and local no-account Web Solution Guide over one typed
discovery core. The Web flow supports planning, provider state, evidence/risk
inspection, selection, and report or skill export.

The repository now has a versioned real-provider benchmark, a reviewed initial
baseline, and an explicit command for comparing later runs without exposing
credentials.

The P2 agent-first workflow is implemented:

- CLI real search is the default; mock is test/demo only.
- `--json`, structured context, stack, and constraints support coding agents.
- Provider failures, empty results, retries, cache, and concurrency are explicit.
- npm and web preserve bounded provider-native evidence.
- Results include source evidence and a validation/rollback/re-search loop.
- Local `useful`, `not-useful`, and `unsafe` outcome records are available.

The search-quality beta also preserves source URLs in JSON output, generates
queries for Chinese-only input, retains results from partially failed provider
runs, and treats a conclusive benchmark relevance miss as a failed quality gate.
The most recent real run passed 1 of 5 relevance cases, so ranking and benchmark
case quality remain active release work.

The 0.3.0 beta adds an optional Jev second-stage reranker and a source-linked
agent handoff. Its API adapter and fallback are tested offline; no TypeSafe key
was available for a live Jev benchmark when this version was prepared.
Before claiming an improvement, compare rule-only and Jev Top-3 relevance on
the same reviewed candidate pools, with latency, cost, safety, and Chinese
cases recorded separately.

## P3 Priorities

### 1. Improve measured real quality

- Use the benchmark to improve cases that currently miss their approved
  candidates, then review any baseline update.
- Record relevance, source coverage, warnings, latency, and empty-result rate
  in every explicit real run.
- Keep query and scoring changes tied to this regression set.

### 2. Strengthen evidence

- Extract bounded page content and highlights for web results.
- Identify official documentation and improve provenance confidence.
- Expand grouping beyond exact canonical URLs only after evaluation proves value.
- Use reviewed outcome records as an explicit, auditable ranking input; never
  learn silently from unreviewed activity.

### 3. Polish the Web Guide

- Show generated queries and provider skip/failure messages clearly.
- Add the outcome feedback action to the Web UI.
- Keep slow real-provider work visibly loading and covered by the browser flow.

### 4. Release confidence

- Exercise real mode with configured GitHub and web credentials.
- Keep smoke coverage for GitHub, npm, Brave/SerpApi web, JSON output, and the
  globally linked command.
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
