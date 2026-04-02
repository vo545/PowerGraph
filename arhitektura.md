# PowerGraph arhitektura

PowerGraph je aplikacija za sledenje fitnes napredku s fokusom na delovanje v brskalniku, lokalno shrambo, izvoz podatkov in opcijski backend za sinhronizacijo.

## Diagram arhitekture
```mermaid
graph TD
    A[Frontend (HTML/CSS/JS)] --> B[localStorage]
    A --> C[API Calls (opcijsko)]
    C --> D[Backend (Node.js/Express)]
    D --> E[Database (MongoDB/SQLite)]
    D --> F[Auth (JWT)]
    A --> G[Chart.js za grafe]
    A --> H[Izvoz (Blob/Download)]
```

## Kazalo
1. [Uporabniški primeri](#1-uporabniški-primeri)
2. [Frontend](#2-frontend)
3. [Backend (opcijski)](#3-backend-opcijski)
4. [Dodatne funkcionalnosti](#4-dodatne-funkcionalnosti)
5. [Dizajn](#5-dizajn)
6. [Deployment](#6-deployment)
7. [Tehnični detajli](#7-tehnični-drog)
8. [Varnost](#8-varnost)
9. [Razširitve](#9-razširitve)
10. [Dodatne funkcionalnosti (razširitev)](#10-dodatne-funkcionalnosti-razširitev)
11. [Roadmap](#11-roadmap)
12. [Zaključek](#12-zaključek)

## 1. Uporabniški primeri
- Uporabnik vnese trening (mašina, teža, seti, reps).
- Podatki se takoj shranijo v `localStorage`.
- Uporabnik vidi graf napredka in statistiko.
- Uporabnik lahko izvozi vse podatke (JSON/CSV/PDF).
- Uporabnik se lahko prijavi in sinhronizira podatke med napravami.
- Uporabnik lahko doda cilje in opomnike (notifikacije).
- Aplikacija spremlja dodatne meritve (telesna teža, kalorije, trajanje).

## 2. Frontend
- Tehnologije: HTML5 + CSS3 + JavaScript (vanilla ali ogrodje kot React/Vue).
- Glavni elementi:
  - obrazec za vnos treninga
  - gumbi: shrani, izvoz, počisti, sinhroniziraj
  - izpis napredka: % sprememb, personal records
  - grafi: line chart, pie chart, opcijsko bar chart
  - panel ciljev in opomnikov
  - login/register modal
  - tema: svetla/temna

### 2.1 Lokalna shramba
- Ključ: `powergraph_workouts`
- Podatki: JSON array objektov
- Trenutna struktura vnosa:
  - `date` (string, YYYY-MM-DD)
  - `machine` (string, npr. "Bench Press")
  - `weight` (number, kg)
  - `sets` (number)
  - `reps` (number)
  - `bodyWeight` (number, optional)
  - `calories` (number, optional)
  - `duration` (number, min, optional)
  - `notes` (string, optional)

### 2.2 Izvoz
- JSON: `Blob(JSON.stringify(...))`
- CSV: delimiter `,`, naslovna vrstica + pretvorba vrednosti
- PDF: jsPDF + html2canvas ali server-side generiranje

### 2.3 Grafi
- Line chart: max weight per date per machine
- Pie chart: volumen po machine ali število vnosov po machine
- Optional: bar chart za total sets/reps, progress trends

### 2.4 UI
- Responsive design (mobile/tablet/desktop)
- temna tema preklop
- prijava/sinhronizacija izpis statusa (offline/online)

## 3. Backend (opcijski)
- Tehnologije: Node.js + Express.
- Avtentikacija: JWT.
- Database: SQLite/PostgreSQL/MongoDB.

### 3.1 API endpoints
- `POST /api/auth/signup` - registracija (primer: `{email: "user@example.com", password: "geslo"}`)
- `POST /api/auth/login` - prijava (vrne JWT token)
- `GET /api/workouts` - vse vaje uporabnika (filtriraj po datumu: `?date=2023-10-01`)
- `POST /api/workouts` - dodaj vajo (primer: `{date: "2023-10-01", machine: "Bench Press", weight: 80, sets: 3, reps: 10}`)
- `PUT /api/workouts/:id` - urejaj vajo
- `DELETE /api/workouts/:id` - izbriši vajo
- `GET/POST /api/goals` - cilji (primer: `{machine: "Bench Press", targetWeight: 100, deadline: "2023-12-01"}`)
- `GET/POST /api/reminders` - opomniki (primer: `{type: "workout", datetime: "2023-10-02T18:00:00"}`)

### 3.2 Sinhronizacija
- ob zagonu: frontend poizve `GET /api/workouts`, merge z lokalnimi
- ob shranjevanju: localStorage + `POST /api/workouts`
- offline queue: shranjevanje sprememb in pošiljanje, ko je online

## 4. Dodatne funkcionalnosti
- Cilji: `targetWeight`, `deadline`, status (pending/done)
- Opomniki: datumi/časi za trening
- Metrični dodatki: telesna teža, obod, kalorije, trajanje
- Statistika: total volume (weight * sets * reps), personal records, monthly trends

## 5. Dizajn
- Barvna shema: primarna `#1976d2`, sekundarna `#4caf50`, napaka `#ef5350`
- Kartice za sekcije
- Trendi: kartice “Weekly summary”, “Goal completion”

## 6. Deployment
- Frontend: GitHub Pages / Netlify / Vercel.
- Backend: Railway / Heroku / Render.
- Opcijsko Docker za oba: `frontend` + `backend`.

## 7. Tehnični drog
- Verzije:
  - Node.js >=14
  - npm >=8
  - Chart.js 3.x ali 4.x
  - jsPDF za PDF izvoz
  - bcrypt + jsonwebtoken
## 7.1 Testiranje
- Unit testi: Jest za JavaScript funkcije (npr. izračun napredka).
- Integration testi: Supertest za API endpoints.
- E2E testi: Cypress ali Playwright za celotne scenarije (vnos treninga, izvoz).
- Coverage: Cilj 80%+ z nyc ali istanbul.
- CI/CD: GitHub Actions za avtomatsko testiranje ob pushu.
## 8. Varnost
- Input validacija na frontend in backend (npr. sanitizacija, regex za email).
- HTTPS za backend (Let's Encrypt za certifikate).
- Varnostni headerji (helmet: CSP, HSTS, X-Frame-Options).
- Rate-limiting (express-rate-limit: 100 zahtev/min na IP).
- CORS: dovoli samo določene domene (npr. frontend URL).
- OWASP top 10: zaščita pred XSS, CSRF, SQL injection.
- GDPR: uporabniška privolitev za podatke, pravica do izbrisa.

## 9. Razširitve
- PWA (offline-first)
- API integracija z externim trenerjem (npr. Google Fit)
- Metrike napredka na nivoju mišičnih skupin
- Social (deljenje napredka, izzivi)

## 10. Dodatne funkcionalnosti (razširitev)
- LocalStorage do IndexedDB nadgradnja z offline-first sync queue (robustno hranjenje podatkov)
- Push notifikacije in koledarski opomniki za cilje in treninge
- Cilji: prednastavljeni workout programi, goal completion in coaching modul
- Napredna analitika: 1RM, TTM, heatmap, mesečni trendi, plateau detekcija
- Več uporabnikov / multi-tenant / federacija profilov
- Integracija s třetimi napravami: Fitbit, Apple Health, Google Fit
- Onboarding in in-app guidance: welcome workflow, interaktivni tooltipi
- CI/CD + test coverage + linting + monitoring (Sentry, LogRocket)
- SEO + accessibility (WCAG 2.1)

## 11. Roadmap
- **Faza 1 (MVP, 2 tedna)**: Frontend z localStorage, osnovni grafi, izvoz JSON. Metrika: delujoča aplikacija za 1 uporabnika.
- **Faza 2 (Backend, 3 tedni)**: Dodaj backend, avtentikacijo, sinhronizacijo. Metrika: sinhronizacija med 2 napravami.
- **Faza 3 (Funkcionalnosti, 4 tedni)**: Cilji, opomniki, dodatne meritve, temna tema. Metrika: 80% test coverage.
- **Faza 4 (Razširitve, 6 tednov)**: PWA, push notifikacije, napredna analitika, integracije. Metrika: 100 offline uporabnikov.
- **Faza 5 (Produkcija, 8 tednov)**: Multi-tenant, social funkcije, monitoring. Metrika: 1000+ uporabnikov, 99% uptime.
Ta arhitektura omogoča postopno gradnjo PowerGraph od preproste lokalne aplikacije do polne platforme. Začnite z frontendom in localStorage, nato dodajte backend za sinhronizacijo. Dokument se bo posodabljal z implementacijo.

## 13. Known Limitations
- localStorage: omejitev 5-10MB na domeno; za več podatkov uporabite IndexedDB.
- Offline: brez backend, podatki izgubljeni ob brisanju brskalnika.
- Skalabilnost: SQLite ni primeren za 1000+ uporabnikov; preklopi na PostgreSQL.
- Varnost: lokalni podatki niso šifrirani; za občutljive podatke dodaj enkripcijo.
- Mobilno: PWA podpira, ampak starejši brskalniki ne.

