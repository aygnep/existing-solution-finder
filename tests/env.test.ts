import { resolveEnvPaths } from '../src/utils/env';

describe('Fixseek environment configuration paths', () => {
  it('prefers an explicit environment file', () => {
    expect(resolveEnvPaths('/workspace/app', '/users/test', './secrets/fixseek.env')).toEqual([
      '/workspace/app/secrets/fixseek.env',
    ]);
  });

  it('falls back to the caller project and user config directory', () => {
    expect(resolveEnvPaths('/workspace/app', '/users/test', undefined)).toEqual([
      '/workspace/app/.env',
      '/users/test/.config/fixseek/.env',
    ]);
  });
});
