# Long-Term Memory

## Identity

Fixseek is a solution-discovery tool for developers and coding agents. Its
value is evidence, fit, and risk visibility, not generic chat.

## Durable Decisions

- CLI and local Web Guide are equal interfaces over one discovery core.
- DiscoveryResult, not terminal text, is the source of truth.
- Mock mode is deterministic; real providers are optional and fail visibly.
- Evidence, score explanations, warnings, and validation survive exports.
- LLMs may summarize sourced evidence later but never control search, scoring,
  safety classification, or execution.

## Safety Contract

- No automatic installation, cloning, execution, or code changes from results.
- No credential leakage to browser, output, logs, or exports.
- Never conceal archive, license, suspicious-install, or secret-transmission risk.

## Architecture Decisions

- Core owns deterministic discovery behavior.
- Providers own external I/O; discovery-searchers selects mock or real mode.
- Fastify is a local credential boundary, not a multi-user backend.
- React state is ephemeral; persistence and accounts are deferred.
- Canonical URL grouping is intentionally conservative.

## Documentation Policy

- Keep stable specs, operational docs, current handoff, and this memory only.
- Do not retain dated task plans or brainstorming transcripts in docs.
- Update this file only for durable product or architecture decisions.

## Known Constraints

- A versioned real-query benchmark and initial reviewed baseline exist under
  `benchmarks/`; ordinary tests remain offline and baseline replacement is
  explicit.
- Web evidence is provider metadata/snippets, not full-page extraction.
- Web search implementation currently supports Brave only, even though
  environment parsing still accepts `serpapi`.
- ESLint configuration is missing.
- No persistence, private sources, accounts, or team workflow.
