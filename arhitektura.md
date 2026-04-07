# PowerGraph arhitektura

PowerGraph je preprosta fitness spletna aplikacija, ki deluje samo v brskalniku. Aplikacija nima backenda, nima prijave in ne uporablja zunanje baze. Vsi podatki se shranjujejo lokalno v brskalniku uporabnika.

## Diagram arhitekture
```mermaid
graph TD
    A[Frontend (HTML/CSS/JavaScript)] --> B[Browser Storage]
    A --> C[Chart.js]
    A --> D[Export JSON/CSV]
```

## Kazalo
1. [Cilj aplikacije](#1-cilj-aplikacije)
2. [Osnovna arhitektura](#2-osnovna-arhitektura)
3. [Podatkovni model](#3-podatkovni-model)
4. [Shranjevanje podatkov](#4-shranjevanje-podatkov)
5. [Funkcionalnosti](#5-funkcionalnosti)
6. [Uporabniški vmesnik](#6-uporabniski-vmesnik)
7. [Izvoz in uvoz](#7-izvoz-in-uvoz)
8. [Tehnične odločitve](#8-tehnicne-odlocitve)
9. [Omejitve](#9-omejitve)
10. [Roadmap](#10-roadmap)

## 1. Cilj aplikacije
- Uporabnik vnese trening direktno v spletni strani.
- Podatki se shranijo samo lokalno v brskalniku.
- Uporabnik vidi zgodovino treningov, osnovno statistiko in graf napredka.
- Uporabnik lahko izvozi ali uvozi svoje podatke brez strežnika.

## 2. Osnovna arhitektura

### Frontend
- HTML za strukturo strani
- CSS za izgled
- JavaScript za logiko aplikacije

### Browser-only pristop
- brez Node.js backenda
- brez API klicev
- brez avtentikacije
- brez baze na strežniku
- brez sinhronizacije med napravami

### Glavni moduli na strani
- obrazec za vnos treninga
- seznam vseh treningov
- statistika in povzetki
- graf napredka
- izvoz in uvoz podatkov
- nastavitve uporabnika, shranjene lokalno

## 3. Podatkovni model

Osnovni zapis treninga:

```json
{
  "id": "uuid-ali-timestamp",
  "date": "2026-04-07",
  "exercise": "Bench Press",
  "weight": 80,
  "sets": 3,
  "reps": 10,
  "notes": "dober trening"
}
```

Možna razširitev:
- `duration`
- `bodyWeight`
- `calories`
- `category`

## 4. Shranjevanje podatkov

### Primarna izbira
Za enostavno verzijo aplikacija uporablja `localStorage`.

Predlagani ključi:
- `powergraph_workouts`
- `powergraph_settings`

### Primer strukture v `localStorage`
```json
[
  {
    "id": "1712486400000",
    "date": "2026-04-07",
    "exercise": "Squat",
    "weight": 100,
    "sets": 5,
    "reps": 5,
    "notes": ""
  }
]
```

### Pravila shranjevanja
- ob dodajanju treninga se podatki takoj shranijo v `localStorage`
- ob urejanju se prepiše celoten seznam treningov
- ob brisanju se seznam ponovno shrani
- ob nalaganju strani se podatki preberejo iz `localStorage`

### Alternativa za kasneje
Če bo podatkov več, se lahko `localStorage` kasneje zamenja z `IndexedDB`, še vedno brez backenda.

## 5. Funkcionalnosti

### MVP
- dodaj trening
- uredi trening
- izbriši trening
- prikaži seznam treningov
- filtriranje po vaji ali datumu
- osnovna statistika
- graf napredka
- izvoz podatkov
- uvoz podatkov

### Statistika
- skupno število treningov
- največja teža po vaji
- skupni volumen: `weight * sets * reps`
- zgodovina napredka po posamezni vaji

## 6. Uporabniški vmesnik

Stran naj bo ena enostavna SPA stran ali pa klasična večsekcijska stran brez strežniške logike.

Glavni deli vmesnika:
- zgornji naslov in kratek povzetek
- obrazec za vnos treninga
- tabela ali kartice z vnosi
- sekcija statistike
- sekcija z grafom
- gumbi za izvoz, uvoz in čiščenje podatkov

UI smernice:
- responsive layout za telefon in desktop
- čim manj korakov za vnos treninga
- jasen prikaz napak pri vnosu
- potrditveni dialog pri brisanju vseh podatkov

## 7. Izvoz in uvoz

### Izvoz
- JSON za varnostno kopijo
- CSV za pregled v Excelu ali Google Sheets

### Uvoz
- uporabnik naloži prej izvožen JSON
- aplikacija preveri osnovno strukturo podatkov
- nato podatke zapiše v `localStorage`

### Namen
Ker ni backenda, je izvoz pomemben za backup in prenos podatkov med napravami.

## 8. Tehnične odločitve

### Predlagan stack
- HTML
- CSS
- JavaScript
- Chart.js za grafe

### Zakaj taka poenostavitev
- manj kompleksnosti
- hitrejša izdelava MVP
- ni stroškov za strežnik ali bazo
- aplikacija lahko gostuje kot statična stran

### Deployment
Aplikacija lahko teče kot statična spletna stran na:
- GitHub Pages
- Netlify
- Vercel
- lokalno z odpiranjem `index.html` ali prek enostavnega static serverja

## 9. Omejitve

- podatki ostanejo samo v trenutnem brskalniku
- ob brisanju podatkov brskalnika se podatki izgubijo
- brez prijave ni sinhronizacije med napravami
- `localStorage` ima omejitev velikosti
- lokalni podatki niso primerni za občutljive informacije

## 10. Roadmap

### Faza 1
- osnovni obrazec
- lokalno shranjevanje
- seznam treningov

### Faza 2
- grafi in statistika
- izvoz JSON in CSV
- uvoz JSON

### Faza 3
- boljši filtri
- tema svetlo/temno
- nadgradnja iz `localStorage` na `IndexedDB`, če bo potrebno

## Zaključek

PowerGraph naj bo v prvi verziji čista browser-only aplikacija. To pomeni, da celotna logika živi na frontend strani, vsi podatki ostanejo v brskalniku, uporabnik pa si po potrebi sam naredi izvoz za backup. Tak pristop je najbolj enostaven, najhitrejši za razvoj in dovolj dober za prvi MVP.
