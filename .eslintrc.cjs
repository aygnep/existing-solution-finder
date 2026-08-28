module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'],
  overrides: [
    {
      files: ['tests/**/*.ts', 'web/src/**/*.test.tsx'],
      env: { jest: true },
    },
    {
      files: ['web/src/**/*.ts', 'web/src/**/*.tsx'],
      env: { browser: true },
    },
  ],
};
