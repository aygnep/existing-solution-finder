# Existing Solution Finder

> **Find existing tools, GitHub projects, issues, and workarounds for your technical problems — instantly.**

A CLI tool that takes a raw error log or problem description and returns a **ranked, annotated list of existing solutions**: open-source tools, GitHub issues, config workarounds, and npm packages — scored by relevance, recency, and safety.

---

## ✨ Project Highlights

### 🏗️ Clean Pipeline Architecture
Five pure-function stages, each independently testable:
```
CLI Input → problem-parser → query-generator → provider → scorer → ranker → summarizer → Output
```
No hidden state. No globals. Every stage is a typed pure function you can unit-test in isolation.

### 🔍 Smart Problem Parsing
Extracts signal from noisy input — error tokens, stack names, version strings, constraints — using targeted regex patterns. Recognizes 25+ tech stack names out of the box (Claude Code, DeepSeek, OpenCode Go, Docker, Node.js, …).

```bash
$ npm start -- "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"

  Errors:  reasoning_content
  Stack:   Claude Code, DeepSeek, OpenCode Go
```

### 📊 Structured Scoring (0–100)
Every candidate is scored across 7 dimensions defined in [`docs/SCORING_RULES.md`](docs/SCORING_RULES.md):

| Dimension | Max | What it measures |
|-----------|-----|-----------------|
| Exact error match | 25 | Does the README/title mention your exact error? |
| Stack match | 20 | Does it support your tech stack? |
| README evidence | 15 | Is there a usage example relevant to your problem? |
| Recency | 10 | Last commit age |
| Installation clarity | 10 | Can you `npm install` it in one line? |
| Maintenance activity | 10 | Are issues being responded to? |
| Example config | 10 | Is there a usable config file? |

Penalties (archived repo, no license, suspicious install scripts) are applied transparently and displayed in output.

### 🏷️ Result Typing: tool / issue / workaround
Every result is classified automatically:

- 🔧 **Tool** — installable package or proxy
- 🐛 **Issue** — GitHub issue with a workaround in the thread
- 💡 **Workaround** — config change, env var, or API parameter

### 🛡️ Built-in Safety Warnings
Follows [`docs/SAFETY_RULES.md`](docs/SAFETY_RULES.md) — never silently hides risk:

```
⚠️  WARNING [NEW_PROJECT]: Created 2 months ago with only 0 stars. Not widely tested.
⚠️  WARNING [PENALTY]: No license file
🚫 Risky — Archived repository + Suspicious install script (curl|bash without checksum)
```

### ▶️ Actionable Next Steps
Each result includes a copy-pasteable next step:

```
▶  Next step: Run `go install github.com/luobogor/oc-go-cc@latest`, start the adapter
   with `oc-go-cc --port 8787 --upstream http://localhost:8080`, then point Claude Code
   to `http://localhost:8787`.
```

### 🧪 123 Tests, Zero Config
- Unit tests for parser, query generator, scorer, GitHub search utilities
- **End-to-end pipeline test** that validates the full flow including rank order
- Deterministic (no `Date.now()` without seeding)
- 94%+ statement coverage

```bash
npm test       # 123 tests, ~0.7s
```

### 🔌 Mock-First, Real-API-Ready
Ships with a rich mock provider (9 hand-crafted candidates) that exercises every score tier, trust level, and penalty condition — no API keys required to run or test. Real GitHub/web/npm providers are wired up and ready to activate.

**Mock mode** (default): Uses built-in candidates, no API calls, no keys needed.
**Real mode** (`--real`): Searches GitHub via Search API, fetches READMEs, extracts metadata. Requires `GITHUB_TOKEN`.

---

## Quick Start

```bash
npm install
npm run build

# Mock mode (default) — no API keys needed
npm start -- solve "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"

# Real mode — requires GITHUB_TOKEN
export GITHUB_TOKEN=your_token_here
npm start -- solve --real "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"

# Real mode — GitHub only
npm start -- solve --real --provider github "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"
```

**Example output (rank #1):**

```
  [1] oc-go-cc
      https://github.com/luobogor/oc-go-cc
      Type: 🔧 Tool  |  Score: 100/100  🟢 Strong Match  |  🔶 Unverified

      Why: Directly references the error; explicitly supports the tech stack;
           README contains relevant usage examples; clear install instructions available.

      Score breakdown:
        Error match: 25/25  Stack: 20/20  README: 15/15
        Recency: 10/10  Install: 10/10  Activity: 10/10  Config: 10/10

      ▶  Next step: Run `go install github.com/luobogor/oc-go-cc@latest` ...
```

---

## Development

```bash
npm install
npm run build      # TypeScript compile
npm run dev        # Watch mode
npm test           # Run all tests (123)
npm run typecheck  # Zero-error TypeScript check
npm run lint       # ESLint
```

## Architecture

```
src/
├── cli/index.ts          # Entry point, pipeline orchestration
├── core/
│   ├── problem-parser.ts # Pure: string → ParsedProblem
│   ├── query-generator.ts# Pure: ParsedProblem → Query[]
│   ├── scorer.ts         # Pure: RawCandidate × ParsedProblem → Score
│   ├── ranker.ts         # Pure: ScoredCandidate[] → RankedCandidate[]
│   └── summarizer.ts     # Pure: RankedCandidate[] → string
├── providers/
│   ├── mock-provider.ts  # Built-in mock (no API keys needed)
│   ├── github-search.ts  # GitHub Search API + README fetch + metadata extraction
│   ├── web-search.ts     # Brave/SerpAPI (optional)
│   └── package-search.ts # npm registry (no auth)
├── types/                # candidate.ts | problem.ts | score.ts
└── utils/                # env.ts | logger.ts | text.ts

tests/
├── problem-parser.test.ts
├── query-generator.test.ts
├── scorer.test.ts
├── github-search.test.ts  # Query sanitizer, dedup, README metadata extraction
└── pipeline.e2e.test.ts   # Full end-to-end pipeline test
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Docs

- [Product Spec](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Search Strategy](docs/SEARCH_STRATEGY.md)
- [Scoring Rules](docs/SCORING_RULES.md)
- [Safety Rules](docs/SAFETY_RULES.md)
- [Claude Code Rules](docs/CLAUDE_CODE_RULES.md)

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Done | Project scaffold, types, core modules |
| Phase 2 | ✅ Done | End-to-end mock MVP, 96 tests, full output format |
| Phase 3 | ✅ Done | Real GitHub Search API + README fetch + metadata extraction |
| Phase 4 | 🔜 Later | Semantic scoring via embeddings |
| Phase 5 | 🔜 Later | Web UI |

## License

MIT
