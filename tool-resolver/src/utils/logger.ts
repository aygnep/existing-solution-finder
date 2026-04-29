type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PREFIXES: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO] ',
  warn: '[WARN] ',
  error: '[ERROR]',
};

let currentLevel: LogLevel = 'info';

export const logger = {
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    log('debug', message, meta);
  },

  info(message: string, meta?: Record<string, unknown>): void {
    log('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    log('warn', message, meta);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    log('error', message, meta);
  },
};

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = PREFIXES[level];
  const metaStr = meta ? ' ' + JSON.stringify(sanitizeMeta(meta)) : '';

  const line = `${timestamp} ${prefix} ${message}${metaStr}`;

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stderr.write(line + '\n'); // keep stdout clean for results
  }
}

/**
 * Strips sensitive keys from metadata before logging.
 * Keys containing 'key', 'token', 'secret', 'password' are redacted.
 */
function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sensitivePattern = /key|token|secret|password|auth/i;
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(meta)) {
    result[k] = sensitivePattern.test(k) ? '[REDACTED]' : v;
  }

  return result;
}
