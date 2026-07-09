import { buildDiscoveryRequest } from '../src/types/discovery';

describe('discovery request contract', () => {
  it('trims context and retains selected providers', () => {
    expect(buildDiscoveryRequest({
      problem: '  vite module not found  ',
      stack: [' Node.js ', ''],
      constraints: ['open source'],
      providers: ['github', 'npm'],
      mode: 'mock',
      maxResults: 5,
    })).toEqual(expect.objectContaining({
      problem: 'vite module not found',
      stack: ['Node.js'],
      providers: ['github', 'npm'],
    }));
  });
});
