# Real Quality Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a credential-safe, real-provider benchmark that measures Fixseek discovery quality against human-reviewed cases and baseline snapshots.

**Architecture:** A new `src/benchmark/` layer reads versioned cases, invokes the existing `createDiscoverySearchers('real')` and `discoverSolutions` pipeline, and converts results to redacted evaluation records. Pure evaluator functions compare those records to an approved snapshot; a dedicated executable renders JSON or a short summary and only writes a baseline when explicitly asked.

**Tech Stack:** TypeScript, Node.js, Jest with ts-jest, existing Fixseek discovery core and providers.

---

## File Structure

- Create: `src/benchmark/types.ts` — benchmark case, report, check, baseline, and result contracts.
- Create: `src/benchmark/evaluator.ts` — pure case validation, result reduction, comparison, and summary functions.
- Create: `src/benchmark/index.ts` — real-mode command parsing, JSON data loading, discovery invocation, rendering, and explicit baseline update.
- Create: `benchmarks/cases.json` — reviewed real-query cases; contains no credentials.
- Create: `tests/benchmark-evaluator.test.ts` — deterministic evaluator coverage using in-memory `DiscoveryResult` fixtures.
- Create: `tests/benchmark-command.test.ts` — command behavior using injected discovery and filesystem adapters.
- Modify: `package.json` — explicit benchmark scripts.
- Modify: `.gitignore` — ignore optional generated benchmark reports, but not benchmark cases or baseline snapshots.
- Modify: `README.md` — document the command, credentials, baseline review, and exit behavior.
- Modify: `docs/ROADMAP.md`, `docs/AGENT_HANDOFF.md`, `docs/LONG_TERM_MEMORY.md` — record the benchmark once implemented and verified.

### Task 1: Define benchmark contracts and the first reviewed case set

**Files:**
- Create: `src/benchmark/types.ts`
- Create: `benchmarks/cases.json`
- Test: `tests/benchmark-evaluator.test.ts`

- [ ] **Step 1: Write the failing parser-validation test**

```ts
import { parseBenchmarkCases } from '../src/benchmark/evaluator';

describe('parseBenchmarkCases', () => {
  it('rejects a case without an approved candidate matcher', () => {
    expect(() => parseBenchmarkCases([{
      id: 'missing-matcher',
      problem: 'vite module not found',
      stack: [],
      constraints: [],
      providers: ['github'],
      maxResults: 5,
      topN: 3,
      requiredProviders: ['github'],
      approvedCandidates: [],
    }])).toThrow('must define at least one approved candidate matcher');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: FAIL because `../src/benchmark/evaluator` does not exist.

- [ ] **Step 3: Define the benchmark types and minimal validation**

```ts
// src/benchmark/types.ts
import type { Provider } from '../types/candidate.js';

export interface ApprovedCandidateMatcher {
  readonly url?: string;
  readonly name?: string;
}

export interface BenchmarkCase {
  readonly id: string;
  readonly problem: string;
  readonly stack: readonly string[];
  readonly constraints: readonly string[];
  readonly providers: readonly Provider[];
  readonly maxResults: number;
  readonly topN: number;
  readonly requiredProviders: readonly Provider[];
  readonly approvedCandidates: readonly ApprovedCandidateMatcher[];
}
```

```ts
// src/benchmark/evaluator.ts
import type { BenchmarkCase } from './types.js';

export function parseBenchmarkCases(input: readonly BenchmarkCase[]): readonly BenchmarkCase[] {
  for (const benchmarkCase of input) {
    if (benchmarkCase.approvedCandidates.length === 0) {
      throw new Error(`Benchmark case "${benchmarkCase.id}" must define at least one approved candidate matcher.`);
    }
  }
  return input;
}
```

- [ ] **Step 4: Add reviewed, non-sensitive JSON cases**

```json
[
  {
    "id": "deepseek-reasoning-content",
    "problem": "reasoning_content error Claude Code DeepSeek",
    "stack": ["Claude Code", "DeepSeek"],
    "constraints": ["local proxy only"],
    "providers": ["github", "web"],
    "maxResults": 10,
    "topN": 5,
    "requiredProviders": ["github"],
    "approvedCandidates": [{ "url": "https://github.com/Whale-Dolphin/deepseek-reasoning-proxy" }]
  },
  {
    "id": "deepseek-opencode-bridge",
    "problem": "DeepSeek V4 OpenCode Go Claude Code compatibility bridge",
    "stack": ["Claude Code", "OpenCode Go", "DeepSeek"],
    "constraints": ["Anthropic-compatible client"],
    "providers": ["github", "web"],
    "maxResults": 10,
    "topN": 5,
    "requiredProviders": ["github"],
    "approvedCandidates": [{ "url": "https://github.com/superheroYu/deepseek-v4-opencode-claude-code-bridge" }]
  },
  {
    "id": "esm-commonjs-vite",
    "problem": "Vite package ESM CommonJS interop during SSR",
    "stack": ["Vite", "Node.js"],
    "constraints": ["package solution"],
    "providers": ["github", "npm"],
    "maxResults": 10,
    "topN": 5,
    "requiredProviders": ["npm"],
    "approvedCandidates": [{ "name": "vite-plugin-cjs-interop" }]
  },
  {
    "id": "textlint-module-interop",
    "problem": "ECMAScript module interop library package",
    "stack": ["Node.js"],
    "constraints": ["published npm package"],
    "providers": ["npm"],
    "maxResults": 10,
    "topN": 5,
    "requiredProviders": ["npm"],
    "approvedCandidates": [{ "name": "@textlint/module-interop" }]
  },
  {
    "id": "vite-plugin-resolution",
    "problem": "vite module not found after pnpm install",
    "stack": ["Vite", "pnpm"],
    "constraints": ["prefer package documentation"],
    "providers": ["github", "npm"],
    "maxResults": 10,
    "topN": 5,
    "requiredProviders": ["github", "npm"],
    "approvedCandidates": [{ "url": "https://github.com/adesege/vite-plugin-laravel-i18next" }]
  }
]
```

The listed matchers come from the real-provider reconnaissance run on 2026-07-12. During Task 5, a maintainer reviews the resulting candidates and may replace a matcher only with another concrete URL or package name observed in that run; every replacement is reviewed as part of the tracked `benchmarks/cases.json` diff.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: PASS with the parser validation test green.

- [ ] **Step 6: Commit the contracts and case data**

```bash
git add src/benchmark/types.ts src/benchmark/evaluator.ts benchmarks/cases.json tests/benchmark-evaluator.test.ts
git commit -m "feat: define real quality benchmark cases"
```

### Task 2: Reduce discovery results into redacted, comparable evaluation records

**Files:**
- Modify: `src/benchmark/types.ts`
- Modify: `src/benchmark/evaluator.ts`
- Modify: `tests/benchmark-evaluator.test.ts`

- [ ] **Step 1: Write failing tests for relevance, safety visibility, and redaction**

```ts
import { evaluateCase } from '../src/benchmark/evaluator';

it('passes relevance when an approved name occurs in the top candidates', () => {
  const report = evaluateCase(benchmarkCase, discoveryResult);
  expect(report.relevance.passed).toBe(true);
});

it('redacts credential-shaped text from provider failures', () => {
  const report = evaluateCase(benchmarkCase, failedDiscoveryResult);
  expect(report.providers[0]?.message).toBe('token [REDACTED]');
});

it('fails visible safety when a risky candidate has no warning', () => {
  const report = evaluateCase(benchmarkCase, unsafeDiscoveryResult);
  expect(report.safety.passed).toBe(false);
});
```

Construct the fixture `DiscoveryResult` values in the test using `SolutionCandidate` objects with a candidate URL, name, score warnings, and provider status. Use a `message: 'token ghp_exampleToken' ` provider failure to exercise redaction.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: FAIL because `evaluateCase` does not exist.

- [ ] **Step 3: Add report types and minimal evaluator implementation**

```ts
import type { Provider } from '../types/candidate.js';
import type { DiscoveryResult, ProviderState } from '../types/discovery.js';
import type { TrustLevel } from '../types/score.js';

export type BenchmarkOutcome = 'passed' | 'regressed' | 'inconclusive';

export interface BenchmarkProviderRecord {
  readonly provider: Provider;
  readonly state: ProviderState;
  readonly resultCount: number;
  readonly message?: string;
}

export interface BenchmarkCandidateRecord {
  readonly url: string;
  readonly name: string;
  readonly provider: Provider;
  readonly score: number;
  readonly trustLevel: TrustLevel;
  readonly penaltyCount: number;
  readonly warningCategories: readonly string[];
}

export interface BenchmarkCaseReport {
  readonly id: string;
  readonly requiredProviders: readonly Provider[];
  readonly relevance: { readonly passed: boolean };
  readonly safety: { readonly passed: boolean };
  readonly outcome: BenchmarkOutcome;
  readonly elapsedMs: number;
  readonly providers: readonly BenchmarkProviderRecord[];
  readonly candidates: readonly BenchmarkCandidateRecord[];
}
```

```ts
export function evaluateCase(
  benchmarkCase: BenchmarkCase,
  result: DiscoveryResult,
  elapsedMs: number,
): BenchmarkCaseReport {
  const candidates = result.candidates.map((candidate) => ({
    url: candidate.url,
    name: candidate.name,
    provider: candidate.provider,
    score: candidate.score.displayTotal,
    trustLevel: candidate.score.trustLevel,
    penaltyCount: candidate.score.penalties.length,
    warningCategories: candidate.score.warnings.map((warning) => warning.category),
  }));
  const topCandidates = candidates.slice(0, benchmarkCase.topN);
  const relevancePassed = benchmarkCase.approvedCandidates.some((matcher) =>
    topCandidates.some((candidate) =>
      (matcher.url !== undefined && candidate.url === matcher.url) ||
      (matcher.name !== undefined && candidate.name === matcher.name),
    ),
  );
  return {
    id: benchmarkCase.id,
    requiredProviders: benchmarkCase.requiredProviders,
    relevance: { passed: relevancePassed },
    safety: { passed: candidates.every((candidate) =>
      !hasRiskSignal(candidate) || candidate.warningCategories.length > 0,
    ) },
    outcome: determineCaseOutcome(benchmarkCase, result),
    elapsedMs,
    providers: result.providerStatus.map((status) => ({
      ...status,
      message: status.message === undefined ? undefined : redact(status.message),
    })),
    candidates,
  };
}

function hasRiskSignal(candidate: BenchmarkCandidateRecord): boolean {
  return candidate.trustLevel === 'BLOCKED' || candidate.penaltyCount > 0;
}

function determineCaseOutcome(
  benchmarkCase: BenchmarkCase,
  result: DiscoveryResult,
): BenchmarkOutcome {
  return benchmarkCase.requiredProviders.some((provider) => {
    const status = result.providerStatus.find((item) => item.provider === provider);
    return status?.state !== 'complete' || status.resultCount === 0;
  }) ? 'inconclusive' : 'passed';
}

function redact(value: string): string {
  return value
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
}
```

- [ ] **Step 4: Extend the tests for provider coverage, latency, and inconclusive state**

```ts
it('is inconclusive when a required provider is skipped', () => {
  const report = evaluateCase(benchmarkCase, skippedProviderResult);
  expect(report.outcome).toBe('inconclusive');
});

it('records elapsed milliseconds without adding it to the discovery contract', () => {
  const report = evaluateCase(benchmarkCase, discoveryResult, 125);
  expect(report.elapsedMs).toBe(125);
});
```

- [ ] **Step 5: Run the evaluator test file to verify all cases pass**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: PASS with relevance, redaction, safety, provider, and timing tests green.

- [ ] **Step 6: Commit the evaluator**

```bash
git add src/benchmark/types.ts src/benchmark/evaluator.ts tests/benchmark-evaluator.test.ts
git commit -m "feat: evaluate real discovery benchmark results"
```

### Task 3: Compare reports with the approved baseline

**Files:**
- Modify: `src/benchmark/types.ts`
- Modify: `src/benchmark/evaluator.ts`
- Modify: `tests/benchmark-evaluator.test.ts`

- [ ] **Step 1: Write failing comparison tests**

```ts
import { compareWithBaseline } from '../src/benchmark/evaluator';

it('reports regression when a baseline relevance pass becomes a failure', () => {
  expect(compareWithBaseline(currentFailure, approvedBaseline).outcome).toBe('regressed');
});

it('reports an inconclusive run separately from a regression', () => {
  expect(compareWithBaseline(currentInconclusive, approvedBaseline).outcome).toBe('inconclusive');
});

it('does not fail when a run finds an additional candidate', () => {
  expect(compareWithBaseline(currentImprovement, approvedBaseline).outcome).toBe('passed');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: FAIL because `compareWithBaseline` does not exist.

- [ ] **Step 3: Implement baseline comparison**

```ts
export interface BenchmarkRunReport {
  readonly cases: readonly BenchmarkCaseReport[];
}

export interface BenchmarkComparison {
  readonly outcome: BenchmarkOutcome;
  readonly reasons: readonly string[];
}

export function compareWithBaseline(
  current: BenchmarkRunReport,
  baseline: BenchmarkRunReport,
): BenchmarkComparison {
  if (current.cases.some((item) => item.outcome === 'inconclusive')) {
    return { outcome: 'inconclusive', reasons: ['At least one required provider did not complete.'] };
  }
  const reasons = baseline.cases.flatMap((previous) => {
    const next = current.cases.find((item) => item.id === previous.id);
    if (!next) return [`Missing benchmark case "${previous.id}".`];
    if (previous.relevance.passed && !next.relevance.passed) {
      return [`Relevance regressed for "${previous.id}".`];
    }
    if (previous.safety.passed && !next.safety.passed) {
      return [`Safety visibility regressed for "${previous.id}".`];
    }
    const lostRequiredProvider = previous.requiredProviders.some((provider) => {
      const status = previous.providers.find((item) => item.provider === provider);
      if (!status || status.state !== 'complete' || status.resultCount === 0) return false;
      const nextStatus = next.providers.find((item) => item.provider === provider);
      return nextStatus?.state !== 'complete' || nextStatus.resultCount === 0;
    });
    return lostRequiredProvider
      ? [`Required provider coverage regressed for "${previous.id}".`]
      : [];
  });
  return reasons.length > 0
    ? { outcome: 'regressed', reasons }
    : { outcome: 'passed', reasons: [] };
}
```

- [ ] **Step 4: Run the focused comparison tests**

Run: `npm test -- --selectProjects node tests/benchmark-evaluator.test.ts`

Expected: PASS with all comparison cases green.

- [ ] **Step 5: Commit the baseline comparison**

```bash
git add src/benchmark/types.ts src/benchmark/evaluator.ts tests/benchmark-evaluator.test.ts
git commit -m "feat: compare discovery quality with baseline"
```

### Task 4: Add the explicit real-provider executable and safe baseline updates

**Files:**
- Create: `src/benchmark/index.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/benchmark-command.test.ts`

- [ ] **Step 1: Write failing command tests with dependency injection**

```ts
import { runBenchmark } from '../src/benchmark';

it('uses real searchers and returns an inconclusive exit code when credentials are unavailable', async () => {
  const exitCode = await runBenchmark([], io, dependenciesWithSkippedGitHub);
  expect(exitCode).toBe(3);
  expect(io.stderr.toString()).toContain('inconclusive');
});

it('does not write a baseline without --update-baseline', async () => {
  await runBenchmark([], io, passingDependencies);
  expect(fileStore.write).not.toHaveBeenCalled();
});

it('writes the redacted report only with --update-baseline', async () => {
  await runBenchmark(['--update-baseline'], io, passingDependencies);
  expect(fileStore.write).toHaveBeenCalledWith('benchmarks/baseline.json', expect.stringContaining('[REDACTED]'));
});
```

- [ ] **Step 2: Run the command test to verify it fails**

Run: `npm test -- --selectProjects node tests/benchmark-command.test.ts`

Expected: FAIL because `../src/benchmark` does not exist.

- [ ] **Step 3: Implement command dependencies and explicit flags**

```ts
export interface BenchmarkDependencies {
  readonly readFile: (path: string) => Promise<string>;
  readonly writeFile: (path: string, contents: string) => Promise<void>;
  readonly createSearchers: () => Promise<DiscoverySearchers>;
  readonly discover: typeof discoverSolutions;
  readonly now: () => Date;
}

export async function runBenchmark(
  args: readonly string[],
  io: Pick<CliIo, 'stdout' | 'stderr'>,
  dependencies: BenchmarkDependencies = defaultDependencies(),
): Promise<number> {
  const updateBaseline = args.includes('--update-baseline');
  const cases = parseBenchmarkCases(JSON.parse(await dependencies.readFile('benchmarks/cases.json')));
  const report = await evaluateRun(cases, dependencies);
  if (updateBaseline) {
    await dependencies.writeFile('benchmarks/baseline.json', JSON.stringify(report, null, 2) + '\n');
  }
  io.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return report.outcome === 'passed' ? 0 : report.outcome === 'regressed' ? 2 : 3;
}
```

Use `createDiscoverySearchers('real')` in `defaultDependencies`. Reject unknown CLI flags with exit code 1. If `benchmarks/baseline.json` is absent and `--update-baseline` is not passed, emit a message that an explicit reviewed baseline initialization is required and return exit code 1. Before writing the baseline, serialize only the redacted run-report type; never serialize `DiscoveryResult` or provider request data.

- [ ] **Step 4: Add explicit scripts and generated-report ignore rule**

```json
{
  "scripts": {
    "benchmark:real": "npm run build:core && node dist/benchmark/index.js",
    "benchmark:update": "npm run build:core && node dist/benchmark/index.js --update-baseline"
  }
}
```

```gitignore
benchmark-reports/
```

Do not add `benchmarks/` to `.gitignore`; reviewed cases and `benchmarks/baseline.json` are tracked.

- [ ] **Step 5: Run the command tests to verify they pass**

Run: `npm test -- --selectProjects node tests/benchmark-command.test.ts`

Expected: PASS with explicit update and exit-code behavior green.

- [ ] **Step 6: Commit the executable**

```bash
git add src/benchmark/index.ts package.json .gitignore tests/benchmark-command.test.ts
git commit -m "feat: add real quality benchmark command"
```

### Task 5: Establish the reviewed baseline and document the operational workflow

**Files:**
- Create: `benchmarks/baseline.json`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/AGENT_HANDOFF.md`
- Modify: `docs/LONG_TERM_MEMORY.md`

- [ ] **Step 1: Write a failing documentation-presence test**

```ts
import { readFileSync } from 'node:fs';

it('documents the real benchmark command and explicit update operation', () => {
  const readme = readFileSync('README.md', 'utf8');
  expect(readme).toContain('npm run benchmark:real');
  expect(readme).toContain('npm run benchmark:update');
});
```

- [ ] **Step 2: Run the focused documentation test to verify it fails**

Run: `npm test -- --selectProjects node tests/benchmark-command.test.ts`

Expected: FAIL because the README does not mention the benchmark scripts.

- [ ] **Step 3: Run an explicit real benchmark for human review**

Run: `npm run benchmark:real`

Expected: Exit code 1 if no baseline exists; stdout contains the redacted current report and stderr explains that baseline initialization requires the explicit update command.

Review every approved matcher, provider status, warning category, and elapsed time in the report. If a matcher is not acceptable, replace it with a concrete URL or package name present in this report and repeat the command; the reviewed `benchmarks/cases.json` diff records that decision.

- [ ] **Step 4: Create the baseline only after approving the reviewed report**

Run: `npm run benchmark:update`

Expected: Exit code 0 and a new tracked `benchmarks/baseline.json` containing only case IDs, evaluation checks, redacted provider messages, candidate records, and timing values.

Run: `git diff -- benchmarks/baseline.json`

Expected: Every candidate, warning, and provider status in the snapshot is reviewable and contains no credential-shaped value.

- [ ] **Step 5: Document the operation**

Add this section to `README.md`:

```md
### Real quality benchmark

With `GITHUB_TOKEN` and optional web-search credentials in `.env`, run:

```bash
npm run benchmark:real
```

The command calls real providers and prints a redacted JSON evaluation report. It exits with `2` for an evaluated quality regression and `3` when a required provider is unavailable, skipped, rate-limited, or fails. It never changes the approved snapshot.

After reviewing a current report and intentionally accepting it, update the tracked baseline:

```bash
npm run benchmark:update
```

Never use the update command to hide a regression; inspect and commit the snapshot diff only after human review.
```

Update the roadmap and handoff to mark the benchmark complete and list bounded web evidence, Web controls, and ESLint configuration as the remaining short-term priorities. Update long-term memory to remove “No real-query quality benchmark yet” after the baseline exists.

- [ ] **Step 6: Run the documentation test to verify it passes**

Run: `npm test -- --selectProjects node tests/benchmark-command.test.ts`

Expected: PASS with the README assertions green.

- [ ] **Step 7: Run full verification**

Run: `npm test && npm run typecheck && npm run build && npx playwright test e2e/solution-guide.spec.ts`

Expected: All Jest projects, TypeScript type checking, core/Web build, and the existing browser flow pass. Do not run `npm run lint` as a passing release gate until the later ESLint task adds configuration.

- [ ] **Step 8: Commit the baseline and documentation**

```bash
git add benchmarks/baseline.json benchmarks/cases.json README.md docs/ROADMAP.md docs/AGENT_HANDOFF.md docs/LONG_TERM_MEMORY.md tests/benchmark-command.test.ts
git commit -m "docs: establish real quality benchmark workflow"
```
