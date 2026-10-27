// SPDX-License-Identifier: AGPL-3.0-or-later
/** Номера тел Swiss Ephemeris (SE_*). */
export const BODIES = {
  sun: 0, moon: 1, mercury: 2, venus: 3, mars: 4, jupiter: 5, saturn: 6,
  uranus: 7, neptune: 8, pluto: 9, meanNode: 10, trueNode: 11, lilith: 12,
  chiron: 15, ceres: 17, pallas: 18, juno: 19, vesta: 20,
} as const;
export type BodyId = keyof typeof BODIES;

/** Буквы систем домов Swiss Ephemeris. */
export const HOUSE_SYSTEMS = {
  placidus: 'P', koch: 'K', porphyry: 'O', equal: 'E', wholeSign: 'W', regiomontanus: 'R', campanus: 'C',
} as const;
export type HouseSystemId = keyof typeof HOUSE_SYSTEMS;

/** Номера айанамс (SE_SIDM_*). */
export const AYANAMSAS = { fagan_bradley: 0, lahiri: 1, raman: 3, krishnamurti: 5 } as const;
export type AyanamsaId = keyof typeof AYANAMSAS;

/** Флаги Swiss Ephemeris. */
export const SEFLG = { SWIEPH: 2, SPEED: 256, SIDEREAL: 64 * 1024 } as const;

/** Диапазон файлов *_18.se1: 1800–2400 гг. (юлианские дни UT, с запасом в сутки). */
export const JD_MIN = 2378497.5;
export const JD_MAX = 2597640.5;
