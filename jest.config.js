/** @type {import('ts-jest').JestConfigWithTsJest} */
const moduleNameMapper = { '^(\\.\\.?/.*)\\.js$': '$1' };

module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts'],
      moduleNameMapper,
      collectCoverageFrom: ['src/core/**/*.ts', '!src/**/*.d.ts'],
      coverageThreshold: { global: { branches: 70, functions: 80, lines: 80, statements: 80 } },
    },
    {
      displayName: 'web',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/web/src'],
      testMatch: ['**/*.test.tsx'],
      moduleNameMapper,
      setupFilesAfterEnv: ['<rootDir>/web/src/test-setup.ts'],
      globals: { 'ts-jest': { tsconfig: '<rootDir>/web/tsconfig.json' } },
    },
  ],
};
