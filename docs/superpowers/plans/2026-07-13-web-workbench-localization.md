# Web Workbench and Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a dark, responsive real-mode Web Solution Guide with instant Chinese/English rendering of system-generated candidate content and exports.

**Architecture:** Keep `DiscoveryResult` language-neutral. Add stable warning codes and shared candidate presentation formatters; the Web app, CLI, and Markdown exporters select a language at render time. Rebuild the React app as a responsive two-column workbench that sends real-mode requests by default and retains visible provider state.

**Tech Stack:** TypeScript, React 18, Vite, Jest/Testing Library, Fastify, existing Fixseek i18n catalog.

---

## File Structure

- Create: `src/core/candidate-presentation.ts` — language-aware pure formatters for match reasons, next steps, warnings, and validation steps.
- Create: `web/src/App.css` — dark responsive workbench styles.
- Modify: `src/types/score.ts` — stable warning codes and optional structured parameters.
- Modify: `src/core/scorer.ts` — attach warning codes/parameters without changing safety decisions.
- Modify: `src/core/summarizer.ts` — render localized candidate text with shared formatters.
- Modify: `src/exports/solution-report.ts` — accept language and render localized report/skill text.
- Modify: `src/i18n/messages.ts`, `src/i18n/types.ts` — Web, export, provider-state, and presentation labels.
- Modify: `web/src/App.tsx` — workbench state, language context, real-mode request, localized render.
- Modify: `web/src/main.tsx` — import stylesheet.
- Modify: `web/index.html` — baseline page language/title metadata.
- Modify: `tests/scorer.test.ts`, `tests/solution-report.test.ts`, `tests/web-gateway.test.ts` — stable-code and localized-output regressions.
- Modify: `web/src/App.test.tsx` — immediate switching, real request, provider state, and selection/export behavior.

### Task 1: Add stable, language-neutral presentation data

**Files:**
- Modify: `src/types/score.ts`
- Modify: `src/core/scorer.ts`
- Create: `src/core/candidate-presentation.ts`
- Test: `tests/scorer.test.ts`

- [ ] **Step 1: Write failing warning-code and formatter tests**

```ts
import { formatMatchReason, formatSafetyWarning } from '../src/core/candidate-presentation';

it('adds a stable code to a low-star warning', () => {
  expect(scoreCandidate(lowStarCandidate, parsedProblem).warnings[0]).toMatchObject({
    category: 'LOW_STARS',
    code: 'low-stars',
    params: { stars: 12 },
  });
});

it('renders a match reason in Chinese without changing the candidate', () => {
  expect(formatMatchReason(scoredCandidate, 'zh')).toContain('直接提及该错误');
  expect(formatMatchReason(scoredCandidate, 'en')).toContain('Directly references the error');
});

it('renders a warning from its stable code in Chinese', () => {
  expect(formatSafetyWarning(warning, 'zh')).toContain('星标');
});
```

- [ ] **Step 2: Run the focused test and confirm red failure**

Run: `npm test -- --runInBand tests/scorer.test.ts`

Expected: FAIL because warning codes and `candidate-presentation` do not exist.

- [ ] **Step 3: Define the warning contract**

```ts
export type SafetyWarningCode =
  | 'penalty'
  | 'new-project'
  | 'low-stars';

export interface SafetyWarning {
  readonly category: string;
  readonly code: SafetyWarningCode;
  readonly message: string;
  readonly params?: Readonly<Record<string, string | number>>;
}
```

Update every `buildWarnings` call site so penalty warnings use
`code: 'penalty'`, new-project warnings include `createdMonths` and
`stars`, and low-star warnings include `stars`. Preserve `message` for
existing callers and compatibility.

- [ ] **Step 4: Implement shared presentation formatters**

```ts
export function formatMatchReason(candidate: RankedCandidate, language: Language): string;
export function formatNextStep(candidate: RankedCandidate, language: Language): string;
export function formatSafetyWarning(warning: SafetyWarning, language: Language): string;
export function formatValidationStep(step: ValidationStep, language: Language): ValidationStep;
```

Derive match-reason clauses from `ScoreBreakdown`: exact/related error,
full/partial stack match, README evidence, and install clarity. Derive next
steps from `candidateType`, README install markers, candidate name, and URL.
For `review-risk`, `review-evidence`, `check-compatibility`, and
`try-isolated`, return localized validation text based on the stable step ID.
Keep unknown warning and validation content unchanged rather than guessing a
translation.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --runInBand tests/scorer.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/score.ts src/core/scorer.ts src/core/candidate-presentation.ts tests/scorer.test.ts
git commit -m "feat: add localized candidate presentation"
```

### Task 2: Localize CLI and Markdown exports with the shared formatter

**Files:**
- Modify: `src/core/summarizer.ts`
- Modify: `src/exports/solution-report.ts`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/types.ts`
- Test: `tests/solution-report.test.ts`

- [ ] **Step 1: Write failing Chinese-export tests**

```ts
it('renders Chinese system-generated content in a report', () => {
  const markdown = renderSolutionReport({ request, candidates: [solution], language: 'zh' });
  expect(markdown).toContain('# Fixseek 解决方案报告');
  expect(markdown).toContain('风险提示');
  expect(markdown).toContain('验证步骤');
});

it('keeps evidence excerpts unchanged in a Chinese report', () => {
  const markdown = renderSolutionReport({ request, candidates: [solution], language: 'zh' });
  expect(markdown).toContain('Evidence');
});
```

- [ ] **Step 2: Run the test and confirm red failure**

Run: `npm test -- --runInBand tests/solution-report.test.ts`

Expected: FAIL because `SolutionExportInput` has no language and report labels
remain English.

- [ ] **Step 3: Extend shared messages and exporter input**

```ts
export interface SolutionExportInput {
  readonly request: DiscoveryRequest;
  readonly candidates: readonly SolutionCandidate[];
  readonly language?: Language;
}
```

Add typed message keys for report/skill headings, sources, score, evidence,
safety warnings, validation, provider state, form labels, and export labels.
Implement `renderSolutionReport` and `renderAgentSkill` with
`const language = input.language ?? 'en'`; use the Task 1 formatters for
match reasons, warnings, next steps, and validation steps. Do not translate
`candidate.name`, URLs, evidence titles, or excerpts.

- [ ] **Step 4: Update the CLI summarizer**

Replace direct reads of `candidate.matchReason`, `candidate.nextStep`, and
`warning.message` with Task 1 formatters using the existing `lang` option.
Keep the CLI default language English.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --runInBand tests/solution-report.test.ts tests/cli.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/summarizer.ts src/exports/solution-report.ts src/i18n/messages.ts src/i18n/types.ts tests/solution-report.test.ts
git commit -m "feat: localize solution exports"
```

### Task 3: Build the dark responsive Web workbench

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/App.css`
- Modify: `web/src/main.tsx`
- Modify: `web/index.html`
- Test: `web/src/App.test.tsx`

- [ ] **Step 1: Write failing Web behavior tests**

```tsx
it('sends a real-mode request from the workbench', async () => {
  const discover = jest.fn().mockResolvedValue(result);
  render(<App discover={discover} />);
  fireEvent.change(screen.getByLabelText('Describe the problem'), { target: { value: 'Vite cannot find module' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search solutions' }));
  await waitFor(() => expect(discover).toHaveBeenCalledWith(expect.objectContaining({ mode: 'real' })));
});

it('switches system-generated result text to Chinese without another discovery request', async () => {
  const discover = jest.fn().mockResolvedValue(result);
  render(<App discover={discover} />);
  await runSearch();
  fireEvent.click(screen.getByRole('button', { name: '中文' }));
  expect(screen.getByText('匹配原因')).toBeInTheDocument();
  expect(discover).toHaveBeenCalledTimes(1);
});

it('shows a skipped provider alongside successful candidates', async () => {
  render(<App discover={jest.fn().mockResolvedValue(resultWithSkippedWeb)} />);
  await runSearch();
  expect(screen.getByText(/Web.*已跳过/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'example/tool' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Web test and confirm red failure**

Run: `npm test -- --runInBand web/src/App.test.tsx`

Expected: FAIL because the existing screen has no language control, sends mock
mode, and has no localized provider-state presentation.

- [ ] **Step 3: Replace the page structure with the workbench**

Implement React state for `problem`, comma-separated `stack` and
`constraints`, providers, `Language`, `DiscoveryResult`, selected keys,
and error. Render:

```tsx
<main className="app-shell" lang={language}>
  <header className="app-header">…language controls…</header>
  <section className="workbench">
    <form className="discovery-panel" onSubmit={…}>…</form>
    <section className="results-panel">…plan, status strip, candidates, exports…</section>
  </section>
</main>
```

The form must call `discover` with `mode: 'real'`, normalized stack and
constraints, selected providers, and `maxResults: 10`. Disable the submit
button for empty problem or no provider. On success, clear selections; on
failure, show a localized alert. Do not issue a second discovery request when
the language state changes.

- [ ] **Step 4: Add dark responsive styles**

Create CSS custom properties for charcoal surfaces, readable text, muted text,
primary action, success/warning/danger status, focus rings, spacing, and
radius. Use a two-column grid above 900px and one column below 900px. Style
forms, provider chips, status pills, candidate cards, warnings, evidence,
validation lists, and export controls. Keep sufficient contrast and preserve
visible keyboard focus.

- [ ] **Step 5: Add startup metadata**

Import `./App.css` in `web/src/main.tsx`. Set `web/index.html` title to
`Fixseek · Solution Workbench` and its initial `lang` to `en`; React
updates the rendered application language while the selector controls text.

- [ ] **Step 6: Run Web tests**

Run: `npm test -- --runInBand web/src/App.test.tsx`

Expected: PASS with real mode, immediate localization, provider state, selection,
and export tests green.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx web/src/App.css web/src/main.tsx web/index.html web/src/App.test.tsx
git commit -m "feat: redesign localized web workbench"
```

### Task 4: Validate gateway contract, visual layout, and documentation

**Files:**
- Modify: `tests/web-gateway.test.ts`
- Modify: `README.md`
- Modify: `docs/AGENT_HANDOFF.md`

- [ ] **Step 1: Write a gateway real-mode contract test**

```ts
it('passes real mode through the discovery gateway', async () => {
  const discover = jest.fn().mockResolvedValue(result);
  const app = createGateway({ discover });
  await app.inject({
    method: 'POST',
    url: '/api/discover',
    payload: { problem: 'Vite cannot find module', stack: [], constraints: [], providers: ['github'], mode: 'real', maxResults: 10 },
  });
  expect(discover).toHaveBeenCalledWith(expect.objectContaining({ mode: 'real' }));
});
```

- [ ] **Step 2: Run the gateway test and confirm its current behavior**

Run: `npm test -- --runInBand tests/web-gateway.test.ts`

Expected: PASS after verifying the existing gateway preserves the explicit
`real` value; add no gateway behavior beyond the test unless the test exposes a
regression.

- [ ] **Step 3: Document the Web defaults**

State in the README and handoff that the Web Guide defaults to real mode, that
provider state is visible, and that Chinese/English changes system-generated
text plus exports while evidence remains source-language.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm run typecheck && npm run build && npx playwright test e2e/solution-guide.spec.ts`

Expected: all tests, type checking, core/Web build, and the local browser flow
pass. Then run `npm run web:dev`, inspect desktop and a narrow browser
viewport, and confirm no clipping, missing labels, or color-only risk state.

- [ ] **Step 5: Commit**

```bash
git add tests/web-gateway.test.ts README.md docs/AGENT_HANDOFF.md
git commit -m "docs: describe localized web guide"
```
