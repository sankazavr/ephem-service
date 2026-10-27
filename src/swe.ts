// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRequire } from 'node:module';
import { AYANAMSAS, BODIES, HOUSE_SYSTEMS, SEFLG, type AyanamsaId, type BodyId, type HouseSystemId } from './bodies.js';

const require = createRequire(import.meta.url);
const sweph = require('sweph') as {
  version(): string;
  set_ephe_path(p: string): void;
  set_sid_mode(mode: number, t0: number, ayan: number): void;
  calc_ut(jd: number, body: number, flags: number): { flag: number; error: string; data: number[] };
  houses_ex2(jd: number, flags: number, lat: number, lon: number, hsys: string): {
    flag: number; error: string; data: { houses: number[]; points: number[] };
  };
};

export type BodyPosition = { lon: number; lat: number; dist: number; speedLon: number };
export type HousesResult =
  | { ok: true; cusps: number[]; asc: number; mc: number; armc: number }
  | { ok: false; error: 'HOUSES_UNDEFINED' };

export type ChartRequest = {
  jd_ut: number;
  lat?: number;
  lon?: number;
  bodies: BodyId[];
  house_systems?: HouseSystemId[];
  sidereal?: AyanamsaId;
};

export type ChartResponse = {
  bodies: Partial<Record<BodyId, BodyPosition | null>>;
  houses: Partial<Record<HouseSystemId, HousesResult>>;
};

export function initSwe(ephePath: string): string {
  sweph.set_ephe_path(ephePath);
  return sweph.version();
}

export function calcChart(req: ChartRequest): ChartResponse {
  let sid = 0;
  if (req.sidereal) {
    sweph.set_sid_mode(AYANAMSAS[req.sidereal], 0, 0);
    sid = SEFLG.SIDEREAL;
  }

  const bodies: ChartResponse['bodies'] = {};
  for (const id of new Set(req.bodies)) {
    const r = sweph.calc_ut(req.jd_ut, BODIES[id], SEFLG.SWIEPH | SEFLG.SPEED | sid);
    // Отрицательный флаг — ошибка; если файл эфемерид не нашёлся, Swiss Ephemeris молча переходит на Moshier — это тоже ошибка для нас.
    bodies[id] = r.flag < 0 || (r.flag & SEFLG.SWIEPH) === 0
      ? null
      : { lon: r.data[0], lat: r.data[1], dist: r.data[2], speedLon: r.data[3] };
  }

  const houses: ChartResponse['houses'] = {};
  if (req.lat !== undefined && req.lon !== undefined) {
    for (const sys of new Set<HouseSystemId>(req.house_systems ?? ['placidus'])) {
      const r = sweph.houses_ex2(req.jd_ut, sid, req.lat, req.lon, HOUSE_SYSTEMS[sys]);
      houses[sys] = r.flag < 0
        ? { ok: false, error: 'HOUSES_UNDEFINED' }
        : { ok: true, cusps: r.data.houses.slice(0, 12), asc: r.data.points[0], mc: r.data.points[1], armc: r.data.points[2] };
    }
  }
  return { bodies, houses };
}
