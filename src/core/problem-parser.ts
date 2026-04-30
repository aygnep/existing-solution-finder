import type { ParsedProblem } from '../types/problem.js';

// ─── Known tech stack names for pattern matching ──────────────────────────────

const KNOWN_TOOLS = [
  'Claude Code',
  'DeepSeek',
  'OpenCode Go',
  'OpenCode',
  'Docker',
  'Kubernetes',
  'Node.js',
  'Deno',
  'Bun',
  'Next.js',
  'Vite',
  'Webpack',
  'TypeScript',
  'Go',
  'Python',
  'Rust',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Nginx',
  'Anthropic',
  'OpenAI',
  'LangChain',
  'Ollama',
];

// ─── Regex patterns ───────────────────────────────────────────────────────────

/**
 * Matches error-prefixed lines.
 * Requires a colon separator to avoid capturing natural language like "error with Claude Code".
 */
const ERROR_PATTERN =
  /(?:error|exception|failed|fatal|warn|ECONNREFUSED|ETIMEDOUT|Cannot|Unexpected|invalid):\s*([^\n]{3,80})/gi;


/** Matches version strings like "Node.js 20", "Go 1.22", "v3.4.1" */
const VERSION_PATTERN = /(?:v\d+\.\d+(?:\.\d+)?|\b(?:node|go|python|ruby|java)\s+\d+(?:\.\d+)?)/gi;

/** Matches constraint phrases */
const CONSTRAINT_PATTERN =
  /(?:must\s+be|no\s+cloud|open[\s-]source|offline|self[\s-]host(?:ed)?|free\s+tier|no\s+auth)/gi;

// ─── Pure parser ──────────────────────────────────────────────────────────────

/**
 * Parses a raw problem string into a structured ParsedProblem.
 *
 * This is a pure function: no I/O, no side effects.
 * All extraction is heuristic and best-effort.
 */
export function parseProblem(input: string): ParsedProblem {
  const raw = input.trim();

  return {
    raw,
    errorTokens: extractErrorTokens(raw),
    stackNames: extractStackNames(raw),
    versions: extractVersions(raw),
    constraints: extractConstraints(raw),
    keywords: extractKeywords(raw),
  };
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractErrorTokens(text: string): readonly string[] {
  const tokens = new Set<string>();

  // Match error-prefixed lines (colon-separated to avoid natural language)
  for (const match of text.matchAll(ERROR_PATTERN)) {
    const token = match[1]?.trim();
    if (token && token.length >= 3) {
      tokens.add(token.slice(0, 80)); // cap length
    }
  }

  // Match quoted strings as potential error tokens
  // Only capture if they look like identifiers or error codes (no spaces, or short)
  const quotedPattern = /"([^"\s]{3,40})"|'([^'\s]{3,40})'/g;
  for (const match of text.matchAll(quotedPattern)) {
    const token = (match[1] ?? match[2])?.trim();
    if (token) tokens.add(token);
  }

  // Match snake_case identifiers that look like field names (common in API errors)
  const snakeCasePattern = /\b([a-z][a-z_]{2,}[a-z])\b/g;
  for (const match of text.matchAll(snakeCasePattern)) {
    const token = match[1];
    if (token && token.includes('_') && token.length <= 40) {
      tokens.add(token);
    }
  }

  return [...tokens].slice(0, 10); // max 10 error tokens
}

function extractStackNames(text: string): readonly string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();

  for (const tool of KNOWN_TOOLS) {
    if (lower.includes(tool.toLowerCase())) {
      found.push(tool);
    }
  }

  return found;
}

function extractVersions(text: string): readonly string[] {
  const versions = new Set<string>();

  for (const match of text.matchAll(VERSION_PATTERN)) {
    versions.add(match[0].trim());
  }

  return [...versions].slice(0, 5);
}

function extractConstraints(text: string): readonly string[] {
  const constraints = new Set<string>();

  for (const match of text.matchAll(CONSTRAINT_PATTERN)) {
    constraints.add(match[0].trim().toLowerCase());
  }

  return [...constraints];
}

function extractKeywords(text: string): readonly string[] {
  // Remove already-captured content and extract remaining meaningful words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'i', 'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its',
    'this', 'that', 'have', 'has', 'had', 'do', 'does', 'did',
    'not', 'no', 'can', 'will', 'would', 'could', 'should',
  ]);

  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Deduplicate preserving first occurrence
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
  }

  return keywords.slice(0, 15);
}
