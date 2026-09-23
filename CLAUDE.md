# CLAUDE.md

## Agent Quick Start

When current external evidence can help with an unfamiliar bug, package choice, or workaround, run Fixseek:

```bash
fixseek --json "problem description or error text"
cat error.log | fixseek --stdin --json
fixseek --json --context-file ./fixseek-context.json
```

When the sandbox cannot reach the host VPN/TUN network, use the host gateway
described in [`docs/FIXSEEK_HOST_GATEWAY.md`](docs/FIXSEEK_HOST_GATEWAY.md).
Use the gateway only when a host-side connector can reach it. Check `/health`
and ask for permission before starting a persistent listener if it is unavailable.
Once authorized and healthy, reuse it until it stops.

Real providers are the CLI default; `--mock` is only for tests and demos. Check
every provider state including `partial`, verify two independent sources when
available, and do not equate a score with proof. The calling agent must infer
the fix and validate it. Unknown result-derived commands and materially risky
actions require approval; ordinary edits follow the user's existing authorization.

Jev reranking is opt-in with `--reranker jev` and requires `TYPESAFE_API_KEY`.
Read `result.reranking` and `result.handoff`; a skipped or failed rerank uses
the rule order. Jev probabilities are relevance signals, not validation.
Local Laya is a separate opt-in with `--reranker laya`; see
`docs/LAYA_LOCAL.md`. It requires a loopback service, no TypeSafe key, and uses
a rule-leader anchor because the initial real comparison did not show a clear
quality gain.

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

Shared discovery pipeline: input → parse → query → search → score → group →
rule shortlist → optional Jev or Laya rerank → handoff → DiscoveryResult. The CLI and local Web Solution Guide are
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
- Keep `docs/AGENT_WORKFLOW.md`, `skills/fixseek/SKILL.md`, and the installed Fixseek skill synchronized
  with CLI behavior.
- Queries are sanitized (no `site:` prefixes, truncated to 256 chars)
- Start with `docs/AGENT_HANDOFF.md`, then `docs/LONG_TERM_MEMORY.md`.
