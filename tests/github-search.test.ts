import {
  sanitizeGitHubQuery,
  deduplicateByFullName,
  extractReadmeMetadata,
  searchGitHub,
  searchGitHubIssues,
  searchGitHubMultiQuery,
} from '../src/providers/github-search';

import type { RawCandidate, QueryCategory } from '../src/types/candidate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<RawCandidate> = {}): RawCandidate {
  return {
    id: 'https://github.com/test/repo',
    name: 'test/repo',
    url: 'https://github.com/test/repo',
    description: 'A test repo',
    provider: 'github',
    metadata: {},
    ...overrides,
  };
}

const originalFetch = global.fetch;

function makeEnv() {
  return {
    GITHUB_TOKEN: 'ghp_test_token',
    LOG_LEVEL: 'warn' as const,
    MAX_RESULTS_PER_PROVIDER: 10,
    REQUEST_TIMEOUT_MS: 1000,
  };
}

function makeQuery(text: string, category: QueryCategory = 'github-repos') {
  return { text, category, providers: ['github'] as const };
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

// ─── sanitizeGitHubQuery ──────────────────────────────────────────────────────

describe('sanitizeGitHubQuery', () => {
  it('removes site:github.com prefix', () => {
    const result = sanitizeGitHubQuery(
      'site:github.com "Claude Code" "reasoning_content"',
    );
    expect(result).not.toContain('site:github.com');
    expect(result).toContain('"Claude Code"');
    expect(result).toContain('"reasoning_content"');
  });

  it('removes site: prefixes with other domains', () => {
    const result = sanitizeGitHubQuery(
      'site:stackoverflow.com "Claude Code" error',
    );
    expect(result).not.toContain('site:stackoverflow.com');
    expect(result).toContain('"Claude Code"');
  });

  it('removes very long unquoted tokens (error logs)', () => {
    const longLog = 'a'.repeat(200);
    const result = sanitizeGitHubQuery(`"Claude Code" ${longLog} proxy`);
    expect(result).not.toContain(longLog);
    expect(result).toContain('"Claude Code"');
    expect(result).toContain('proxy');
  });

  it('preserves quoted phrases', () => {
    const result = sanitizeGitHubQuery(
      '"reasoning_content" "Claude Code" "DeepSeek"',
    );
    expect(result).toContain('"reasoning_content"');
    expect(result).toContain('"Claude Code"');
    expect(result).toContain('"DeepSeek"');
  });

  it('preserves key stack names and keywords', () => {
    const result = sanitizeGitHubQuery('Claude Code DeepSeek reasoning_content proxy');
    expect(result).toContain('Claude Code');
    expect(result).toContain('DeepSeek');
    expect(result).toContain('reasoning_content');
    expect(result).toContain('proxy');
  });

  it('truncates queries exceeding max length', () => {
    const longQuery = 'a '.repeat(300);
    const result = sanitizeGitHubQuery(longQuery);
    expect(result.length).toBeLessThanOrEqual(256);
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeGitHubQuery('   ')).toBe('');
  });

  it('collapses multiple spaces', () => {
    const result = sanitizeGitHubQuery('Claude   Code    DeepSeek');
    expect(result).toBe('Claude Code DeepSeek');
  });
});

// ─── deduplicateByFullName ────────────────────────────────────────────────────

describe('deduplicateByFullName', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateByFullName([])).toEqual([]);
  });

  it('returns single candidate unchanged', () => {
    const candidates = [makeCandidate({ name: 'owner/repo' })];
    expect(deduplicateByFullName(candidates)).toHaveLength(1);
  });

  it('deduplicates by full_name case-insensitively', () => {
    const candidates = [
      makeCandidate({ name: 'Owner/Repo', id: 'url1' }),
      makeCandidate({ name: 'owner/repo', id: 'url2' }),
    ];
    const result = deduplicateByFullName(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('url1'); // keeps first
  });

  it('keeps distinct repos', () => {
    const candidates = [
      makeCandidate({ name: 'owner/repo-a' }),
      makeCandidate({ name: 'owner/repo-b' }),
      makeCandidate({ name: 'other/repo-c' }),
    ];
    expect(deduplicateByFullName(candidates)).toHaveLength(3);
  });

  it('handles multiple duplicates keeping first occurrence', () => {
    const candidates = [
      makeCandidate({ name: 'a/x', id: '1' }),
      makeCandidate({ name: 'b/y', id: '2' }),
      makeCandidate({ name: 'a/x', id: '3' }),
      makeCandidate({ name: 'b/y', id: '4' }),
      makeCandidate({ name: 'c/z', id: '5' }),
    ];
    const result = deduplicateByFullName(candidates);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(['1', '2', '5']);
  });
});

// ─── extractReadmeMetadata ────────────────────────────────────────────────────

describe('extractReadmeMetadata', () => {
  it('detects npm install as install instruction', () => {
    const meta = extractReadmeMetadata('## Install\n\n```bash\nnpm install my-package\n```');
    expect(meta.hasInstallInstructions).toBe(true);
  });

  it('detects pip install as install instruction', () => {
    const meta = extractReadmeMetadata('pip install my-package');
    expect(meta.hasInstallInstructions).toBe(true);
  });

  it('detects go install as install instruction', () => {
    const meta = extractReadmeMetadata('go install github.com/foo/bar@latest');
    expect(meta.hasInstallInstructions).toBe(true);
  });

  it('detects brew install as install instruction', () => {
    const meta = extractReadmeMetadata('brew install my-tool');
    expect(meta.hasInstallInstructions).toBe(true);
  });

  it('detects cargo install as install instruction', () => {
    const meta = extractReadmeMetadata('cargo install my-crate');
    expect(meta.hasInstallInstructions).toBe(true);
  });

  it('returns false for no install instructions', () => {
    const meta = extractReadmeMetadata('# My Project\n\nJust a description.');
    expect(meta.hasInstallInstructions).toBe(false);
  });

  it('detects example config with code block', () => {
    const meta = extractReadmeMetadata(
      '## Example configuration\n\n```yaml\nport: 8080\n```',
    );
    expect(meta.hasExampleConfig).toBe(true);
  });

  it('detects config section with code block', () => {
    const meta = extractReadmeMetadata(
      '## Config\n\n```json\n{"key": "value"}\n```',
    );
    expect(meta.hasExampleConfig).toBe(true);
  });

  it('returns false for no example config', () => {
    const meta = extractReadmeMetadata('# Title\n\nJust some text without code blocks.');
    expect(meta.hasExampleConfig).toBe(false);
  });

  it('detects curl pipe bash without checksum as suspicious', () => {
    const meta = extractReadmeMetadata(
      'curl https://example.com/install.sh | bash',
    );
    expect(meta.hasSuspiciousInstallScript).toBe(true);
  });

  it('detects wget pipe sh without checksum as suspicious', () => {
    const meta = extractReadmeMetadata(
      'wget https://example.com/install.sh | sh',
    );
    expect(meta.hasSuspiciousInstallScript).toBe(true);
  });

  it('does not flag curl pipe bash with checksum verification', () => {
    const meta = extractReadmeMetadata(
      'curl https://example.com/install.sh | sha256sum -c checksum.txt && bash install.sh',
    );
    expect(meta.hasSuspiciousInstallScript).toBe(false);
  });

  it('does not flag normal install commands', () => {
    const meta = extractReadmeMetadata('npm install my-package');
    expect(meta.hasSuspiciousInstallScript).toBe(false);
  });

  it('handles empty README', () => {
    const meta = extractReadmeMetadata('');
    expect(meta).toEqual({
      hasInstallInstructions: false,
      hasExampleConfig: false,
      hasSuspiciousInstallScript: false,
    });
  });
});

// ─── searchGitHub repository search hardening ─────────────────────────────────

describe('searchGitHub repository search hardening', () => {
  it('returns an empty array for rate-limit-like responses', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const results = await searchGitHub(makeQuery('Claude Code'), makeEnv());

    expect(results).toEqual([]);
  });

  it('returns an empty array for malformed JSON responses', async () => {
    global.fetch = jest.fn(async () =>
      new Response('{bad-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const results = await searchGitHub(makeQuery('Claude Code'), makeEnv());

    expect(results).toEqual([]);
  });

  it('maps repository results and fetches README text', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        total_count: 1,
        items: [{
          full_name: 'owner/fix-tool',
          html_url: 'https://github.com/owner/fix-tool',
          description: 'Fixes reasoning_content errors',
          stargazers_count: 42,
          license: { spdx_id: 'MIT' },
          pushed_at: '2026-05-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          archived: false,
          open_issues_count: 3,
          owner: { type: 'Organization' },
          default_branch: 'main',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('## Install\n\nnpm install fix-tool', {
        status: 200,
      })) as unknown as typeof fetch;

    const results = await searchGitHub(makeQuery('"reasoning_content"'), makeEnv());

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'https://github.com/owner/fix-tool',
      name: 'owner/fix-tool',
      url: 'https://github.com/owner/fix-tool',
      description: 'Fixes reasoning_content errors',
      provider: 'github',
      metadata: {
        stars: 42,
        license: 'MIT',
        isArchived: false,
        openIssueCount: 3,
        ownerType: 'organization',
        hasInstallInstructions: true,
      },
    });
  });
});

// ─── searchGitHubIssues ──────────────────────────────────────────────────────

describe('searchGitHubIssues', () => {
  it('maps GitHub issue search results into issue candidates', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({
        total_count: 1,
        items: [{
          html_url: 'https://github.com/owner/repo/issues/2365',
          title: 'DeepSeek reasoning_content error',
          body: 'Claude Code fails when DeepSeek returns reasoning_content.',
          number: 2365,
          state: 'open',
          repository_url: 'https://api.github.com/repos/owner/repo',
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
          user: { type: 'User' },
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const results = await searchGitHubIssues(
      makeQuery('"reasoning_content" "Claude Code"', 'github-issues'),
      makeEnv(),
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'https://github.com/owner/repo/issues/2365',
      name: 'owner/repo#2365',
      url: 'https://github.com/owner/repo/issues/2365',
      description: 'DeepSeek reasoning_content error',
      readmeSnippet: 'Claude Code fails when DeepSeek returns reasoning_content.',
      provider: 'github',
      candidateTypeHint: 'issue',
      nextStepHint: 'Read the issue thread for confirmed workarounds, maintainer responses, and affected versions.',
      metadata: {
        ownerType: 'user',
      },
    });
    expect(results[0].metadata.createdDate).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(results[0].metadata.lastCommitDate).toEqual(new Date('2026-05-01T00:00:00Z'));
  });

  it('returns an empty array for issue search rate limits', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const results = await searchGitHubIssues(
      makeQuery('"reasoning_content"', 'github-issues'),
      makeEnv(),
    );

    expect(results).toEqual([]);
  });
});

// ─── searchGitHubMultiQuery mixed routing ────────────────────────────────────

describe('searchGitHubMultiQuery mixed routing', () => {
  it('routes repo queries to repositories and issue queries to issues', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation(async (url: string) => {
        if (url.includes('/search/repositories')) {
          return new Response(JSON.stringify({ total_count: 0, items: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/search/issues')) {
          return new Response(JSON.stringify({
            total_count: 1,
            items: [{
              html_url: 'https://github.com/owner/repo/issues/10',
              title: 'reasoning_content workaround',
              body: 'Use a response transformer.',
              number: 10,
              state: 'closed',
              repository_url: 'https://api.github.com/repos/owner/repo',
              created_at: '2026-02-01T00:00:00Z',
              updated_at: '2026-03-01T00:00:00Z',
              user: { type: 'Organization' },
            }],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('not found', { status: 404 });
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchGitHubMultiQuery([
      makeQuery('"Claude Code"', 'github-repos'),
      makeQuery('"reasoning_content" issue', 'github-issues'),
    ], makeEnv());

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/search/repositories'))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/search/issues'))).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].candidateTypeHint).toBe('issue');
    expect(results[0].name).toBe('owner/repo#10');
  });
});
