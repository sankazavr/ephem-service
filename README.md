# ephem-service

A small HTTP service that returns planet positions and house cusps computed with [Swiss Ephemeris](https://www.astro.com/swisseph/) (Astrodienst AG).
It is the calculation backend of an astrology web app. The service takes only numbers (a moment and coordinates) and never receives names or other personal data.

Небольшой HTTP-сервис: положения планет и куспиды домов по Swiss Ephemeris. Принимает только момент и координаты, без имён и данных о человеке.

## License

**AGPL-3.0-or-later** — see [LICENSE](LICENSE).
Swiss Ephemeris © Astrodienst AG, used under the GNU Affero General Public License via the [`sweph`](https://github.com/timotejroiko/sweph) Node.js binding. The ephemeris files in `ephe/` (`sepl_18`, `semo_18`, `seas_18`, years 1800–2400) are part of the Swiss Ephemeris distribution.

Every response carries an `X-Source-Code` header pointing to this repository, and `GET /v1/source` returns the same link (AGPL §13). The code running in production is always a published commit of this repository; `/v1/health` reports its `git_sha`.

## API

### `POST /v1/chart`

```json
{
  "jd_ut": 2451740.8333333,
  "lat": 55.7558,
  "lon": 37.6173,
  "bodies": ["sun", "moon", "mercury", "chiron", "lilith"],
  "house_systems": ["placidus", "porphyry"],
  "sidereal": "lahiri"
}
```

| Field | Required | Notes |
|---|---|---|
| `jd_ut` | yes | Julian day, UT, years 1800–2400 |
| `bodies` | yes | up to 30 of: `sun moon mercury venus mars jupiter saturn uranus neptune pluto meanNode trueNode lilith chiron ceres pallas juno vesta` (`lilith` = mean lunar apogee) |
| `lat`, `lon` | no | degrees; without them no houses are returned |
| `house_systems` | no | `placidus koch porphyry equal wholeSign regiomontanus campanus`, default `["placidus"]` |
| `sidereal` | no | `fagan_bradley lahiri raman krishnamurti`; tropical if omitted |

Unknown fields are rejected with `400`.

Response:

```json
{
  "bodies": { "sun": { "lon": 113.13, "lat": 0.0, "dist": 1.016, "speedLon": 0.953 } },
  "houses": {
    "placidus": { "ok": true, "cusps": [180.73, "…12 values"], "asc": 180.73, "mc": 91.0, "armc": 92.1 },
    "porphyry": { "ok": true, "cusps": ["…"], "asc": 180.73, "mc": 91.0, "armc": 92.1 }
  },
  "engine": "swisseph 2.10.03",
  "version": "0.1.0"
}
```

- Longitudes are ecliptic, true equinox of date, degrees `[0, 360)`; `speedLon` is degrees per day.
- A body is `null` if it cannot be computed in the range.
- At polar latitudes Placidus and Koch are undefined: `{ "ok": false, "error": "HOUSES_UNDEFINED" }`. Request `porphyry` as well to get a fallback in the same call.

### `GET /v1/health`, `GET /v1/source`

Version, commit, engine; link to the source code.

## Run

```bash
npm ci
npm test          # reference charts, polar houses, validation, CORS, rate limit
npm run build && npm start
```

Environment: `PORT` (8095), `ALLOWED_ORIGINS` (comma-separated, for CORS), `RATE_LIMIT_PER_MINUTE` (120), `SOURCE_URL`, `EPHE_PATH`.

Docker: `deploy/docker-compose.yml` (reads `deploy/.env`, see `deploy/env.example`). `deploy/deploy.sh` refuses to deploy uncommitted or unpushed code.
