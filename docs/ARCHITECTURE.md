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
- Supports `--mock` (default) and `--real` modes
- Supports `--provider github|web|npm` to limit search scope
- Validates `GITHUB_TOKEN` when `--real` + GitHub provider is needed
- Uses `searchGitHubMultiQuery` for cross-query deduplication
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
- Calls GitHub Search API (repositories endpoint)
- Requires `GITHUB_TOKEN` (only in `--real` mode)
- Sanitizes queries: removes `site:` prefixes, strips long error-log tokens, truncates to 256 chars
- Fetches README from `raw.githubusercontent.com` for each repo result
- Extracts metadata from README: install instructions, example config, suspicious install scripts
- Deduplicates results across multiple queries by `full_name` (case-insensitive)
- Exports: `searchGitHub`, `searchGitHubMultiQuery`, `sanitizeGitHubQuery`, `deduplicateByFullName`, `extractReadmeMetadata`
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

## Provider Pipeline

The search layer operates in two modes:

### Mock Mode (default)
1. `generateQueries` produces `Query[]` for the problem.
2. `createMockProvider(getBuiltinMockCandidates())` returns a search function.
3. Each query runs against the mock provider; results are concatenated.
4. No network calls. No API keys required.

### Real Mode (`--real`)
1. `generateQueries` produces `Query[]` for the problem.
2. CLI filters queries by `--provider` if specified.
3. GitHub queries are batched to `searchGitHubMultiQuery`:
   - Queries are sanitized (`sanitizeGitHubQuery`) to remove `site:` prefixes and error logs.
   - GitHub Search API returns repositories; README is fetched via `raw.githubusercontent.com`.
   - README metadata is extracted (`extractReadmeMetadata`).
   - Results are deduplicated by `full_name` (`deduplicateByFullName`).
4. Web and npm queries run per-query in parallel via `searchWeb` and `searchPackages`.
5. All candidate arrays are concatenated and passed to the scorer.

## Design Principles

1. **Pure core** — `core/` modules are pure functions with no side effects. Easy to test.
2. **Injectable providers** — providers are passed as dependencies, not imported globally.
3. **Fail gracefully** — if one provider fails, log a warning and continue with others.
4. **No magic globals** — all config flows through typed `Env` object (see `src/utils/env.ts`).
5. **Types over comments** — use TypeScript types to document data shapes.
