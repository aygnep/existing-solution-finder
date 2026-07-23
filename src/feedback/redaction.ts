const REDACTION_PATTERNS: readonly [RegExp, string][] = [
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
