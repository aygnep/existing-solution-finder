import { generateQueries } from '../src/core/query-generator';
import { parseProblem } from '../src/core/problem-parser';
import type { ParsedProblem } from '../src/types/problem';
import type { Query } from '../src/types/candidate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function queriesByCategory(queries: readonly Query[], category: string): readonly Query[] {
  return queries.filter((q) => q.category === category);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateQueries', () => {
  describe('Claude + DeepSeek reasoning_content scenario', () => {
    let problem: ParsedProblem;
    let queries: readonly Query[];

    beforeAll(() => {
      problem = parseProblem(
        'Claude Code 用 OpenCode Go 跑 DeepSeek 报 reasoning_content 错误'
      );
      queries = generateQueries(problem);
    });

    it('generates at least 5 queries', () => {
      expect(queries.length).toBeGreaterThanOrEqual(5);
    });

    it('generates no more than 15 queries', () => {
      expect(queries.length).toBeLessThanOrEqual(15);
    });

    it('generates exact-error queries', () => {
      const exactError = queriesByCategory(queries, 'exact-error');
      expect(exactError.length).toBeGreaterThanOrEqual(1);
      expect(exactError.length).toBeLessThanOrEqual(3);
    });

    it('generates stack-compatibility queries', () => {
      const stackCompat = queriesByCategory(queries, 'stack-compatibility');
      expect(stackCompat.length).toBeGreaterThanOrEqual(1);
    });

    it('generates github-repos queries', () => {
      const repos = queriesByCategory(queries, 'github-repos');
      expect(repos.length).toBeGreaterThanOrEqual(1);
    });

    it('generates github-issues queries', () => {
      const issues = queriesByCategory(queries, 'github-issues');
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('generates alternatives queries', () => {
      const alt = queriesByCategory(queries, 'alternatives');
      expect(alt.length).toBeGreaterThanOrEqual(1);
    });

    it('exact-error queries mention reasoning_content', () => {
      const exactError = queriesByCategory(queries, 'exact-error');
      const hasToken = exactError.some((q) =>
        q.text.toLowerCase().includes('reasoning_content')
      );
      expect(hasToken).toBe(true);
    });

    it('stack-compat queries mention stack tools', () => {
      const stackCompat = queriesByCategory(queries, 'stack-compatibility');
      const allText = stackCompat.map((q) => q.text.toLowerCase()).join(' ');
      // Should mention at least one known tool
      const hasStackName =
        allText.includes('claude') ||
        allText.includes('deepseek') ||
        allText.includes('opencode');
      expect(hasStackName).toBe(true);
    });

    it('github-repos queries include site:github.com', () => {
      const repos = queriesByCategory(queries, 'github-repos');
      const hasSitePrefix = repos.some((q) =>
        q.text.toLowerCase().includes('site:github.com')
      );
      expect(hasSitePrefix).toBe(true);
    });

    it('no duplicate query texts', () => {
      const texts = queries.map((q) => q.text.toLowerCase());
      const unique = new Set(texts);
      expect(unique.size).toBe(texts.length);
    });

    it('each query has at least one provider', () => {
      for (const q of queries) {
        expect(q.providers.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('exact-error and stack-compat queries route to github and web', () => {
      const relevant = queries.filter(
        (q) => q.category === 'exact-error' || q.category === 'stack-compatibility'
      );
      for (const q of relevant) {
        expect(q.providers).toContain('github');
        expect(q.providers).toContain('web');
      }
    });

    it('alternatives queries include npm provider', () => {
      const alt = queriesByCategory(queries, 'alternatives');
      const hasNpm = alt.some((q) => q.providers.includes('npm'));
      expect(hasNpm).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('generates queries from empty problem', () => {
      const problem = parseProblem('');
      const queries = generateQueries(problem);
      // Should not throw; may produce 0 or few queries
      expect(Array.isArray(queries)).toBe(true);
    });

    it('generates queries with only tool names (no errors)', () => {
      const problem = parseProblem('Docker Kubernetes');
      const queries = generateQueries(problem);
      expect(queries.length).toBeGreaterThan(0);
      // Should have stack-compat queries even without error tokens
      const stackCompat = queriesByCategory(queries, 'stack-compatibility');
      expect(stackCompat.length).toBeGreaterThanOrEqual(1);
    });

    it('quotes multi-word tool names', () => {
      const problem = parseProblem('Claude Code integration');
      const queries = generateQueries(problem);
      const hasQuoted = queries.some((q) => q.text.includes('"Claude Code"'));
      expect(hasQuoted).toBe(true);
    });
  });
});
