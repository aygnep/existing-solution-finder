# Agent Handoff — Short-Term Memory

Updated: 2026-07-10

## Current State

- Local main was pushed through commit 9b1382f.
- CLI and Web share discoverSolutions; do not recreate UI-only search behavior.
- Web mock mode is deterministic. Real mode uses discovery-searchers.ts.
- Run local Web with npm run build && npm run web:dev, then open
  http://127.0.0.1:5173.
- Browser requests go to Fastify on port 4174 and return DiscoveryResult.

## Next Work

1. Create a real-query benchmark and use it to improve discovery quality.
2. Add Web controls for stack, constraints, and provider failure detail.
3. Add bounded web evidence extraction and official-source signals.
4. Add an ESLint configuration; current lint fails before linting.

## Verification

- npm test: 164 tests passed.
- npm run typecheck: passed.
- npm run build: passed.
- Playwright solution-guide flow: passed.
- npm run lint: blocked by missing ESLint configuration.

## Guardrails

- Never execute, install, clone, or modify a candidate automatically.
- Keep provider keys out of browser payloads, logs, and exports.
- Preserve visible provider partial-success state and risk warnings.
- Do not silently add persistence or login.
