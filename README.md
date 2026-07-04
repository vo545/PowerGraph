# PowerGraph

PowerGraph is a local-first fitness PWA for workouts, calories, body weight, hydration, rest days, cheat days, rankings, and AI-assisted estimates. The React/Vite frontend stores data in the browser by default. The optional backend supports login, SQLite backup/sync, admin review, and a safe Gemini proxy.

## Quick Start

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

To connect the frontend to the backend, set `VITE_API_URL`, for example:

```bash
VITE_API_URL=http://localhost:3001
```

## Important

- Do not put API keys in `VITE_*` variables because they are visible in the browser.
- `GEMINI_KEY`, `JWT_SECRET`, `ADMIN_EMAIL`, `DB_PATH`, and `CORS_ORIGIN` belong in `backend/.env`.
- JSON backup from Settings is still recommended even when backend sync is enabled.

## Build

```bash
npm run build
```

The build creates the PWA in `dist/` with a versioned service worker.

## Data Safety

PowerGraph keeps its local-first storage keys backward compatible. New migration helpers live in `src/utils/migrations.js` and are used by shared storage services to tolerate corrupted JSON, missing fields, and older backup shapes.

Important local keys remain unchanged, including:

- `powergraph_users`
- `powergraph_session`
- `powergraph_workouts_<email>`
- `powergraph_calories_<email>`
- `powergraph_bodyweight_<email>`
- `powergraph_rest_<email>`
- `powergraph_cheat_<email>`
- `powergraph_custom_ex_<email>`
- `powergraph_settings_<email>`
- `powergraph_water_<email>_<YYYY-MM-DD>`

Backup/import remains JSON based. Imports show a preview before overwrite, and clearing local data requires typing `DELETE`.

## Smoke Test

Before publishing larger changes, run:

```bash
npm install
npm run build
```

Then follow [SMOKE_TEST.md](./SMOKE_TEST.md) for dashboard, backup/import, mobile PWA, and offline checks.
