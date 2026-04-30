/**
 * E2E core pipeline test.
 *
 * Tests the full pipeline (parse → query → mock-search → score → rank → summarize)
 * without any real network calls or API keys.
 *
 * Per CLAUDE_CODE_RULES.md: tests must be deterministic; no Date.now() without seeding.
 */

import { parseProblem } from '../src/core/problem-parser';
import { generateQueries } from '../src/core/query-generator';
import { scoreAndAttach } from '../src/core/scorer';
import { rankCandidates } from '../src/core/ranker';
import { summarize } from '../src/core/summarizer';
import { createMockProvider, getBuiltinMockCandidates } from '../src/providers/mock-provider';
import type { RawCandidate } from '../src/types/candidate';

// ─── Deterministic "now" for recency/maintenance tests ────────────────────────
const FIXED_NOW = new Date('2026-04-30T00:00:00Z').getTime();
const originalDateNow = Date.now;

beforeAll(() => {
  Date.now = () => FIXED_NOW;
});

afterAll(() => {
  Date.now = originalDateNow;
});

// ─── Target query from Phase 2 spec ──────────────────────────────────────────

const TARGET_INPUT = 'reasoning_content error with Claude Code + DeepSeek + OpenCode Go';

// ─── Full pipeline helper ─────────────────────────────────────────────────────

async function runPipeline(input: string, maxResults = 10) {
  const problem = parseProblem(input);
  const queries = generateQueries(problem);
  const mockSearch = createMockProvider(getBuiltinMockCandidates());
  const rawResults = await Promise.all(queries.map((q) => mockSearch(q)));
  const allCandidates: RawCandidate[] = rawResults.flat();
  const scored = allCandidates.map((c) => scoreAndAttach(c, problem));
  const ranked = rankCandidates(scored, { maxResults });
  const output = summarize(ranked, problem);
  return { problem, queries, allCandidates, scored, ranked, output };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E core pipeline', () => {
  describe('target query: reasoning_content + Claude Code + DeepSeek + OpenCode Go', () => {
    let result: Awaited<ReturnType<typeof runPipeline>>;

    beforeAll(async () => {
      result = await runPipeline(TARGET_INPUT);
    });

    // ── Parse phase ──

    it('parses reasoning_content as an error token', () => {
      const tokens = result.problem.errorTokens.join(' ').toLowerCase();
      expect(tokens).toContain('reasoning_content');
    });

    it('does NOT capture "with Claude Code + DeepSeek" as an error token', () => {
      const tokens = result.problem.errorTokens.join(' ').toLowerCase();
      expect(tokens).not.toMatch(/with claude|with deepseek/i);
    });

    it('identifies Claude Code as stack name', () => {
      expect(result.problem.stackNames).toContain('Claude Code');
    });

    it('identifies DeepSeek as stack name', () => {
      expect(result.problem.stackNames).toContain('DeepSeek');
    });

    it('identifies OpenCode Go as stack name', () => {
      expect(result.problem.stackNames).toContain('OpenCode Go');
    });

    // ── Query generation phase ──

    it('generates at least 5 queries', () => {
      expect(result.queries.length).toBeGreaterThanOrEqual(5);
    });

    it('generates no more than 15 queries', () => {
      expect(result.queries.length).toBeLessThanOrEqual(15);
    });

    it('includes a query mentioning reasoning_content', () => {
      const hasToken = result.queries.some((q) =>
        q.text.toLowerCase().includes('reasoning_content'),
      );
      expect(hasToken).toBe(true);
    });

    // ── Search phase ──

    it('returns at least 5 raw candidates from mock provider', () => {
      expect(result.allCandidates.length).toBeGreaterThanOrEqual(5);
    });

    it('includes all 5 required mock candidates in raw results', () => {
      const names = result.allCandidates.map((c) => c.name);
      expect(names).toContain('oc-go-cc');
      expect(names).toContain('claude-code-router');
      expect(names).toContain('UniClaudeProxy');
      expect(names).toContain('cc-switch issue: reasoning_content workaround');
      expect(names).toContain('DeepSeek: disable thinking mode via API param');
    });

    // ── Score phase ──

    it('all candidates have a valid score object', () => {
      for (const c of result.scored) {
        expect(c.score).toBeDefined();
        expect(c.score.displayTotal).toBeGreaterThanOrEqual(0);
        expect(c.score.displayTotal).toBeLessThanOrEqual(100);
        expect(c.score.breakdown).toBeDefined();
      }
    });

    it('oc-go-cc scores 100 (perfect match)', () => {
      const ocGoCC = result.scored.find((c) => c.name === 'oc-go-cc');
      expect(ocGoCC).toBeDefined();
      expect(ocGoCC!.score.displayTotal).toBe(100);
    });

    // ── Rank phase ──

    it('oc-go-cc ranks #1', () => {
      expect(result.ranked[0]?.name).toBe('oc-go-cc');
      expect(result.ranked[0]?.rank).toBe(1);
    });

    it('all ranked candidates have candidateType set', () => {
      for (const c of result.ranked) {
        expect(['tool', 'issue', 'workaround']).toContain(c.candidateType);
      }
    });

    it('cc-switch issue candidate has candidateType "issue"', () => {
      const issueCandidate = result.ranked.find((c) =>
        c.name.includes('cc-switch'),
      );
      expect(issueCandidate).toBeDefined();
      expect(issueCandidate!.candidateType).toBe('issue');
    });

    it('disable thinking mode candidate has candidateType "workaround"', () => {
      const workaround = result.ranked.find((c) =>
        c.name.includes('disable thinking'),
      );
      expect(workaround).toBeDefined();
      expect(workaround!.candidateType).toBe('workaround');
    });

    it('all ranked candidates have a non-empty nextStep', () => {
      for (const c of result.ranked) {
        expect(c.nextStep).toBeTruthy();
        expect(c.nextStep.length).toBeGreaterThan(10);
      }
    });

    it('all ranked candidates have a non-empty matchReason', () => {
      for (const c of result.ranked) {
        expect(c.matchReason).toBeTruthy();
      }
    });

    it('deduplicates candidates by URL', () => {
      const urls = result.ranked.map((c) => c.url.toLowerCase());
      const unique = new Set(urls);
      expect(unique.size).toBe(urls.length);
    });

    it('results are sorted by displayTotal descending', () => {
      for (let i = 0; i < result.ranked.length - 1; i++) {
        expect(result.ranked[i]!.score.displayTotal).toBeGreaterThanOrEqual(
          result.ranked[i + 1]!.score.displayTotal,
        );
      }
    });

    // ── Summarize phase ──

    it('output contains the problem description', () => {
      expect(result.output).toContain('reasoning_content');
    });

    it('output contains rank labels [1] through [N]', () => {
      expect(result.output).toContain('[1]');
      expect(result.output).toContain('[2]');
    });

    it('output contains Type label for each candidate', () => {
      expect(result.output).toMatch(/Type:/);
    });

    it('output contains Next step for each candidate', () => {
      expect(result.output).toContain('▶  Next step:');
    });

    it('output contains Score breakdown', () => {
      expect(result.output).toContain('Score breakdown:');
    });

    it('output contains oc-go-cc as first result', () => {
      const firstResultIdx = result.output.indexOf('[1]');
      const secondResultIdx = result.output.indexOf('[2]');
      const ocGoCCIdx = result.output.indexOf('oc-go-cc');
      expect(ocGoCCIdx).toBeGreaterThanOrEqual(0);
      expect(ocGoCCIdx).toBeLessThan(secondResultIdx);
      expect(firstResultIdx).toBeLessThan(ocGoCCIdx);
    });

    it('output contains warnings for risky candidates', () => {
      // The archived/suspicious candidate should have WARNING in output
      expect(result.output).toMatch(/WARNING/);
    });

    it('output does not contain any API key patterns', () => {
      // Safety: no hardcoded tokens in output
      expect(result.output).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(result.output).not.toMatch(/ghp_[a-zA-Z0-9]{20,}/);
    });
  });

  describe('empty input edge case', () => {
    it('pipeline handles empty input gracefully', async () => {
      const { output } = await runPipeline('');
      expect(output).toContain('No candidates found');
    });
  });

  describe('tool-only input (no error tokens)', () => {
    it('still produces results for tool-name-only input', async () => {
      const { ranked } = await runPipeline('Claude Code DeepSeek proxy');
      expect(ranked.length).toBeGreaterThan(0);
    });
  });

  describe('output format contract', () => {
    it('every ranked candidate has all required output fields', async () => {
      const { ranked } = await runPipeline(TARGET_INPUT);
      for (const c of ranked) {
        expect(c.rank).toBeGreaterThan(0);
        expect(c.name).toBeTruthy();
        expect(c.url).toBeTruthy();
        expect(c.score.displayTotal).toBeGreaterThanOrEqual(0);
        expect(c.score.trustLevel).toMatch(/^(HIGH|MEDIUM|LOW|BLOCKED)$/);
        expect(c.candidateType).toMatch(/^(tool|issue|workaround)$/);
        expect(c.matchReason).toBeTruthy();
        expect(c.nextStep).toBeTruthy();
      }
    });
  });
});
