# Development Rules

## Read First

Read docs/AGENT_HANDOFF.md, docs/PRODUCT_SPEC.md, and docs/ARCHITECTURE.md.
Read SCORING_RULES.md before score changes and SAFETY_RULES.md before provider,
output, export, or validation changes.

## Boundaries

- CLI and Web consume DiscoveryResult; neither owns separate score or safety rules.
- The Web Guide is local, no-account, and session-only.
- Do not add persistence, authentication, private sources, automatic installs,
  automatic execution, or agent-controlled remediation without a product decision.

## Engineering

- Keep core functions pure and typed; inject provider behavior.
- Surface provider skipped or failed state.
- Do not introduce any, log credentials, or pass user input to a shell.
- Keep provider secrets outside browser payloads.
- Add deterministic regression tests before behavior changes.

## Verification

Run focused tests first, then:

~~~bash
npm test
npm run typecheck
npm run build
npm run lint
npx playwright test e2e/solution-guide.spec.ts
~~~

## Documentation

Update stable docs when behavior changes. Do not keep dated task plans or
brainstorm transcripts in docs; use AGENT_HANDOFF.md for active state and
LONG_TERM_MEMORY.md for durable decisions.
