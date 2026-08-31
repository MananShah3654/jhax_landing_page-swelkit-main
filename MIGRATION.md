# Migration Map — React/FastAPI → SvelteKit

Exhaustive, file-by-file record of the port. Every reachable feature, screen,
component, calculation, and endpoint from the original is reproduced.

## Verification summary

- `npm run check` → **0 errors, 0 warnings** (svelte-check, 3487 files)
- `npm run build` → **success** (adapter-node)
- `npm run parity` → **PASS**, 81,094 value comparisons byte-identical to the
  original Python (10,542 health/money cases + 30,005 seeded-metric keys)
- Runtime smoke test: page renders, `/api` root, `/api/leads` validation (422),
  DB-absent handling (500), `/api/audit` full pipeline (OSM) + missing-name (400)

## Backend

| Original (Python) | Port | Notes |
|---|---|---|
| `backend/server.py` routes | `src/routes/api/**/+server.js` | root, status, leads, audit |
| `backend/server.py` heuristics | `src/lib/server/audit.js` | health score, money-lost, `pyRound` (round-half-to-even, matches CPython) |
| `backend/data_source.py` | `src/lib/server/dataSource.js` + `seeded.js` | OSM + Google providers, rate limiter, SHA-256 seeded metrics |
| `backend/db.py` (SQLAlchemy/asyncpg) | `src/lib/server/db.js` (postgres.js) | same `leads` / `status_checks` schema, same `postgres://` + SSL normalization, tables auto-created |
| CORS middleware | `src/hooks.server.js` | reflects origin when `CORS_ORIGINS=*`, credentials on |
| `pydantic` validation | `zod` | invalid email → 422 |
| `HTTPException(detail=...)` | `src/lib/server/http.js` | preserves `{ "detail": ... }` body |
| `requirements.txt` | `package.json` deps | fastapi/uvicorn/sqlalchemy/asyncpg → SvelteKit/postgres |

### Calculation fidelity
`pyRound` operates on the exact IEEE-754 double (no decimal pre-rounding) so ties
resolve to even exactly like Python's `round()`. Verified against the real Python
formulas in `scripts/parity/py_ref.py`.

## Frontend

| Original component | Port |
|---|---|
| `App.js` (Lenis) | `src/routes/+layout.svelte` |
| `pages/Landing.jsx` | `src/routes/+page.svelte` |
| `index.css` + `App.css` | `src/app.css` (tokens, keyframes, utilities verbatim) |
| `public/index.html` | `src/app.html` |
| `Nav`, `Hero`, `LiveDemoCard`, `FreeAudit`, `TrustStrip`, `ProblemSection`, `RealRestaurantProof`, `PhoneSwipeDemo`, `ProductDemo`, `HowItWorks`, `Features`, `TheLoop`, `Marquee`, `FAQ`, `Stats`, `FinalCTA`, `Footer`, `ChapterHeader`, `Logo` | `src/lib/components/site/*.svelte` (same names) |

New helper components/modules created for the port:
- `Reveal.svelte` — framer-motion `whileInView`/`animate` equivalent
- `JhaxMark.svelte`, `AuditHealthDial.svelte`, `ProductAskTab.svelte`, `ProductMarketingTab.svelte` — sub-components extracted from their parents
- `src/lib/actions/reveal.js` — IntersectionObserver action (`whileInView` + `once`)
- `src/lib/motion.js` — exact `cubic-bezier(0.22,1,0.36,1)` easing + numeric tween (for the cost counter)
- `src/lib/api.js` — same-origin `/api` fetch helper (replaces axios)

### Preserved exactly
- All brand hex values, fonts (Bricolage Grotesque / Inter / JetBrains Mono), the
  star-mark SVG path, the wordmark, the "DO NOT TOUCH" copy, the 5 loop stage
  names, "STOPS HERE"/"FULL LOOP" labels.
- Every `data-testid` attribute.
- All UI states: idle / loading / report / error (audit), success/error (lead
  form), hover reveals, typewriters, countdowns, the autonomous loop, drag-swipe.
- The PDF export (light print template + jsPDF header/footer) — byte-for-byte the
  same template code, still client-side via dynamic `import('html2pdf.js')`.

## Intentionally NOT ported (with reasons)

- **`src/components/ui/*` (60 shadcn/Radix files), `hooks/use-toast.js`,
  `components/ui/sonner.jsx`, `toaster.jsx`** — dead scaffolding. None are imported
  by `index.js → App.js → Landing.jsx` or any of the 18 site components (verified
  by grep). They never render, so porting Radix→Svelte primitives would add a large
  unused surface. Re-add on demand with a Svelte UI kit if future screens need them.
- **`src/constants/testIds/*`** — auth/home test-id registries not referenced by any
  rendered component (the components use hardcoded `data-testid` strings, which ARE
  preserved).
- **`craco.config.js`, `plugins/health-check/*`, `jsconfig.json`,
  `components.json`, `postcss`/`tailwind` CRA wiring** — CRA/Emergent build tooling,
  replaced by the SvelteKit equivalents.
- **`react-query`, `React.StrictMode`** (from `index.js`) — react-query is never used
  by any component (they call the API directly); both are React-specific.

## Notes / follow-ups for the owner

- **`app.html`**: the original `<head>` also loaded two Emergent-platform scripts
  (a visual-edit injector and PostHog analytics posting to `ap.emergent.sh` with a
  hardcoded key). They are landing-page-external telemetry, so they are included
  **commented out**. Uncomment for exact head parity.
- **Google Places key**: `.env` carries the same key as the original `backend/.env`.
  Rotate it if it has ever been committed to a public place. Default
  `AUDIT_DATA_SOURCE` in `.env.example` is `osm` (no key needed); the local `.env`
  keeps `google` to match the original.
- SSR is disabled (`+layout.js` `ssr = false`) to match the original CRA SPA, since
  the sections are animation/DOM-driven.

## Architecture change: fully static / serverless (no database)

A later change removed the backend entirely — the app is now a static SPA:

| Feature | Was (server) | Now (client) |
|---|---|---|
| Free Audit | `POST /api/audit` (server calls Google/OSM + heuristics) | `src/lib/audit/*` runs in the browser: Google Places via the **Maps JS Places library** (REST has no browser CORS), OSM via Nominatim; heuristics client-side |
| Lead capture | `POST /api/leads` → Postgres | `src/lib/leads.js` → **Firebase Firestore** `leads` collection |
| Insight cards | `buildFindings()` (client, unchanged) | `buildFindings()` (client, unchanged) |
| Adapter | `adapter-node` (+ Cloud SQL) | `adapter-static` (SPA, `build/`) |

Removed: `src/lib/server/*` (db, providers, heuristics, http), `src/routes/api/*`,
`src/hooks.server.js`, `src/lib/api.js`, `Dockerfile`/`.dockerignore`, and the
`postgres`/`zod`/`dotenv` deps. Added: `firebase`, `@sveltejs/adapter-static`,
`firestore.rules`, `firebase.json`, `.firebaserc`.

Parity note: the heuristics moved to `src/lib/audit/heuristics.js` and seeded
metrics to `src/lib/audit/seeded.js` (now async, using Web Crypto so it runs in the
browser). `npm run parity` still confirms byte-identical output vs. the original
Python — the numbers on the cards are unchanged.

The `/api/audit` response object is reproduced exactly by `src/lib/audit/index.js`,
so `buildReportFromApi()` / `buildFindings()` — and therefore every KPI, the health
dial, and the "Fix This"/"Opportunity" cards — behave identically.
