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

  it('redacts full authentication headers and quoted secrets with spaces', () => {
    const request = buildDiscoveryRequest({
      problem: 'Vite error\nAuthorization: Basic ZmFrZTpmYWtl\nCookie: arbitrary=fictionalCookie; another=fictionalValue\npassword="fictional secret phrase"',
      stack: [], constraints: [], providers: ['npm'], mode: 'mock', maxResults: 5,
    });
    expect(request.problem).not.toMatch(/ZmFrZT|fictional/);
    expect(request.problem).toContain('Vite error');
  });
