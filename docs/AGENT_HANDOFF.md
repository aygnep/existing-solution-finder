# Agent Handoff — Short-Term Memory

Updated: 2026-09-23

## Current State

- GitHub beta 0.2.0 adds Chinese query fallback, per-query partial provider
  results, source-URL-safe JSON redaction, grouping before Top N with distinct
  npm packages, and conservative trust labels. Agent JSON schema is 1.1.
- The real benchmark now fails conclusively on relevance misses. The latest
  explicit run passed 1 of 5 relevance cases; four misses remain open quality
  targets. Do not describe the beta as having passed the real quality gate.

- Agent-first P2 is complete and independently reviewed for release.
- CLI and Web share discoverSolutions; do not recreate UI-only search behavior.
- CLI defaults to real providers. `--mock` is explicit test/demo behavior.
- `fixseek --json` exposes invocation metadata, search plan, provider states,
  evidence, provider-native provenance, warnings, and validation steps.
- `--context-file`, `--stack`, and `--constraints` carry bounded, redacted agent
  context into discovery.
- Provider I/O distinguishes empty, skipped, and failed; it has bounded retry,
  concurrency, request coalescing, and a 60-second successful-response cache.
- `fixseek feedback` records explicit useful / not-useful / unsafe outcomes as
  redacted local JSONL.
- Run local Web with npm run build && npm run web:dev, then open
  http://127.0.0.1:5173.
- Browser requests go to Fastify on port 4174 and return DiscoveryResult.
- The Web Solution Guide is a dark responsive workbench and sends real-mode
  requests by default. Its Chinese / EN switch re-renders generated text and
  exports without repeating provider calls; source evidence stays unchanged.
- Real-provider Web requests show a localized loading state, disable duplicate
  submissions, and allow enough browser-test time for bounded provider latency.
- ESLint covers the Node source, tests, Web source, and Playwright flow.
- `npm run benchmark:real` reads `benchmarks/cases.json`, calls real providers,
  and prints a redacted report without changing the snapshot.
- `npm run benchmark:update` intentionally overwrites
  `benchmarks/baseline.json`; run it only after reviewing the report and diff.
- The historical baseline records two relevance misses. A September real run
  showed four misses; keep the current report separate from the old snapshot.
- Web search supports both Brave and SerpApi.

## Competitive Findings

GitHub topic research on 2026-07-13 highlighted mature code-context and
analysis tools such as `zilliztech/claude-context` (12k+ stars),
`sourcegraph/sourcegraph-public-snapshot` (10k+), `MinishLab/semble`
(5k+), `astral-sh/ruff` (48k+), and `semgrep/semgrep` (15k+). Their
common strengths are repository-aware context, high-signal evidence, and
integration into developer workflows rather than a one-off result list.

## Next Work

1. Tune queries and scoring against the two benchmark relevance misses, then
   review whether to update the baseline.
2. Add benchmark acceptance targets for critical cases; a baseline that records
   a relevance miss must remain visible as an improvement target, not become a
   silent pass condition.
3. Add bounded page extraction, official-domain signals, and source-quality
   ranking before expanding URL grouping.
4. Use reviewed local outcomes as an explicit benchmark/ranking input and add
   equivalent feedback controls to the Web Guide.

## Verification

- `npm test -- --runInBand --silent`: 26 suites and 238 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, including the Web bundle.
- `npm run lint`: passed.
- `npx playwright test e2e/solution-guide.spec.ts`: deterministic Web flow
  passed; the external-provider smoke test is opt-in with `FIXSEEK_REAL_E2E=1`
  and has its own provider-aligned timeout.
- `git diff --check`: passed.
- The global `fixseek` executable resolves to this checkout's
  `dist/cli/index.js`.
- Real npm, GitHub, and Web CLI smoke searches each returned `complete`, exit
  code 0, valid JSON, candidates, and no stderr.
- Global `fixseek feedback` smoke test wrote and reloaded a temporary outcome
  record successfully.
- The initial real benchmark baseline was created intentionally after review.

## Guardrails

- Never execute, install, clone, or modify a candidate automatically.
- Keep provider keys out of browser payloads, logs, and exports.
- Preserve visible provider partial-success state and risk warnings.
- Do not silently add persistence or login.
