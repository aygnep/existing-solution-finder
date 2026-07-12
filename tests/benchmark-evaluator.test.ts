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
