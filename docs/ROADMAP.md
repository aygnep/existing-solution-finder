# Roadmap

## Purpose

This document is the project roadmap and agent handoff entry point for Fixseek.
It describes where the project is now, what should happen next, and which
existing documents are the source of truth for deeper details.

It does not replace:

- `docs/PRODUCT_SPEC.md` for product goals and non-goals.
- `docs/ARCHITECTURE.md` for pipeline and module responsibilities.
- `docs/SEARCH_STRATEGY.md` for query generation rules.
- `docs/SCORING_RULES.md` for ranking and score weights.
- `docs/SAFETY_RULES.md` for safety warnings and trust boundaries.

## Current State

Fixseek is a TypeScript CLI that helps developers search for existing fixes,
tools, GitHub projects, npm packages, issues, docs, and workarounds before
building from scratch.

The current implementation supports:

- CLI entry point with default direct query usage and compatibility `solve`
  subcommand.
- Mock mode by default, with deterministic built-in candidates for local tests.
- Real GitHub repository search with query sanitization, README fetching,
  metadata extraction, and cross-query deduplication.
- npm registry search for package candidates.
- Brave-based web search when `WEB_SEARCH_API_KEY` is configured.
- Parsing, query generation, scoring, ranking, and summarizing as separate core
  modules.
- English and Chinese output labels.
- npm package metadata and publishing checklist for manual 0.1 release work.

The product is past the original local mock MVP and close to a 0.1 CLI release
candidate. The next work should focus on real result quality, provider
reliability, and release confidence rather than adding a frontend or broad new
platform features.

## Short-Term Goals

The active implementation slice is agent-first global skill packaging: create a
`fixseek` global skill for coding agents, simplify CLI help for common usage,
and update docs for agent handoff. This runs alongside M2.5/M3 provider work.

### 1. Stabilize Real Provider Behavior

- Verify GitHub real mode with realistic queries and token-based API access.
- Add or improve tests around provider failure paths, empty results, malformed
  responses, and rate-limit-like responses.
- Keep provider failures non-fatal when another provider can still return useful
  candidates.
- Review whether GitHub README fetching should use authenticated API requests
  instead of raw GitHub URLs for better rate-limit consistency.

### 2. Add GitHub Issues Search

- Implement issue search as a distinct real-provider path, not only repository
  search heuristics.
- Preserve the existing candidate shape so scoring and ranking can compare
  issues with repos, packages, docs, and workarounds.
- Mark issue candidates with `candidateTypeHint: 'issue'` when the provider has
  direct evidence.
- Update `docs/ARCHITECTURE.md` and `docs/SEARCH_STRATEGY.md` when this behavior
  lands.

### 3. Improve Search Quality

- Tune query generation using real examples, especially exact error queries and
  stack compatibility queries.
- Avoid sending web-oriented `site:` syntax to APIs that do not need it.
- Add regression fixtures for known problems such as Claude Code, DeepSeek, and
  `reasoning_content`.
- Track whether each query category produces useful candidates before expanding
  provider count.

### 4. Improve Output Usefulness

- Keep CLI output compact enough for terminal use.
- Make warnings visible without overwhelming the candidate summary.
- Consider a `--json` output mode for automation only after human-readable
  output is stable.
- Ensure Chinese output remains aligned with English behavior when labels or
  sections change.

### 5. Prepare Manual npm Release

- Run the release checklist in `docs/NPM_PUBLISHING.md`.
- Confirm `npm run prepublishOnly` passes.
- Inspect `npm publish --dry-run` output before publishing.
- Keep publishing manual; do not add automation that runs `npm publish`.

### 6. Clean Up Documentation Entry Points

- Keep `README.md` and `README.zh-CN.md` focused on users.
- Keep `CLAUDE.md` as a short agent quick-start file.
- Keep `docs/CLAUDE_CODE_RULES.md` as the detailed coding rules source of truth.
- Migrate useful content from `milestone.txt` into this roadmap or remove the
  file if it is obsolete.

## Long-Term Goals

### LLM Summary Layer

Add an optional LLM summarization layer after deterministic search, scoring, and
ranking. The LLM should summarize evidence, explain trade-offs, and suggest next
steps. It must not control raw search, scoring, or safety classification.

### Result Quality Evaluation

Build a small regression set of real troubleshooting prompts and expected
candidate characteristics. Use it to compare query changes, provider changes,
and scoring changes before shipping them.

### More Provider Coverage

Expand provider support only when it improves result quality for real user
problems. Good candidates include direct GitHub Issues search, additional web
search backends, package registries beyond npm, and official documentation
search.

### Structured Output and Integrations

Add `--json` or similar structured output once the human CLI result format is
stable. This can support editor integrations, CI diagnostics, and future agent
tooling.

### Web UI

A web UI should wait until the CLI search pipeline is stable. If added, it should
visualize ranked candidates, warnings, and evidence rather than replace the CLI
as the core product.

## Agent Handoff Notes

### Start Here

Read these files before changing behavior:

1. `CLAUDE.md` for quick commands and local gotchas.
2. `docs/PRODUCT_SPEC.md` for product scope and non-goals.
3. `docs/ARCHITECTURE.md` for module boundaries.
4. `docs/SCORING_RULES.md` before touching `src/core/scorer.ts`.
5. `docs/SAFETY_RULES.md` before touching providers or output formatting.
6. `docs/CLAUDE_CODE_RULES.md` before making larger code changes.

### Key Code Paths

- `src/cli/index.ts`: CLI arguments, mode selection, provider orchestration.
- `src/core/problem-parser.ts`: input parsing.
- `src/core/query-generator.ts`: query categories and provider targeting.
- `src/providers/github-search.ts`: real GitHub repository search and README
  metadata extraction.
- `src/providers/package-search.ts`: npm registry search.
- `src/providers/web-search.ts`: Brave web search wrapper.
- `src/core/scorer.ts`: score and safety warning computation.
- `src/core/ranker.ts`: deduplication, ordering, candidate type, next steps.
- `src/core/summarizer.ts`: terminal output.

### Validation Commands

Use the narrowest useful command while developing, then run the full checks
before handing off a finished change:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

For release work:

```bash
npm run prepublishOnly
npm publish --dry-run
```

Do not run `npm publish` unless the maintainer explicitly intends to publish.

### Current Git Notes

- `CLAUDE.md` is present in the working tree as an untracked agent quick-start
  file.
- Do not modify `.env`; use `.env.example` for documented configuration.
- Ignore generated output such as `dist/`, `coverage/`, and local system files
  unless the task is specifically about packaging or repository hygiene.

### Guardrails

- Keep core modules pure when possible.
- Do not add a database, authentication, plugin system, or frontend for the
  current CLI-focused phase.
- Do not run downloaded code, clone unknown repositories automatically, or hide
  safety warnings.
- Update the relevant docs when behavior changes.

## Documentation Redundancy Assessment

The current `docs/` directory is not too large for the project. Most files have
separate roles:

- `PRODUCT_SPEC.md`: product intent, inputs, outputs, and non-goals.
- `ARCHITECTURE.md`: pipeline and module responsibility map.
- `SEARCH_STRATEGY.md`: query categories and provider mapping.
- `SCORING_RULES.md`: scoring weights, penalties, and tie-breaking.
- `SAFETY_RULES.md`: warnings, trust levels, and safety boundaries.
- `NPM_PUBLISHING.md`: manual release checklist.
- `CLAUDE_CODE_RULES.md`: detailed assistant coding rules.

The redundancy risk is in entry-point overlap rather than total document count:

- `README.md` and `README.zh-CN.md` should stay user-facing.
- `CLAUDE.md` should stay short and point agents to deeper docs.
- `docs/CLAUDE_CODE_RULES.md` should hold detailed rules, not repeat the full
  roadmap.
- `milestone.txt` is now stale relative to the implemented code. Its useful
  future milestones should live in this roadmap, and the old file should be
  removed or clearly marked obsolete.

The preferred doc model is stable specs plus one changing roadmap. Avoid adding
new docs unless a new file has a clearly different reader or lifecycle.
