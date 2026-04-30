# Claude Code Development Rules

These rules govern how Claude Code (and any AI coding assistant) must behave when working on this project. Read this file before making any changes.

---

## Mandatory Pre-Work

Before modifying any file, Claude Code must:

1. **Read `docs/PRODUCT_SPEC.md`** — Understand what the product does and does not do.
2. **Read `docs/ARCHITECTURE.md`** — Understand the pipeline and module responsibilities.
3. **Check `docs/SCORING_RULES.md`** before touching `src/core/scorer.ts`.
4. **Check `docs/SAFETY_RULES.md`** before touching any output or provider logic.

---

## Scope Rules

| Rule | Rationale |
|---|---|
| Keep MVP small | Complexity is the enemy of correctness |
| Do NOT introduce a frontend unless explicitly requested | Out of scope for MVP |
| Do NOT add a database in MVP | Results are ephemeral; use in-memory |
| Do NOT add authentication in MVP | Local CLI tool; no users to authenticate |
| Do NOT add caching in MVP unless a performance test proves it's needed | Premature optimization |
| Do NOT add a plugin system in MVP | YAGNI |

---

## Code Quality Rules

### Functions

- Prefer **pure functions** in `src/core/` — no side effects, no I/O, no global state.
- Functions in `src/providers/` may have side effects (network calls) but must be clearly typed.
- Maximum function length: **50 lines**. If longer, extract.
- Maximum file length: **300 lines** for MVP. If approaching this, refactor.

### Types

- Every public function must have explicit TypeScript parameter and return types.
- No `any`. Use `unknown` and narrow it.
- Prefer `interface` for data shapes, `type` for unions.

### Error Handling

- Never use `throw` without a typed error class.
- Provider errors must be caught and returned as `Result<T, ProviderError>` — do not let provider failures crash the pipeline.
- Log errors via `src/utils/logger.ts`. Never use `console.log` in production code.

---

## Security Rules

- **Never commit API keys.** Keys live in `.env` only (git-ignored).
- **Never hardcode tokens** — not even test tokens.
- **Never log API keys**, even at debug level.
- **Never pass user-supplied strings directly to shell commands** — no `exec`, no `spawn` with untrusted input.
- All environment variables must be validated at startup via `src/utils/env.ts` with Zod.

---

## Testing Rules

- **Must have tests** for: `problem-parser`, `query-generator`, `scorer`.
- Test coverage target: **80%** for `src/core/`.
- Tests use fixtures from `tests/fixtures/` — do not generate random inputs in tests.
- Tests must be deterministic — no `Date.now()`, no `Math.random()` without seeding.
- Run `npm test` before declaring a task complete.

---

## Documentation Rules

- When changing behavior in any `src/core/` module, update the relevant `docs/` file.
- When adding a new environment variable, add it to `.env.example` with a comment.
- When changing scoring weights, update `docs/SCORING_RULES.md` first, then the code.

---

## Forbidden Patterns

```typescript
// ❌ Never
console.log(apiKey)
const key = "sk-hardcoded-token"
exec(`git clone ${userInput}`)
const x: any = result

// ✅ Always
logger.debug('provider called', { provider: 'github' })
const key = env.GITHUB_TOKEN
const candidates = await githubSearch(query, env)
const x: unknown = result
```

---

## Definition of Done

A task is complete when:

1. `npm run typecheck` passes (zero TypeScript errors)
2. `npm test` passes (all tests green)
3. `npm run lint` passes
4. Relevant `docs/` files are updated if behavior changed
5. No new `any` types introduced
6. No API keys in any committed file
