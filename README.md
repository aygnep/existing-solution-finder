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
# Direct query, recommended
fixseek "reasoning_content error with Claude Code + DeepSeek"

# Read a log from stdin
cat error.log | fixseek --stdin

# Compatibility subcommand
fixseek solve "npm package ESM CommonJS error"

# Limit results
fixseek --max-results 5 "vite module not found"

# Add stack context
fixseek --stack "Node.js,Docker" "container networking issue"

# Chinese or English output labels
fixseek --lang zh "Claude Code + DeepSeek reasoning_content 报错"
fixseek --lang en "reasoning_content error with Claude Code"

# Quiet or verbose logs
fixseek --log-level warn "dependency resolution error"
fixseek --log-level debug "dependency resolution error"

# Real GitHub search
fixseek --real --provider github "vite module not found"
```

Supported providers are `github`, `web`, and `npm`. Real GitHub mode requires
`GITHUB_TOKEN`; mock mode does not.

## Examples

```bash
fixseek "TypeError fetch failed Node.js proxy"

fixseek "vite module not found after pnpm install"

fixseek --stack "React,Vite,TypeScript" "Cannot find module vite/client"

fixseek --provider npm "ESM CommonJS interop package error"

fixseek --real --provider github "Docker host.docker.internal connection refused"

cat ./error.log | fixseek --stdin --max-results 5
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
