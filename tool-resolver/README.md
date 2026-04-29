# Tool Resolver

A CLI tool that helps developers find existing tools, GitHub projects, issues, and workarounds to solve technical problems.

## Quick Start

```bash
npm install
cp .env.example .env
# Fill in your API keys in .env

npm run build
npm start -- "your problem description here"
```

## Usage

```bash
# Analyze an error log
tool-resolver solve "reasoning_content error with Claude Code + DeepSeek"

# Pipe in error output
cat error.log | tool-resolver solve --stdin

# Analyze a specific tech stack problem
tool-resolver solve --stack "Node.js,Docker" "container networking issue"
```

## Development

```bash
npm install
npm run dev       # Watch mode
npm test          # Run tests
npm run lint      # Lint
npm run typecheck # TypeScript check
```

## Architecture

See `docs/ARCHITECTURE.md` for full design.

## Docs

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Search Strategy](docs/SEARCH_STRATEGY.md)
- [Scoring Rules](docs/SCORING_RULES.md)
- [Safety Rules](docs/SAFETY_RULES.md)
- [Claude Code Rules](docs/CLAUDE_CODE_RULES.md)
