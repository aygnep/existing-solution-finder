# Fixseek

Find existing fixes, tools, GitHub issues, packages, and workarounds before you build from scratch.

[中文文档](./README.zh-CN.md)

## Why Fixseek?

When developers hit an error, integration problem, CLI failure, dependency issue,
or tooling gap, the first instinct is often to ask AI or debug from zero.
Fixseek takes a different first step: search for signs that someone has already
solved it.

It turns an error log or problem description into ranked candidates: existing
GitHub projects, GitHub issues, npm packages, workarounds, docs, and related
tools. You still review the result; Fixseek helps you avoid missing the obvious
existing fix before you build one yourself.

## Installation

```bash
npm install -g fixseek
```

## Quick Start

```bash
fixseek "Claude Code DeepSeek reasoning_content error"

cat error.log | fixseek --stdin

fixseek --stack "Node.js,Docker" "container networking issue"
```

CLI searches real providers by default. npm needs only outbound network access;
GitHub and web are used when their credentials are configured. `--mock` is only
for deterministic tests and demos.

When the calling environment cannot reach the host VPN/TUN network, run the
host-only gateway described in
[`docs/FIXSEEK_HOST_GATEWAY.md`](docs/FIXSEEK_HOST_GATEWAY.md). The first real
search must request user authorization before starting the loopback listener;
later searches may reuse a healthy gateway in the same session.

## Usage

```bash
# Direct query
fixseek "reasoning_content error with Claude Code + DeepSeek"

# Read a log from stdin
cat error.log | fixseek --stdin

# Real search across configured providers (the default)
fixseek "vite module not found"

# Real npm search (no token required; network access is required)
fixseek --provider npm "ESM CommonJS package error"

# Real GitHub search (requires GITHUB_TOKEN)
fixseek --provider github "vite module not found"

# Real web search (requires WEB_SEARCH_API_KEY)
fixseek --provider web "vite module not found"

# Stable machine-readable output for coding agents
fixseek --json --stack "Vite,Node.js" \
  --constraints "no dependency upgrade" "vite module not found"

# Chinese output
fixseek --lang zh "reasoning_content 报错"

# Limit results
fixseek --max-results 5 "npm package ESM CommonJS error"
```

Supported providers are `github`, `web`, and `npm`. GitHub searches require
`GITHUB_TOKEN`, web searches require `WEB_SEARCH_API_KEY`, and npm searches do
not require a token. The default mode attempts every provider and preserves
each provider's `complete`, `empty`, `skipped`, or `failed` state. `--real`
remains accepted as an explicit compatibility flag.

### Advanced Options

```bash
# Compatibility subcommand
fixseek solve "npm package ESM CommonJS error"

# Add stack context
fixseek --stack "Node.js,Docker" "container networking issue"

# Add constraints or a structured agent context file
fixseek --constraints "open source,no cloud" "container networking issue"
fixseek --json --context-file ./fixseek-context.json

# Limit to a specific provider
fixseek --provider github "vite module not found"

# Explicit test/demo mode or adjusted log level
fixseek --mock "dependency resolution error"
fixseek --log-level debug "dependency resolution error"
```

## Examples

```bash
fixseek "TypeError fetch failed Node.js proxy"

fixseek "vite module not found after pnpm install"

cat ./error.log | fixseek --stdin --max-results 5

fixseek "Docker host.docker.internal connection refused"

fixseek --lang zh "ESM CommonJS interop 包报错"
```

## Configuration

Copy `.env.example` to `.env` to configure authenticated providers. Fixseek
loads the first available values from the current directory's `.env` and then
`~/.config/fixseek/.env`. Set `FIXSEEK_ENV_FILE` to use one explicit file.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub token for `--provider github`. Not needed in mock mode. |
| `WEB_SEARCH_PROVIDER` | Optional web search provider: `brave` or `serpapi`; defaults to `brave`. |
| `WEB_SEARCH_API_KEY` | API key for the configured web search provider. |
| `FIXSEEK_ENV_FILE` | Optional explicit environment-file path. |
| `FIXSEEK_OUTCOME_FILE` | Optional outcome JSONL path; defaults to `~/.config/fixseek/outcomes.jsonl`. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error`. Default: `warn`. |
| `MAX_RESULTS_PER_PROVIDER` | Max results requested per provider. Default: `10`. |
| `REQUEST_TIMEOUT_MS` | Request timeout in milliseconds. Default: `10000`. |

Do not commit `.env` or real tokens.

## Coding-Agent Workflow

Use `fixseek --json` before implementing an unfamiliar fix. Check every
provider state, verify at least two independent sources when available, and
treat scores as retrieval signals rather than proof. The calling agent should
infer the root cause, propose an isolated validation and rollback, and obtain
user approval before executing result-derived commands or modifying code.

### Agent Skill Usage

In an agent environment where the Fixseek skill is installed, invoke it with a
normal request such as:

> Use Fixseek to investigate this Vite module-resolution error before changing
> the project.

The skill is the orchestration and safety layer: it collects the error, stack,
versions, constraints, and attempted fixes; runs `fixseek --json`; checks every
provider state; verifies source evidence; and reports a proposed validation and
rollback. The Fixseek CLI remains the execution layer that performs the actual
search. If the skill is not installed, an agent can follow the same workflow by
calling the CLI directly.

The "agent-skill draft" downloadable from the Web Solution Guide packages
selected search results for follow-up work. It is not the installed Fixseek
integration skill itself.

After validation, record the observed result:

```bash
fixseek feedback \
  --problem "vite module not found after pnpm install" \
  --candidate-url "https://github.com/example/project/issues/123" \
  --outcome useful \
  --notes "Confirmed in an isolated reproduction" \
  --json
```

Outcomes are `useful`, `not-useful`, or `unsafe`. If validation fails, add the
attempted fix and new error to a context file and search again. See
[`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md).

## What Fixseek Does Not Do

- It does not automatically install tools.
- It does not automatically clone repositories.
- It does not execute unknown scripts or search-result commands.
- It does not guarantee that a result is correct or safe.
- It does not replace human review.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

### Real quality benchmark

With `GITHUB_TOKEN` and optional web-search credentials in `.env`, run:

```bash
npm run benchmark:real
```

The command calls real providers and prints a redacted JSON evaluation report.
It exits with `2` for an evaluated quality regression and `3` when a required
provider is unavailable, skipped, rate-limited, or fails. It never changes the
approved snapshot.

After reviewing a current report and intentionally accepting it, update the
tracked baseline:

```bash
npm run benchmark:update
```

Never use the update command to hide a regression; inspect and commit the
snapshot diff only after human review.

### Web Solution Guide (local preview)

The no-account Web Solution Guide turns one technical problem into a visible
search plan, evidence-backed candidates, safety warnings, and downloadable
Markdown report or agent-skill draft.

```bash
npm install
npm run build
npm run web:dev
```

Open <http://127.0.0.1:5173>. The local gateway listens on port 4174 and keeps
provider credentials outside the browser. Web sessions are not persisted. The
workbench defaults to real mode and keeps each provider's complete, empty,
skipped, or failed state visible. The Chinese / EN selector immediately changes
system-generated candidate explanations, warnings, validation steps, and
exports; evidence stays in its original source language.

The GitHub repository is currently:
[aygnep/existing-solution-finder](https://github.com/aygnep/existing-solution-finder).
The product name is Fixseek; the repository may be renamed later.

## Publishing

Publishing is manual. Do not run `npm publish` unless you intend to publish a
new package version.

```bash
npm run prepublishOnly
npm publish --dry-run
npm publish
```

## License

MIT
