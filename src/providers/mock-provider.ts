import type { Query, RawCandidate } from '../types/candidate.js';

/**
 * A mock search provider for MVP development and testing.
 *
 * Returns fake candidates that exercise the full scoring pipeline
 * without requiring real API keys.
 */
export function createMockProvider(
  mockResults: readonly RawCandidate[],
): (query: Query) => Promise<readonly RawCandidate[]> {
  return async (query: Query): Promise<readonly RawCandidate[]> => {
    // Simulate matching: return candidates whose name or description
    // contains any word from the query text
    const queryWords = query.text
      .replace(/["]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    return mockResults.filter((c) => {
      const searchable = `${c.name} ${c.description} ${c.readmeSnippet ?? ''}`.toLowerCase();
      return queryWords.some((w) => searchable.includes(w));
    });
  };
}

/**
 * A built-in set of mock candidates for the "Claude Code + DeepSeek reasoning_content"
 * scenario. Exercises all score tiers, trust levels, and penalty conditions.
 */
export function getBuiltinMockCandidates(): readonly RawCandidate[] {
  const now = Date.now();
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000);
  const fourYearsAgo = new Date(now - 4 * 365 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'https://github.com/example/openai-proxy-strip',
      name: 'openai-proxy-strip',
      url: 'https://github.com/example/openai-proxy-strip',
      description: 'A lightweight proxy that strips extra fields like reasoning_content from OpenAI-compatible API responses.',
      readmeSnippet: `# openai-proxy-strip

Strips unexpected fields (e.g. \`reasoning_content\`) from OpenAI-compatible API responses.

## Usage

\`\`\`bash
npm install openai-proxy-strip
\`\`\`

## Example config

\`\`\`json
{
  "strip_fields": ["reasoning_content"],
  "upstream": "https://api.deepseek.com/v1"
}
\`\`\`

Compatible with Claude Code, OpenCode Go, and other OpenAI API consumers.`,
      provider: 'github',
      metadata: {
        stars: 230,
        license: 'MIT',
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 5,
        ownerType: 'organization',
        hasInstallInstructions: true,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },
    {
      id: 'https://github.com/example/deepseek-adapter',
      name: 'deepseek-adapter',
      url: 'https://github.com/example/deepseek-adapter',
      description: 'Adapter to make DeepSeek API responses compatible with standard OpenAI format.',
      readmeSnippet: `# deepseek-adapter

Converts DeepSeek API responses to strict OpenAI format. Handles reasoning_content, tool calls, and streaming.

## Install

\`\`\`bash
npm install deepseek-adapter
\`\`\`

## Usage

Wrap your DeepSeek client:

\`\`\`typescript
import { adapt } from 'deepseek-adapter';
const client = adapt(deepseekClient);
\`\`\``,
      provider: 'github',
      metadata: {
        stars: 89,
        license: 'Apache-2.0',
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 12,
        ownerType: 'user',
        hasInstallInstructions: true,
        hasExampleConfig: false,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },
    {
      id: 'https://github.com/example/llm-proxy-middleware',
      name: 'llm-proxy-middleware',
      url: 'https://github.com/example/llm-proxy-middleware',
      description: 'General LLM response proxy with field filtering, rate limiting, and caching.',
      readmeSnippet: `# llm-proxy-middleware

A general-purpose proxy for LLM APIs.

## Features
- Field filtering (whitelist/blacklist)
- Rate limiting
- Response caching
- Usage tracking

## Install
\`\`\`bash
go install github.com/example/llm-proxy-middleware@latest
\`\`\``,
      provider: 'github',
      metadata: {
        stars: 1200,
        license: 'MIT',
        lastCommitDate: oneMonthAgo,
        createdDate: twoYearsAgo,
        isArchived: false,
        openIssueCount: 23,
        ownerType: 'organization',
        hasInstallInstructions: true,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },
    {
      id: 'https://github.com/example/claude-deepseek-bridge',
      name: 'claude-deepseek-bridge',
      url: 'https://github.com/example/claude-deepseek-bridge',
      description: 'Bridge Claude Code and DeepSeek with field mapping.',
      readmeSnippet: '', // No real README — should get penalty
      provider: 'github',
      metadata: {
        stars: 8,
        license: undefined,
        lastCommitDate: sixMonthsAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 0,
        ownerType: 'user',
        hasInstallInstructions: false,
        hasExampleConfig: false,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },
    {
      id: 'https://github.com/example/openai-response-cleaner',
      name: 'openai-response-cleaner',
      url: 'https://github.com/example/openai-response-cleaner',
      description: 'Cleans and normalizes OpenAI API responses. Archived.',
      readmeSnippet: `# openai-response-cleaner (ARCHIVED)

⚠️ This project is no longer maintained.

Install: curl https://raw.example.com/install.sh | bash`,
      provider: 'github',
      metadata: {
        stars: 450,
        license: 'MIT',
        lastCommitDate: fourYearsAgo,
        createdDate: fourYearsAgo,
        isArchived: true,
        openIssueCount: 87,
        ownerType: 'organization',
        hasInstallInstructions: true,
        hasExampleConfig: false,
        hasSuspiciousInstallScript: true,
        requiresSecretsTransmission: false,
      },
    },
    {
      id: 'https://www.npmjs.com/package/opencode-go-wrapper',
      name: 'opencode-go-wrapper',
      url: 'https://www.npmjs.com/package/opencode-go-wrapper',
      description: 'Node.js wrapper for OpenCode Go CLI.',
      readmeSnippet: `# opencode-go-wrapper

Call OpenCode Go from Node.js.

## Install
npm install opencode-go-wrapper

## Usage
\`\`\`js
const { opencode } = require('opencode-go-wrapper');
await opencode.complete('Hello');
\`\`\``,
      provider: 'npm',
      metadata: {
        stars: undefined,
        license: 'ISC',
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 2,
        ownerType: 'user',
        hasInstallInstructions: true,
        hasExampleConfig: false,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },
  ];
}
