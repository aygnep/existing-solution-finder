# Existing Solution Finder

Turn error logs and developer problems into existing solution candidates.

Existing Solution Finder is a local CLI that helps you turn a raw error log or
problem description into ranked candidates: tools, GitHub projects, issues, and
workarounds that may already solve the problem.

Language: **English** | [中文文档](README.zh-CN.md)

## What It Does

- Extracts useful keywords from error logs and problem descriptions.
- Generates search queries from error tokens, stack names, and constraints.
- Searches candidate tools, GitHub projects, issues, and workarounds.
- Scores and ranks candidates by fit, evidence, recency, and safety signals.
- Prints match reasons, risks, and recommended next steps.

## What It Does Not Do

- It does not automatically install tools.
- It does not automatically execute unknown code.
- It does not guarantee every result is correct.
- It does not replace human review.
- It does not automatically fix every error.

## Installation From Source

```bash
git clone <repo-url>
cd existing-solution-finder
npm install
npm run build
npm start -- solve "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"
```

## Mock Mode

Mock mode is the default. It uses built-in fixture candidates, does not call real
network APIs, and does not require an API key.

```bash
npm start -- solve "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"
```

## Real GitHub Mode

Real GitHub mode searches GitHub through the GitHub API. It requires
`GITHUB_TOKEN`.

```bash
cp .env.example .env
# Edit .env and set GITHUB_TOKEN.

npm start -- solve --real --provider github "reasoning_content error with Claude Code"
```

## CLI Examples

```bash
# Plain input
npm start -- solve "reasoning_content error with Claude Code"

# Read from stdin
printf '%s\n' "reasoning_content error with Claude Code" | npm start -- solve --stdin

# Limit result count
npm start -- solve --max-results 3 "Claude Code DeepSeek proxy"

# Chinese output labels
npm start -- solve --lang zh "Claude Code + DeepSeek reasoning_content 报错"

# English output labels
npm start -- solve --lang en "reasoning_content error with Claude Code"

# Change log level
npm start -- solve --log-level debug "Claude Code DeepSeek proxy"

# Real GitHub provider
npm start -- solve --real --provider github "reasoning_content error with Claude Code"
```

## Environment Variables

Copy `.env.example` to `.env` for local real-provider usage.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub Personal Access Token for `--real --provider github`. Not needed in mock mode. |
| `WEB_SEARCH_PROVIDER` | Optional web search provider, currently `brave` or `serpapi`. |
| `WEB_SEARCH_API_KEY` | Optional API key for the configured web search provider. |
| `LOG_LEVEL` | Log level: `debug`, `info`, `warn`, or `error`. Default: `info`. |
| `MAX_RESULTS_PER_PROVIDER` | Max results requested per provider. Default: `10`. |
| `REQUEST_TIMEOUT_MS` | Request timeout in milliseconds. Default: `10000`. |

Do not commit `.env` or any real token.

## npm Distribution

Ready for npm publish preparation, but not published yet. The current package
name is `tool-resolver`; before publishing, consider whether the npm name should
match the product/repository name, for example `existing-solution-finder` or
`@aygnep/existing-solution-finder`.

Future global install flow:

```bash
npm install -g <package-name>
tool-resolver solve "reasoning_content error with Claude Code"
```

See [docs/NPM_PUBLISHING.md](docs/NPM_PUBLISHING.md) for the pre-publish
checklist.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
npm run clean
```

## Safety Boundaries

Existing Solution Finder is designed to inform, not decide. It never
automatically runs commands from search results, clones repositories, installs
packages, or executes unknown scripts. Review every candidate and command before
using it.

## Docs

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Search Strategy](docs/SEARCH_STRATEGY.md)
- [Scoring Rules](docs/SCORING_RULES.md)
- [Safety Rules](docs/SAFETY_RULES.md)
- [Claude Code Rules](docs/CLAUDE_CODE_RULES.md)
- [npm Publishing](docs/NPM_PUBLISHING.md)

## Roadmap

- Better Chinese output
- GitHub Issues search
- npm / package registry search improvements
- Better evidence extraction
- More real-world fixtures

## License

MIT
