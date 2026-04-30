import { parseLanguage } from '../src/i18n/messages';
import { parseProblem } from '../src/core/problem-parser';
import { generateQueries } from '../src/core/query-generator';
import { scoreAndAttach } from '../src/core/scorer';
import { rankCandidates } from '../src/core/ranker';
import { summarize } from '../src/core/summarizer';
import { createMockProvider, getBuiltinMockCandidates } from '../src/providers/mock-provider';

const FIXED_NOW = new Date('2026-04-30T00:00:00Z').getTime();
const originalDateNow = Date.now;

beforeAll(() => {
  Date.now = () => FIXED_NOW;
});

afterAll(() => {
  Date.now = originalDateNow;
});

async function render(lang?: 'en' | 'zh'): Promise<string> {
  const problem = parseProblem('reasoning_content error with Claude Code + DeepSeek + OpenCode Go');
  const queries = generateQueries(problem);
  const mockSearch = createMockProvider(getBuiltinMockCandidates());
  const rawResults = await Promise.all(queries.map((q) => mockSearch(q)));
  const scored = rawResults.flat().map((c) => scoreAndAttach(c, problem));
  const ranked = rankCandidates(scored, { maxResults: 3 });
  return summarize(ranked, problem, lang ? { lang } : {});
}

describe('i18n output', () => {
  it('defaults to English labels', async () => {
    const output = await render();
    expect(output).toContain('Top matches');
    expect(output).toContain('Type:');
    expect(output).toContain('Fit score:');
  });

  it('renders Chinese labels with --lang zh behavior', async () => {
    const output = await render('zh');
    expect(output).toContain('最佳匹配');
    expect(output).toContain('类型:');
    expect(output).toContain('匹配分:');
    expect(output).toContain('下一步:');
  });

  it('renders English labels with --lang en behavior', async () => {
    const output = await render('en');
    expect(output).toContain('Top matches');
    expect(output).toContain('Type:');
    expect(output).toContain('Fit score:');
  });

  it('rejects unsupported languages clearly', () => {
    expect(() => parseLanguage('fr')).toThrow(
      'Unsupported language: fr. Supported languages: en, zh.',
    );
  });

  it('does not translate candidate names, error keywords, or URLs', async () => {
    const output = await render('zh');
    expect(output).toContain('oc-go-cc');
    expect(output).toContain('reasoning_content');
    expect(output).toContain('https://github.com/luobogor/oc-go-cc');
  });
});
