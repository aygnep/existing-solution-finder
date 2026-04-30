import type { ParsedProblem } from '../types/problem.js';
import type { Provider, Query, QueryCategory } from '../types/candidate.js';

/** Maximum queries per category */
const MAX_PER_CATEGORY = 3;

/**
 * Generates search queries from a parsed problem.
 *
 * Produces queries in the five categories defined in SEARCH_STRATEGY.md.
 * This is a pure function: no I/O, no side effects.
 */
export function generateQueries(problem: ParsedProblem): readonly Query[] {
  const queries: Query[] = [
    ...generateExactErrorQueries(problem),
    ...generateStackCompatQueries(problem),
    ...generateGitHubRepoQueries(problem),
    ...generateGitHubIssueQueries(problem),
    ...generateAlternativeQueries(problem),
  ];

  // Deduplicate by query text (case-insensitive)
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Category generators ──────────────────────────────────────────────────────

function generateExactErrorQueries(problem: ParsedProblem): Query[] {
  const providers: Provider[] = ['github', 'web'];
  const queries: Query[] = [];

  for (const token of problem.errorTokens.slice(0, MAX_PER_CATEGORY)) {
    const parts: string[] = [quote(token)];

    // Add the first stack name as context if available
    if (problem.stackNames[0]) {
      parts.push(quote(problem.stackNames[0]));
    }

    queries.push(makeQuery(parts.join(' '), 'exact-error', providers));
  }

  return queries.slice(0, MAX_PER_CATEGORY);
}

function generateStackCompatQueries(problem: ParsedProblem): Query[] {
  const providers: Provider[] = ['github', 'web'];
  const queries: Query[] = [];

  const tools = problem.stackNames;

  // Pairs of tools
  for (let i = 0; i < tools.length && queries.length < MAX_PER_CATEGORY; i++) {
    for (let j = i + 1; j < tools.length && queries.length < MAX_PER_CATEGORY; j++) {
      queries.push(
        makeQuery(
          `${quote(tools[i])} ${quote(tools[j])} proxy`,
          'stack-compatibility',
          providers,
        ),
      );
    }
  }

  // If fewer than max, add a general compat query
  if (queries.length < MAX_PER_CATEGORY && tools.length > 0) {
    queries.push(
      makeQuery(
        `${quote(tools[0])} integration compatible`,
        'stack-compatibility',
        providers,
      ),
    );
  }

  return queries.slice(0, MAX_PER_CATEGORY);
}

function generateGitHubRepoQueries(problem: ParsedProblem): Query[] {
  const providers: Provider[] = ['github', 'web'];
  const queries: Query[] = [];

  // Site-specific queries for GitHub repositories
  const errorToken = problem.errorTokens[0];
  const firstTool = problem.stackNames[0];

  if (errorToken && firstTool) {
    queries.push(
      makeQuery(
        `site:github.com ${quote(firstTool)} ${quote(errorToken)}`,
        'github-repos',
        providers,
      ),
    );
  }

  if (firstTool) {
    queries.push(
      makeQuery(
        `site:github.com ${quote(firstTool)} proxy workaround`,
        'github-repos',
        providers,
      ),
    );
  }

  if (problem.stackNames.length >= 2) {
    queries.push(
      makeQuery(
        `site:github.com ${quote(problem.stackNames[0])} ${quote(problem.stackNames[1])} compatible`,
        'github-repos',
        providers,
      ),
    );
  }

  return queries.slice(0, MAX_PER_CATEGORY);
}

function generateGitHubIssueQueries(problem: ParsedProblem): Query[] {
  const providers: Provider[] = ['github', 'web'];
  const queries: Query[] = [];

  const errorToken = problem.errorTokens[0];

  if (errorToken) {
    queries.push(
      makeQuery(
        `site:github.com ${quote(errorToken)} issue`,
        'github-issues',
        providers,
      ),
    );
  }

  if (problem.stackNames.length >= 2) {
    queries.push(
      makeQuery(
        `site:github.com ${quote(problem.stackNames[0])} ${quote(problem.stackNames[1])} issue`,
        'github-issues',
        providers,
      ),
    );
  }

  if (errorToken && problem.stackNames[0]) {
    queries.push(
      makeQuery(
        `${quote(errorToken)} ${quote(problem.stackNames[0])} workaround`,
        'github-issues',
        providers,
      ),
    );
  }

  return queries.slice(0, MAX_PER_CATEGORY);
}

function generateAlternativeQueries(problem: ParsedProblem): Query[] {
  const providers: Provider[] = ['github', 'web', 'npm'];
  const queries: Query[] = [];

  // Keyword-based broad search
  const keywords = problem.keywords.slice(0, 3).join(' ');
  if (keywords) {
    queries.push(makeQuery(`${keywords} alternative`, 'alternatives', providers));
  }

  // If there's a first tool, look for wrappers/alternatives
  if (problem.stackNames[0]) {
    queries.push(
      makeQuery(
        `${quote(problem.stackNames[0])} workaround middleware`,
        'alternatives',
        providers,
      ),
    );
  }

  // Error-based npm search
  if (problem.errorTokens[0]) {
    queries.push(makeQuery(problem.errorTokens[0], 'alternatives', ['npm']));
  }

  return queries.slice(0, MAX_PER_CATEGORY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function quote(term: string): string {
  // Only quote multi-word terms or terms with special characters
  if (/\s|[()[\]]/.test(term)) {
    return `"${term}"`;
  }
  return term;
}

function makeQuery(text: string, category: QueryCategory, providers: readonly Provider[]): Query {
  return { text, category, providers };
}
