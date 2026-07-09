# Fixseek Web Solution Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a no-account Web Solution Guide that reuses Fixseek to plan a search, compare sourced candidates, surface risks, and export a selected report or agent-skill draft.

**Architecture:** Extract CLI orchestration into a typed discovery service. A thin Fastify gateway validates browser requests and protects environment credentials; a Vite/React client keeps task state in memory. The core owns scoring, provenance, grouping, validation guidance, and export rendering.

**Tech Stack:** TypeScript 5, Node/Jest/Zod, Fastify 4, React 18, Vite 5, Testing Library, Playwright.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| src/types/discovery.ts | Request, provider status, provenance, grouped-candidate, and result types |
| src/core/discovery-service.ts | Shared parse → plan → search → score → group orchestration |
| src/core/solution-grouper.ts | Deterministic cross-source grouping |
| src/core/validation-guidance.ts | Safe read-only validation steps |
| src/exports/solution-report.ts | Markdown report and agent-skill generators |
| src/web/gateway.ts | Validated HTTP transport only |
| web/src/* | In-memory React task UI |
| tests/*, web/src/*.test.tsx, e2e/* | Core, UI, and browser coverage |

## Task 1: Add the typed discovery contract

**Files:**
- Create: src/types/discovery.ts
- Modify: src/types/candidate.ts
- Test: tests/discovery-contract.test.ts

- [ ] **Step 1: Write the failing request-normalization test.**

~~~
import { buildDiscoveryRequest } from '../src/types/discovery';

it('trims context and retains selected providers', () => {
  expect(buildDiscoveryRequest({
    problem: '  vite module not found ', stack: [' Node.js ', ''],
    constraints: ['open source'], providers: ['github', 'npm'],
    mode: 'mock', maxResults: 5,
  })).toEqual(expect.objectContaining({
    problem: 'vite module not found', stack: ['Node.js'], providers: ['github', 'npm'],
  }));
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: npx jest tests/discovery-contract.test.ts --runInBand

Expected: FAIL because src/types/discovery.ts does not exist.

- [ ] **Step 3: Implement the contract.**

~~~
import type { Provider, RawCandidate } from './candidate.js';
import type { ParsedProblem } from './problem.js';
import type { RankedCandidate } from './score.js';

export type DiscoveryMode = 'mock' | 'real';
export type ProviderState = 'pending' | 'complete' | 'empty' | 'skipped' | 'failed';
export interface DiscoveryRequest {
  readonly problem: string; readonly stack: readonly string[];
  readonly constraints: readonly string[]; readonly providers: readonly Provider[];
  readonly mode: DiscoveryMode; readonly maxResults: number;
}
export interface ProviderStatus {
  readonly provider: Provider; readonly state: ProviderState;
  readonly resultCount: number; readonly message?: string;
}
export interface EvidenceItem {
  readonly sourceUrl: string; readonly sourceKind: Provider; readonly title: string;
  readonly excerpt?: string; readonly retrievedAt: string;
}
export interface ValidationStep {
  readonly id: string; readonly instruction: string;
  readonly expectedObservation: string; readonly riskNote?: string;
}
export interface SolutionCandidate extends RankedCandidate {
  readonly solutionKey: string; readonly evidence: readonly EvidenceItem[];
  readonly relatedCandidates: readonly RawCandidate[];
  readonly validationSteps: readonly ValidationStep[];
}
export interface DiscoveryResult {
  readonly request: DiscoveryRequest; readonly parsedProblem: ParsedProblem;
  readonly searchPlan: readonly { query: string; category: string; providers: readonly Provider[] }[];
  readonly providerStatus: readonly ProviderStatus[];
  readonly candidates: readonly SolutionCandidate[]; readonly completedAt: string;
}
export function buildDiscoveryRequest(input: DiscoveryRequest): DiscoveryRequest {
  return {
    ...input, problem: input.problem.trim(),
    stack: input.stack.map((item) => item.trim()).filter(Boolean),
    constraints: input.constraints.map((item) => item.trim()).filter(Boolean),
  };
}
~~~

Add optional repositoryUrl?: string to CandidateMetadata; it is the canonical repository URL for package or issue candidates.

- [ ] **Step 4: Run the focused test and type check.**

Run: npx jest tests/discovery-contract.test.ts --runInBand && npm run typecheck

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add src/types/discovery.ts src/types/candidate.ts tests/discovery-contract.test.ts
git commit -m "feat: add discovery result contract"
~~~

## Task 2: Extract a provider-resilient discovery service

**Files:**
- Create: src/core/discovery-service.ts
- Modify: src/core/scorer.ts
- Modify: src/providers/github-search.ts
- Modify: src/providers/package-search.ts
- Test: tests/discovery-service.test.ts

- [ ] **Step 1: Write the failing partial-success test.**

~~~
import { discoverSolutions } from '../src/core/discovery-service';

it('keeps npm results when GitHub is rate limited', async () => {
  const result = await discoverSolutions({
    request: { problem: 'vite module not found', stack: [], constraints: [],
      providers: ['github', 'npm'], mode: 'real', maxResults: 5 },
    now: new Date('2026-07-10T00:00:00Z'),
    searchers: {
      github: async () => { throw new Error('rate limited'); },
      npm: async () => [npmCandidate], web: async () => [],
    },
  });
  expect(result.providerStatus).toEqual(expect.arrayContaining([
    expect.objectContaining({ provider: 'github', state: 'failed' }),
    expect.objectContaining({ provider: 'npm', state: 'complete', resultCount: 1 }),
  ]));
  expect(result.candidates).toHaveLength(1);
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: npx jest tests/discovery-service.test.ts --runInBand

Expected: FAIL because discoverSolutions does not exist.

- [ ] **Step 3: Implement injectable orchestration.**

Define DiscoverySearchers with one query executor per provider. discoverSolutions parses the request, generates queries, executes enabled providers independently, scores raw results, ranks them, and returns a completed ISO time. To keep this commit independently type-safe, initially convert every ranked item into a singleton SolutionCandidate: solutionKey is its normalized URL, evidence contains its own URL/name/README excerpt, relatedCandidates contains only itself, and validationSteps is empty. Task 3 replaces these singleton objects with grouped evidence and validation guidance.

Each searcher returns either RawCandidate[] or { raw: RawCandidate[]; state: 'skipped'; message: string }. This lets unconfigured GitHub or web credentials surface as skipped rather than looking like an empty search or aborting other providers. Add a test where GitHub returns { raw: [], state: 'skipped', message: 'GitHub token is not configured.' } and npm completes; the resulting statuses must contain skipped and complete.

~~~
const statuses = await Promise.all(request.providers.map(async (provider) => {
  try {
    const raw = await searchProvider(provider, queries, searchers);
    return { provider, state: raw.length ? 'complete' : 'empty', resultCount: raw.length, raw };
  } catch (error) {
    return { provider, state: 'failed', resultCount: 0, message: safeMessage(error), raw: [] };
  }
}));
const ranked = rankCandidates(
  statuses.flatMap((status) => status.raw).map((candidate) =>
    scoreAndAttach(candidate, parsedProblem, now.getTime())),
  { maxResults: request.maxResults },
);
~~~

Change scoreCandidate and scoreAndAttach to take optional nowMs = Date.now(), pass it into recency, maintenance, penalties, and warnings. safeMessage replaces configured GitHub and web-search key values with [REDACTED]. Provider mapping sets repositoryUrl: repository html_url; issue URL derived from GitHub repository_url; npm repository link when supplied.

- [ ] **Step 4: Run focused regressions.**

Run: npx jest tests/discovery-service.test.ts tests/scorer.test.ts tests/github-search.test.ts --runInBand

Expected: PASS; a provider failure does not erase other results.

- [ ] **Step 5: Commit.**

~~~
git add src/core/discovery-service.ts src/core/scorer.ts src/providers src/types/candidate.ts tests/discovery-service.test.ts tests/scorer.test.ts tests/github-search.test.ts
git commit -m "feat: add resilient discovery service"
~~~

## Task 3: Group provenance, add validation guidance, and export artifacts

**Files:**
- Create: src/core/solution-grouper.ts
- Create: src/core/validation-guidance.ts
- Create: src/exports/solution-report.ts
- Modify: src/core/discovery-service.ts
- Test: tests/solution-grouper.test.ts
- Test: tests/validation-guidance.test.ts
- Test: tests/solution-report.test.ts

- [ ] **Step 1: Write failing grouping, safety, and export tests.**

~~~
it('groups a repository and its issue by repository URL', () => {
  expect(groupSolutions([rankedRepo, rankedIssue])[0]!.evidence).toHaveLength(2);
});
it('does not tell users to install a blocked candidate', () => {
  expect(createValidationSteps(blockedCandidate).map((step) => step.instruction).join(' '))
    .not.toMatch(/npm install|go install|pip install/);
});
it('retains source URLs and warnings in the report', () => {
  const markdown = renderSolutionReport({ request, candidates: [blockedSolution] });
  expect(markdown).toContain(blockedSolution.evidence[0]!.sourceUrl);
  expect(markdown).toContain('BLOCKED');
});
~~~

- [ ] **Step 2: Run tests to verify they fail.**

Run: npx jest tests/solution-grouper.test.ts tests/validation-guidance.test.ts tests/solution-report.test.ts --runInBand

Expected: FAIL because these modules do not exist.

- [ ] **Step 3: Implement deterministic grouping and safe outputs.**

groupSolutions normalizes metadata.repositoryUrl ?? url by lowercasing and removing trailing slash and .git. It may group only identical normalized keys; no fuzzy or LLM grouping. The highest-ranked member supplies group-card fields; all members create evidence in rank order.

~~~
if (candidate.score.trustLevel === 'BLOCKED') return [{
  id: 'review-risk',
  instruction: 'Read the linked source and displayed warnings before considering this candidate.',
  expectedObservation: 'You can identify the archived, script, or secret-transmission risk.',
  riskNote: 'This candidate is blocked by Fixseek safety rules; do not run its installation command.',
}];
return [
  { id: 'review-evidence', instruction: 'Open the cited source and confirm the evidence applies to your stack.', expectedObservation: 'The source names the relevant tool, error, or compatibility condition.' },
  { id: 'check-compatibility', instruction: 'Check the license, supported versions, and configuration example.', expectedObservation: 'Your constraints are supported or the gap is understood.' },
  { id: 'try-isolated', instruction: 'If you choose to proceed, test the documented setup in an isolated environment first.', expectedObservation: 'Expected behavior occurs without production secrets.' },
];
~~~

renderSolutionReport begins with # Fixseek Solution Report and prints selected candidate score/trust, reason, sources/excerpts, warnings, assumptions, and validation. renderAgentSkill begins with YAML name: fixseek-solution-guide, has Evidence, Validation, and Safety sections, and includes the literal rule Never install or execute a candidate automatically.

- [ ] **Step 4: Run focused tests.**

Run: npx jest tests/solution-grouper.test.ts tests/validation-guidance.test.ts tests/solution-report.test.ts tests/discovery-service.test.ts --runInBand

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add src/core/solution-grouper.ts src/core/validation-guidance.ts src/exports/solution-report.ts src/core/discovery-service.ts tests/solution-grouper.test.ts tests/validation-guidance.test.ts tests/solution-report.test.ts
git commit -m "feat: add grouped evidence and safe exports"
~~~

## Task 4: Route the CLI through the shared result

**Files:**
- Modify: src/cli/index.ts
- Modify: tests/cli.test.ts
- Modify: tests/pipeline.e2e.test.ts

- [ ] **Step 1: Add a CLI parity test.**

~~~
it('renders discovery-service candidates in mock mode', async () => {
  const { io, stdout } = makeIo();
  const code = await runSolve(['reasoning_content error with Claude Code'], {
    mock: true, maxResults: '2', lang: 'en', logLevel: 'warn',
  }, io);
  expect(code).toBe(0);
  expect(stdout.text()).toContain('oc-go-cc');
  expect(stdout.text()).toContain('WARNING');
});
~~~

- [ ] **Step 2: Run it to verify failure after deleting CLI-local orchestration.**

Run: npx jest tests/cli.test.ts --runInBand

Expected: FAIL until runSolve delegates to discoverSolutions.

- [ ] **Step 3: Refactor runSolve.**

Keep commander parsing, language validation, stdin reading, and terminal error messages in src/cli/index.ts. Replace private searchRealProviders with construction of DiscoveryRequest, mock/real searcher injection, discoverSolutions, then existing summarize(result.candidates, result.parsedProblem, { lang }). Do not add a CLI JSON flag; the gateway owns structured transport.

- [ ] **Step 4: Run regressions.**

Run: npx jest tests/cli.test.ts tests/pipeline.e2e.test.ts --runInBand && npm run typecheck

Expected: PASS with unchanged CLI labels and warnings.

- [ ] **Step 5: Commit.**

~~~
git add src/cli/index.ts tests/cli.test.ts tests/pipeline.e2e.test.ts
git commit -m "refactor: route CLI through discovery service"
~~~

## Task 5: Add the validated thin web gateway

**Files:**
- Create: src/web/gateway.ts
- Create: tests/web-gateway.test.ts
- Modify: package.json
- Modify: package-lock.json

- [ ] **Step 1: Write failing HTTP tests.**

~~~
import { createGateway } from '../src/web/gateway';

it('returns a structured result for a valid request', async () => {
  const app = createGateway({ discover: async () => fixtureResult });
  const response = await app.inject({ method: 'POST', url: '/api/discover', payload: fixtureRequest });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(fixtureResult);
});
it('never returns a token from a provider error', async () => {
  const app = createGateway({ discover: async () => { throw new Error('GITHUB_TOKEN=secret'); } });
  const response = await app.inject({ method: 'POST', url: '/api/discover', payload: fixtureRequest });
  expect(response.body).not.toContain('secret');
});
~~~

- [ ] **Step 2: Install Fastify and run the failing test.**

Run: npm install fastify@4.28.1 && npx jest tests/web-gateway.test.ts --runInBand

Expected: FAIL because createGateway does not exist.

- [ ] **Step 3: Implement exactly two routes.**

~~~
app.get('/health', async () => ({ ok: true }));
app.post('/api/discover', async (request, reply) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid discovery request.' });
  try { return await discover(buildDiscoveryRequest(parsed.data)); }
  catch { return reply.code(500).send({ error: 'Discovery failed. Check provider status and retry.' }); }
});
~~~

The Zod schema requires non-empty problem up to 10,000 characters; caps stack/constraint arrays at 20 strings; accepts known providers; accepts mock or real; and limits maxResults to integer 1–20. Gateway has no storage, authentication, or ranking logic.

When gateway.ts is the program entry point, it must call createGateway().listen({ host: '127.0.0.1', port: 4174 }) and report only the local URL. Its environment-backed discover dependency maps unconfigured real providers to the skipped result described in Task 2.

- [ ] **Step 4: Run gateway tests.**

Run: npx jest tests/web-gateway.test.ts --runInBand && npm run typecheck

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~
git add package.json package-lock.json src/web/gateway.ts tests/web-gateway.test.ts
git commit -m "feat: add web discovery gateway"
~~~

## Task 6: Build the React task flow and browser verification

**Files:**
- Create: web/index.html
- Create: web/vite.config.ts
- Create: web/tsconfig.json
- Create: web/src/main.tsx
- Create: web/src/App.tsx
- Create: web/src/components/ProblemIntake.tsx
- Create: web/src/components/SearchPlan.tsx
- Create: web/src/components/ProviderStatus.tsx
- Create: web/src/components/SolutionCard.tsx
- Create: web/src/components/ExportActions.tsx
- Create: web/src/App.test.tsx
- Create: web/src/test-setup.ts
- Create: e2e/solution-guide.spec.ts
- Create: playwright.config.ts
- Modify: package.json
- Modify: package-lock.json
- Modify: jest.config.js

- [ ] **Step 1: Write failing task-flow UI tests.**

~~~
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

it('shows an editable plan before search', () => {
  render(<App discover={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create search plan' }));
  expect(screen.getByRole('heading', { name: 'Search plan' })).toBeInTheDocument();
  expect(screen.getByLabelText('GitHub')).toBeChecked();
});
it('keeps blocked warnings visible in selected export', async () => {
  render(<App discover={async () => fixtureResultWithBlockedCandidate} />);
  await completePlanAndRunDiscovery();
  expect(screen.getByText('BLOCKED')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Select risky solution/i));
  fireEvent.click(screen.getByRole('button', { name: 'Download report' }));
  expect(screen.getByText('Exports retain selected evidence and safety warnings.')).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Install UI tooling and verify tests fail.**

Run: npm install react@18.3.1 react-dom@18.3.1 && npm install -D vite@5.4.10 @vitejs/plugin-react@4.3.3 @types/react@18.3.12 @types/react-dom@18.3.1 @testing-library/react@16.0.1 @testing-library/jest-dom@6.6.3 jest-environment-jsdom@29.7.0 concurrently@9.0.1 @playwright/test@1.48.2 && npx jest web/src/App.test.tsx --runInBand

Expected: FAIL because UI does not exist.

- [ ] **Step 3: Implement session-only UI.**

App owns draft, planAccepted, result, selectedKeys, and error only. ProblemIntake provides textarea label Describe the problem, comma-separated stack/constraint fields, mock/real mode, and Create search plan. SearchPlan uses generateQueries(parseProblem(problem)), toggles GitHub/npm/web, and calls:

~~~
async function discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const response = await fetch('/api/discover', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Discovery failed. Check provider status and retry.');
  return response.json() as Promise<DiscoveryResult>;
}
~~~

ProviderStatus displays complete, empty, skipped, or failed. SolutionCard displays score, trust, reason, assumptions, all evidence URLs/excerpts, warnings, and validation steps. ExportActions calls shared exporters, creates a text/markdown Blob, downloads fixseek-solution-report.md or fixseek-solution-skill.md, and displays exactly: Exports retain selected evidence and safety warnings.

Configure Vite /api proxy for http://127.0.0.1:4174. Add scripts build:core (tsc), build:web (vite build --config web/vite.config.ts), build (npm run build:core && npm run build:web), web:gateway (node dist/web/gateway.js), web:client (vite --config web/vite.config.ts), and web:dev (both via concurrently). Convert Jest configuration to two projects: existing Node tests remain in tests with node environment, and web/src uses jsdom plus setupFilesAfterEnv: ['<rootDir>/web/src/test-setup.ts']; the setup file imports '@testing-library/jest-dom'.

- [ ] **Step 4: Add a deterministic browser journey.**

~~~
import { expect, test } from '@playwright/test';

test('runs mock discovery and selects a sourced solution', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  await page.getByRole('button', { name: 'Create search plan' }).click();
  await page.getByRole('button', { name: 'Run discovery' }).click();
  await expect(page.getByText('oc-go-cc')).toBeVisible();
  await expect(page.getByText('Evidence')).toBeVisible();
  await page.getByLabel(/Select oc-go-cc/).check();
  await expect(page.getByText('Exports retain selected evidence and safety warnings.')).toBeVisible();
});
~~~

Set Playwright webServer.command to npm run web:dev. The test uses mock mode and makes no provider network calls.

- [ ] **Step 5: Run UI, browser, and build checks.**

Run: npx playwright install chromium && npx jest web/src/App.test.tsx --runInBand && npm run build && npx playwright test e2e/solution-guide.spec.ts

Expected: PASS. Stop development servers after checking startup.

- [ ] **Step 6: Commit.**

~~~
git add package.json package-lock.json web e2e playwright.config.ts
git commit -m "feat: add web solution guide"
~~~

## Task 7: Update documentation and run release verification

**Files:**
- Modify: README.md
- Modify: README.zh-CN.md
- Modify: docs/ARCHITECTURE.md
- Modify: docs/ROADMAP.md

- [ ] **Step 1: Update user and architecture documentation.**

Document npm run web:dev, mock mode default, client URL http://127.0.0.1:5173, credentials staying server-side, and sessions not persisting. Update data flow to end in DiscoveryResult consumed by CLI and gateway. Replace the roadmap statement “do not build a frontend” with the approved no-account local Web milestone.

- [ ] **Step 2: Run complete verification.**

Run: npm test && npm run typecheck && npm run lint && npm run build && npx playwright test

Expected: every command exits 0; no test output, export, or browser payload includes ghp_ or sk- token patterns.

- [ ] **Step 3: Inspect and commit only intended documentation.**

~~~
git diff --check
git status --short
git add README.md README.zh-CN.md docs/ARCHITECTURE.md docs/ROADMAP.md
git commit -m "docs: document web solution guide"
~~~

Expected: unrelated existing files remain unstaged.
