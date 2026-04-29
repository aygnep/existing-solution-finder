import { scoreCandidate, scoreAndAttach } from '../src/core/scorer';

import type { ParsedProblem } from '../src/types/problem';
import type { RawCandidate } from '../src/types/candidate';


// ─── Deterministic "now" for recency/maintenance tests ────────────────────────

// We freeze Date.now to a known value so tests are deterministic.
// CLAUDE_CODE_RULES.md: "Tests must be deterministic — no Date.now()"
const FIXED_NOW = new Date('2026-04-30T00:00:00Z').getTime();
const originalDateNow = Date.now;

beforeAll(() => {
  Date.now = () => FIXED_NOW;
});

afterAll(() => {
  Date.now = originalDateNow;
});

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeProblem(overrides: Partial<ParsedProblem> = {}): ParsedProblem {
  return {
    raw: 'test problem with reasoning_content error',
    errorTokens: ['reasoning_content'],
    stackNames: ['Claude Code', 'DeepSeek'],
    versions: [],
    constraints: [],
    keywords: ['proxy', 'api'],
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<RawCandidate> = {}): RawCandidate {
  return {
    id: 'https://github.com/test/test-repo',
    name: 'test-repo',
    url: 'https://github.com/test/test-repo',
    description: 'A test repository',
    readmeSnippet: 'Some readme content with usage and install instructions. npm install test-repo. Example config included.',
    provider: 'github',
    metadata: {
      stars: 100,
      license: 'MIT',
      lastCommitDate: new Date('2026-03-01'),
      createdDate: new Date('2025-01-01'),
      isArchived: false,
      openIssueCount: 5,
      ownerType: 'organization',
      hasInstallInstructions: true,
      hasExampleConfig: true,
      hasSuspiciousInstallScript: false,
      requiresSecretsTransmission: false,
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scoreCandidate', () => {
  describe('exact error match (max 25)', () => {
    it('gives 25 when error token appears in name/description', () => {
      const problem = makeProblem({ errorTokens: ['reasoning_content'] });
      const candidate = makeCandidate({
        name: 'reasoning_content-fixer',
        description: 'Fixes the reasoning_content field issue',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.exactErrorMatch).toBe(25);
    });

    it('gives 15 when error token appears in readme only', () => {
      const problem = makeProblem({ errorTokens: ['reasoning_content'] });
      const candidate = makeCandidate({
        name: 'generic-proxy',
        description: 'A generic proxy tool',
        readmeSnippet: 'This tool handles reasoning_content field stripping from API responses. Usage and install instructions included.',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.exactErrorMatch).toBe(15);
    });

    it('gives 5 when only keyword match found', () => {
      const problem = makeProblem({
        errorTokens: ['some_unique_error'],
        keywords: ['proxy'],
      });
      const candidate = makeCandidate({
        name: 'api-proxy',
        description: 'A proxy for APIs',
        readmeSnippet: 'General proxy usage. Install: npm install api-proxy.',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.exactErrorMatch).toBe(5);
    });

    it('gives 0 when no match at all', () => {
      const problem = makeProblem({
        errorTokens: ['xyz_totally_unrelated_error'],
        keywords: ['unicorn'],
      });
      const candidate = makeCandidate({
        name: 'database-tool',
        description: 'Manages databases',
        readmeSnippet: 'A database management tool with many features and config options included.',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.exactErrorMatch).toBe(0);
    });
  });

  describe('stack match (max 20)', () => {
    it('gives 20 when all stack names match', () => {
      const problem = makeProblem({ stackNames: ['Claude Code', 'DeepSeek'] });
      const candidate = makeCandidate({
        description: 'Works with Claude Code and DeepSeek',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.stackMatch).toBe(20);
    });

    it('gives 12 when majority match (>=50%)', () => {
      const problem = makeProblem({ stackNames: ['Claude Code', 'DeepSeek', 'Docker', 'Node.js'] });
      const candidate = makeCandidate({
        description: 'Supports Claude Code and DeepSeek integration',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.stackMatch).toBe(12);
    });

    it('gives 5 when one match', () => {
      const problem = makeProblem({ stackNames: ['Claude Code', 'DeepSeek', 'Docker'] });
      const candidate = makeCandidate({
        description: 'A Docker utility',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.stackMatch).toBe(5);
    });

    it('gives 10 (neutral) when problem has no stack', () => {
      const problem = makeProblem({ stackNames: [] });
      const candidate = makeCandidate();
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.stackMatch).toBe(10);
    });

    it('gives 0 when no overlap', () => {
      const problem = makeProblem({ stackNames: ['Rust', 'PostgreSQL'] });
      const candidate = makeCandidate({
        name: 'js-tool',
        description: 'A JavaScript utility',
        readmeSnippet: 'Works with Node.js only. npm install js-tool.',
      });
      const score = scoreCandidate(candidate, problem);
      expect(score.breakdown.stackMatch).toBe(0);
    });
  });

  describe('recency (max 10)', () => {
    it('gives 10 for commit < 3 months ago', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          lastCommitDate: new Date('2026-03-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.breakdown.recency).toBe(10);
    });

    it('gives 7 for commit 3-12 months ago', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          lastCommitDate: new Date('2025-10-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.breakdown.recency).toBe(7);
    });

    it('gives 3 for commit 1-2 years ago', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          lastCommitDate: new Date('2024-10-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.breakdown.recency).toBe(3);
    });

    it('gives 0 for commit > 2 years ago', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          lastCommitDate: new Date('2022-01-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.breakdown.recency).toBe(0);
    });

    it('gives 3 (benefit of doubt) when commit date unknown', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          lastCommitDate: undefined,
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.breakdown.recency).toBe(3);
    });
  });

  describe('penalties', () => {
    it('applies -10 for no README', () => {
      const candidate = makeCandidate({ readmeSnippet: '' });
      const score = scoreCandidate(candidate, makeProblem());
      const noReadmePenalty = score.penalties.find((p) => p.reason === 'No README');
      expect(noReadmePenalty).toBeDefined();
      expect(noReadmePenalty!.amount).toBe(-10);
    });

    it('applies -5 for no license', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, license: undefined },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const noLicense = score.penalties.find((p) => p.reason === 'No license file');
      expect(noLicense).toBeDefined();
      expect(noLicense!.amount).toBe(-5);
    });

    it('applies -30 for archived repo', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, isArchived: true },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const archived = score.penalties.find((p) => p.reason === 'Archived repository');
      expect(archived).toBeDefined();
      expect(archived!.amount).toBe(-30);
    });

    it('applies -30 for suspicious install script', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, hasSuspiciousInstallScript: true },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const suspicious = score.penalties.find((p) =>
        p.reason.includes('Suspicious install script')
      );
      expect(suspicious).toBeDefined();
      expect(suspicious!.amount).toBe(-30);
    });

    it('applies -30 for secrets transmission', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, requiresSecretsTransmission: true },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const secrets = score.penalties.find((p) =>
        p.reason.includes('secrets')
      );
      expect(secrets).toBeDefined();
      expect(secrets!.amount).toBe(-30);
    });

    it('stacks multiple penalties', () => {
      const candidate = makeCandidate({
        readmeSnippet: '',
        metadata: {
          ...makeCandidate().metadata,
          license: undefined,
          isArchived: true,
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.penalties.length).toBeGreaterThanOrEqual(3);
      // -10 (no readme) + -5 (no license) + -30 (archived) = -45
      const totalPenalty = score.penalties.reduce((s, p) => s + p.amount, 0);
      expect(totalPenalty).toBeLessThanOrEqual(-45);
    });
  });

  describe('score totals', () => {
    it('subtotal is sum of all breakdown fields', () => {
      const score = scoreCandidate(makeCandidate(), makeProblem());
      const b = score.breakdown;
      const expectedSubtotal =
        b.exactErrorMatch + b.stackMatch + b.readmeEvidence +
        b.recency + b.installationClarity + b.maintenanceActivity +
        b.exampleConfig;
      expect(score.subtotal).toBe(expectedSubtotal);
    });

    it('total = subtotal + penalties', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, license: undefined },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const penaltySum = score.penalties.reduce((s, p) => s + p.amount, 0);
      expect(score.total).toBe(score.subtotal + penaltySum);
    });

    it('displayTotal is clamped to 0 minimum', () => {
      const candidate = makeCandidate({
        readmeSnippet: '',
        metadata: {
          ...makeCandidate().metadata,
          license: undefined,
          isArchived: true,
          hasSuspiciousInstallScript: true,
          requiresSecretsTransmission: true,
          lastCommitDate: new Date('2020-01-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.displayTotal).toBeGreaterThanOrEqual(0);
      // Raw total should be negative
      expect(score.total).toBeLessThan(0);
    });
  });

  describe('trust levels', () => {
    it('BLOCKED for archived repos', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, isArchived: true },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.trustLevel).toBe('BLOCKED');
    });

    it('BLOCKED for suspicious install', () => {
      const candidate = makeCandidate({
        metadata: { ...makeCandidate().metadata, hasSuspiciousInstallScript: true },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.trustLevel).toBe('BLOCKED');
    });

    it('HIGH for org-owned, well-scored, licensed project', () => {
      const candidate = makeCandidate({
        name: 'reasoning_content handler',
        description: 'Handles reasoning_content for Claude Code and DeepSeek',
        readmeSnippet: 'Handles reasoning_content field. Usage and install: npm install it. Config example included.',
        metadata: {
          ...makeCandidate().metadata,
          ownerType: 'organization',
          license: 'MIT',
          lastCommitDate: new Date('2026-04-01'),
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      expect(score.trustLevel).toBe('HIGH');
    });

    it('LOW for no-license, low-score project', () => {
      const candidate = makeCandidate({
        name: 'unrelated-tool',
        description: 'Something unrelated',
        readmeSnippet: 'An unrelated tool with readme content about databases and storage systems.',
        metadata: {
          ...makeCandidate().metadata,
          license: undefined,
          ownerType: 'user',
          stars: 3,
        },
      });
      const score = scoreCandidate(candidate, makeProblem({
        errorTokens: ['xyz_unique'],
        keywords: ['unicorn'],
      }));
      expect(score.trustLevel).toBe('LOW');
    });
  });

  describe('warnings', () => {
    it('warns about new low-star projects', () => {
      const twoMonthsAgo = new Date(FIXED_NOW - 60 * 24 * 60 * 60 * 1000);
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          stars: 12,
          createdDate: twoMonthsAgo,
          ownerType: 'user',
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const newProjectWarning = score.warnings.find((w) => w.category === 'NEW_PROJECT');
      expect(newProjectWarning).toBeDefined();
    });

    it('warns about low stars for individual projects', () => {
      const candidate = makeCandidate({
        metadata: {
          ...makeCandidate().metadata,
          stars: 10,
          ownerType: 'user',
          createdDate: new Date('2024-01-01'), // not new
        },
      });
      const score = scoreCandidate(candidate, makeProblem());
      const lowStarsWarning = score.warnings.find((w) => w.category === 'LOW_STARS');
      expect(lowStarsWarning).toBeDefined();
    });
  });

  describe('scoreAndAttach', () => {
    it('returns a ScoredCandidate with all original fields plus score', () => {
      const candidate = makeCandidate();
      const problem = makeProblem();
      const scored = scoreAndAttach(candidate, problem);

      expect(scored.id).toBe(candidate.id);
      expect(scored.name).toBe(candidate.name);
      expect(scored.url).toBe(candidate.url);
      expect(scored.provider).toBe(candidate.provider);
      expect(scored.score).toBeDefined();
      expect(scored.score.breakdown).toBeDefined();
      expect(typeof scored.score.displayTotal).toBe('number');
    });
  });
});
