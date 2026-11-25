#!/usr/bin/env node
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { sanitizeForOutput } from '../feedback/redaction.js';
import { z } from 'zod';
import { discoverSolutions } from '../core/discovery-service.js';
import { createDiscoverySearchers } from '../providers/discovery-searchers.js';
import { createJevReranker, createLayaReranker } from '../providers/system-one-reranker.js';
import { loadEnv } from '../utils/env.js';
import { buildDiscoveryRequest, type DiscoveryRequest, type DiscoveryResult } from '../types/discovery.js';

const requestSchema = z.object({
  problem: z.string().trim().min(1).max(10_000),
  stack: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  constraints: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  providers: z.array(z.enum(['github', 'npm', 'web'])).min(1).max(3),
  mode: z.enum(['mock', 'real']),
  maxResults: z.number().int().min(1).max(20),
  reranker: z.enum(['jev', 'laya']).optional(),
});

export interface GatewayDependencies {
  readonly staticRoot?: string;
  readonly discover?: (request: DiscoveryRequest) => Promise<DiscoveryResult>;
}

export function createGateway(dependencies: GatewayDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const discover = dependencies.discover ?? discoverFromEnvironment;

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host ?? '';
    const origin = request.headers.origin;
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host) ||
      (origin !== undefined && origin !== `http://${host}` &&
        !/^http:\/\/(?:127\.0\.0\.1|localhost):5173$/.test(origin))) {
      return reply.code(403).send({ error: 'Only local requests are accepted.' });
    }
  });

  const staticRoot = dependencies.staticRoot ?? resolve(__dirname, '../../web/dist');
  if (existsSync(staticRoot)) {
    void app.register(fastifyStatic, { root: staticRoot, index: 'index.html', dotfiles: 'deny' });
  }

  app.get('/health', async () => ({ ok: true }));
  app.post('/api/discover', async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid discovery request.' });

    try {
      return sanitizeForOutput(await discover(buildDiscoveryRequest(parsed.data)));
    } catch {
      return reply.code(500).send({ error: 'Discovery failed. Check provider status and retry.' });
    }
  });

  return app;
}

async function discoverFromEnvironment(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const searchers = await createDiscoverySearchers(request.mode);
  const reranker = request.mode === 'real'
    ? request.reranker === 'jev' ? createJevReranker(loadEnv())
      : request.reranker === 'laya' ? createLayaReranker(loadEnv()) : undefined
    : undefined;
  return discoverSolutions({ request, now: new Date(), searchers, reranker });
}

if (require.main === module) {
  void (async () => {
    try {
      loadEnv();
      const app = createGateway();
      await app.listen({ host: '127.0.0.1', port: 4174 });
      console.log('Fixseek Web: http://127.0.0.1:4174');
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => { void app.close(); });
      }
    } catch {
      console.error('Unable to start Fixseek Web. Check .env.example settings and whether port 4174 is in use.');
      process.exitCode = 1;
    }
  })();
}
