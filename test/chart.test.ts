import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

const SOURCE = 'https://github.com/OWNER/ephem-service';
const ALLOWED = 'https://app.example.org';

const jd = (iso: string) => Date.parse(iso) / 86400000 + 2440587.5;
const dm = (deg: number, min: number) => deg + min / 60;
const SIGN = { ari: 0, tau: 30, gem: 60, can: 90, leo: 120, vir: 150, lib: 180, sco: 210, sag: 240, cap: 270, aqu: 300, pis: 330 };

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({
    ephePath: fileURLToPath(new URL('../ephe', import.meta.url)),
    sourceUrl: SOURCE,
    version: 'test',
    gitSha: 'test',
    allowedOrigins: [ALLOWED],
    rateLimitPerMinute: 5,
  });
});
afterAll(() => app.close());

async function chart(body: object, ip = '10.0.0.1') {
  return app.inject({ method: 'POST', url: '/v1/chart', payload: body, remoteAddress: ip });
}

describe('эталон «Анна», 15.07.2000 12:00 Москва (08:00 UT), docs/core-reference-anna.md Орбиса', () => {
  it('планеты и углы в пределах 1′', async () => {
    const res = await chart({
      jd_ut: jd('2000-07-15T08:00:00Z'), lat: 55.7558, lon: 37.6173,
      bodies: ['sun', 'moon', 'mercury', 'mars', 'pluto', 'chiron', 'lilith', 'trueNode'],
    }, '10.0.1.1');
    expect(res.statusCode).toBe(200);
    const { bodies, houses } = res.json();
    const near = (v: number, exp: number) => expect(Math.abs(v - exp)).toBeLessThanOrEqual(1 / 60);
    near(bodies.sun.lon, SIGN.can + dm(23, 8));
    near(bodies.moon.lon, SIGN.cap + dm(9, 37));
    near(bodies.mercury.lon, SIGN.can + dm(10, 36));
    expect(bodies.mercury.speedLon).toBeLessThan(0);
    near(bodies.mars.lon, SIGN.can + dm(19, 6));
    near(bodies.pluto.lon, SIGN.sag + dm(10, 30));
    near(bodies.chiron.lon, SIGN.sag + dm(11, 39));
    near(bodies.lilith.lon, SIGN.cap + dm(15, 12));
    near(bodies.trueNode.lon, SIGN.can + dm(24, 37));
    expect(houses.placidus.ok).toBe(true);
    near(houses.placidus.asc, SIGN.lib + dm(0, 44));
    near(houses.placidus.mc, SIGN.can + dm(1, 0));
    near(houses.placidus.cusps[1], SIGN.lib + dm(23, 41));
  });
});

describe('сверка с astro.com.ru: Москва, 15.07.1990 08:00 UT', () => {
  it('совпадает до 0,01°', async () => {
    const res = await chart({ jd_ut: jd('1990-07-15T08:00:00Z'), lat: 55.75204, lon: 37.61781, bodies: ['sun', 'moon', 'chiron', 'saturn'] }, '10.0.2.1');
    const { bodies, houses } = res.json();
    expect(Math.abs(bodies.sun.lon - 112.587168)).toBeLessThan(0.01);
    expect(Math.abs(bodies.moon.lon - 20.920632)).toBeLessThan(0.01);
    expect(Math.abs(bodies.chiron.lon - 109.210022)).toBeLessThan(0.01);
    expect(Math.abs(bodies.saturn.lon - 291.975944)).toBeLessThan(0.01);
    expect(Math.abs(houses.placidus.asc - 180.356096)).toBeLessThan(0.01);
  });
});

describe('дома и граничные случаи', () => {
  it('70° с. ш.: Плацидус не определён, Порфирий считается', async () => {
    const res = await chart({ jd_ut: jd('2000-01-01T12:00:00Z'), lat: 70, lon: 25, bodies: ['sun'], house_systems: ['placidus', 'porphyry'] }, '10.0.3.1');
    const { houses } = res.json();
    expect(houses.placidus).toEqual({ ok: false, error: 'HOUSES_UNDEFINED' });
    expect(houses.porphyry.ok).toBe(true);
    expect(houses.porphyry.cusps).toHaveLength(12);
  });

  it('без координат домов нет', async () => {
    const res = await chart({ jd_ut: jd('2000-01-01T12:00:00Z'), bodies: ['moon'] }, '10.0.3.2');
    expect(res.json().houses).toEqual({});
  });

  it('сидерический зодиак сдвигает долготу на айанамсу (~24°)', async () => {
    const body = { jd_ut: jd('2000-01-01T12:00:00Z'), bodies: ['sun'] };
    const trop = (await chart(body, '10.0.3.3')).json().bodies.sun.lon;
    const sid = (await chart({ ...body, sidereal: 'lahiri' }, '10.0.3.3')).json().bodies.sun.lon;
    expect(((trop - sid + 360) % 360)).toBeGreaterThan(23.5);
    expect(((trop - sid + 360) % 360)).toBeLessThan(24.2);
    const tropAgain = (await chart(body, '10.0.3.3')).json().bodies.sun.lon;
    expect(tropAgain).toBe(trop);
  });
});

describe('проверка входа, CORS, лимит, AGPL', () => {
  it.each([
    [{ jd_ut: 1000, bodies: ['sun'] }],
    [{ jd_ut: 2451545, bodies: ['sun'], lat: 95, lon: 0 }],
    [{ jd_ut: 2451545, bodies: ['nibiru'] }],
    [{ jd_ut: 2451545, bodies: ['sun'], name: 'Анна' }],
    [{ bodies: ['sun'] }],
  ])('неверный вход → 400: %j', async (body) => {
    const res = await chart(body, '10.0.4.1');
    expect(res.statusCode).toBe(400);
  });

  it('X-Source-Code в каждом ответе, /v1/source отдаёт репозиторий', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/source', remoteAddress: '10.0.5.1' });
    expect(res.headers['x-source-code']).toBe(SOURCE);
    expect(res.json()).toMatchObject({ repo_url: SOURCE, license: 'AGPL-3.0-or-later' });
    const bad = await chart({ jd_ut: 1 }, '10.0.5.1');
    expect(bad.headers['x-source-code']).toBe(SOURCE);
  });

  it('CORS: свой домен разрешён, чужой — нет', async () => {
    const pre = (origin: string) => app.inject({
      method: 'OPTIONS', url: '/v1/chart', remoteAddress: '10.0.6.1',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    expect((await pre(ALLOWED)).headers['access-control-allow-origin']).toBe(ALLOWED);
    expect((await pre('https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });

  it('лимит запросов → 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await app.inject({ method: 'GET', url: '/v1/health', remoteAddress: '10.0.7.1' })).statusCode);
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});
