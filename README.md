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

Mock mode is the default and does not require an API key.

## Usage

```bash
# Direct query
fixseek "reasoning_content error with Claude Code + DeepSeek"

# Read a log from stdin
cat error.log | fixseek --stdin

# Real search (requires GITHUB_TOKEN)
fixseek --real "vite module not found"

# Chinese output
fixseek --lang zh "reasoning_content 报错"

# Limit results
fixseek --max-results 5 "npm package ESM CommonJS error"
```

Supported providers are `github`, `web`, and `npm`. Real GitHub mode requires
`GITHUB_TOKEN`; mock mode does not.

### Advanced Options

```bash
# Compatibility subcommand
fixseek solve "npm package ESM CommonJS error"

# Add stack context
fixseek --stack "Node.js,Docker" "container networking issue"

# Limit to a specific provider
fixseek --real --provider github "vite module not found"

# Force mock mode or adjust log level
fixseek --mock "dependency resolution error"
fixseek --log-level debug "dependency resolution error"
```

## Examples

```bash
fixseek "TypeError fetch failed Node.js proxy"

fixseek "vite module not found after pnpm install"

cat ./error.log | fixseek --stdin --max-results 5

fixseek --real "Docker host.docker.internal connection refused"

fixseek --lang zh "ESM CommonJS interop 包报错"
```

## Configuration

Copy `.env.example` to `.env` when you want real providers.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub token for `--real --provider github`. Not needed in mock mode. |
| `WEB_SEARCH_PROVIDER` | Optional web search provider: `brave` or `serpapi`. |
| `WEB_SEARCH_API_KEY` | API key for the configured web search provider. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error`. Default: `warn`. |
| `MAX_RESULTS_PER_PROVIDER` | Max results requested per provider. Default: `10`. |
| `REQUEST_TIMEOUT_MS` | Request timeout in milliseconds. Default: `10000`. |

Do not commit `.env` or real tokens.

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
provider credentials outside the browser. Web sessions are not persisted. Mock
mode is deterministic and needs no credentials; real mode uses the environment
variables listed above.

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
