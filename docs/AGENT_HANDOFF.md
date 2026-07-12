# Agent Handoff — Short-Term Memory

Updated: 2026-07-13

## Current State

- Local main was pushed through commit 9b1382f.
- CLI and Web share discoverSolutions; do not recreate UI-only search behavior.
- Web mock mode is deterministic. Real mode uses discovery-searchers.ts.
- Run local Web with npm run build && npm run web:dev, then open
  http://127.0.0.1:5173.
- Browser requests go to Fastify on port 4174 and return DiscoveryResult.
- `npm run benchmark:real` reads `benchmarks/cases.json`, calls real providers,
  and prints a redacted report without changing the snapshot.
- `npm run benchmark:update` intentionally overwrites
  `benchmarks/baseline.json`; run it only after reviewing the report and diff.
- The initial baseline records two relevance misses:
  `deepseek-opencode-bridge` and `esm-commonjs-vite`.
- The implementation supports Brave web search only. `serpapi` currently
  validates in environment parsing but is returned as an empty provider by
  `web-search.ts`.

## Next Work

1. Tune queries and scoring against the two benchmark relevance misses, then
   review whether to update the baseline.
2. Reconcile the documented/configured web provider list with implementation,
   or add SerpAPI support.
3. Add Web controls for stack, constraints, and provider failure detail.
4. Add bounded web evidence extraction and official-source signals.
5. Add an ESLint configuration; current lint fails before linting.

## Verification

- npm test: 164 tests passed.
- npm run typecheck: passed.
- npm run build: passed.
- Playwright solution-guide flow: passed.
- npm run lint: blocked by missing ESLint configuration.
- The initial real benchmark baseline was created intentionally after review.

## Guardrails

- Never execute, install, clone, or modify a candidate automatically.
- Keep provider keys out of browser payloads, logs, and exports.
- Preserve visible provider partial-success state and risk warnings.
- Do not silently add persistence or login.
