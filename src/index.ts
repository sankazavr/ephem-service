// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './server.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

const app = await buildApp({
  ephePath: process.env.EPHE_PATH ?? `${root}ephe`,
  sourceUrl: process.env.SOURCE_URL ?? 'https://github.com/sankazavr/ephem-service',
  version: pkg.version,
  gitSha: process.env.GIT_SHA ?? 'dev',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
  logger: true,
});

await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 8095) });
