// SPDX-License-Identifier: AGPL-3.0-or-later
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { AYANAMSAS, BODIES, HOUSE_SYSTEMS, JD_MAX, JD_MIN } from './bodies.js';
import { calcChart, initSwe, type ChartRequest } from './swe.js';

export type AppOptions = {
  ephePath: string;
  sourceUrl: string;
  version: string;
  gitSha: string;
  allowedOrigins: string[];
  rateLimitPerMinute: number;
  logger?: boolean;
};

const chartSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['jd_ut', 'bodies'],
    properties: {
      jd_ut: { type: 'number', minimum: JD_MIN, maximum: JD_MAX },
      lat: { type: 'number', minimum: -90, maximum: 90 },
      lon: { type: 'number', minimum: -180, maximum: 180 },
      bodies: { type: 'array', maxItems: 30, items: { type: 'string', enum: Object.keys(BODIES) } },
      house_systems: { type: 'array', maxItems: 7, items: { type: 'string', enum: Object.keys(HOUSE_SYSTEMS) } },
      sidereal: { type: 'string', enum: Object.keys(AYANAMSAS) },
    },
  },
} as const;

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const sweVersion = initSwe(opts.ephePath);
  const engine = `swisseph ${sweVersion}`;

  // Стандартный лог Fastify пишет метод, адрес и статус, но не тело запроса: в нём дата и место рождения.
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: true,
    bodyLimit: 4096,
    // Лишние поля (например, имя) не вырезать молча, а отклонять: сервису не нужны данные о человеке.
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Предложение исходников по разделу 13 AGPL — в каждом ответе.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Source-Code', opts.sourceUrl);
    reply.header('X-License', 'AGPL-3.0-or-later');
  });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || opts.allowedOrigins.includes(origin)),
    methods: ['GET', 'POST'],
    exposedHeaders: ['X-Source-Code', 'X-License'],
    maxAge: 86400,
  });
  await app.register(rateLimit, { max: opts.rateLimitPerMinute, timeWindow: '1 minute' });

  app.get('/v1/health', async () => ({ ok: true, version: opts.version, git_sha: opts.gitSha, engine, ephe_range: '1800-2400' }));

  app.get('/v1/source', async () => ({ repo_url: opts.sourceUrl, license: 'AGPL-3.0-or-later', version: opts.version, git_sha: opts.gitSha }));

  app.post<{ Body: ChartRequest }>('/v1/chart', { schema: chartSchema }, async (req) => ({
    ...calcChart(req.body),
    engine,
    version: opts.version,
  }));

  return app;
}
