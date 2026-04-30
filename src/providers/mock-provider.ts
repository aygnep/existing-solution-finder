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
 *
 * Required candidates (per Phase 2 spec):
 *   1. oc-go-cc          — should rank #1 for "reasoning_content + DeepSeek + OpenCode Go"
 *   2. claude-code-router
 *   3. UniClaudeProxy
 *   4. cc-switch issue workaround
 *   5. generic "disable thinking mode" workaround
 */
export function getBuiltinMockCandidates(): readonly RawCandidate[] {
  const now = Date.now();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
  const twoYearsAgo = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000);
  const fourYearsAgo = new Date(now - 4 * 365 * 24 * 60 * 60 * 1000);

  return [
    // ─── CANDIDATE 1: oc-go-cc (REQUIRED — must rank #1 for target query) ──────
    {
      id: 'https://github.com/luobogor/oc-go-cc',
      name: 'oc-go-cc',
      url: 'https://github.com/luobogor/oc-go-cc',
      description:
        'OpenCode Go + Claude Code adapter that strips reasoning_content and other DeepSeek-specific fields from API responses, making DeepSeek fully compatible with Claude Code.',
      readmeSnippet: `# oc-go-cc

A proxy adapter between OpenCode Go and Claude Code that handles the \`reasoning_content\` field
emitted by DeepSeek models (deepseek-reasoner, deepseek-r1).

## Problem

When using Claude Code with OpenCode Go as a proxy backend, and DeepSeek as the LLM provider,
the DeepSeek API returns a \`reasoning_content\` field that Claude Code cannot parse,
causing an "Unexpected field" error.

## Solution

oc-go-cc sits between OpenCode Go and Claude Code, stripping \`reasoning_content\` and other
non-standard fields before forwarding responses to Claude Code.

## Install

\`\`\`bash
go install github.com/luobogor/oc-go-cc@latest
\`\`\`

## Usage

\`\`\`bash
# Start the adapter on port 8787
oc-go-cc --port 8787 --upstream http://localhost:8080
\`\`\`

## Example config (config.yaml)

\`\`\`yaml
upstream: "http://localhost:8080"   # OpenCode Go address
strip_fields:
  - reasoning_content
  - thinking
port: 8787
\`\`\`

Configure Claude Code to use \`http://localhost:8787\` as its API base URL.
Compatible with Claude Code, OpenCode Go, and DeepSeek deepseek-reasoner model.`,
      provider: 'github',
      candidateTypeHint: 'tool',
      nextStepHint:
        'Run `go install github.com/luobogor/oc-go-cc@latest`, start the adapter with `oc-go-cc --port 8787 --upstream http://localhost:8080`, then point Claude Code to `http://localhost:8787`.',
      metadata: {
        stars: 412,
        license: 'MIT',
        lastCommitDate: twoWeeksAgo,
        createdDate: twoMonthsAgo,
        isArchived: false,
        openIssueCount: 7,
        ownerType: 'user',
        hasInstallInstructions: true,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },

    // ─── CANDIDATE 2: claude-code-router (REQUIRED) ───────────────────────────
    {
      id: 'https://github.com/musistudio/claude-code-router',
      name: 'claude-code-router',
      url: 'https://github.com/musistudio/claude-code-router',
      description:
        'A router/proxy for Claude Code that supports multiple LLM backends including DeepSeek, OpenAI, and Anthropic. Handles field normalization and reasoning_content stripping.',
      readmeSnippet: `# claude-code-router

Route Claude Code requests to different LLM providers (DeepSeek, OpenAI, Anthropic, Ollama).

## Features
- Transparent proxy — no Claude Code configuration changes needed
- Strips non-standard fields including \`reasoning_content\` from DeepSeek responses
- Supports multiple concurrent backends
- Works with OpenCode Go as an upstream

## Install

\`\`\`bash
npm install -g claude-code-router
\`\`\`

## Quick start

\`\`\`bash
ccrouter --config config.json
\`\`\`

## Example config

\`\`\`json
{
  "port": 3000,
  "backends": [
    {
      "name": "deepseek",
      "url": "https://api.deepseek.com/v1",
      "stripFields": ["reasoning_content"]
    }
  ]
}
\`\`\`

Compatible with Claude Code and DeepSeek.`,
      provider: 'github',
      candidateTypeHint: 'tool',
      nextStepHint:
        'Run `npm install -g claude-code-router`, create a config.json with your DeepSeek backend, then start with `ccrouter --config config.json` and point Claude Code to `http://localhost:3000`.',
      metadata: {
        stars: 890,
        license: 'MIT',
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 23,
        ownerType: 'user',
        hasInstallInstructions: true,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },

    // ─── CANDIDATE 3: UniClaudeProxy (REQUIRED) ───────────────────────────────
    {
      id: 'https://github.com/douo/UniClaudeProxy',
      name: 'UniClaudeProxy',
      url: 'https://github.com/douo/UniClaudeProxy',
      description:
        'Universal Claude-compatible proxy that normalizes responses from DeepSeek, Gemini, and other LLMs to the Anthropic API format. Strips reasoning_content and thinking fields automatically.',
      readmeSnippet: `# UniClaudeProxy

A universal proxy that makes any OpenAI-compatible LLM work with Claude Code by normalizing API responses
to Anthropic format.

## Supported providers
- DeepSeek (strips \`reasoning_content\`, \`thinking\`)
- Gemini (via OpenAI-compatible endpoint)
- Local models via Ollama

## Install

\`\`\`bash
pip install uni-claude-proxy
\`\`\`

## Usage

\`\`\`bash
uniclaudeproxy --port 5000 --provider deepseek --api-key $DEEPSEEK_API_KEY
\`\`\`

## Example config

\`\`\`yaml
provider: deepseek
upstream: https://api.deepseek.com/v1
strip_fields: [reasoning_content, thinking]
port: 5000
\`\`\`

Compatible with Claude Code and DeepSeek.`,
      provider: 'github',
      candidateTypeHint: 'tool',
      nextStepHint:
        'Run `pip install uni-claude-proxy`, configure your DeepSeek API key, then start with `uniclaudeproxy --port 5000 --provider deepseek`.',
      metadata: {
        stars: 340,
        license: 'Apache-2.0',
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: 15,
        ownerType: 'user',
        hasInstallInstructions: true,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },

    // ─── CANDIDATE 4: cc-switch issue workaround (REQUIRED) ──────────────────
    {
      id: 'https://github.com/opencode-ai/opencode/issues/312',
      name: 'cc-switch issue: reasoning_content workaround',
      url: 'https://github.com/opencode-ai/opencode/issues/312',
      description:
        'GitHub issue in OpenCode tracking the reasoning_content incompatibility with Claude Code. Includes workaround: set CC_DISABLE_THINKING=1 env var or use the --no-thinking flag.',
      readmeSnippet: `Issue: reasoning_content field breaks Claude Code when using DeepSeek via OpenCode Go.

**Workaround (until fix is merged):**

Set the environment variable before starting OpenCode Go:
\`\`\`bash
CC_DISABLE_THINKING=1 opencode
\`\`\`

Or pass the flag:
\`\`\`bash
opencode --no-thinking
\`\`\`

This disables the reasoning chain in DeepSeek responses, preventing \`reasoning_content\` from
appearing in the API output. Claude Code can then parse responses normally.

Status: Fix in progress — tracked in PR #315.`,
      provider: 'github',
      candidateTypeHint: 'issue',
      nextStepHint:
        'Set `CC_DISABLE_THINKING=1` before starting OpenCode Go, or pass `--no-thinking` flag. Watch the issue for a permanent fix in PR #315.',
      metadata: {
        stars: undefined,
        license: undefined,
        lastCommitDate: twoWeeksAgo,
        createdDate: twoMonthsAgo,
        isArchived: false,
        openIssueCount: undefined,
        ownerType: 'organization',
        hasInstallInstructions: false,
        hasExampleConfig: false,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },

    // ─── CANDIDATE 5: disable thinking mode workaround (REQUIRED) ────────────
    {
      id: 'workaround:deepseek-disable-thinking',
      name: 'DeepSeek: disable thinking mode via API param',
      url: 'https://api-docs.deepseek.com/guides/reasoning_model',
      description:
        'Workaround: set `enable_thinking: false` in DeepSeek API requests to prevent reasoning_content from being returned. Works without any proxy — only requires a request parameter change.',
      readmeSnippet: `DeepSeek reasoning models (deepseek-reasoner, deepseek-r1) return a \`reasoning_content\` field
by default when thinking mode is enabled. To disable it:

**Option A — API parameter (recommended):**

\`\`\`json
{
  "model": "deepseek-reasoner",
  "messages": [...],
  "enable_thinking": false
}
\`\`\`

**Option B — Environment variable (OpenCode Go):**

\`\`\`bash
DEEPSEEK_DISABLE_THINKING=true opencode
\`\`\`

Disabling thinking mode removes \`reasoning_content\` entirely. Claude Code can then parse
DeepSeek responses without errors. Note: disabling thinking reduces answer quality on
reasoning-heavy tasks.`,
      provider: 'web',
      candidateTypeHint: 'workaround',
      nextStepHint:
        'Add `"enable_thinking": false` to your DeepSeek API request body, or set `DEEPSEEK_DISABLE_THINKING=true` in your environment before starting OpenCode Go.',
      metadata: {
        stars: undefined,
        license: undefined,
        lastCommitDate: oneMonthAgo,
        createdDate: sixMonthsAgo,
        isArchived: false,
        openIssueCount: undefined,
        ownerType: 'organization',
        hasInstallInstructions: false,
        hasExampleConfig: true,
        hasSuspiciousInstallScript: false,
        requiresSecretsTransmission: false,
      },
    },

    // ─── ADDITIONAL CANDIDATES (for scoring diversity) ────────────────────────

    {
      id: 'https://github.com/example/openai-proxy-strip',
      name: 'openai-proxy-strip',
      url: 'https://github.com/example/openai-proxy-strip',
      description:
        'A lightweight proxy that strips extra fields like reasoning_content from OpenAI-compatible API responses.',
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
      candidateTypeHint: 'tool',
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
      description:
        'Adapter to make DeepSeek API responses compatible with standard OpenAI format.',
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
      candidateTypeHint: 'tool',
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
      description:
        'General LLM response proxy with field filtering, rate limiting, and caching.',
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
      candidateTypeHint: 'tool',
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
      candidateTypeHint: 'tool',
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
      candidateTypeHint: 'tool',
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
  ];
}
