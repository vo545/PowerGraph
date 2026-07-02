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
