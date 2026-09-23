import { z } from 'zod';
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

let dotenvLoaded = false;

const emptyToUndefined = (value: unknown): unknown =>
  value === '' ? undefined : value;

const envSchema = z.object({
  GITHUB_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  WEB_SEARCH_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(['brave', 'serpapi']).optional(),
  ),
  WEB_SEARCH_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  TYPESAFE_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  JEV_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
  MAX_RESULTS_PER_PROVIDER: z.coerce.number().int().positive().default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type Env = z.infer<typeof envSchema>;

export function resolveEnvPaths(
  cwd = process.cwd(),
  home = homedir(),
  explicitPath = process.env.FIXSEEK_ENV_FILE,
): readonly string[] {
  if (explicitPath?.trim()) {
    return [resolve(cwd, explicitPath.trim())];
  }

  return [
    resolve(cwd, '.env'),
    resolve(home, '.config', 'fixseek', '.env'),
  ];
}

function loadDotenvFiles(): void {
  if (dotenvLoaded) return;

  const seen = new Set<string>();
  for (const path of resolveEnvPaths()) {
    if (seen.has(path) || !existsSync(path)) continue;
    seen.add(path);
    dotenv.config({ path, override: false });
  }

  dotenvLoaded = true;
}

/**
 * Loads and validates environment variables at startup.
 * Throws a descriptive error if required variables are missing.
 */
export function loadEnv(): Env {
  loadDotenvFiles();
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment configuration error:\n${issues}\n\nSee .env.example for required variables.`);
  }

  return result.data;
}
