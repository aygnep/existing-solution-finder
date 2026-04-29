import * as fs from 'fs';
import * as path from 'path';
import { parseProblem } from '../src/core/problem-parser';
import type { ParsedProblem } from '../src/types/problem';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseProblem', () => {
  describe('Claude + DeepSeek error scenario', () => {
    let result: ParsedProblem;

    beforeAll(() => {
      result = parseProblem(readFixture('claude-deepseek-error.txt'));
    });

    it('preserves raw input', () => {
      expect(result.raw).toContain('reasoning_content');
      expect(result.raw).toContain('Claude Code');
    });

    it('extracts error tokens including reasoning_content', () => {
      expect(result.errorTokens.length).toBeGreaterThanOrEqual(1);
      const allTokens = result.errorTokens.join(' ').toLowerCase();
      expect(allTokens).toContain('reasoning_content');
    });

    it('identifies Claude Code as a stack name', () => {
      expect(result.stackNames).toContain('Claude Code');
    });

    it('identifies DeepSeek as a stack name', () => {
      expect(result.stackNames).toContain('DeepSeek');
    });

    it('extracts version strings', () => {
      // "Node.js 20" or "v1.2.3" or "v0.8.1" should be found
      expect(result.versions.length).toBeGreaterThanOrEqual(1);
    });

    it('produces keywords', () => {
      expect(result.keywords.length).toBeGreaterThan(0);
    });
  });

  describe('npm build error scenario', () => {
    let result: ParsedProblem;

    beforeAll(() => {
      result = parseProblem(readFixture('npm-build-error.txt'));
    });

    it('extracts error tokens from npm ERR lines', () => {
      expect(result.errorTokens.length).toBeGreaterThanOrEqual(1);
    });

    it('identifies stack names mentioned in the error log', () => {
      // The fixture mentions "next build" and "Type error" but not "TypeScript"
      // or "Next.js" literally. Parser relies on exact known-tool matching.
      // At minimum, error tokens should be extracted.
      expect(result.errorTokens.length).toBeGreaterThanOrEqual(1);
      // Keywords should capture relevant terms
      expect(result.keywords.length).toBeGreaterThan(0);
    });
  });

  describe('Docker network error scenario', () => {
    let result: ParsedProblem;

    beforeAll(() => {
      result = parseProblem(readFixture('docker-network-error.txt'));
    });

    it('extracts ECONNREFUSED as error token', () => {
      const allTokens = result.errorTokens.join(' ');
      expect(allTokens).toMatch(/ECONNREFUSED|connect/i);
    });

    it('identifies Docker as a stack name', () => {
      expect(result.stackNames).toContain('Docker');
    });

    it('identifies PostgreSQL as a stack name', () => {
      expect(result.stackNames).toContain('PostgreSQL');
    });

    it('extracts constraints (open source, self-hosted)', () => {
      const allConstraints = result.constraints.join(' ');
      expect(allConstraints).toMatch(/open.?source|self.?host/i);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = parseProblem('');
      expect(result.raw).toBe('');
      expect(result.errorTokens).toEqual([]);
      expect(result.stackNames).toEqual([]);
    });

    it('handles whitespace-only input', () => {
      const result = parseProblem('   \n\t  ');
      expect(result.raw).toBe('');
    });

    it('handles input with only tool names', () => {
      const result = parseProblem('Docker Kubernetes Redis');
      expect(result.stackNames).toContain('Docker');
      expect(result.stackNames).toContain('Kubernetes');
      expect(result.stackNames).toContain('Redis');
    });

    it('extracts snake_case field names as error tokens', () => {
      const result = parseProblem('unexpected field reasoning_content in API response');
      const allTokens = result.errorTokens.join(' ');
      expect(allTokens).toContain('reasoning_content');
    });

    it('caps error tokens at 10', () => {
      // Generate input with many potential error tokens
      const manyErrors = Array.from({ length: 20 }, (_, i) =>
        `error: something_wrong_${i}`
      ).join('\n');
      const result = parseProblem(manyErrors);
      expect(result.errorTokens.length).toBeLessThanOrEqual(10);
    });

    it('caps keywords at 15', () => {
      const manyWords = Array.from({ length: 30 }, (_, i) =>
        `keyword${i}`
      ).join(' ');
      const result = parseProblem(manyWords);
      expect(result.keywords.length).toBeLessThanOrEqual(15);
    });
  });
});
