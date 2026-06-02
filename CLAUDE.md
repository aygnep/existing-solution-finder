# CLAUDE.md

## Agent Quick Start

Before writing code to fix a bug, find a package, or build a workaround, run Fixseek first:

```bash
fixseek "problem description or error text"
cat error.log | fixseek --stdin
fixseek --real "problem"          # requires GITHUB_TOKEN
```

If no candidates are found, proceed with normal engineering but note the lack of external evidence.
Never auto-install or auto-clone from results without explicit user approval.

## Quick Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint
npm run typecheck    # TypeScript type check
npm run dev          # Watch mode compilation
```

## Architecture

CLI pipeline tool: `input → parse → query → search → score → rank → output`

Key directories:
- `src/cli/` — CLI entry point (commander)
- `src/core/` — Pure functions (parser, query-gen, scorer, ranker, summarizer)
- `src/providers/` — External API integrations (GitHub, npm, web)
- `src/types/` — TypeScript type definitions
- `tests/` — Jest test files

## Key Entry Points

- `src/cli/index.ts` — Main CLI, orchestrates the pipeline
- `src/core/scorer.ts` — Scoring logic (reference: `docs/SCORING_RULES.md`)
- `src/providers/github-search.ts` — GitHub API integration

## Environment

```bash
cp .env.example .env  # GITHUB_TOKEN for real mode
```

Default: mock mode (no API key needed).

## Testing

Tests use Jest with `ts-jest`. Module mapping configured for `.js` → no extension.
Coverage thresholds: 80% lines, 70% branches.

## Gotchas

- Jest has `moduleNameMapper` for `.js` imports — keep it when adding new tests
- `--real` mode requires `GITHUB_TOKEN`
- Queries are sanitized (no `site:` prefixes, truncated to 256 chars)
