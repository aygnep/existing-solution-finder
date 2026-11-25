const REDACTION_PATTERNS: readonly [RegExp, string][] = [
  [/^(\s*(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*)[^\r\n]+/gim, '$1[REDACTED]'],
  [/(\b(?:api.?key|access.?token|refresh.?token|token|secret|password|passwd|credential|authorization|cookie|session(?:id)?|private.?key)\b\s*["']?\s*[:=]\s*)(["'])([^\r\n]*?)\2/gi, '$1$2[REDACTED]$2'],
  [
    /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
    '[REDACTED]',
  ],
  [/\b(?:github_pat_|gh[pousr]_|npm_)[A-Za-z0-9_]{8,}\b/g, '[REDACTED]'],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]'],
  [/\bAKIA[A-Z0-9]{16}\b/g, '[REDACTED]'],
  [/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[REDACTED]'],
  [/\b(Bearer\s+)[^\s,;]{8,}/gi, '$1[REDACTED]'],
  [
    /(\b(?:api.?key|access.?token|refresh.?token|token|secret|password|passwd|credential|authorization|cookie|session(?:id)?|private.?key)\b\s*["']?\s*[:=]\s*["']?)([^"'\s,;}\]]+)/gi,
    '$1[REDACTED]',
  ],
  [
    /([?&](?:api_?key|token|access_?token|secret|password)=)[^&#\s]+/gi,
    '$1[REDACTED]',
  ],
  [/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[REDACTED]@'],
];

export function redactSensitiveText(value: string): string {
  return REDACTION_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

const SENSITIVE_KEY = /(?:api.?key|token|secret|password|passwd|credential|authorization|cookie|session|private.?key)/i;

export function sanitizeForOutput<T>(value: T): T {
  return sanitizeOutputValue(value, '') as T;
}

function sanitizeOutputValue(value: unknown, key: string): unknown {
  if (SENSITIVE_KEY.test(key) && key !== 'errorTokens' &&
      !(key === 'requiresSecretsTransmission' && typeof value === 'boolean')) return '[REDACTED]';
  if (typeof value === 'string') return redactSensitiveText(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeOutputValue(item, ''));

  const sanitized: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    sanitized[childKey] = sanitizeOutputValue(childValue, childKey);
  }
  return sanitized;
}
