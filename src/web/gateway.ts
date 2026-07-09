import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { discoverSolutions, type DiscoverySearchers } from '../core/discovery-service.js';
import { searchGitHubMultiQuery } from '../providers/github-search.js';
import { searchPackages } from '../providers/package-search.js';
import { searchWeb } from '../providers/web-search.js';
import { loadEnv } from '../utils/env.js';
import { buildDiscoveryRequest, type DiscoveryRequest, type DiscoveryResult } from '../types/discovery.js';

const requestSchema = z.object({
  problem: z.string().trim().min(1).max(10_000),
  stack: z.array(z.string().trim().min(1)).max(20).default([]),
  constraints: z.array(z.string().trim().min(1)).max(20).default([]),
  providers: z.array(z.enum(['github', 'npm', 'web'])).min(1).max(3),
  mode: z.enum(['mock', 'real']),
  maxResults: z.number().int().min(1).max(20),
});

export interface GatewayDependencies {
  readonly discover?: (request: DiscoveryRequest) => Promise<DiscoveryResult>;
}

export function createGateway(dependencies: GatewayDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const discover = dependencies.discover ?? discoverFromEnvironment;

  app.get('/health', async () => ({ ok: true }));
  app.post('/api/discover', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid discovery request.' });

    try {
      return await discover(buildDiscoveryRequest(parsed.data));
    } catch {
      return reply.code(500).send({ error: 'Discovery failed. Check provider status and retry.' });
    }
  });

  return app;
}

async function discoverFromEnvironment(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const env = loadEnv();
  const searchers: DiscoverySearchers = {
    github: async (queries) => env.GITHUB_TOKEN
      ? searchGitHubMultiQuery(queries, env)
      : { raw: [], state: 'skipped', message: 'GitHub token is not configured.' },
    web: async (queries) => env.WEB_SEARCH_API_KEY
      ? (await Promise.all(queries.map((query) => searchWeb(query, env)))).flat()
      : { raw: [], state: 'skipped', message: 'Web search key is not configured.' },
    npm: async (queries) => (await Promise.all(queries.map((query) => searchPackages(query, env)))).flat(),
  };

  return discoverSolutions({ request, now: new Date(), searchers });
}

if (require.main === module) {
  const app = createGateway();
  void app.listen({ host: '127.0.0.1', port: 4174 });
}
