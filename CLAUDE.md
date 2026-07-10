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
npm run web:dev      # Local Web Solution Guide
```

## Architecture

Shared discovery pipeline: input → parse → query → search → score → rank →
group → validation → DiscoveryResult. The CLI and local Web Solution Guide are
two renderers of this core.

Key directories:
- `src/cli/` — CLI entry point (commander)
- `src/core/` — Pure functions (parser, query-gen, scorer, ranker, summarizer)
- `src/providers/` — External API integrations (GitHub, npm, web)
- `src/web/` and `web/` — Local Fastify gateway and React UI
- `src/exports/` — Markdown report and agent-skill exports
- `src/types/` — TypeScript type definitions
- `tests/` — Jest test files

## Key Entry Points

- `src/cli/index.ts` — Main CLI, orchestrates the pipeline
- `src/core/discovery-service.ts` — Shared discovery orchestration
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

Run `npx playwright test e2e/solution-guide.spec.ts` for the local Web flow.
`npm run lint` is currently blocked because the project has no ESLint
configuration; do not treat it as a passing check.

## Gotchas

- Jest has `moduleNameMapper` for `.js` imports — keep it when adding new tests
- Mock mode is deterministic; real GitHub and web providers can be skipped when
  credentials are absent.
- Queries are sanitized (no `site:` prefixes, truncated to 256 chars)
- Start with `docs/AGENT_HANDOFF.md`, then `docs/LONG_TERM_MEMORY.md`.
