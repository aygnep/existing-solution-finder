# Product Spec

## Goal

Help developers find existing tools, GitHub projects, issues, and workarounds that can solve their current technical problem.

The core insight: most problems developers encounter have already been solved somewhere on GitHub, npm, or the internet. The bottleneck is *finding* those solutions quickly and evaluating whether they are safe and relevant. This tool automates that search and provides a ranked, annotated result set.

## Input

- **Error logs** — raw text from terminal, CI, or runtime
- **Natural language descriptions** — "I need a proxy that rewrites OpenAI API responses to strip reasoning_content fields"
- **Tech stack context** — e.g., `Node.js 20, Docker Compose, Claude Code, DeepSeek`
- **Constraints** — e.g., "must be open source", "no cloud dependency", "must work offline"

## Output

For each candidate result:

- **Name & link** — repository URL, npm package, or documentation page
- **Why it matches** — concise explanation of the relevance
- **Risk summary** — known issues, license concerns, maintenance status
- **Installation instructions** — copy-pasteable commands where available
- **Suggested next step** — e.g., "Read the README section on proxy configuration"

The full output is a ranked list of candidates, ordered by composite score (see `SCORING_RULES.md`).

## Non-Goals

- **Do not automatically install unknown tools.** Users must review and confirm before installation.
- **Do not run arbitrary code from GitHub.** No exec, no eval, no piping to bash without explicit user consent.
- **Do not expose API keys.** Keys must remain in `.env` and never appear in logs, output, or network requests to third-party services beyond their intended provider.
- **Do not claim a tool is safe without evidence.** Safety assessments are probabilistic and must be labeled as such.
- **Do not introduce a database in MVP.** Results are ephemeral; no persistence layer.
- **Do not add authentication in MVP.** This is a local CLI tool, not a multi-tenant service.
- **Do not build a frontend in MVP.** CLI output only until explicitly requested.

## Success Criteria (MVP)

1. Given a problem string, returns ≥ 3 relevant candidates within 15 seconds.
2. Each candidate has a score ≥ 0 and a one-sentence reason.
3. Safety warnings appear for archived repos, no-license projects, and suspicious install scripts.
4. No API keys appear in stdout, stderr, or log files.
5. All core modules (parser, query generator, scorer) have passing unit tests.
