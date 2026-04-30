# Architecture

## Overview

```
User Input (CLI)
      │
      ▼
┌─────────────────┐
│  problem-parser  │  Extracts: error tokens, stack names, constraints
└────────┬────────┘
         │ ParsedProblem
         ▼
┌─────────────────┐
│ query-generator  │  Produces N queries across 5 categories
└────────┬────────┘
         │ Query[]
         ▼
┌──────────────────────────────────────┐
│              Providers               │
│  github-search  web-search  pkg-search│
└────────────────┬─────────────────────┘
                 │ RawCandidate[]
                 ▼
┌─────────────────┐
│     scorer       │  Applies SCORING_RULES.md, produces Score
└────────┬────────┘
         │ ScoredCandidate[]
         ▼
┌─────────────────┐
│     ranker       │  Sorts, deduplicates, applies penalties
└────────┬────────┘
         │ RankedCandidate[]
         ▼
┌─────────────────┐
│   summarizer     │  Formats human-readable output
└────────┬────────┘
         │
         ▼
     CLI Output
```

## Module Responsibilities

### `src/cli/index.ts`
- Parse CLI arguments via `commander`
- Load `.env` via `dotenv`
- Orchestrate the pipeline (parse → query → search → score → rank → summarize)
- Print results to stdout
- Exit with code 1 on fatal errors

### `src/core/problem-parser.ts`
- Pure function: `parseProblem(input: string): ParsedProblem`
- Extracts error messages, stack traces, tech names, version numbers
- No external dependencies (pure string processing)

### `src/core/query-generator.ts`
- Pure function: `generateQueries(problem: ParsedProblem): Query[]`
- Produces queries in 5 categories (see `SEARCH_STRATEGY.md`)
- No external I/O

### `src/core/scorer.ts`
- Pure function: `scoreCandidate(candidate: RawCandidate, problem: ParsedProblem): Score`
- Applies rules from `SCORING_RULES.md`
- Returns a structured `Score` object with field-level breakdown

### `src/core/ranker.ts`
- Pure function: `rankCandidates(candidates: ScoredCandidate[]): RankedCandidate[]`
- Deduplicates by URL
- Sorts by total score descending
- Caps output at configurable N (default 10)

### `src/core/summarizer.ts`
- Pure function: `summarize(candidates: RankedCandidate[], problem: ParsedProblem): string`
- Produces human-readable CLI output
- Formats warnings clearly

### `src/providers/github-search.ts`
- Calls GitHub Search API (code + repository endpoints)
- Requires `GITHUB_TOKEN`
- Returns `RawCandidate[]`

### `src/providers/web-search.ts`
- Calls configured web search provider (Brave / SerpAPI)
- Returns `RawCandidate[]`

### `src/providers/package-search.ts`
- Calls npm registry search API
- No auth required
- Returns `RawCandidate[]`

## Data Flow Types

See `src/types/` for full TypeScript definitions.

```
string (raw input)
  → ParsedProblem
  → Query[]
  → RawCandidate[]      (per provider)
  → ScoredCandidate[]   (after scorer)
  → RankedCandidate[]   (after ranker)
  → string (output)
```

## Design Principles

1. **Pure core** — `core/` modules are pure functions with no side effects. Easy to test.
2. **Injectable providers** — providers are passed as dependencies, not imported globally.
3. **Fail gracefully** — if one provider fails, log a warning and continue with others.
4. **No magic globals** — all config flows through typed `Env` object (see `src/utils/env.ts`).
5. **Types over comments** — use TypeScript types to document data shapes.
