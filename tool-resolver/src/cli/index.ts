#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { parseProblem } from '../core/problem-parser.js';
import { generateQueries } from '../core/query-generator.js';
import { scoreAndAttach } from '../core/scorer.js';
import { rankCandidates } from '../core/ranker.js';
import { summarize } from '../core/summarizer.js';
import { createMockProvider, getBuiltinMockCandidates } from '../providers/mock-provider.js';
import type { RawCandidate } from '../types/candidate.js';

const program = new Command();

program
  .name('tool-resolver')
  .description('Find existing tools and projects that solve your technical problem')
  .version('0.1.0');

program
  .command('solve <problem>', { isDefault: true })
  .description('Analyze a problem and find matching tools')
  .option('--stdin', 'Read problem from stdin instead of argument')
  .option('--max-results <n>', 'Maximum results to show', '10')
  .option('--mock', 'Use mock provider (no real API calls)', true)
  .option('--log-level <level>', 'Log level: debug | info | warn | error', 'info')
  .action(async (problemArg: string, options: {
    stdin?: boolean;
    maxResults: string;
    mock: boolean;
    logLevel: string;
  }) => {
    logger.setLevel(options.logLevel as 'debug' | 'info' | 'warn' | 'error');

    // Collect problem input
    let problemText = problemArg;
    if (options.stdin) {
      problemText = await readStdin();
    }

    if (!problemText?.trim()) {
      process.stderr.write('Error: problem description is empty.\n');
      process.exit(1);
    }

    logger.info('Analyzing problem...', { length: problemText.length });

    // 1. Parse
    const problem = parseProblem(problemText);
    logger.debug('Parsed problem', {
      errorTokens: problem.errorTokens.length,
      stackNames: problem.stackNames.length,
      keywords: problem.keywords.length,
    });

    // 2. Generate queries
    const queries = generateQueries(problem);
    logger.info(`Generated ${queries.length} queries`);

    // 3. Search (mock or real)
    let allCandidates: RawCandidate[];

    if (options.mock) {
      logger.info('Using mock provider (no real API calls)');
      const mockSearch = createMockProvider(getBuiltinMockCandidates());
      const results = await Promise.all(queries.map((q) => mockSearch(q)));
      allCandidates = results.flat();
    } else {
      // Real providers require env — lazy-load to avoid error when using mock
      const { loadEnv } = await import('../utils/env.js');
      const { searchGitHub } = await import('../providers/github-search.js');
      const { searchWeb } = await import('../providers/web-search.js');
      const { searchPackages } = await import('../providers/package-search.js');

      let env;
      try {
        env = loadEnv();
      } catch (err) {
        process.stderr.write(String(err) + '\n');
        process.exit(1);
      }

      allCandidates = [];
      const searchPromises = queries.flatMap((query) => {
        const promises: Promise<void>[] = [];

        if (query.providers.includes('github')) {
          promises.push(
            searchGitHub(query, env).then((results) => {
              allCandidates.push(...results);
            }).catch((err: unknown) => {
              logger.warn('GitHub search failed', { error: String(err) });
            }),
          );
        }
        if (query.providers.includes('web')) {
          promises.push(
            searchWeb(query, env).then((results) => {
              allCandidates.push(...results);
            }).catch((err: unknown) => {
              logger.warn('Web search failed', { error: String(err) });
            }),
          );
        }
        if (query.providers.includes('npm')) {
          promises.push(
            searchPackages(query, env).then((results) => {
              allCandidates.push(...results);
            }).catch((err: unknown) => {
              logger.warn('npm search failed', { error: String(err) });
            }),
          );
        }
        return promises;
      });
      await Promise.all(searchPromises);
    }

    logger.info(`Found ${allCandidates.length} raw candidates`);

    // 4. Score
    const scored = allCandidates.map((c) => scoreAndAttach(c, problem));

    // 5. Rank
    const ranked = rankCandidates(scored, {
      maxResults: parseInt(options.maxResults, 10),
    });

    // 6. Output
    const output = summarize(ranked, problem);
    process.stdout.write(output);
  });

program.parse();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.resume();
  });
}
