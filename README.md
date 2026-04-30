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

## Project Structure / 目录结构

```
existing-solution-finder/
├── .env.example
├── .gitignore
├── README.md
├── jest.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CLAUDE_CODE_RULES.md
│   ├── PRODUCT_SPEC.md
│   ├── SAFETY_RULES.md
│   ├── SCORING_RULES.md
│   └── SEARCH_STRATEGY.md
├── src/
│   ├── cli/
│   │   └── index.ts
│   ├── core/
│   │   ├── problem-parser.ts
│   │   ├── query-generator.ts
│   │   ├── ranker.ts
│   │   ├── scorer.ts
│   │   └── summarizer.ts
│   ├── providers/
│   │   ├── github-search.ts
│   │   ├── mock-provider.ts
│   │   ├── package-search.ts
│   │   └── web-search.ts
│   ├── types/
│   │   ├── candidate.ts
│   │   ├── problem.ts
│   │   └── score.ts
│   └── utils/
│       ├── env.ts
│       ├── logger.ts
│       └── text.ts
└── tests/
    ├── fixtures/
    │   ├── claude-deepseek-error.txt
    │   ├── docker-network-error.txt
    │   └── npm-build-error.txt
    ├── problem-parser.test.ts
    ├── query-generator.test.ts
    └── scorer.test.ts
```

## Docs

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Search Strategy](docs/SEARCH_STRATEGY.md)
- [Scoring Rules](docs/SCORING_RULES.md)
- [Safety Rules](docs/SAFETY_RULES.md)
- [Claude Code Rules](docs/CLAUDE_CODE_RULES.md)
