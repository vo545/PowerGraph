# PowerGraph

PowerGraph je lokalno-prva fitness aplikacija za belezenje treningov, kalorij, telesne teze, pocitka, cheat dni, ranga in osnovnih AI ocen. Frontend deluje kot React/Vite PWA in podatke privzeto hrani v brskalniku. Backend je opcijski in sluzi za prijavo, SQLite backup/sync, admin pregled ter varen Gemini proxy.

## Hiter zagon

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

Za povezavo frontenda z backendom nastavi `VITE_API_URL`, na primer:

```bash
VITE_API_URL=http://localhost:3001
```

## Pomembno

- Ne nastavljaj API kljucev v `VITE_*` spremenljivke, ker so vidne v brskalniku.
- `GEMINI_KEY`, `JWT_SECRET`, `ADMIN_EMAIL`, `DB_PATH` in `CORS_ORIGIN` sodijo v `backend/.env`.
- Backup JSON v nastavitvah ostaja priporocen tudi pri uporabi backend synca.

## Build

```bash
npm run build
```

Build ustvari PWA v `dist/` z verzioniranim service workerjem.
