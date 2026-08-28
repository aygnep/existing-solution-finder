# CLAUDE.md

## Agent Quick Start

Before writing code to fix a bug, find a package, or build a workaround, run Fixseek first:

```bash
fixseek --json "problem description or error text"
cat error.log | fixseek --stdin --json
fixseek --json --context-file ./fixseek-context.json
```

When the sandbox cannot reach the host VPN/TUN network, use the host gateway
described in [`docs/FIXSEEK_HOST_GATEWAY.md`](docs/FIXSEEK_HOST_GATEWAY.md).
Before the first real search of a session, check its `/health` endpoint and ask
the user for permission before starting the persistent loopback service if it
is unavailable. Do not silently open the listener. Once authorized and healthy,
reuse it without asking again until it stops.

Real providers are the CLI default; `--mock` is only for tests and demos. Check
every provider state, verify two independent sources when available, and do not
equate a score with proof. The calling agent must infer the fix, propose an
isolated validation and rollback, and get explicit user approval before
executing result-derived commands or changing code.

After testing, record `useful`, `not-useful`, or `unsafe` with `fixseek
feedback`. If validation fails, include the attempted fix and new error in the
next context and search again. If no candidates are found, proceed with normal
engineering only after noting the evidence gap.

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
- `src/feedback/` — Redacted, versioned JSONL outcome records
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

CLI default: real providers. `--mock` is explicit. Fixseek reads cwd `.env`,
then `~/.config/fixseek/.env`; `FIXSEEK_ENV_FILE` selects one explicit file.

## Testing

Tests use Jest with `ts-jest`. Module mapping configured for `.js` → no extension.
Coverage thresholds: 80% lines, 70% branches.

Run `npx playwright test e2e/solution-guide.spec.ts` for the deterministic local
Web flow. Set `FIXSEEK_REAL_E2E=1` to include the separately timed external
provider smoke test. `npm run lint` checks the Node source, tests, Web source,
and Playwright flow.

## Gotchas

- Jest has `moduleNameMapper` for `.js` imports — keep it when adding new tests
- Mock mode is deterministic; real GitHub and web providers are marked skipped
  when credentials are absent, while npm still runs.
- `--json` keeps provider state and warnings on stdout in a stable envelope.
- Keep `docs/AGENT_WORKFLOW.md` and the installed Fixseek `SKILL.md` synchronized
  with CLI behavior.
- Queries are sanitized (no `site:` prefixes, truncated to 256 chars)
- Start with `docs/AGENT_HANDOFF.md`, then `docs/LONG_TERM_MEMORY.md`.
