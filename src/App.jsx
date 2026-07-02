import { useEffect, useMemo, useRef, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { ClipboardList, Dumbbell, Flame, Home, Lightbulb, Scale, Search, Settings, Shield, Target, Trophy, Utensils } from 'lucide-react';
import EmptyState from './components/EmptyState.jsx';
import QuickActions from './components/QuickActions.jsx';
import StatCard from './components/StatCard.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, BarElement);

const API_URL = import.meta.env.VITE_API_URL || '';
const JWT_KEY_PREFIX = 'powergraph_jwt_';
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}
function getJwt(email) {
  const key = `${JWT_KEY_PREFIX}${email}`;
  const token = localStorage.getItem(key) || '';
  if (!token) return '';
  const payload = decodeJwtPayload(token);
  if (!payload) {
    localStorage.removeItem(key);
    return '';
  }
  if (payload?.exp && payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem(key);
    return '';
  }
  return token;
}
function setJwt(email, token) { if (token) localStorage.setItem(`${JWT_KEY_PREFIX}${email}`, token); else localStorage.removeItem(`${JWT_KEY_PREFIX}${email}`); }
async function apiCall(email, path, method = 'GET', body) {
  if (!API_URL) return null;
  const token = getJwt(email);
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return res.json();
    if (res.status === 401) setJwt(email, '');
  } catch {}
  return null;
}
async function backendLogin(email, password, mode = 'login') {
  if (!API_URL) return null;
  try {
    let res = await fetch(`${API_URL}/api/auth/${mode === 'signup' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) { const { token } = await res.json(); setJwt(email, token); return token; }
    if (mode === 'signup' && res.status === 409) {
      res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (res.ok) { const { token } = await res.json(); setJwt(email, token); return token; }
    }
  } catch {}
  return null;
}
async function pullFromBackend(email) {
  const data = await apiCall(email, '/api/sync');
  return data;
}

const WORKOUTS_KEY_PREFIX = 'powergraph_workouts_';
const CALORIES_KEY_PREFIX = 'powergraph_calories_';
const CUSTOM_EX_KEY_PREFIX = 'powergraph_custom_ex_';
const CAL_HISTORY_KEY_PREFIX = 'powergraph_calhistory_';
const BODYWEIGHT_KEY_PREFIX = 'powergraph_bodyweight_';
const BODYFAT_KEY_PREFIX = 'powergraph_bodyfat_';
const RECAP_KEY_PREFIX = 'powergraph_recap_';
const REST_KEY_PREFIX = 'powergraph_rest_';
const CHEAT_KEY_PREFIX = 'powergraph_cheat_';
const WATER_KEY_PREFIX = 'powergraph_water_';
const DEMO_DAYS_KEY_PREFIX = 'powergraph_demo_days_';
const DEMO_WATER_KEY_PREFIX = 'powergraph_demo_water_';
const THEME_KEY = 'powergraph_theme';
const LAST_SECTION_KEY_PREFIX = 'powergraph_last_section_';
const DRAFT_KEY_PREFIX = 'powergraph_draft_';
const SETTINGS_KEY_PREFIX = 'powergraph_settings_';
const USERS_KEY = 'powergraph_users';
const SESSION_KEY = 'powergraph_session';
const ADMIN_EMAIL = 'vid.oreskovic@gmail.com';
const ADMIN_CONFIG_KEY = 'powergraph_admin_config';
const ADMIN_AUDIT_KEY = 'powergraph_admin_audit';
const LOGINS_KEY = 'powergraph_logins';
const AUTH_THROTTLE_KEY_PREFIX = 'powergraph_auth_throttle_';
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;
const PBKDF2_ITERATIONS = 210000;
const APP_SECTION_IDS = ['dashboard', 'exercises', 'history', 'bodyweight', 'calories', 'ocenjevalec', 'rankings', 'advisor', 'settings', 'admin'];
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
const BACKUP_SCHEMA_VERSION = 3;

function todayKey() { return new Date().toISOString().slice(0, 10); }
function dateOffsetKey(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
function getLastSectionKey(email) { return `${LAST_SECTION_KEY_PREFIX}${email}`; }
function getDraftKey(email, name) { return `${DRAFT_KEY_PREFIX}${email}_${name}`; }
function getInitialSection(email) {
  if (!email) return 'dashboard';
  try {
    const saved = localStorage.getItem(getLastSectionKey(email));
    if (!APP_SECTION_IDS.includes(saved)) return 'dashboard';
    return saved === 'admin' && email !== ADMIN_EMAIL ? 'dashboard' : saved;
  } catch {
    return 'dashboard';
  }
}
function saveDraft(email, name, value) {
  if (!email) return;
  try { localStorage.setItem(getDraftKey(email, name), JSON.stringify(value)); } catch {}
}
function loadDraft(email, name, fallback) {
  if (!email) return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(getDraftKey(email, name)) || 'null');
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}
function clearUserDrafts(email) {
  if (!email) return;
  ['workoutForm', 'mealForm', 'bodyWeightForm', 'tdeeForm', 'ingredientForm'].forEach((name) => {
    try { localStorage.removeItem(getDraftKey(email, name)); } catch {}
  });
}
function getDefaultWorkoutForm() { return { date: todayKey(), exercise: 'Bench Press', weight: '', setDetails: ['12', '10', '8'], setWeights: ['', '', ''] }; }
function getDefaultMealForm() { return { date: todayKey(), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' }; }
function getDefaultBodyWeightForm() { return { date: todayKey(), weight: '' }; }

const BAR_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { beginAtZero: true, suggestedMax: 10, grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8', precision: 0, stepSize: 1 } },
  },
};

function getMonthBarData(dates, lang, n = 12) {
  const counts = {};
  dates.forEach(d => { const k = d.slice(0, 7); counts[k] = (counts[k] || 0) + 1; });
  const labels = [], data = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    labels.push(d.toLocaleString(lang === 'sl' ? 'sl-SI' : 'en-US', { month: 'short', year: '2-digit' }));
    data.push(counts[key] || 0);
  }
  return { labels, data };
}

const LOCAL_FOODS = {
  // --- Meso / Meat ---
  'piscanec': { name: 'Piščanec (prsi)', kcal: 165 }, 'piscancje prsi': { name: 'Piščančje prsi', kcal: 165 },
  'piscancje bedro': { name: 'Piščančje bedro', kcal: 209 }, 'piscancje krilo': { name: 'Piščančje krilo', kcal: 203 },
  'puran': { name: 'Puran (prsi)', kcal: 135 }, 'racka': { name: 'Raca', kcal: 337 },
  'svinjina': { name: 'Svinjina', kcal: 242 }, 'svinjski file': { name: 'Svinjski file', kcal: 143 },
  'svinjska rebra': { name: 'Svinjska rebra', kcal: 292 }, 'slanina': { name: 'Slanina', kcal: 541 },
  'salama': { name: 'Salama', kcal: 336 }, 'klobasa': { name: 'Klobasa', kcal: 301 },
  'hrenovka': { name: 'Hrenovka', kcal: 290 }, 'sunka': { name: 'Šunka', kcal: 145 },
  'govedina': { name: 'Govedina', kcal: 250 }, 'goveji zrezek': { name: 'Goveji zrezek', kcal: 271 },
  'hamburger': { name: 'Hamburger (meso)', kcal: 295 }, 'jagnjetina': { name: 'Jagnjetina', kcal: 282 },
  'telecina': { name: 'Telečina', kcal: 175 }, 'divjacina': { name: 'Divjačina', kcal: 158 },
  'chicken': { name: 'Chicken breast', kcal: 165 }, 'chicken breast': { name: 'Chicken breast', kcal: 165 },
  'chicken thigh': { name: 'Chicken thigh', kcal: 209 }, 'turkey': { name: 'Turkey breast', kcal: 135 },
  'pork': { name: 'Pork', kcal: 242 }, 'pork tenderloin': { name: 'Pork tenderloin', kcal: 143 },
  'bacon': { name: 'Bacon', kcal: 541 }, 'ham': { name: 'Ham', kcal: 145 },
  'beef': { name: 'Beef', kcal: 250 }, 'steak': { name: 'Beef steak', kcal: 271 },
  'lamb': { name: 'Lamb', kcal: 282 }, 'sausage': { name: 'Sausage', kcal: 301 },
  'hot dog': { name: 'Hot dog', kcal: 290 },
  // --- Ribe / Fish ---
  'losos': { name: 'Losos', kcal: 208 }, 'tuna': { name: 'Tuna (v vodi)', kcal: 116 },
  'tunina': { name: 'Tunina', kcal: 116 }, 'tuna v olju': { name: 'Tuna v olju', kcal: 198 },
  'sardele': { name: 'Sardele', kcal: 208 }, 'skusa': { name: 'Skuša', kcal: 205 },
  'polenovka': { name: 'Polenovka / bakalar', kcal: 82 }, 'bakalar': { name: 'Bakalar', kcal: 82 },
  'brancin': { name: 'Brancin', kcal: 97 }, 'krap': { name: 'Krap', kcal: 127 },
  'lignji': { name: 'Lignji', kcal: 92 }, 'kozice': { name: 'Kozice', kcal: 85 },
  'raki': { name: 'Raki', kcal: 82 }, 'dagnje': { name: 'Dagnje', kcal: 86 },
  'salmon': { name: 'Salmon', kcal: 208 }, 'tuna in water': { name: 'Tuna in water', kcal: 116 },
  'sardines': { name: 'Sardines', kcal: 208 }, 'mackerel': { name: 'Mackerel', kcal: 205 },
  'cod': { name: 'Cod', kcal: 82 }, 'shrimp': { name: 'Shrimp', kcal: 85 },
  'squid': { name: 'Squid', kcal: 92 }, 'mussels': { name: 'Mussels', kcal: 86 },
  // --- Mlečni / Dairy ---
  'mleko': { name: 'Mleko (polno)', kcal: 61 }, 'posneto mleko': { name: 'Posneto mleko', kcal: 35 },
  'sir': { name: 'Trdi sir', kcal: 402 }, 'edamec': { name: 'Edamec', kcal: 357 },
  'mozzarela': { name: 'Mozzarela', kcal: 280 }, 'mozzarella': { name: 'Mozzarella', kcal: 280 },
  'feta': { name: 'Feta sir', kcal: 264 }, 'cottage cheese': { name: 'Skuta', kcal: 98 },
  'skuta': { name: 'Skuta', kcal: 98 }, 'mascarpone': { name: 'Mascarpone', kcal: 429 },
  'parmezan': { name: 'Parmezan', kcal: 431 }, 'parmesan': { name: 'Parmesan', kcal: 431 },
  'jogurt': { name: 'Navadni jogurt', kcal: 59 }, 'grski jogurt': { name: 'Grški jogurt', kcal: 97 },
  'grski jogurt 2': { name: 'Grški jogurt 2%', kcal: 73 }, 'kefir': { name: 'Kefir', kcal: 52 },
  'smetana': { name: 'Sladka smetana', kcal: 340 }, 'kisla smetana': { name: 'Kisla smetana', kcal: 193 },
  'maslo': { name: 'Maslo', kcal: 717 }, 'kremni sir': { name: 'Kremni sir', kcal: 342 },
  'milk': { name: 'Whole milk', kcal: 61 }, 'skim milk': { name: 'Skim milk', kcal: 35 },
  'cheese': { name: 'Hard cheese', kcal: 402 }, 'edam': { name: 'Edam cheese', kcal: 357 },
  'yogurt': { name: 'Plain yogurt', kcal: 59 }, 'yoghurt': { name: 'Plain yogurt', kcal: 59 },
  'greek yogurt': { name: 'Greek yogurt', kcal: 97 }, 'cream': { name: 'Heavy cream', kcal: 340 },
  'sour cream': { name: 'Sour cream', kcal: 193 }, 'butter': { name: 'Butter', kcal: 717 },
  'cream cheese': { name: 'Cream cheese', kcal: 342 }, 'ricotta': { name: 'Ricotta', kcal: 174 },
  // --- Jajca / Eggs ---
  'jajce': { name: 'Jajce (celo)', kcal: 155 }, 'jajca': { name: 'Jajce (celo)', kcal: 155 },
  'kuhano jajce': { name: 'Trdo kuhano jajce', kcal: 155 }, 'ocvrto jajce': { name: 'Ocvrto jajce', kcal: 196 },
  'egg': { name: 'Egg (whole)', kcal: 155 }, 'eggs': { name: 'Egg (whole)', kcal: 155 },
  'boiled egg': { name: 'Hard boiled egg', kcal: 155 }, 'fried egg': { name: 'Fried egg', kcal: 196 },
  'scrambled eggs': { name: 'Scrambled eggs', kcal: 149 }, 'egg white': { name: 'Egg white', kcal: 52 },
  'beljak': { name: 'Jajčni beljak', kcal: 52 }, 'rumenjak': { name: 'Jajčni rumenjak', kcal: 322 },
  // --- Žita / Grains ---
  'riz': { name: 'Kuhan beli riž', kcal: 130 }, 'rjavi riz': { name: 'Kuhan rjavi riž', kcal: 112 },
  'testenine': { name: 'Kuhane testenine', kcal: 131 }, 'spageti': { name: 'Kuhani špageti', kcal: 131 },
  'fusili': { name: 'Kuhani fusilli', kcal: 131 }, 'penne': { name: 'Kuhano penne', kcal: 131 },
  'kruh': { name: 'Beli kruh', kcal: 265 }, 'crni kruh': { name: 'Črni kruh', kcal: 239 },
  'polnozen kruh': { name: 'Polnozrnat kruh', kcal: 247 }, 'bagel': { name: 'Bagel', kcal: 245 },
  'toast': { name: 'Toast kruh', kcal: 313 }, 'tortila': { name: 'Pšenična tortila', kcal: 308 },
  'ovseni kosmici': { name: 'Ovseni kosmiči', kcal: 389 }, 'ovsena kasa': { name: 'Ovsena kaša', kcal: 389 },
  'koruza': { name: 'Kuhana koruza', kcal: 86 }, 'polenta': { name: 'Kuhana polenta', kcal: 70 },
  'zganci': { name: 'Žganci', kcal: 95 }, 'kus kus': { name: 'Kuhan kuskus', kcal: 112 },
  'kvinoja': { name: 'Kuhana kvinoja', kcal: 120 }, 'proso': { name: 'Kuhano proso', kcal: 119 },
  'ajda': { name: 'Ajdova kaša', kcal: 92 }, 'rice': { name: 'Cooked white rice', kcal: 130 },
  'brown rice': { name: 'Cooked brown rice', kcal: 112 }, 'pasta': { name: 'Cooked pasta', kcal: 131 },
  'spaghetti': { name: 'Cooked spaghetti', kcal: 131 }, 'bread': { name: 'White bread', kcal: 265 },
  'whole wheat bread': { name: 'Whole wheat bread', kcal: 247 }, 'oats': { name: 'Rolled oats', kcal: 389 },
  'oatmeal': { name: 'Oatmeal', kcal: 389 }, 'corn': { name: 'Cooked corn', kcal: 86 },
  'couscous': { name: 'Cooked couscous', kcal: 112 }, 'quinoa': { name: 'Cooked quinoa', kcal: 120 },
  'tortilla': { name: 'Flour tortilla', kcal: 308 },
  // --- Zelenjava / Vegetables ---
  'brokoli': { name: 'Brokoli', kcal: 34 }, 'cvetaca': { name: 'Cvetača', kcal: 25 },
  'korenje': { name: 'Korenje', kcal: 41 }, 'kumara': { name: 'Kumara', kcal: 15 },
  'paradiznik': { name: 'Paradižnik', kcal: 18 }, 'paprika': { name: 'Paprika', kcal: 31 },
  'solata': { name: 'Zelena solata', kcal: 15 }, 'spinaca': { name: 'Špinača', kcal: 23 },
  'zelena': { name: 'Zelena', kcal: 16 }, 'por': { name: 'Por', kcal: 61 },
  'buc': { name: 'Buča', kcal: 26 }, 'buca': { name: 'Buča', kcal: 26 },
  'tikvica': { name: 'Tikvica', kcal: 17 }, 'melancane': { name: 'Jajčevec', kcal: 25 },
  'jajcevec': { name: 'Jajčevec', kcal: 25 }, 'gobe': { name: 'Šampinjoni', kcal: 22 },
  'sampinjoni': { name: 'Šampinjoni', kcal: 22 }, 'cebula': { name: 'Čebula', kcal: 40 },
  'cesnek': { name: 'Česen', kcal: 149 }, 'repa': { name: 'Repa', kcal: 28 },
  'pesa': { name: 'Pesa', kcal: 43 }, 'radici': { name: 'Radič', kcal: 23 },
  'ohrovt': { name: 'Ohrovt', kcal: 43 }, 'brstican ohrovt': { name: 'Brstičan ohrovt', kcal: 43 },
  'krompir': { name: 'Kuhan krompir', kcal: 77 }, 'sladki krompir': { name: 'Sladki krompir', kcal: 86 },
  'broccoli': { name: 'Broccoli', kcal: 34 }, 'cauliflower': { name: 'Cauliflower', kcal: 25 },
  'carrot': { name: 'Carrot', kcal: 41 }, 'carrots': { name: 'Carrot', kcal: 41 },
  'cucumber': { name: 'Cucumber', kcal: 15 }, 'tomato': { name: 'Tomato', kcal: 18 },
  'tomatoes': { name: 'Tomato', kcal: 18 }, 'pepper': { name: 'Bell pepper', kcal: 31 },
  'lettuce': { name: 'Lettuce', kcal: 15 }, 'spinach': { name: 'Spinach', kcal: 23 },
  'onion': { name: 'Onion', kcal: 40 }, 'garlic': { name: 'Garlic', kcal: 149 },
  'mushrooms': { name: 'Mushrooms', kcal: 22 }, 'zucchini': { name: 'Zucchini', kcal: 17 },
  'eggplant': { name: 'Eggplant', kcal: 25 }, 'potato': { name: 'Boiled potato', kcal: 77 },
  'sweet potato': { name: 'Sweet potato', kcal: 86 }, 'pumpkin': { name: 'Pumpkin', kcal: 26 },
  'beetroot': { name: 'Beetroot', kcal: 43 }, 'celery': { name: 'Celery', kcal: 16 },
  'asparagus': { name: 'Asparagus', kcal: 20 }, 'sparglji': { name: 'Šparglji', kcal: 20 },
  'artichoke': { name: 'Artichoke', kcal: 47 }, 'artickoka': { name: 'Artičoka', kcal: 47 },
  // --- Stročnice / Legumes ---
  'fižol': { name: 'Kuhan fižol', kcal: 127 }, 'lececa': { name: 'Kuhana leča', kcal: 116 },
  'leca': { name: 'Kuhana leča', kcal: 116 }, 'cizrna': { name: 'Kuhana čičerika', kcal: 164 },
  'cicrika': { name: 'Kuhana čičerika', kcal: 164 }, 'grah': { name: 'Zeleni grah', kcal: 81 },
  'soja': { name: 'Kuhana soja', kcal: 173 }, 'tofu': { name: 'Tofu', kcal: 76 },
  'hummus': { name: 'Hummus', kcal: 166 }, 'hmus': { name: 'Hummus', kcal: 166 },
  'beans': { name: 'Cooked beans', kcal: 127 }, 'lentils': { name: 'Cooked lentils', kcal: 116 },
  'chickpeas': { name: 'Cooked chickpeas', kcal: 164 }, 'peas': { name: 'Green peas', kcal: 81 },
  'soybeans': { name: 'Cooked soybeans', kcal: 173 }, 'edamame': { name: 'Edamame', kcal: 121 },
  // --- Sadje / Fruit ---
  'banana': { name: 'Banana', kcal: 89 }, 'jabolko': { name: 'Jabolko', kcal: 52 },
  'pomaranca': { name: 'Pomaranča', kcal: 47 }, 'jagode': { name: 'Jagode', kcal: 32 },
  'borovnice': { name: 'Borovnice', kcal: 57 }, 'kivi': { name: 'Kivi', kcal: 61 },
  'grozdje': { name: 'Grozdje', kcal: 69 }, 'lubenica': { name: 'Lubenica', kcal: 30 },
  'avokado': { name: 'Avokado', kcal: 160 }, 'mango': { name: 'Mango', kcal: 60 },
  'ananas': { name: 'Ananas', kcal: 50 }, 'breskev': { name: 'Breskev', kcal: 39 },
  'hruska': { name: 'Hruška', kcal: 57 }, 'sliva': { name: 'Sliva', kcal: 46 },
  'visnja': { name: 'Višnja / češnja', kcal: 63 }, 'ceresnja': { name: 'Češnja', kcal: 63 },
  'malina': { name: 'Malina', kcal: 52 }, 'robida': { name: 'Robida', kcal: 43 },
  'smokva': { name: 'Smokva', kcal: 74 }, 'datelj': { name: 'Datelj', kcal: 277 },
  'rozina': { name: 'Rozine', kcal: 299 }, 'limon': { name: 'Limona', kcal: 29 },
  'apple': { name: 'Apple', kcal: 52 }, 'orange': { name: 'Orange', kcal: 47 },
  'strawberry': { name: 'Strawberries', kcal: 32 }, 'strawberries': { name: 'Strawberries', kcal: 32 },
  'blueberry': { name: 'Blueberries', kcal: 57 }, 'blueberries': { name: 'Blueberries', kcal: 57 },
  'grapes': { name: 'Grapes', kcal: 69 }, 'watermelon': { name: 'Watermelon', kcal: 30 },
  'avocado': { name: 'Avocado', kcal: 160 }, 'peach': { name: 'Peach', kcal: 39 },
  'pear': { name: 'Pear', kcal: 57 }, 'plum': { name: 'Plum', kcal: 46 },
  'cherry': { name: 'Cherry', kcal: 63 }, 'cherries': { name: 'Cherries', kcal: 63 },
  'raspberry': { name: 'Raspberry', kcal: 52 }, 'raspberries': { name: 'Raspberries', kcal: 52 },
  'blackberry': { name: 'Blackberry', kcal: 43 }, 'pineapple': { name: 'Pineapple', kcal: 50 },
  'lemon': { name: 'Lemon', kcal: 29 },
  'dates': { name: 'Dates', kcal: 277 }, 'raisins': { name: 'Raisins', kcal: 299 },
  'fig': { name: 'Fig', kcal: 74 }, 'figs': { name: 'Figs', kcal: 74 },
  // --- Oreščki / Nuts & Seeds ---
  'mandlji': { name: 'Mandlji', kcal: 579 }, 'orehi': { name: 'Orehi', kcal: 654 },
  'indijski oresek': { name: 'Indijski orešek', kcal: 553 }, 'pistacije': { name: 'Pistacije', kcal: 562 },
  'lescniki': { name: 'Lešniki', kcal: 628 }, 'macadamia': { name: 'Macadamia', kcal: 718 },
  'brasiljski oresek': { name: 'Brazilski orešek', kcal: 659 }, 'pine nuts': { name: 'Pinjole', kcal: 673 },
  'pinjole': { name: 'Pinjole', kcal: 673 }, 'bucna semena': { name: 'Bučna semena', kcal: 559 },
  'soncnicna semena': { name: 'Sončnična semena', kcal: 584 }, 'laneno seme': { name: 'Laneno seme', kcal: 534 },
  'chia semena': { name: 'Chia semena', kcal: 486 }, 'sezam': { name: 'Sezam', kcal: 573 },
  'arasidovo maslo': { name: 'Arašidovo maslo', kcal: 588 }, 'arasidi': { name: 'Arašidi', kcal: 567 },
  'almonds': { name: 'Almonds', kcal: 579 }, 'walnuts': { name: 'Walnuts', kcal: 654 },
  'cashews': { name: 'Cashews', kcal: 553 }, 'pistachios': { name: 'Pistachios', kcal: 562 },
  'hazelnuts': { name: 'Hazelnuts', kcal: 628 }, 'peanuts': { name: 'Peanuts', kcal: 567 },
  'peanut butter': { name: 'Peanut butter', kcal: 588 }, 'pumpkin seeds': { name: 'Pumpkin seeds', kcal: 559 },
  'sunflower seeds': { name: 'Sunflower seeds', kcal: 584 }, 'chia seeds': { name: 'Chia seeds', kcal: 486 },
  'flaxseed': { name: 'Flaxseed', kcal: 534 }, 'sesame': { name: 'Sesame seeds', kcal: 573 },
  // --- Maščobe / Oils ---
  'olivno olje': { name: 'Olivno olje', kcal: 884 }, 'olje': { name: 'Rastlinsko olje', kcal: 884 },
  'kokosovo olje': { name: 'Kokosovo olje', kcal: 892 }, 'ghee': { name: 'Ghee', kcal: 900 },
  'olive oil': { name: 'Olive oil', kcal: 884 }, 'coconut oil': { name: 'Coconut oil', kcal: 892 },
  'vegetable oil': { name: 'Vegetable oil', kcal: 884 },
  // --- Sladkarije / Sweets ---
  'cokolada': { name: 'Mlečna čokolada', kcal: 546 }, 'temna cokolada': { name: 'Temna čokolada', kcal: 598 },
  'bela cokolada': { name: 'Bela čokolada', kcal: 539 }, 'sladkor': { name: 'Beli sladkor', kcal: 387 },
  'med': { name: 'Med', kcal: 304 }, 'nutella': { name: 'Nutella', kcal: 539 },
  'marmelada': { name: 'Marmelada', kcal: 278 },
  'cokoladni namaz': { name: 'Čokoladni namaz', kcal: 539 },
  'chocolate': { name: 'Milk chocolate', kcal: 546 }, 'dark chocolate': { name: 'Dark chocolate', kcal: 598 },
  'white chocolate': { name: 'White chocolate', kcal: 539 }, 'sugar': { name: 'Sugar', kcal: 387 },
  'honey': { name: 'Honey', kcal: 304 }, 'jam': { name: 'Jam', kcal: 278 },
  'maple syrup': { name: 'Maple syrup', kcal: 260 },
  // --- Slovenijske jedi / Slovenian dishes ---
  'burek': { name: 'Burek (s sirom)', kcal: 298 }, 'burek z mesom': { name: 'Burek z mesom', kcal: 312 },
  'burek s sirom': { name: 'Burek s sirom', kcal: 298 }, 'potica': { name: 'Potica (orehova)', kcal: 385 },
  'strudel': { name: 'Jabolčni zavitek', kcal: 210 }, 'gibanica': { name: 'Gibanica', kcal: 320 },
  'zelenjavna juha': { name: 'Zelenjavna juha', kcal: 35 }, 'goveja juha': { name: 'Goveja juha', kcal: 45 },
  'minestrone': { name: 'Minestrone', kcal: 60 }, 'goulas': { name: 'Golaž', kcal: 112 },
  'golaz': { name: 'Golaž', kcal: 112 }, 'kranjska klobasa': { name: 'Kranjska klobasa', kcal: 312 },
  'kislo zelje': { name: 'Kislo zelje', kcal: 19 }, 'zelje': { name: 'Zelje', kcal: 25 },
  'jota': { name: 'Jota (juha)', kcal: 72 }, 'ricet': { name: 'Ričet', kcal: 95 },
  'prsut': { name: 'Pršut', kcal: 268 }, 'presut': { name: 'Pršut', kcal: 268 },
  'sarma': { name: 'Sarma', kcal: 148 }, 'palacinka': { name: 'Palačinka', kcal: 197 },
  'palacinka s cokolado': { name: 'Palačinka s čokolado', kcal: 265 },
  // --- Mednarodne jedi / International dishes ---
  'pica': { name: 'Pica margarita', kcal: 266 }, 'pizza': { name: 'Pizza margherita', kcal: 266 },
  'pica margarita': { name: 'Pica margarita', kcal: 266 }, 'pizza margherita': { name: 'Pizza margherita', kcal: 266 },
  'pizza pepperoni': { name: 'Pizza pepperoni', kcal: 298 }, 'pica s salamom': { name: 'Pica s salamom', kcal: 298 },
  'burger': { name: 'Hamburger', kcal: 295 }, 'cevapi': { name: 'Čevapi', kcal: 230 },
  'kebab': { name: 'Kebab (doner)', kcal: 220 }, 'shawarma': { name: 'Shawarma', kcal: 215 },
  'sushi': { name: 'Sushi (maki)', kcal: 140 }, 'ramen': { name: 'Ramen juha', kcal: 188 },
  'pad thai': { name: 'Pad Thai', kcal: 168 }, 'fried rice': { name: 'Fried rice', kcal: 163 },
  'ocvrt riz': { name: 'Ocvrt riž', kcal: 163 }, 'curry': { name: 'Curry (piščanec)', kcal: 150 },
  'lasagna': { name: 'Lazanja', kcal: 166 }, 'lazanja': { name: 'Lazanja', kcal: 166 },
  'risotto': { name: 'Rižota', kcal: 166 }, 'rizota': { name: 'Rižota', kcal: 166 },
  'tacos': { name: 'Tacos', kcal: 226 }, 'burrito': { name: 'Burrito', kcal: 206 },
  'sandwich': { name: 'Sendvič (šunka+sir)', kcal: 250 }, 'sendvic': { name: 'Sendvič', kcal: 250 },
  'wrap': { name: 'Wrap (piščanec)', kcal: 230 }, 'hotdog': { name: 'Hot dog', kcal: 290 },
  'nachos': { name: 'Nachos s sirom', kcal: 346 },
  'quesadilla': { name: 'Quesadilla', kcal: 304 }, 'gyros': { name: 'Gyros', kcal: 215 },
  'falafel': { name: 'Falafel', kcal: 333 }, 'paella': { name: 'Paella', kcal: 162 },
  // --- Pijače / Drinks ---
  'kava': { name: 'Kava (brez sladkorja)', kcal: 2 }, 'kava z mlekom': { name: 'Kava z mlekom', kcal: 47 },
  'cappuccino': { name: 'Cappuccino', kcal: 74 }, 'latte': { name: 'Latte', kcal: 101 },
  'caj': { name: 'Čaj (brez sladkorja)', kcal: 1 }, 'sokova': { name: 'Pomarančni sok', kcal: 45 },
  'pomarancni sok': { name: 'Pomarančni sok', kcal: 45 }, 'jabolcni sok': { name: 'Jabolčni sok', kcal: 46 },
  'smoothie': { name: 'Sadni smoothie', kcal: 60 }, 'proteinov napitek': { name: 'Proteinski napitek', kcal: 120 },
  'coffee': { name: 'Coffee (black)', kcal: 2 }, 'coffee with milk': { name: 'Coffee with milk', kcal: 47 },
  'tea': { name: 'Tea (unsweetened)', kcal: 1 }, 'orange juice': { name: 'Orange juice', kcal: 45 },
  'apple juice': { name: 'Apple juice', kcal: 46 }, 'protein shake': { name: 'Protein shake', kcal: 120 },
  // --- Razno / Misc ---
  'ketchup': { name: 'Ketchup', kcal: 112 }, 'majoneza': { name: 'Majoneza', kcal: 680 },
  'mayonnaise': { name: 'Mayonnaise', kcal: 680 }, 'mustard': { name: 'Mustard', kcal: 66 },
  'gorcica': { name: 'Gorčica', kcal: 66 }, 'sojina omaka': { name: 'Sojina omaka', kcal: 60 },
  'soy sauce': { name: 'Soy sauce', kcal: 60 }, 'tabasco': { name: 'Tabasco', kcal: 12 },
  'chips': { name: 'Krompirjev čips', kcal: 536 }, 'cips': { name: 'Krompirjev čips', kcal: 536 },
  'popcorn': { name: 'Popcorn (navaden)', kcal: 375 }, 'pretzels': { name: 'Slani peclji', kcal: 381 },
  'crackers': { name: 'Krekerji', kcal: 421 }, 'krekerji': { name: 'Krekerji', kcal: 421 },
  'protein bar': { name: 'Proteinska ploščica', kcal: 370 }, 'proteinska ploscica': { name: 'Proteinska ploščica', kcal: 370 },
  'granola': { name: 'Granola', kcal: 471 }, 'muesli': { name: 'Musli', kcal: 367 },
  'musli': { name: 'Musli', kcal: 367 },
};

function normalizeFoodQuery(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const FOOD_NUTRITION_LIBRARY = [
  { aliases: ['chicken', 'chicken breast', 'piscancje prsi', 'piscanec'], name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['chicken thigh'], name: 'Chicken thigh', kcal: 209, protein: 26, carbs: 0, fat: 10.9, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['turkey', 'puran'], name: 'Turkey breast', kcal: 135, protein: 29, carbs: 0, fat: 1.6, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['beef', 'steak', 'govedina'], name: 'Beef', kcal: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['pork', 'svinjina'], name: 'Pork', kcal: 242, protein: 27, carbs: 0, fat: 14, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['salmon', 'losos'], name: 'Salmon', kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0, servingG: 150 },
  { aliases: ['tuna', 'tuna in water', 'tunina'], name: 'Tuna in water', kcal: 116, protein: 26, carbs: 0, fat: 1, fiber: 0, sugar: 0, servingG: 120, canG: 120 },
  { aliases: ['tuna in oil', 'tuna v olju'], name: 'Tuna in oil', kcal: 198, protein: 29, carbs: 0, fat: 8, fiber: 0, sugar: 0, servingG: 120, canG: 120 },
  { aliases: ['egg', 'eggs', 'jajce', 'jajca', 'boiled egg'], name: 'Egg', kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1, servingG: 50, countG: 50 },
  { aliases: ['egg white', 'beljak'], name: 'Egg white', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, sugar: 0.7, servingG: 33, countG: 33 },
  { aliases: ['rice', 'white rice', 'riz', 'kuhan riz'], name: 'Cooked white rice', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, servingG: 160, cupG: 158 },
  { aliases: ['brown rice', 'rjavi riz'], name: 'Cooked brown rice', kcal: 112, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, sugar: 0.4, servingG: 160, cupG: 195 },
  { aliases: ['pasta', 'spaghetti', 'testenine'], name: 'Cooked pasta', kcal: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, sugar: 0.6, servingG: 180, cupG: 140 },
  { aliases: ['bread', 'white bread', 'kruh'], name: 'White bread', kcal: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sugar: 5, servingG: 35, sliceG: 35 },
  { aliases: ['whole wheat bread', 'whole grain bread', 'polnozrnat kruh'], name: 'Whole wheat bread', kcal: 247, protein: 13, carbs: 41, fat: 4.2, fiber: 7, sugar: 6, servingG: 35, sliceG: 35 },
  { aliases: ['oats', 'oatmeal', 'ovseni kosmici'], name: 'Rolled oats', kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sugar: 0.9, servingG: 45, cupG: 80 },
  { aliases: ['potato', 'krompir'], name: 'Boiled potato', kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, servingG: 180 },
  { aliases: ['sweet potato', 'sladki krompir'], name: 'Sweet potato', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sugar: 4.2, servingG: 180 },
  { aliases: ['broccoli', 'brokoli'], name: 'Broccoli', kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, sugar: 1.7, servingG: 90, cupG: 91 },
  { aliases: ['asparagus', 'sparglji'], name: 'Asparagus', kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, sugar: 1.9, servingG: 90, cupG: 134 },
  { aliases: ['tomato', 'tomatoes', 'paradiznik'], name: 'Tomato', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, servingG: 120 },
  { aliases: ['banana'], name: 'Banana', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, servingG: 118, countG: 118 },
  { aliases: ['apple', 'jabolko'], name: 'Apple', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10.4, servingG: 180, countG: 180 },
  { aliases: ['avocado', 'avokado'], name: 'Avocado', kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7, servingG: 150, countG: 150 },
  { aliases: ['milk', 'mleko'], name: 'Whole milk', kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sugar: 5, servingG: 244, cupG: 244 },
  { aliases: ['greek yogurt', 'grski jogurt'], name: 'Greek yogurt', kcal: 97, protein: 9, carbs: 3.6, fat: 5, fiber: 0, sugar: 3.2, servingG: 170, cupG: 245 },
  { aliases: ['yogurt', 'jogurt'], name: 'Plain yogurt', kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.2, servingG: 170, cupG: 245 },
  { aliases: ['cheese', 'sir'], name: 'Hard cheese', kcal: 402, protein: 25, carbs: 1.3, fat: 33, fiber: 0, sugar: 0.5, servingG: 30, sliceG: 25 },
  { aliases: ['olive oil', 'olivno olje'], name: 'Olive oil', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, servingG: 14, tbspG: 14, tspG: 4.5 },
  { aliases: ['butter', 'maslo'], name: 'Butter', kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1, servingG: 14, tbspG: 14, tspG: 4.7 },
  { aliases: ['peanut butter', 'arasidovo maslo'], name: 'Peanut butter', kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sugar: 9, servingG: 32, tbspG: 16 },
  { aliases: ['pizza', 'pica'], name: 'Pizza margherita', kcal: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3, sugar: 3.6, servingG: 250, sliceG: 110 },
  { aliases: ['burger', 'hamburger'], name: 'Hamburger', kcal: 295, protein: 17, carbs: 30, fat: 14, fiber: 1.5, sugar: 5, servingG: 220 },
];

const NUMBER_WORDS = {
  half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ena: 1, en: 1, dve: 2, dva: 2, tri: 3, stiri: 4, pet: 5, sest: 6,
};

function parseAmountToken(token) {
  if (!token) return null;
  const clean = normalizeFoodQuery(token).replace(',', '.');
  if (NUMBER_WORDS[clean] !== undefined) return NUMBER_WORDS[clean];
  if (/^\d+\/\d+$/.test(clean)) {
    const [a, b] = clean.split('/').map(Number);
    return b ? a / b : null;
  }
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function findNutritionFood(rawName) {
  const normalized = normalizeFoodQuery(rawName).replace(/\b(of|with|and|in|cooked|raw|fresh)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const library = FOOD_NUTRITION_LIBRARY
    .flatMap((food) => food.aliases.map((alias) => ({ food, alias: normalizeFoodQuery(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const exact = library.find(({ alias }) => alias === normalized);
  if (exact) return exact.food;
  const included = library.find(({ alias }) => normalized.includes(alias) || alias.includes(normalized));
  if (included) return included.food;
  const local = LOCAL_FOODS[normalized] || Object.entries(LOCAL_FOODS).find(([key]) => normalized.includes(key) || key.includes(normalized))?.[1];
  if (!local) return null;
  return { name: local.name, kcal: local.kcal, servingG: 100, fallback: true };
}

function inferMacrosFromCalories(name, kcal) {
  const normalized = normalizeFoodQuery(name);
  let proteinPct = 0.2, carbsPct = 0.5, fatPct = 0.3;
  if (/(oil|olje|butter|maslo|mayo|majoneza)/.test(normalized)) { proteinPct = 0; carbsPct = 0; fatPct = 1; }
  else if (/(chicken|beef|pork|tuna|salmon|fish|meat|puran|govedina|svinjina|losos)/.test(normalized)) { proteinPct = 0.55; carbsPct = 0; fatPct = 0.45; }
  else if (/(rice|bread|pasta|potato|oats|riz|kruh|testenine|krompir)/.test(normalized)) { proteinPct = 0.12; carbsPct = 0.78; fatPct = 0.1; }
  else if (/(fruit|apple|banana|jabolko|sadje)/.test(normalized)) { proteinPct = 0.03; carbsPct = 0.94; fatPct = 0.03; }
  return {
    protein: (kcal * proteinPct) / 4,
    carbs: (kcal * carbsPct) / 4,
    fat: (kcal * fatPct) / 9,
    fiber: 0,
    sugar: 0,
  };
}

function getServingGrams(food, quantity = 1, unit = '') {
  const q = Math.max(0.05, Number(quantity) || 1);
  const u = normalizeFoodQuery(unit);
  if (u === 'kg' || u.startsWith('kilogram')) return q * 1000;
  if (u === 'g' || u.startsWith('gram')) return q;
  if (u === 'l' || u.startsWith('liter') || u.startsWith('litre')) return q * 1000;
  if (u === 'ml' || u.startsWith('milliliter')) return q;
  if (u.startsWith('cup')) return q * (food.cupG || food.servingG || 150);
  if (u === 'tbsp' || u.startsWith('tablespoon')) return q * (food.tbspG || 14);
  if (u === 'tsp' || u.startsWith('teaspoon')) return q * (food.tspG || 5);
  if (u.startsWith('slice')) return q * (food.sliceG || food.servingG || 35);
  if (u.startsWith('can')) return q * (food.canG || food.servingG || 120);
  if (u.startsWith('piece') || u === 'pcs' || u.startsWith('serving')) return q * (food.countG || food.servingG || 100);
  return q * (food.countG || food.servingG || 100);
}

function parseIngredientPhrase(raw) {
  let text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const unitPattern = '(kg|kilograms?|g|grams?|ml|milliliters?|l|liters?|litres?|cups?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|pcs|cans?|servings?)';
  let quantity = null;
  let unit = '';
  let name = text;
  const trailing = text.match(new RegExp(`^(.+?)\\s+(\\d+(?:[,.]\\d+)?|\\d+\\/\\d+)\\s*${unitPattern}$`, 'i'));
  const leading = text.match(new RegExp(`^(\\d+(?:[,.]\\d+)?|\\d+\\/\\d+|half|one|two|three|four|five|six|seven|eight|nine|ten|ena|en|dve|dva|tri|stiri|pet|sest)\\s*${unitPattern}?\\s+(.+)$`, 'i'));
  if (trailing) {
    name = trailing[1];
    quantity = parseAmountToken(trailing[2]);
    unit = trailing[3] || '';
  } else if (leading) {
    quantity = parseAmountToken(leading[1]);
    unit = leading[2] || '';
    name = leading[3];
  }
  name = name.replace(/^of\s+/i, '').trim();
  const food = findNutritionFood(name);
  if (!food) return { raw, unmatched: true };
  const grams = Math.round(getServingGrams(food, quantity || 1, unit));
  const kcal = Math.round((food.kcal * grams) / 100);
  const macros = food.protein === undefined ? inferMacrosFromCalories(food.name, kcal) : food;
  return {
    name: food.name,
    raw,
    grams,
    kcal,
    protein: Number(((macros.protein || 0) * grams / 100).toFixed(1)),
    carbs: Number(((macros.carbs || 0) * grams / 100).toFixed(1)),
    fat: Number(((macros.fat || 0) * grams / 100).toFixed(1)),
    fiber: Number(((macros.fiber || 0) * grams / 100).toFixed(1)),
    sugar: Number(((macros.sugar || 0) * grams / 100).toFixed(1)),
    kcalPer100: food.kcal,
    confidence: food.fallback ? 'low' : 'moderate',
  };
}

function buildNutritionResult(items, source = 'local') {
  const total = items.reduce((acc, item) => ({
    kcal: acc.kcal + Number(item.kcal || 0),
    protein: acc.protein + Number(item.protein || 0),
    carbs: acc.carbs + Number(item.carbs || 0),
    fat: acc.fat + Number(item.fat || 0),
    fiber: acc.fiber + Number(item.fiber || 0),
    sugar: acc.sugar + Number(item.sugar || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const confidence = items.every((item) => item.confidence === 'high')
    ? 'high'
    : (items.some((item) => item.confidence === 'low') ? 'low' : 'moderate');
  return {
    source,
    confidence,
    total: Object.fromEntries(Object.entries(total).map(([key, value]) => [key, key === 'kcal' ? Math.round(value) : Number(value.toFixed(1))])),
    items: items.map((item) => ({ ...item, kcal: Math.round(item.kcal) })),
  };
}

function parseAiJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  return null;
}

function analyzeIngredientsLocally({ mode, query, preciseItems }) {
  const phrases = mode === 'quick'
    ? query.split(/,|\n|;|\+|\s+and\s+/i).map((item) => item.trim()).filter(Boolean)
    : preciseItems.filter((item) => item.name.trim() && Number(item.grams) > 0).map((item) => `${item.grams} g ${item.name}`);
  const parsed = phrases.map(parseIngredientPhrase);
  const matched = parsed.filter((item) => item && !item.unmatched);
  const unmatched = parsed.filter((item) => item?.unmatched).map((item) => item.raw);
  if (!matched.length) return null;
  return { ...buildNutritionResult(matched, 'offline'), unmatched };
}

function sanitizeIngredientResult(parsed, source = 'ai') {
  if (!parsed || !Array.isArray(parsed.items)) return null;
  const items = parsed.items.map((item) => ({
    name: String(item.name || 'Food').slice(0, 80),
    grams: Math.max(0, Math.round(Number(item.grams) || 0)),
    kcalPer100: Math.max(0, Math.round(Number(item.kcalPer100 || item.kcal_per_100 || item.caloriesPer100g) || 0)),
    kcal: Math.max(0, Math.round(Number(item.kcal) || (Number(item.kcalPer100 || item.kcal_per_100 || item.caloriesPer100g) * Number(item.grams || 0) / 100) || 0)),
    protein: Number((Number(item.protein) || 0).toFixed(1)),
    carbs: Number((Number(item.carbs) || 0).toFixed(1)),
    fat: Number((Number(item.fat) || 0).toFixed(1)),
    fiber: Number((Number(item.fiber) || 0).toFixed(1)),
    sugar: Number((Number(item.sugar) || 0).toFixed(1)),
    quantity: item.quantity ? String(item.quantity).slice(0, 40) : '',
    unit: item.unit ? String(item.unit).slice(0, 24) : '',
    assumption: item.assumption ? String(item.assumption).slice(0, 180) : '',
    confidence: ['low', 'moderate', 'high'].includes(item.confidence) ? item.confidence : 'moderate',
  })).filter((item) => item.name && (item.kcal || item.grams));
  if (!items.length) return null;
  const built = buildNutritionResult(items, source);
  let calorieRange = null;
  if (parsed.calorieRange && typeof parsed.calorieRange === 'object') {
    const low = Math.max(0, Math.round(Number(parsed.calorieRange.low) || 0));
    const high = Math.max(0, Math.round(Number(parsed.calorieRange.high) || 0));
    if (low || high) calorieRange = { low: low || high, high: Math.max(low, high) };
  }
  return {
    ...built,
    mealName: parsed.mealName ? String(parsed.mealName).slice(0, 90) : '',
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map((item) => String(item).slice(0, 180)).slice(0, 5) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((item) => String(item).slice(0, 180)).slice(0, 5) : [],
    calorieRange,
  };
}

function getBodyFatCategory(percent, gender = 'male') {
  const p = Number(percent);
  if (gender === 'female') {
    if (p < 12) return 'Essential fat';
    if (p <= 20) return 'Athletes';
    if (p <= 24) return 'Fitness';
    if (p <= 31) return 'Average';
    return 'High';
  }
  if (p < 5) return 'Essential fat';
  if (p <= 13) return 'Athletes';
  if (p <= 17) return 'Fitness';
  if (p <= 24) return 'Average';
  return 'High';
}

function getMeasurementBodyFatMethods({ gender = 'male', age, height, weight, waist, neck, hip }) {
  const methods = [];
  const h = Number(height), w = Number(weight), a = Number(age), waistCm = Number(waist), neckCm = Number(neck), hipCm = Number(hip);
  const sex = gender === 'male' ? 1 : 0;
  if (h > 80 && w > 20 && a > 5) {
    const bmi = w / ((h / 100) ** 2);
    const value = a < 18
      ? (1.51 * bmi) - (0.7 * a) - (3.6 * sex) + 1.4
      : (1.2 * bmi) + (0.23 * a) - (10.8 * sex) - 5.4;
    methods.push({ name: 'BMI-age', value: clampNumber(value, 3, 60), weight: 0.16 });
  }
  if (h > 80 && waistCm > 40) {
    const value = gender === 'female' ? 76 - (20 * h / waistCm) : 64 - (20 * h / waistCm);
    methods.push({ name: 'RFM', value: clampNumber(value, 3, 60), weight: 0.24 });
  }
  if (h > 80 && waistCm > 40 && neckCm > 20) {
    const hi = h / 2.54, wi = waistCm / 2.54, ni = neckCm / 2.54, hipi = hipCm / 2.54;
    const value = gender === 'female' && hipCm > 50
      ? (163.205 * Math.log10(wi + hipi - ni)) - (97.684 * Math.log10(hi)) - 78.387
      : (86.01 * Math.log10(wi - ni)) - (70.041 * Math.log10(hi)) + 36.76;
    if (Number.isFinite(value)) methods.push({ name: 'US Navy circumference', value: clampNumber(value, 3, 60), weight: 0.6 });
  }
  return methods;
}

function combineBodyFatMethods(methods, photoEstimate = null, photoCount = 0) {
  const usable = methods.filter((method) => Number.isFinite(method.value));
  if (photoEstimate && Number.isFinite(photoEstimate.bodyFatPercent)) {
    const measurementAvg = usable.length ? usable.reduce((s, m) => s + m.value * m.weight, 0) / usable.reduce((s, m) => s + m.weight, 0) : null;
    const conflict = measurementAvg !== null && Math.abs(photoEstimate.bodyFatPercent - measurementAvg) > 8;
    usable.push({ name: 'AI photo', value: clampNumber(photoEstimate.bodyFatPercent, 3, 60), weight: conflict ? 0.12 : (photoCount >= 3 ? 0.3 : 0.2) });
  }
  if (!usable.length) return null;
  const totalWeight = usable.reduce((sum, method) => sum + method.weight, 0);
  const bodyFatPercent = usable.reduce((sum, method) => sum + method.value * method.weight, 0) / totalWeight;
  const confidence = usable.some((m) => m.name === 'US Navy circumference') && usable.length >= 3
    ? (photoCount >= 2 ? 'high' : 'moderate')
    : usable.length >= 2 ? 'moderate' : 'low';
  return {
    bodyFatPercent: Number(bodyFatPercent.toFixed(1)),
    confidence,
    methods: usable.map((method) => ({ name: method.name, value: Number(method.value.toFixed(1)) })),
  };
}

function getCalHistoryKey(email) { return `${CAL_HISTORY_KEY_PREFIX}${email}`; }
function getBodyWeightKey(email) { return `${BODYWEIGHT_KEY_PREFIX}${email}`; }
function getBodyFatKey(email) { return `${BODYFAT_KEY_PREFIX}${email}`; }
function getRecapKey(email) { return `${RECAP_KEY_PREFIX}${email}`; }
function getRestKey(email) { return `${REST_KEY_PREFIX}${email || ''}`; }
function getCheatKey(email) { return `${CHEAT_KEY_PREFIX}${email || ''}`; }
function getLegacyRestKey(email) { return `${REST_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function getLegacyCheatKey(email) { return `${CHEAT_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function loadDateList(primaryKey, legacyKey) {
  try {
    const primary = JSON.parse(localStorage.getItem(primaryKey) || '[]');
    if (Array.isArray(primary) && primary.length) return sanitizeDateArray(primary);
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
    return sanitizeDateArray(legacy);
  } catch { return []; }
}
function loadRestDays(email) { return email ? loadDateList(getRestKey(email), getLegacyRestKey(email)) : []; }
function loadCheatDays(email) { return email ? loadDateList(getCheatKey(email), getLegacyCheatKey(email)) : []; }
function getCustomExKey(email) { return `${CUSTOM_EX_KEY_PREFIX}${email}`; }
function loadCustomExercises(email) { if (!email) return []; try { const stored = JSON.parse(localStorage.getItem(getCustomExKey(email)) || '[]'); return Array.isArray(stored) ? stored.slice(0, 500).map(sanitizeCustomExercise).filter(Boolean) : []; } catch { return []; } }
function getWaterKey(email, date = new Date().toISOString().slice(0, 10)) { return `${WATER_KEY_PREFIX}${email}_${date}`; }
function loadWaterMl(email) { if (!email) return 0; try { return Number(localStorage.getItem(getWaterKey(email)) || 0); } catch { return 0; } }
function saveWaterMl(email, ml) { if (email) localStorage.setItem(getWaterKey(email), String(ml)); }
function getDemoDaysKey(email) { return `${DEMO_DAYS_KEY_PREFIX}${email || ''}`; }
function getDemoWaterKey(email, date = new Date().toISOString().slice(0, 10)) { return `${DEMO_WATER_KEY_PREFIX}${email || ''}_${date}`; }
function readDemoDayMarkers(email) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getDemoDaysKey(email)) || '{}');
    return {
      rest: Array.isArray(parsed.rest) ? parsed.rest : [],
      cheat: Array.isArray(parsed.cheat) ? parsed.cheat : [],
    };
  } catch {
    return { rest: [], cheat: [] };
  }
}
function loadBodyWeight(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getBodyWeightKey(email)) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 5000).map(sanitizeBodyWeightEntry).filter(Boolean) : [];
  } catch { return []; }
}
function loadCalHistory(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getCalHistoryKey(email)) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 10000).map(sanitizeCalHistoryEntry).filter(Boolean) : [];
  } catch { return []; }
}
function loadBodyFatHistory(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getBodyFatKey(email)) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 500).map(sanitizeBodyFatHistoryEntry).filter(Boolean) : [];
  } catch { return []; }
}

function isCleanDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanNumber(value, min, max, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clampNumber(num, min, max);
}

async function sha256Text(value) {
  const buffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(buffer));
}

function sanitizeDateArray(list, limit = 5000) {
  return Array.isArray(list) ? [...new Set(list.filter(isCleanDate))].slice(0, limit) : [];
}

function sanitizeMealEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanText(entry.name, 160);
  const date = isCleanDate(entry.date) ? entry.date : todayKey();
  if (!name) return null;
  const mealType = VALID_MEAL_TYPES.includes(entry.mealType) ? entry.mealType : 'snack';
  return {
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date,
    mealType,
    name,
    calories: Math.round(cleanNumber(entry.calories, 0, 20000, 0)),
    protein: Number(cleanNumber(entry.protein, 0, 1000, 0).toFixed(1)),
    carbs: Number(cleanNumber(entry.carbs, 0, 2000, 0).toFixed(1)),
    fat: Number(cleanNumber(entry.fat, 0, 1000, 0).toFixed(1)),
    ...(entry.demo ? { demo: true } : {}),
  };
}

function sanitizeBodyWeightEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const weight = cleanNumber(entry.weight, 20, 400, NaN);
  if (!Number.isFinite(weight)) return null;
  return {
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date: isCleanDate(entry.date) ? entry.date : todayKey(),
    weight: Number(weight.toFixed(1)),
    ...(entry.demo ? { demo: true } : {}),
  };
}

function sanitizeCalHistoryEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanText(entry.name, 160);
  if (!name) return null;
  return {
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date: isCleanDate(entry.date) ? entry.date : todayKey(),
    name,
    grams: Math.round(cleanNumber(entry.grams, 0, 20000, 0)),
    kcalPer100: Math.round(cleanNumber(entry.kcalPer100 ?? entry.kcal_per_100, 0, 2000, 0)),
    total: Math.round(cleanNumber(entry.total, 0, 50000, 0)),
    protein: Number(cleanNumber(entry.protein, 0, 1000, 0).toFixed(1)),
    carbs: Number(cleanNumber(entry.carbs, 0, 2000, 0).toFixed(1)),
    fat: Number(cleanNumber(entry.fat, 0, 1000, 0).toFixed(1)),
  };
}

function sanitizeCustomExercise(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const name = cleanText(entry.name, 90);
  if (!name) return null;
  const section = MUSCLE_KEYS.includes(entry.section) ? entry.section : 'Chest';
  const cleanLocale = (value) => ({
    en: cleanText(value?.en, 260),
    sl: cleanText(value?.sl, 260),
  });
  return {
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    name,
    section,
    howTo: cleanLocale(entry.howTo),
    cues: cleanLocale(entry.cues),
    targets: cleanLocale(entry.targets),
    primary: cleanLocale(entry.primary),
  };
}

function sanitizeBodyFatHistoryEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const result = entry.result && typeof entry.result === 'object' ? entry.result : {};
  return {
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date: isCleanDate(entry.date) ? entry.date : todayKey(),
    photoCount: Math.round(cleanNumber(entry.photoCount, 0, 3, 0)),
    metrics: entry.metrics && typeof entry.metrics === 'object' ? {
      gender: entry.metrics.gender === 'female' ? 'female' : 'male',
      age: cleanNumber(entry.metrics.age, 5, 100, 0),
      height: cleanNumber(entry.metrics.height, 80, 250, 0),
      weight: cleanNumber(entry.metrics.weight, 20, 400, 0),
      waist: cleanNumber(entry.metrics.waist, 0, 250, 0),
      neck: cleanNumber(entry.metrics.neck, 0, 100, 0),
      hip: cleanNumber(entry.metrics.hip, 0, 250, 0),
    } : {},
    result: {
      bodyFatPercent: Number(cleanNumber(result.bodyFatPercent, 3, 60, 0).toFixed(1)),
      confidence: ['low', 'moderate', 'high'].includes(result.confidence) ? result.confidence : 'low',
      category: cleanText(result.category, 80),
      description: cleanText(result.description, 300),
      fatMassKg: result.fatMassKg == null ? null : Number(cleanNumber(result.fatMassKg, 0, 300, 0).toFixed(1)),
      leanMassKg: result.leanMassKg == null ? null : Number(cleanNumber(result.leanMassKg, 0, 300, 0).toFixed(1)),
      methods: Array.isArray(result.methods) ? result.methods.slice(0, 8).map((method) => ({
        name: cleanText(method.name, 80),
        value: Number(cleanNumber(method.value, 0, 80, 0).toFixed(1)),
      })).filter((method) => method.name) : [],
    },
  };
}

function sanitizeBackupPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const workoutsRaw = Array.isArray(raw) ? raw : raw.workouts;
  if (!Array.isArray(workoutsRaw)) return null;
  return {
    workouts: workoutsRaw.slice(0, 5000).map(normalizeWorkout),
    calorieEntries: (Array.isArray(raw.calorieEntries) ? raw.calorieEntries : []).slice(0, 10000).map(sanitizeMealEntry).filter(Boolean),
    settings: raw.settings ? sanitizeSettings(raw.settings) : null,
    calHistory: (Array.isArray(raw.calHistory) ? raw.calHistory : []).slice(0, 10000).map(sanitizeCalHistoryEntry).filter(Boolean),
    bodyFatHistory: (Array.isArray(raw.bodyFatHistory) ? raw.bodyFatHistory : []).slice(0, 500).map(sanitizeBodyFatHistoryEntry).filter(Boolean),
    bodyWeightEntries: (Array.isArray(raw.bodyWeightEntries) ? raw.bodyWeightEntries : []).slice(0, 5000).map(sanitizeBodyWeightEntry).filter(Boolean),
    restDays: sanitizeDateArray(raw.restDays),
    cheatDays: sanitizeDateArray(raw.cheatDays),
    customExercises: (Array.isArray(raw.customExercises) ? raw.customExercises : []).slice(0, 500).map(sanitizeCustomExercise).filter(Boolean),
  };
}

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'sl', label: 'Slovenščina' },
  { id: 'es', label: 'Español' },
  { id: 'pt', label: 'Português' },
  { id: 'fr', label: 'Français' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ar', label: 'العربية' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '简体中文' },
  { id: 'ru', label: 'Русский' },
];
const SUPPORTED_LANGUAGES = LANGUAGE_OPTIONS.map((item) => item.id);
const BACKGROUND_PRESETS = [
  { id: 'blue', color: '#38bdf8', label: { en: 'Blue steel', sl: 'Modra', es: 'Azul acero', pt: 'Azul', fr: 'Bleu acier', tr: 'Mavi', ar: 'Azraq', ja: 'Blue', zh: 'Blue', ru: 'Blue' } },
  { id: 'green', color: '#a3e635', label: { en: 'Performance green', sl: 'Zelena', es: 'Verde', pt: 'Verde', fr: 'Vert', tr: 'Yesil', ar: 'Akhdar', ja: 'Green', zh: 'Green', ru: 'Green' } },
  { id: 'amber', color: '#f59e0b', label: { en: 'Amber power', sl: 'Jantarna', es: 'Ambar', pt: 'Ambar', fr: 'Ambre', tr: 'Kehribar', ar: 'Anbari', ja: 'Amber', zh: 'Amber', ru: 'Amber' } },
  { id: 'red', color: '#f43f5e', label: { en: 'Redline', sl: 'Rdeca', es: 'Rojo', pt: 'Vermelho', fr: 'Rouge', tr: 'Kirmizi', ar: 'Ahmar', ja: 'Red', zh: 'Red', ru: 'Red' } },
  { id: 'violet', color: '#a78bfa', label: { en: 'Violet', sl: 'Vijolicna', es: 'Violeta', pt: 'Violeta', fr: 'Violet', tr: 'Mor', ar: 'Banafsaji', ja: 'Violet', zh: 'Violet', ru: 'Violet' } },
  { id: 'mono', color: '#cbd5e1', label: { en: 'Monochrome', sl: 'Monokrom', es: 'Monocromo', pt: 'Monocromatico', fr: 'Monochrome', tr: 'Monokrom', ar: 'Monochrome', ja: 'Mono', zh: 'Mono', ru: 'Mono' } },
];
const SUPPORTED_BACKGROUNDS = BACKGROUND_PRESETS.map((item) => item.id);
const defaultSettings = { units: 'kg', language: 'en', backgroundAccent: 'blue', dateFormat: 'DD.MM.YYYY', backupReminderDays: 7, lastBackupAt: '', calorieGoal: 2200, waterGoalMl: 2500, calorieTrackerMode: 'simple', weightDrop: false, gender: 'male', age: '', height: '', showFeedbackBtn: true };
const defaultAdminConfig = {
  appName: 'PowerGraph',
  announcementEnabled: false,
  announcementText: '',
  maintenanceMode: false,
  signupEnabled: true,
  feedbackEnabled: true,
  backupBannerEnabled: true,
  defaultLanguage: 'en',
  defaultAccent: 'blue',
  defaultUnits: 'kg',
  defaultCalorieGoal: 2200,
  defaultWaterGoalMl: 2500,
  adminNote: '',
};
const RATINGS_KEY = 'powergraph_ratings';
const BANNED_KEY = 'powergraph_banned';
const MODS_KEY = 'powergraph_mods';
const PRESENCE_KEY = 'powergraph_presence';

const ui = {
  sl: {
    app: 'PowerGraph',
    dashboard: 'Nadzorna plo\u0161\u010da',
    history: 'Zgodovina',
    exercises: 'Vaje',
    advisor: 'Nasvetovalec',
    settings: 'Nastavitve',
    calories: 'Kalorije',
    title: 'Spremljaj svoj napredek',
    subtitle: 'Lokalni dnevnik treningov v brskalniku z dnevnim predlogom treninga.',
    addWorkout: 'Dodaj trening',
    chart: 'Napredek po vajah',
    noChart: 'Za izbrano vajo \u0161e ni vnosa.',
    date: 'Datum',
    exercise: 'Vaja',
    weight: 'Te\u017ea',
    sets: 'Serije',
    repsPerSet: 'Ponovitve po serijah',
    addSet: 'Dodaj serijo',
    save: 'Shrani trening',
    saveChanges: 'Shrani spremembe',
    cancel: 'Prekli\u010di',
    edit: 'Uredi',
    delete: 'Izbri\u0161i',
    weekly: 'Tedensko',
    monthly: 'Mese\u010dno',
    analytics: 'Analitika',
    trainingLoad: 'Obremenitev treninga',
    mealCount: '\u0160tevilo obrokov',
    workouts: 'Treningi',
    totalSets: 'Skupaj serij',
    totalReps: 'Skupaj ponovitev',
    totalVolume: 'Skupni volumen',
    bestWeight: 'Najbolj\u0161a te\u017ea',
    streak: 'Zaporedni dnevi',
    recent: 'Zadnji treningi',
    noHistory: 'Treningov se ni. Dodaj prvi trening in zacni slediti napredku.',
    byExercise: 'Statistika po vajah',
    target: 'Target',
    primary: 'Primarni target',
    difficulty: 'Težavnost',
    howTo: 'Kako izvajamo',
    cues: 'Na kaj paziti',
    equipment: 'Oprema / naprave',
    units: 'Enote',
    language: 'Jezik',
    backgroundAccent: 'Barva ozadja',
    backgroundAccentDesc: 'Izberi barvo, ki se uporabi za ozadje, gumbe in glavne poudarke.',
    dateFormat: 'Na\u010din zapisa datuma',
    backupReminder: 'Opomnik za backup',
    lastBackup: 'Zadnji backup',
    never: 'Nikoli',
    days: 'dni',
    export: 'Izvozi podatke',
    import: 'Uvozi podatke',
    clear: 'Izbri\u0161i vse podatke',
    clearConfirm: 'Ali res \u017eeli\u0161 izbrisati vse lokalne podatke? Tega ni mogo\u010de razveljaviti.',
    backupTitle: 'Opomnik za backup',
    backupText: 'Naredi nov izvoz, da ne izgubi\u0161 lokalnih podatkov.',
    showFeedbackBtn: 'Gumb za komentar',
    showFeedbackBtnDesc: 'Prika\u017ei ali skrij gumb za povratne informacije.',
    installApp: 'Namesti aplikacijo',
    installAppDesc: 'Dodaj PowerGraph na za\u010detni zaslon ali namizje.',
    installBtn: 'Namesti',
    installIos: 'Pritisni Deli (\u25a1\u2191) \u2192 \u201eDodaj na za\u010detni zaslon\u201c',
    installDone: 'Aplikacija je \u017ee name\u0161\u010dena.',
    backupDone: 'Backup ustvarjen.',
    importDone: 'Podatki uvo\u017eeni.',
    importFail: 'Uvoz ni uspel.',
    saved: 'Trening shranjen.',
    cleared: 'Podatki izbrisani.',
    advisorTitle: 'Dnevni predlog treninga',
    advisorText: 'Predlog temelji na tem, kaj si nazadnje treniral in katera skupina je trenutno najmanj pokrita.',
    focus: 'Dana\u0161nji fokus',
    why: 'Zakaj ta predlog',
    suggested: 'Predlagane vaje',
    lastWorked: 'Nazadnje trenirano',
    neverWorked: '\u0160e nikoli trenirano',
    reasonCold: 'Ta mi\u0161i\u010dna skupina \u017ee nekaj \u010dasa ni bila trenirana, zato je dober kandidat za danes.',
    reasonEmpty: 'Za to skupino \u0161e ni vnosa, zato je smiselna za uravnote\u017een za\u010detek.',
    reasonBalance: 'Predlog uravnote\u017ei zadnje treninge, da ne ponavlja\u0161 ves \u010das istega fokusa.',
    planStrength: '3 do 4 serije, 6 do 12 ponovitev',
    planCardio: '20 do 35 minut enakomernega ali intervalnega dela',
    chest: 'Prsa',
    legs: 'Noge',
    triceps: 'Triceps',
    biceps: 'Biceps',
    forearms: 'Podlakti',
    shoulders: 'Ramena',
    cardio: 'Vzdr\u017eljivost / kardio',
    back: 'Hrbet',
    abs: 'Trebu\u0161ne',
    login: 'Prijava',
    signup: 'Registracija',
    logout: 'Odjava',
    email: 'Email',
    password: 'Geslo',
    confirmPassword: 'Potrdi geslo',
    authTitle: 'Vstopi v PowerGraph',
    authSubtitle: 'Tvoj trening, prehrana in napredek so ločeni po profilu ter pripravljeni za lokalno rabo ali backend sync.',
    authSwitchLogin: '\u017de ima\u0161 ra\u010dun?',
    authSwitchSignup: '\u0160e nima\u0161 ra\u010duna?',
    authCreate: 'Ustvari ra\u010dun',
    authEnter: 'Nadaljuj',
    authPasswordsNoMatch: 'Gesli se ne ujemata.',
    authInvalidEmail: 'Vpi\u0161i veljaven email.',
    authPasswordRequired: 'Vpiši geslo.',
    authShortPassword: 'Geslo naj ima vsaj 10 znakov.',
    authExists: 'Računa s temi podatki ni bilo mogoče ustvariti.',
    authNotFound: 'Email ali geslo ni pravilno.',
    authWrongPassword: 'Email ali geslo ni pravilno.',
    authLocalOnly: 'Podatki se shranijo lokalno; backend sync je uporabljen samo, ce je nastavljen.',
    authEyebrow: 'Lokalno-prvi dostop',
    authLoginTitle: 'Dobrodošel nazaj',
    authSignupTitle: 'Ustvari varen profil',
    authLoginSubtitle: 'Nadaljuj tam, kjer si končal. Brez nepotrebnih korakov.',
    authSignupSubtitle: 'Nastavi profil za treninge, kalorije, težo in prihodnji sync.',
    authShowPassword: 'Pokaži geslo',
    authHidePassword: 'Skrij geslo',
    authShowShort: 'Pokaži',
    authHideShort: 'Skrij',
    authPasswordHint: 'Uporabi daljše geslo ali frazo. Kopiranje iz password managerja je podprto.',
    authStrength: 'Moč gesla',
    authStrengthWeak: 'Šibko',
    authStrengthOk: 'V redu',
    authStrengthGood: 'Dobro',
    authStrengthStrong: 'Močno',
    authRuleLength: 'Vsaj 10 znakov',
    authRuleVariety: 'Več vrst znakov ali vsaj 14 znakov',
    authRuleNoEmail: 'Ne vsebuje emaila',
    authRuleCommon: 'Ni pogosto geslo',
    authWeakPassword: 'Izberi močnejše geslo.',
    authLoginFailed: 'Email ali geslo ni pravilno.',
    authLocked: 'Preveč poskusov. Poskusi znova čez {time}.',
    authSecurityLocal: 'Lokalni vault',
    authSecurityHash: 'PBKDF2 zaščita gesel',
    authSecuritySync: 'Backend sync pripravljen',
    caloriesTitle: 'Dnevni vnos kalorij',
    caloriesSubtitle: 'Bele\u017ei obroke, dnevni cilj in osnovne makre.',
    addMeal: 'Dodaj obrok',
    mealName: 'Ime obroka',
    mealType: 'Obrok',
    breakfast: 'Zajtrk',
    lunch: 'Kosilo',
    dinner: 'Ve\u010derja',
    snack: 'Malica',
    caloriesUnit: 'kcal',
    protein: 'Beljakovine',
    carbs: 'Ogljikovi hidrati',
    fat: 'Ma\u0161\u010dobe',
    calorieGoal: 'Dnevni cilj',
    caloriesConsumed: 'Vnesene kalorije',
    caloriesRemaining: 'Preostanek',
    caloriesProgress: 'Napredek dneva',
    mealSaved: 'Obrok shranjen.',
    noMeals: 'Danes se ni obrokov. Dodaj obrok ali kopiraj vcerajsnje obroke.',
    todayMeals: 'Danes',
    mealsHistory: 'Dnevni obroki',
    kcalShort: 'kcal',
    trackerMode: 'Na\u010din trackerja',
    simpleTracker: 'Osnovni tracker',
    advancedTracker: 'Napredni tracker',
    ocenjevalec: 'Ocenjevalec kalorij',
    calEstTitle: 'Poišči kalorije',
    calEstFood: 'Ime jedi',
    calEstGrams: 'Količina (g)',
    calEstSearch: 'Išči',
    calEstPer100: 'kcal / 100 g',
    calEstTotal: 'Skupaj kcal',
    calEstNoResult: 'Jed ni bila najdena. Poskusi z drugim imenom.',
    calEstLoading: 'Iščem...',
    calEstError: 'Napaka pri iskanju. Preveri povezavo.',
    calEstPlaceholder: 'npr. piščanec, banana, riž',
    calEstHistory: 'Knjižnica hran',
    calEstHistoryEmpty: 'Še ni iskanj. Poišči prvo jed zgoraj.',
    calEstSaved: 'Shranjeno v knjižnico.',
    calEstAiResponse: 'Ocena AI',
    calPhotoTitle: 'Analiza hrane s sliko',
    calPhotoDesc: 'Slikaj hrano. AI najprej prepozna jedi, oceni grame, kalorije in makrote, potem pa lahko vse popraviš pred shranjevanjem.',
    calPhotoBtn: 'Dodaj sliko / Fotografiraj',
    calPhotoChange: 'Zamenjaj sliko',
    calPhotoAnalyze: 'Analiziraj sliko',
    calPhotoNoKey: 'AI backend ni nastavljen ali nisi povezan z njim.',
    foodPhotoReviewTitle: 'Preglej in popravi AI oceno',
    foodPhotoReviewDesc: 'To je ocena iz slike, ne tehtanje. Popravi ime, grame ali kcal za vsak item, nato shrani v obroke.',
    foodCorrectionLabel: 'Popravek za AI',
    foodCorrectionPlaceholder: 'npr. To nista 2 hlebca kruha, ampak 2 jajci. Kruha ni na sliki.',
    foodCorrectionApply: 'Ponovno analiziraj s popravkom',
    foodItemAdd: 'Dodaj item',
    foodItemRemove: 'Odstrani',
    foodEstimateReady: 'Ocena pripravljena. Preglej jo pred shranjevanjem.',
    prTitle: 'Osebni rekordi',
    prBadge: 'PR',
    prNoData: 'Še ni PR-jev. Dodaj trening!',
    timerTitle: 'Odmor med serijami',
    timerStart: 'Start',
    timerPause: 'Pavza',
    timerReset: 'Ponastavi',
    timerDone: 'Čas potekel!',
    bodyweight: 'Telesna teža',
    bwTitle: 'Sledenje telesni teži',
    bwAdd: 'Dodaj meritev',
    bwDate: 'Datum meritve',
    bwWeight: 'Teža (kg)',
    bwSave: 'Shrani meritev',
    bwNoData: 'Ni se vnosov telesne teze. Dodaj trenutno telesno tezo.',
    tdeeTitle: 'Kalkulator kalorij',
    tdeeCurrentWeight: 'Trenutna teža (kg)',
    tdeeGoalWeight: 'Ciljna teža (kg)',
    tdeeWeeks: 'Čas (tedni)',
    tdeeActivity: 'Aktivnost',
    tdeeSedentary: 'Sedeč (malo ali nič vadbe)',
    tdeeLight: 'Lahka (1–3x/teden)',
    tdeeModerate: 'Zmerna (3–5x/teden)',
    tdeeActive: 'Aktivna (6–7x/teden)',
    tdeeVeryActive: 'Zelo aktivna (2x/dan)',
    tdeeCalculate: 'Izračunaj',
    tdeeTDEE: 'Ocena TDEE',
    tdeeTarget: 'Dnevni cilj kalorij',
    tdeeAdjustment: 'Prilagoditev / dan',
    recapTitle: 'Mesečni pregled',
    recapClose: 'Zapri',
    recapMonth: 'Mesec',
    recapWorkouts: 'Opravljeni treningi',
    recapPRs: 'Podrti rekordi',
    recapNoPRs: 'Ta mesec ni bilo novih rekordov.',
    recapMotivation: 'BRAVO! Odlično si delal ta mesec!',
    recapPRDetail: 'Podrl si rekord za',
    recapOn: 'za vajo',
    admin: 'Admin panel',
    adminUsers: 'Registrirani uporabniki',
    adminTotalUsers: 'Skupaj uporabnikov',
    adminTotalWorkouts: 'Skupaj treningov',
    adminRegistered: 'Registriran',
    adminWorkouts: 'Treningi',
    adminMeals: 'Obroki',
    adminBodyWeight: 'Meritve teže',
    adminLastWorkout: 'Zadnji trening',
    adminNever: 'Nikoli',
    adminNoUsers: 'Ni registriranih uporabnikov.',
    adminLoginHistory: 'Zgodovina prijav',
    adminLoginEvent: 'Prijava',
    adminSignupEvent: 'Registracija',
    adminNoLogins: 'Še ni zabeleženih prijav.',
    adminCommands: 'Admin ukazi',
    adminShowRecap: 'Prikaži mesečni povzetek',
    adminRankUp: '▲ Rang gor',
    adminDemote: '▼ Rang dol',
    adminBonusPts: 'Bonus točke',
    adminRankUpDone: 'Rang povišan',
    adminDemoteDone: 'Rang znižan',
    adminMaxRank: 'Že na max rangu',
    adminMinRank: 'Že na min rangu',
    adminActiveUsers: 'Aktivni uporabniki',
    adminOnlineNow: '🟢 Aktiven zdaj',
    adminRecentlyActive: '🟡 Nedavno aktiven',
    adminOffline: '⚫ Offline',
    adminNoActive: 'Ni aktivnih uporabnikov.',
    adminLastSeen: 'Zadnjič viden',
    adminComments: 'Komentarji uporabnikov',
    adminNoComments: 'Ni komentarjev.',
    adminPrivateNote: 'Zasebna opomba',
    adminStars: 'Ocena',
    loading: 'Nalagam...',
    rankings: 'Lestvica rangov',
    rankTitle: 'Moj rang',
    rankPoints: 'točk',
    rankNext: 'Do naslednjega ranga',
    rankMax: 'Dosegel si najvišji rang!',
    rankProgress: 'Napredek do naslednjega',
    rankAllRanks: 'Vse stopnje',
    rankCurrentLabel: 'Trenutni rang',
    restDay: 'Dan za počitek',
    restDayDone: '✓ Dan za počitek',
    restDayLast: 'Zadnji počitek',
    restDayNever: 'Še nikoli',
    restDayChart: 'Dnevi počitka po mesecih',
    cheatDayChart: 'Goljufivi dnevi po mesecih',
    addComment: 'Dodaj opombo',
    editComment: 'Uredi opombo',
    commentPlaceholder: 'Npr. danes sem bil utrujen, nova teža...',
    saveComment: 'Shrani',
    cheatDay: 'Goljufiv dan',
    cheatDayDone: '✓ Goljufiv dan',
    recapRank: 'Tvoj rang',
    recapPoints: 'Skupaj točk',
    repeatWorkout: 'Ponovi',
    heatmapTitle: 'Aktivnost',
    reuseMeal: 'Uporabi',
    weightDrop: 'Weight Drop',
    weightDropDesc: 'Vnesi kg za vsak set posebej',
    searchExercise: 'Išči vajo…',
    noExerciseResults: 'Ni rezultatov za to iskanje.',
    ratingsTitle: 'Ocene & povratne informacije',
    ratingsSubtitle: 'Oceni aplikacijo in napiši predlog za izboljšavo.',
    ratingStars: 'Ocena',
    ratingComment: 'Komentar / predlog',
    ratingCommentPlaceholder: 'Kaj bi rad izboljšal ali dodal?',
    ratingPrivate: 'Zasebno sporočilo adminu (opcijsko)',
    ratingPrivatePlaceholder: 'Direkten komentar adminu (vidi samo admin)…',
    ratingSubmit: 'Pošlji oceno',
    ratingDone: 'Ocena poslana. Hvala!',
    ratingEmpty: 'Še ni ocen.',
    ratingYours: 'Tvoje ocene',
    ratingAll: 'Vse ocene',
    tdeeGender: 'Spol',
    tdeeMale: 'Moški',
    tdeeFemale: 'Ženska',
    tdeeAge: 'Starost (leta)',
    tdeeHeight: 'Višina (cm)',
    timerAlarmTitle: 'PowerGraph – Odmor končan!',
    timerAlarmBody: 'Počitek je potekel. Nadaljuj s treningom! 💪',
    timerCustomLabel: 'Čas (sek)',
    timerCustomGo: 'Nastavi',
    selectSection: 'Izberi skupino',
    selectExercise: 'Izberi vajo',
    gymMode: 'Gym',
    calisthenicsMode: 'Kalistenika',
    advisorModeLabel: 'Na\u010din',
    splitSectionTitle: 'Mi\u0161i\u010dni split',
    splitAutoLabel: 'Samodejno',
    splitCustomLabel: 'Lasten',
    macrosTitle: 'Kalkulator makrohranil',
    macrosGoal: 'Cilj',
    macrosBulk: 'Nabiranje mase',
    macrosMaintain: 'Vzdr\u017eevanje',
    macrosCut: 'Su\u0161enje',
    macrosProtein: 'Beljakovine / dan',
    macrosCarbs: 'Ogljikovi hidrati / dan',
    macrosFat: 'Ma\u0161\u010dobe / dan',
    macrosCalories: 'Kalorije / dan',
    macrosCalculate: 'Izra\u010dunaj',
    macrosWeight: 'Telesna te\u017ea (kg)',
    adminBan: 'Blokiraj',
    adminUnban: 'Odblokiraj',
    adminBanned: '\u274c Blokiran',
    adminMod: '\u2705 Moderator',
    adminSetMod: 'Nastavi mod',
    adminRemoveMod: 'Odstrani mod',
    adminBanConfirm: 'Blokiraj tega uporabnika?',
    rankHowTitle: 'Kako zaslu\u017ei\u0161 to\u010dke',
    rankHowWorkout: '+5 za vsak trening',
    rankHowPR: '+15 za vsak osebni rekord',
    rankHowRest: '+3 za dan po\u010ditka',
    rankHowBodyweight: '+1 za meritev telesne te\u017ee',
    rankHowCalories: '+2 za sledenje kalorij',
    rankHowCaloriesBonus: '+8 bonus za dosego cilja (\u00b1200 kcal)',
    rankHowCaloriesMinus: '-3 za prekoračitev cilja (>200 kcal)',
    rankHowInactive: '-4 za neaktiven dan (po 2 dneh brez aktivnosti)',
    timerDoneTitle: 'Odmor kon\u010dan!',
    timerDoneContinue: 'Nadaljuj',
    tutorialOpen: 'Odpri vodič',
    tutorialOpenDesc: 'Pokaži vodič za začetnike.',
    tutorialNext: 'Naprej',
    tutorialBack: 'Nazaj',
    tutorialClose: 'Začni',
    tutorialStep1Title: 'Dobrodošel v PowerGraph! 💪',
    tutorialStep1: 'PowerGraph je lokalno-prvi dnevnik treningov. Deluje v brskalniku, po potrebi pa se lahko sinhronizira z backendom.',
    tutorialStep2Title: 'Nadzorna plošča 📊',
    tutorialStep2: 'Tukaj vidiš svoje statistike: aktivni niz dni, število treningov, kalorije in telesno težo. Graf prikazuje napredek po mesecih.',
    tutorialStep3Title: 'Dodaj trening ➕',
    tutorialStep3: 'Pritisni "Dodaj trening", izberi vajo in vnesi serije ter ponovitve. Volumen vaje se doda misicam, ki jih dejansko trenira.',
    tutorialStep4Title: 'Vaje 🏋️',
    tutorialStep4: 'V zavihku Vaje najdeš podrobnosti o vsaki vaji: kako jo izvajamo, katera oprema je potrebna in kako zahtevna je.',
    tutorialStep5Title: 'Kalorije 🍎',
    tutorialStep5: 'Sledi dnevnemu vnosu kalorij in makrohranil. Dodaj obroke ali uporabi kalkulator, da ostaneš v okviru cilja.',
    tutorialStep6Title: 'Nasvetovalec 🧠',
    tutorialStep6: 'Vsak dan ti predlagamo vajo glede na to, kaj si nazadnje treniral. Predlog temelji na skupini, ki je bila najmanj trenirana.',
    tutorialStep7Title: 'Lestvica rangov 🏆',
    tutorialStep7: 'Rangi temeljijo na tehtanem volumnu po misicah. Skupni rang je povprecje vseh devetih misicnih skupin.',
    tutorialStep8Title: 'Nastavitve ⚙️',
    tutorialStep8: 'V nastavitvah izberi jezik, enote in varnostno kopiranje. Vodič (ta zaslon) je vedno dostopen tukaj.',
    myEquipmentTitle: 'Moja oprema',
    addCustomExercise: 'Dodaj vajo',
    customExName: 'Ime vaje (npr. Lat Pulldown)',
    customExSection: 'Mišična skupina',
    customExFetch: 'Pridobi navodila z AI',
    customExAdding: 'Iščem navodila…',
    customExAdded: 'Vaja dodana!',
    customExError: 'Napaka pri iskanju navodil. Poskusi znova.',
    customExEmpty: 'Dodaj svojo prvo vajo s klikom na + Dodaj vajo.',
    customExDelete: 'Odstrani',
    muscleRankTitle: 'Rang po mišičnih skupinah',
    muscleRankSelect: 'Klikni mišico na sliki ali izberi skupino',
    muscleRankNoData: 'Začni trenirati to skupino za rang.',
    muscleRankVolume: 'Skupni volumen',
    muscleRankSessions: 'Treningi',
    muscleRankPRs: 'Osebni rekordi',
    waterTitle: 'Dnevna potreba po vodi',
    waterLiters: 'Priporočen dnevni vnos',
    waterDesc: 'Izračunano glede na težo, starost, spol in aktivnost.',
    ingredientTracker: 'Sledilnik sestavin',
    quickMode: 'Hitro',
    preciseMode: 'Natančno',
    addIngredient: 'Dodaj sestavino',
    ingredientName: 'Sestavina (npr. piščanec)',
    ingredientGrams: 'Gramov',
    ingredientAnalyze: 'Analiziraj z AI',
    ingredientAnalyzing: 'Analiziram…',
    ingredientTotal: 'Skupaj',
    ingredientNoKey: 'Za analizo potrebuješ povezan AI backend.',
    ingredientError: 'Napaka pri analizi. Poskusi znova.',
    ingredientQuickPlaceholder: 'npr. kruh, 2 jajci, tuna, šparglji, riž',
    ingredientQuickDesc: 'Napiši jedi in AI bo ocenil količine ter izračunal makre.',
    bodyFatTitle: 'Ocena % telesne maščobe',
    bodyFatDesc: 'Poslikaj se v 1–3 pozah. Več slik = bolj natančna ocena.',
    bodyFatFront: 'Spredaj',
    bodyFatSide: 'Stran',
    bodyFatBack: 'Zadaj',
    bodyFatAnalyze: 'Oceni % telesne maščobe',
    bodyFatAnalyzing: 'Ocenjujem…',
    bodyFatResultLabel: '% telesne maščobe',
    bodyFatNoKey: 'Za oceno potrebuješ povezan AI backend.',
    bodyFatError: 'Napaka pri oceni. Poskusi znova.',
    bodyFatAddPhoto: 'Dodaj fotografijo',
    bodyFatRemove: 'Odstrani',
    bodyFatConfidence: 'Zanesljivost',
    bodyFatCategory: 'Kategorija',
    reverseCalTitle: 'Čas do cilja',
    reverseCalDailyKcal: 'Trenutni dnevni vnos (kcal)',
    reverseCalCalc: 'Izračunaj čas',
    reverseCalResult: 'Ocenjen čas do cilja',
    reverseCalWeeks: 'tednov',
    reverseCalGaining: 'pridobivanje mase',
    reverseCalLosing: 'hujšanje',
    setAsGoal: 'Nastavi kot cilj',
    goalSet: 'Cilj nastavljen!',
    genderSelect: 'Izberi spol',
    genderTitle: 'Spol',
    macrosWater: 'Voda / dan',
    waterAdd: 'Dodaj vodo',
    waterDrank: 'Spito danes',
    waterGoalLabel: 'Cilj',
    waterReset: 'Ponastavi',
    waterNoGoal: 'Izračunaj TDEE za priporočen cilj vode.',
    landingTagline: 'Spremljaj treninge, kalorije, težo in napredek v eni močni nadzorni plošči.',
    landingWorkoutCard: 'Sledi treningom',
    landingCaloriesCard: 'Kalorije in makri',
    landingProgressCard: 'Grafi napredka',
    landingTodayPreview: 'Danes',
    dashboardTodayCalories: 'Kalorije danes',
    dashboardWeeklyVolume: 'Tedenski volumen',
    dashboardBodyWeight: 'Telesna teža',
    dashboardEmptyTitle: 'Še brez podatkov',
    dashboardEmptyBody: 'Začni z enim treningom, obrokom ali meritvijo. PowerGraph bo potem takoj napolnil grafe in napredek.',
    addWeight: 'Dodaj težo',
    addWaterShort: 'Dodaj vodo',
    repeatLastWorkout: 'Ponovi zadnji trening',
    repeatLastWorkoutConfirm: 'Naj zadnji trening kopiram v obrazec za danes? Pred shranjevanjem ga lahko urediš.',
    noWorkoutToRepeat: 'Ni treninga za ponovitev.',
    copyYesterdayMeals: 'Kopiraj včerajšnje obroke',
    copyYesterdayConfirm: 'Kopiram včerajšnje obroke na današnji dan?',
    copyYesterdayDuplicateConfirm: 'Danes že imaš obroke. Vseeno kopiram včerajšnje obroke?',
    copiedYesterdayMeals: 'Včerajšnji obroki kopirani.',
    noYesterdayMeals: 'Včeraj ni obrokov za kopiranje.',
    deleteConfirmWorkout: 'Izbrišem ta trening?',
    deleteConfirmMeal: 'Izbrišem ta obrok?',
    deleteConfirmWeight: 'Izbrišem to meritev teže?',
    deleteConfirmWater: 'Ponastavim današnji vnos vode?',
    deleteConfirmEstimate: 'Izbrišem ta zapis?',
    dataPrivacy: 'Podatki in zasebnost',
    dataPrivacyDesc: 'Podatki so shranjeni lokalno v tem brskalniku, razen če je omogočen backend sync. Export je tvoja varnostna kopija, import jo naloži nazaj.',
    privacyPolicy: 'Politika zasebnosti',
    demoDataTitle: 'Vzorčni podatki',
    demoDataDesc: 'Dodaj realistične vzorčne treninge, obroke, težo in vodo za testiranje grafov.',
    demoDataAdd: 'Try demo with sample data',
    demoDataClear: 'Clear demo data only',
    demoDataConfirm: 'This will add sample data to your account. Continue?',
    demoDataAdded: 'Sample data added.',
    demoDataCleared: 'Sample data removed.',
  },
  en: {
    app: 'PowerGraph',
    dashboard: 'Dashboard',
    history: 'History',
    exercises: 'Exercises',
    advisor: 'Advisor',
    settings: 'Settings',
    calories: 'Calories',
    title: 'Track your progress',
    subtitle: 'A local browser workout log with a smart daily workout suggestion.',
    addWorkout: 'Add workout',
    chart: 'Exercise progress',
    noChart: 'There are no entries for the selected exercise.',
    date: 'Date',
    exercise: 'Exercise',
    weight: 'Weight',
    sets: 'Sets',
    repsPerSet: 'Reps per set',
    addSet: 'Add set',
    save: 'Save workout',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    weekly: 'Weekly',
    monthly: 'Monthly',
    analytics: 'Analytics',
    trainingLoad: 'Training load',
    mealCount: 'Meal count',
    workouts: 'Workouts',
    totalSets: 'Total sets',
    totalReps: 'Total reps',
    totalVolume: 'Total volume',
    bestWeight: 'Best weight',
    streak: 'Streak days',
    recent: 'Recent workouts',
    noHistory: 'No workouts yet. Add your first workout to start tracking progress.',
    byExercise: 'Stats by exercise',
    target: 'Targets',
    primary: 'Primary targeting',
    difficulty: 'Difficulty',
    howTo: 'How to do it',
    cues: 'What to watch for',
    equipment: 'Equipment / machines',
    units: 'Units',
    language: 'Language',
    backgroundAccent: 'Background color',
    backgroundAccentDesc: 'Choose the color used for the background, buttons, and main highlights.',
    dateFormat: 'Date format',
    backupReminder: 'Backup reminder',
    lastBackup: 'Last backup',
    never: 'Never',
    days: 'days',
    export: 'Export data',
    import: 'Import data',
    clear: 'Delete all data',
    clearConfirm: 'Do you really want to delete all local data? This cannot be undone.',
    backupTitle: 'Backup reminder',
    backupText: 'Create a fresh export so you do not lose local data.',
    showFeedbackBtn: 'Comment button',
    showFeedbackBtnDesc: 'Show or hide the feedback button.',
    installApp: 'Install app',
    installAppDesc: 'Add PowerGraph to your home screen or desktop.',
    installBtn: 'Install',
    installIos: 'Tap Share (\u25a1\u2191) \u2192 \u201cAdd to Home Screen\u201d',
    installDone: 'App is already installed.',
    backupDone: 'Backup created.',
    importDone: 'Data imported.',
    importFail: 'Import failed.',
    saved: 'Workout saved.',
    cleared: 'Data deleted.',
    advisorTitle: 'Daily workout suggestion',
    advisorText: 'The suggestion is based on what you trained recently and which area has been neglected the most.',
    focus: "Today's focus",
    why: 'Why this suggestion',
    suggested: 'Suggested exercises',
    lastWorked: 'Last trained',
    neverWorked: 'Never trained',
    reasonCold: 'This muscle group has not been trained for a while, so it is a strong candidate for today.',
    reasonEmpty: 'There are no entries for this group yet, so it is a good balanced starting point.',
    reasonBalance: 'The suggestion balances recent sessions so you do not keep repeating the same focus.',
    planStrength: '3 to 4 sets, 6 to 12 reps',
    planCardio: '20 to 35 minutes steady or interval work',
    chest: 'Chest',
    legs: 'Legs',
    triceps: 'Triceps',
    biceps: 'Biceps',
    forearms: 'Forearms',
    shoulders: 'Shoulders',
    cardio: 'Stamina / Cardio',
    back: 'Back',
    abs: 'Abs',
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    authTitle: 'Enter PowerGraph',
    authSubtitle: 'Your training, nutrition, and progress stay separated by profile and are ready for local use or backend sync.',
    authSwitchLogin: 'Already have an account?',
    authSwitchSignup: "Don't have an account yet?",
    authCreate: 'Create account',
    authEnter: 'Continue',
    authPasswordsNoMatch: 'Passwords do not match.',
    authInvalidEmail: 'Enter a valid email address.',
    authPasswordRequired: 'Enter your password.',
    authShortPassword: 'Password must be at least 10 characters.',
    authExists: 'An account could not be created with these details.',
    authNotFound: 'Email or password is incorrect.',
    authWrongPassword: 'Email or password is incorrect.',
    authLocalOnly: 'Data is stored locally; backend sync is used only when configured.',
    authEyebrow: 'Local-first access',
    authLoginTitle: 'Welcome back',
    authSignupTitle: 'Create a secure profile',
    authLoginSubtitle: 'Continue where you left off. No unnecessary steps.',
    authSignupSubtitle: 'Set up a profile for workouts, calories, weight, and future sync.',
    authShowPassword: 'Show password',
    authHidePassword: 'Hide password',
    authShowShort: 'Show',
    authHideShort: 'Hide',
    authPasswordHint: 'Use a longer password or passphrase. Password-manager paste is supported.',
    authStrength: 'Password strength',
    authStrengthWeak: 'Weak',
    authStrengthOk: 'Okay',
    authStrengthGood: 'Good',
    authStrengthStrong: 'Strong',
    authRuleLength: 'At least 10 characters',
    authRuleVariety: 'Mixed characters or at least 14 characters',
    authRuleNoEmail: 'Does not include your email',
    authRuleCommon: 'Not a common password',
    authWeakPassword: 'Choose a stronger password.',
    authLoginFailed: 'Email or password is incorrect.',
    authLocked: 'Too many attempts. Try again in {time}.',
    authSecurityLocal: 'Local vault',
    authSecurityHash: 'PBKDF2 password protection',
    authSecuritySync: 'Backend sync ready',
    caloriesTitle: 'Daily calorie intake',
    caloriesSubtitle: 'Track meals, your daily target, and basic macros.',
    addMeal: 'Add meal',
    mealName: 'Meal name',
    mealType: 'Meal',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    caloriesUnit: 'kcal',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    calorieGoal: 'Daily goal',
    caloriesConsumed: 'Consumed',
    caloriesRemaining: 'Remaining',
    caloriesProgress: 'Daily progress',
    mealSaved: 'Meal saved.',
    noMeals: 'No meals logged today. Add a meal or copy yesterday\'s meals.',
    todayMeals: 'Today',
    mealsHistory: 'Meals for the day',
    kcalShort: 'kcal',
    trackerMode: 'Tracker mode',
    simpleTracker: 'Simple tracker',
    advancedTracker: 'Advanced tracker',
    ocenjevalec: 'Calorie Estimator',
    calEstTitle: 'Find Calories',
    calEstFood: 'Food name',
    calEstGrams: 'Amount (g)',
    calEstSearch: 'Search',
    calEstPer100: 'kcal / 100 g',
    calEstTotal: 'Total kcal',
    calEstNoResult: 'Food not found. Try a different name.',
    calEstLoading: 'Searching...',
    calEstError: 'Search failed. Check your connection.',
    calEstPlaceholder: 'e.g. chicken, banana, rice',
    calEstHistory: 'Food library',
    calEstHistoryEmpty: 'No searches yet. Look up your first food above.',
    calEstSaved: 'Saved to library.',
    calEstAiResponse: 'AI estimate',
    calPhotoTitle: 'Analyze food photo',
    calPhotoDesc: 'Take a food photo. AI identifies foods, estimates grams, calories, and macros, then you can correct everything before saving.',
    calPhotoBtn: 'Add photo / Take photo',
    calPhotoChange: 'Change photo',
    calPhotoAnalyze: 'Analyze photo',
    calPhotoNoKey: 'AI backend is not configured or connected.',
    foodPhotoReviewTitle: 'Review and correct the AI estimate',
    foodPhotoReviewDesc: 'This is a visual estimate, not a scale measurement. Correct the name, grams, or kcal for each item before saving.',
    foodCorrectionLabel: 'Correction for AI',
    foodCorrectionPlaceholder: 'e.g. Those are not 2 bread rolls, they are 2 eggs. There is no bread in the photo.',
    foodCorrectionApply: 'Re-analyze with correction',
    foodItemAdd: 'Add item',
    foodItemRemove: 'Remove',
    foodEstimateReady: 'Estimate ready. Review it before saving.',
    prTitle: 'Personal Records',
    prBadge: 'PR',
    prNoData: 'No PRs yet. Add a workout!',
    timerTitle: 'Rest timer',
    timerStart: 'Start',
    timerPause: 'Pause',
    timerReset: 'Reset',
    timerDone: 'Time is up!',
    bodyweight: 'Body Weight',
    bwTitle: 'Body weight tracking',
    bwAdd: 'Add measurement',
    bwDate: 'Measurement date',
    bwWeight: 'Weight (kg)',
    bwSave: 'Save measurement',
    bwNoData: 'No weight entries yet. Add your current body weight.',
    tdeeTitle: 'Calorie Calculator',
    tdeeCurrentWeight: 'Current weight (kg)',
    tdeeGoalWeight: 'Goal weight (kg)',
    tdeeWeeks: 'Timeframe (weeks)',
    tdeeActivity: 'Activity level',
    tdeeSedentary: 'Sedentary (little/no exercise)',
    tdeeLight: 'Light (1–3x/week)',
    tdeeModerate: 'Moderate (3–5x/week)',
    tdeeActive: 'Active (6–7x/week)',
    tdeeVeryActive: 'Very active (2x/day)',
    tdeeCalculate: 'Calculate',
    tdeeTDEE: 'TDEE estimate',
    tdeeTarget: 'Daily calorie target',
    tdeeAdjustment: 'Adjustment / day',
    recapTitle: 'Monthly recap',
    recapClose: 'Close',
    recapMonth: 'Month',
    recapWorkouts: 'Workouts completed',
    recapPRs: 'Records broken',
    recapNoPRs: 'No new records this month.',
    recapMotivation: 'BRAVO! You did great this month!',
    recapPRDetail: 'You broke your record on',
    recapOn: 'on exercise',
    admin: 'Admin panel',
    adminUsers: 'Registered users',
    adminTotalUsers: 'Total users',
    adminTotalWorkouts: 'Total workouts',
    adminRegistered: 'Registered',
    adminWorkouts: 'Workouts',
    adminMeals: 'Meals',
    adminBodyWeight: 'Weight entries',
    adminLastWorkout: 'Last workout',
    adminNever: 'Never',
    adminNoUsers: 'No registered users.',
    adminLoginHistory: 'Login history',
    adminLoginEvent: 'Login',
    adminSignupEvent: 'Signup',
    adminNoLogins: 'No logins recorded yet.',
    adminCommands: 'Admin Commands',
    adminShowRecap: 'Show monthly recap',
    adminRankUp: '▲ Rank up',
    adminDemote: '▼ Demote',
    adminBonusPts: 'Bonus pts',
    adminRankUpDone: 'Rank increased',
    adminDemoteDone: 'Rank decreased',
    adminMaxRank: 'Already at max rank',
    adminMinRank: 'Already at min rank',
    adminActiveUsers: 'Active users',
    adminOnlineNow: '🟢 Online now',
    adminRecentlyActive: '🟡 Recently active',
    adminOffline: '⚫ Offline',
    adminNoActive: 'No active users.',
    adminLastSeen: 'Last seen',
    adminComments: 'User comments',
    adminNoComments: 'No comments yet.',
    adminPrivateNote: 'Private note',
    adminStars: 'Rating',
    loading: 'Loading...',
    rankings: 'Rankings',
    rankTitle: 'My rank',
    rankPoints: 'points',
    rankNext: 'To next rank',
    rankMax: 'You reached the highest rank!',
    rankProgress: 'Progress to next rank',
    rankAllRanks: 'All ranks',
    rankCurrentLabel: 'Current rank',
    restDay: 'Rest day',
    restDayDone: '✓ Rest day',
    restDayLast: 'Last rest',
    restDayNever: 'Never',
    restDayChart: 'Rest days per month',
    cheatDayChart: 'Cheat days per month',
    addComment: 'Add note',
    editComment: 'Edit note',
    commentPlaceholder: 'e.g. felt tired today, new weight...',
    saveComment: 'Save',
    cheatDay: 'Cheat day',
    cheatDayDone: '✓ Cheat day',
    recapRank: 'Your rank',
    recapPoints: 'Total points',
    repeatWorkout: 'Repeat',
    heatmapTitle: 'Activity',
    reuseMeal: 'Reuse',
    weightDrop: 'Weight Drop',
    weightDropDesc: 'Enter kg for each set individually',
    searchExercise: 'Search exercise…',
    noExerciseResults: 'No results for this search.',
    ratingsTitle: 'Ratings & Feedback',
    ratingsSubtitle: 'Rate the app and suggest improvements.',
    ratingStars: 'Rating',
    ratingComment: 'Comment / suggestion',
    ratingCommentPlaceholder: 'What would you like improved or added?',
    ratingPrivate: 'Private message to admin (optional)',
    ratingPrivatePlaceholder: 'Direct comment to admin (only admin can see)…',
    ratingSubmit: 'Submit rating',
    ratingDone: 'Rating submitted. Thank you!',
    ratingEmpty: 'No ratings yet.',
    ratingYours: 'Your ratings',
    ratingAll: 'All ratings',
    tdeeGender: 'Gender',
    tdeeMale: 'Male',
    tdeeFemale: 'Female',
    tdeeAge: 'Age (years)',
    tdeeHeight: 'Height (cm)',
    timerAlarmTitle: 'PowerGraph – Rest Over!',
    timerAlarmBody: 'Rest time is up. Get back to training! 💪',
    timerCustomLabel: 'Time (sec)',
    timerCustomGo: 'Set',
    selectSection: 'Select group',
    selectExercise: 'Select exercise',
    gymMode: 'Gym',
    calisthenicsMode: 'Calisthenics',
    advisorModeLabel: 'Mode',
    splitSectionTitle: 'Muscle split',
    splitAutoLabel: 'Auto',
    splitCustomLabel: 'Custom',
    macrosTitle: 'Macros Calculator',
    macrosGoal: 'Goal',
    macrosBulk: 'Bulk',
    macrosMaintain: 'Maintain',
    macrosCut: 'Cut',
    macrosProtein: 'Protein / day',
    macrosCarbs: 'Carbs / day',
    macrosFat: 'Fat / day',
    macrosCalories: 'Calories / day',
    macrosCalculate: 'Calculate',
    macrosWeight: 'Body weight (kg)',
    adminBan: 'Ban',
    adminUnban: 'Unban',
    adminBanned: '❌ Banned',
    adminMod: '✅ Moderator',
    adminSetMod: 'Set mod',
    adminRemoveMod: 'Remove mod',
    adminBanConfirm: 'Ban this user?',
    rankHowTitle: 'How to earn points',
    rankHowWorkout: '+5 per workout',
    rankHowPR: '+15 per personal record',
    rankHowRest: '+3 per rest day',
    rankHowBodyweight: '+1 per body weight entry',
    rankHowCalories: '+2 per calorie tracking day',
    rankHowCaloriesBonus: '+8 bonus for hitting target (±200 kcal)',
    rankHowCaloriesMinus: '-3 for exceeding target (>200 kcal)',
    rankHowInactive: '-4 per inactive day (after 2 days without activity)',
    timerDoneTitle: 'Rest over!',
    timerDoneContinue: 'Continue',
    tutorialOpen: 'Open tutorial',
    tutorialOpenDesc: 'Show the beginner guide.',
    tutorialNext: 'Next',
    tutorialBack: 'Back',
    tutorialClose: 'Get started',
    tutorialStep1Title: 'Welcome to PowerGraph! 💪',
    tutorialStep1: 'PowerGraph is a local-first workout log. It works in your browser and can sync to a backend when configured.',
    tutorialStep2Title: 'Dashboard 📊',
    tutorialStep2: 'Here you see your stats: active streak, workout count, calories, and body weight. The chart shows your progress over the last months.',
    tutorialStep3Title: 'Add a workout ➕',
    tutorialStep3: 'Click "Add workout", pick an exercise, and enter your sets and reps. Exercise volume is added to the muscles it actually trains.',
    tutorialStep4Title: 'Exercises 🏋️',
    tutorialStep4: 'The Exercises tab has details for every exercise: how to perform it, what equipment you need, and the difficulty level.',
    tutorialStep5Title: 'Calories 🍎',
    tutorialStep5: 'Track your daily calorie and macro intake. Add meals or use the calorie estimator to stay within your goal.',
    tutorialStep6Title: 'Advisor 🧠',
    tutorialStep6: 'Every day the Advisor suggests a workout based on what you trained recently and which muscle group has been neglected the most.',
    tutorialStep7Title: 'Rankings 🏆',
    tutorialStep7: 'Ranks are based on weighted volume per muscle. Your overall rank is the average of all nine muscle groups.',
    tutorialStep8Title: 'Settings ⚙️',
    tutorialStep8: 'In Settings you can change the language, units, and backup options. The tutorial button is also here if you want to see this guide again.',
    myEquipmentTitle: 'My Equipment',
    addCustomExercise: 'Add exercise',
    customExName: 'Exercise name (e.g. Lat Pulldown)',
    customExSection: 'Muscle group',
    customExFetch: 'Fetch AI instructions',
    customExAdding: 'Fetching instructions…',
    customExAdded: 'Exercise added!',
    customExError: 'Failed to fetch instructions. Try again.',
    customExEmpty: 'Add your first exercise by clicking + Add exercise.',
    customExDelete: 'Remove',
    muscleRankTitle: 'Muscle Group Rankings',
    muscleRankSelect: 'Click a muscle on the body or select a group',
    muscleRankNoData: 'Start training this group to earn a rank.',
    muscleRankVolume: 'Total volume',
    muscleRankSessions: 'Sessions',
    muscleRankPRs: 'Personal records',
    waterTitle: 'Daily Water Intake',
    waterLiters: 'Recommended daily intake',
    waterDesc: 'Calculated based on weight, age, gender, and activity.',
    ingredientTracker: 'Ingredient Tracker',
    quickMode: 'Quick',
    preciseMode: 'Precise',
    addIngredient: 'Add ingredient',
    ingredientName: 'Ingredient (e.g. chicken)',
    ingredientGrams: 'Grams',
    ingredientAnalyze: 'Analyze with AI',
    ingredientAnalyzing: 'Analyzing…',
    ingredientTotal: 'Total',
    ingredientNoKey: 'Connected AI backend required for analysis.',
    ingredientError: 'Analysis failed. Try again.',
    ingredientQuickPlaceholder: 'e.g. bread, 2 eggs, tuna, asparagus, rice',
    ingredientQuickDesc: 'Type any foods and AI will estimate portions and calculate macros.',
    bodyFatTitle: 'Body Fat % Estimation',
    bodyFatDesc: 'Take 1–3 photos in different poses. More photos = more accurate.',
    bodyFatFront: 'Front',
    bodyFatSide: 'Side',
    bodyFatBack: 'Back',
    bodyFatAnalyze: 'Estimate body fat %',
    bodyFatAnalyzing: 'Estimating…',
    bodyFatResultLabel: 'Body fat %',
    bodyFatNoKey: 'Connected AI backend required for estimation.',
    bodyFatError: 'Estimation failed. Try again.',
    bodyFatAddPhoto: 'Add photo',
    bodyFatRemove: 'Remove',
    bodyFatConfidence: 'Confidence',
    bodyFatCategory: 'Category',
    reverseCalTitle: 'Time to Goal',
    reverseCalDailyKcal: 'Current daily intake (kcal)',
    reverseCalCalc: 'Calculate time',
    reverseCalResult: 'Estimated time to goal',
    reverseCalWeeks: 'weeks',
    reverseCalGaining: 'gaining mass',
    reverseCalLosing: 'losing weight',
    setAsGoal: 'Set as my goal',
    goalSet: 'Goal set!',
    genderSelect: 'Select gender',
    genderTitle: 'Gender',
    macrosWater: 'Water / day',
    waterAdd: 'Add water',
    waterDrank: 'Drunk today',
    waterGoalLabel: 'Goal',
    waterReset: 'Reset',
    waterNoGoal: 'Calculate TDEE to get a recommended water goal.',
    landingTagline: 'Track workouts, calories, weight, and progress in one powerful dashboard.',
    landingWorkoutCard: 'Track workouts',
    landingCaloriesCard: 'Calories & macros',
    landingProgressCard: 'Progress graphs',
    landingTodayPreview: 'Today',
    dashboardTodayCalories: 'Today calories',
    dashboardWeeklyVolume: 'Weekly volume',
    dashboardBodyWeight: 'Body weight',
    dashboardEmptyTitle: 'No data yet',
    dashboardEmptyBody: 'Start with one workout, meal, or weight entry. PowerGraph will immediately fill your graphs and progress.',
    addWeight: 'Add weight',
    addWaterShort: 'Add water',
    repeatLastWorkout: 'Repeat last workout',
    repeatLastWorkoutConfirm: 'Copy the last workout into today’s form? You can edit it before saving.',
    noWorkoutToRepeat: 'No workout to repeat yet.',
    copyYesterdayMeals: 'Copy yesterday meals',
    copyYesterdayConfirm: 'Copy yesterday’s meals to today?',
    copyYesterdayDuplicateConfirm: 'You already have meals today. Copy yesterday’s meals anyway?',
    copiedYesterdayMeals: 'Yesterday meals copied.',
    noYesterdayMeals: 'No meals from yesterday to copy.',
    deleteConfirmWorkout: 'Delete this workout?',
    deleteConfirmMeal: 'Delete this meal?',
    deleteConfirmWeight: 'Delete this weight entry?',
    deleteConfirmWater: 'Reset today’s water intake?',
    deleteConfirmEstimate: 'Delete this entry?',
    dataPrivacy: 'Data & Privacy',
    dataPrivacyDesc: 'Your data is saved locally in this browser unless backend sync is enabled. Export is your backup, import restores it.',
    privacyPolicy: 'Privacy policy',
    demoDataTitle: 'Sample data',
    demoDataDesc: 'Add realistic demo workouts, meals, weight, water, rest days, and cheat days to test graphs.',
    demoDataAdd: 'Try demo with sample data',
    demoDataClear: 'Clear demo data only',
    demoDataConfirm: 'This will add sample data to your account. Continue?',
    demoDataAdded: 'Sample data added.',
    demoDataCleared: 'Sample data removed.',
  },
};

const uiOverrides = {
  es: {
    dashboard: 'Panel', history: 'Historial', exercises: 'Ejercicios', advisor: 'Asesor', settings: 'Ajustes', calories: 'Calorias', bodyweight: 'Peso corporal', rankings: 'Rangos', ocenjevalec: 'Estimador de calorias',
    title: 'Sigue tu progreso', subtitle: 'Diario local de entrenamiento en el navegador con sugerencias inteligentes.', addWorkout: 'Anadir entrenamiento', chart: 'Progreso por ejercicio',
    date: 'Fecha', exercise: 'Ejercicio', weight: 'Peso', sets: 'Series', repsPerSet: 'Repeticiones por serie', addSet: 'Anadir serie', save: 'Guardar entrenamiento', saveChanges: 'Guardar cambios', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar',
    workouts: 'Entrenamientos', totalSets: 'Series totales', totalReps: 'Repeticiones totales', totalVolume: 'Volumen total', bestWeight: 'Mejor peso', recent: 'Entrenamientos recientes', noHistory: 'Aun no hay entrenamientos.',
    units: 'Unidades', language: 'Idioma', backgroundAccent: 'Color de fondo', backgroundAccentDesc: 'Elige el color para el fondo, botones y acentos principales.', dateFormat: 'Formato de fecha', backupReminder: 'Recordatorio de copia', lastBackup: 'Ultima copia', never: 'Nunca', days: 'dias', export: 'Exportar datos', import: 'Importar datos', clear: 'Borrar todos los datos',
    backupTitle: 'Recordatorio de copia', backupText: 'Crea una nueva exportacion para no perder tus datos locales.', showFeedbackBtn: 'Boton de comentarios', showFeedbackBtnDesc: 'Muestra u oculta el boton de feedback.', installApp: 'Instalar app', installAppDesc: 'Anade PowerGraph a la pantalla de inicio o escritorio.', installBtn: 'Instalar',
    login: 'Iniciar sesion', signup: 'Registrarse', logout: 'Salir', email: 'Email', password: 'Contrasena', confirmPassword: 'Confirmar contrasena', authTitle: 'Entrar a PowerGraph', authSubtitle: 'Tu entrenamiento, nutricion y progreso quedan separados por perfil.', authLoginTitle: 'Bienvenido de nuevo', authSignupTitle: 'Crea un perfil seguro', authEnter: 'Continuar', authCreate: 'Crear cuenta',
    calorieGoal: 'Objetivo diario', trackerMode: 'Modo de seguimiento', simpleTracker: 'Basico', advancedTracker: 'Avanzado', tutorialOpen: 'Abrir guia', tutorialOpenDesc: 'Muestra la guia para principiantes.',
  },
  pt: {
    dashboard: 'Painel', history: 'Historico', exercises: 'Exercicios', advisor: 'Assistente', settings: 'Definicoes', calories: 'Calorias', bodyweight: 'Peso corporal', rankings: 'Rankings', ocenjevalec: 'Estimador de calorias',
    title: 'Acompanha o teu progresso', subtitle: 'Diario local de treino no navegador com sugestao inteligente diaria.', addWorkout: 'Adicionar treino', chart: 'Progresso por exercicio',
    date: 'Data', exercise: 'Exercicio', weight: 'Peso', sets: 'Series', repsPerSet: 'Repeticoes por serie', addSet: 'Adicionar serie', save: 'Guardar treino', saveChanges: 'Guardar alteracoes', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar',
    workouts: 'Treinos', totalSets: 'Total de series', totalReps: 'Total de repeticoes', totalVolume: 'Volume total', bestWeight: 'Melhor peso', recent: 'Treinos recentes', noHistory: 'Ainda nao ha treinos.',
    units: 'Unidades', language: 'Idioma', backgroundAccent: 'Cor de fundo', backgroundAccentDesc: 'Escolhe a cor usada no fundo, botoes e destaques.', dateFormat: 'Formato da data', backupReminder: 'Lembrete de backup', lastBackup: 'Ultimo backup', never: 'Nunca', days: 'dias', export: 'Exportar dados', import: 'Importar dados', clear: 'Apagar todos os dados',
    backupTitle: 'Lembrete de backup', backupText: 'Cria uma nova exportacao para nao perder dados locais.', showFeedbackBtn: 'Botao de feedback', showFeedbackBtnDesc: 'Mostra ou esconde o botao de feedback.', installApp: 'Instalar app', installAppDesc: 'Adiciona o PowerGraph ao ecra inicial ou desktop.', installBtn: 'Instalar',
    login: 'Entrar', signup: 'Registar', logout: 'Sair', email: 'Email', password: 'Palavra-passe', confirmPassword: 'Confirmar palavra-passe', authTitle: 'Entrar no PowerGraph', authSubtitle: 'Treino, nutricao e progresso ficam separados por perfil.', authLoginTitle: 'Bem-vindo de volta', authSignupTitle: 'Cria um perfil seguro', authEnter: 'Continuar', authCreate: 'Criar conta',
    calorieGoal: 'Objetivo diario', trackerMode: 'Modo do tracker', simpleTracker: 'Simples', advancedTracker: 'Avancado', tutorialOpen: 'Abrir guia', tutorialOpenDesc: 'Mostra o guia para iniciantes.',
  },
  fr: {
    dashboard: 'Tableau de bord', history: 'Historique', exercises: 'Exercices', advisor: 'Conseiller', settings: 'Reglages', calories: 'Calories', bodyweight: 'Poids corporel', rankings: 'Classements', ocenjevalec: 'Estimateur de calories',
    title: 'Suis ta progression', subtitle: 'Journal local d entrainement dans le navigateur avec suggestion quotidienne.', addWorkout: 'Ajouter entrainement', chart: 'Progression par exercice',
    date: 'Date', exercise: 'Exercice', weight: 'Poids', sets: 'Series', repsPerSet: 'Repetitions par serie', addSet: 'Ajouter serie', save: 'Enregistrer', saveChanges: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', delete: 'Supprimer',
    workouts: 'Entrainements', totalSets: 'Total series', totalReps: 'Total repetitions', totalVolume: 'Volume total', bestWeight: 'Meilleur poids', recent: 'Entrainements recents', noHistory: 'Aucun entrainement.',
    units: 'Unites', language: 'Langue', backgroundAccent: 'Couleur de fond', backgroundAccentDesc: 'Choisis la couleur du fond, des boutons et des accents.', dateFormat: 'Format de date', backupReminder: 'Rappel sauvegarde', lastBackup: 'Derniere sauvegarde', never: 'Jamais', days: 'jours', export: 'Exporter', import: 'Importer', clear: 'Supprimer les donnees',
    backupTitle: 'Rappel sauvegarde', backupText: 'Cree une nouvelle exportation pour proteger tes donnees locales.', showFeedbackBtn: 'Bouton feedback', showFeedbackBtnDesc: 'Afficher ou masquer le bouton de feedback.', installApp: 'Installer app', installAppDesc: 'Ajoute PowerGraph a l ecran d accueil ou au bureau.', installBtn: 'Installer',
    login: 'Connexion', signup: 'Inscription', logout: 'Deconnexion', email: 'Email', password: 'Mot de passe', confirmPassword: 'Confirmer', authTitle: 'Entrer dans PowerGraph', authSubtitle: 'Tes entrainements, ta nutrition et tes progres restent separes par profil.', authLoginTitle: 'Bon retour', authSignupTitle: 'Cree un profil securise', authEnter: 'Continuer', authCreate: 'Creer un compte',
    calorieGoal: 'Objectif quotidien', trackerMode: 'Mode de suivi', simpleTracker: 'Simple', advancedTracker: 'Avance', tutorialOpen: 'Ouvrir le guide', tutorialOpenDesc: 'Afficher le guide debutant.',
  },
  tr: {
    dashboard: 'Panel', history: 'Gecmis', exercises: 'Egzersizler', advisor: 'Danisman', settings: 'Ayarlar', calories: 'Kalori', bodyweight: 'Vucut agirligi', rankings: 'Siralama', ocenjevalec: 'Kalori tahmini',
    title: 'Ilerlemeni takip et', subtitle: 'Tarayicida yerel antrenman gunlugu ve akilli gunluk oneriler.', addWorkout: 'Antrenman ekle', chart: 'Egzersiz ilerlemesi',
    date: 'Tarih', exercise: 'Egzersiz', weight: 'Agirlik', sets: 'Setler', repsPerSet: 'Set basina tekrar', addSet: 'Set ekle', save: 'Antrenmani kaydet', saveChanges: 'Degisiklikleri kaydet', cancel: 'Iptal', edit: 'Duzenle', delete: 'Sil',
    workouts: 'Antrenmanlar', totalSets: 'Toplam set', totalReps: 'Toplam tekrar', totalVolume: 'Toplam hacim', bestWeight: 'En iyi agirlik', recent: 'Son antrenmanlar', noHistory: 'Henuz antrenman yok.',
    units: 'Birimler', language: 'Dil', backgroundAccent: 'Arka plan rengi', backgroundAccentDesc: 'Arka plan, butonlar ve ana vurgular icin rengi sec.', dateFormat: 'Tarih formati', backupReminder: 'Yedek hatirlatici', lastBackup: 'Son yedek', never: 'Hicbir zaman', days: 'gun', export: 'Verileri disa aktar', import: 'Verileri ice aktar', clear: 'Tum verileri sil',
    backupTitle: 'Yedek hatirlatici', backupText: 'Yerel verilerini kaybetmemek icin yeni bir disa aktarim yap.', showFeedbackBtn: 'Geri bildirim butonu', showFeedbackBtnDesc: 'Geri bildirim butonunu goster veya gizle.', installApp: 'Uygulamayi yukle', installAppDesc: 'PowerGraph i ana ekrana veya masaustune ekle.', installBtn: 'Yukle',
    login: 'Giris', signup: 'Kayit ol', logout: 'Cikis', email: 'Email', password: 'Sifre', confirmPassword: 'Sifreyi onayla', authTitle: 'PowerGraph a gir', authSubtitle: 'Antrenman, beslenme ve ilerleme profil bazinda ayrilir.', authLoginTitle: 'Tekrar hos geldin', authSignupTitle: 'Guvenli profil olustur', authEnter: 'Devam', authCreate: 'Hesap olustur',
    calorieGoal: 'Gunluk hedef', trackerMode: 'Takip modu', simpleTracker: 'Basit', advancedTracker: 'Gelismis', tutorialOpen: 'Kilavuzu ac', tutorialOpenDesc: 'Baslangic kilavuzunu goster.',
  },
  ar: {
    dashboard: 'لوحة التحكم', history: 'السجل', exercises: 'التمارين', advisor: 'المدرب', settings: 'الإعدادات', calories: 'السعرات', bodyweight: 'وزن الجسم', rankings: 'الترتيب', ocenjevalec: 'حاسبة السعرات',
    title: 'تابع تقدمك', subtitle: 'سجل تدريب محلي في المتصفح مع اقتراح يومي ذكي.', addWorkout: 'أضف تمرينا', chart: 'تقدم التمارين',
    date: 'التاريخ', exercise: 'التمرين', weight: 'الوزن', sets: 'الجولات', repsPerSet: 'التكرارات', addSet: 'أضف جولة', save: 'حفظ التمرين', saveChanges: 'حفظ التغييرات', cancel: 'إلغاء', edit: 'تعديل', delete: 'حذف',
    workouts: 'تمارين', totalSets: 'إجمالي الجولات', totalReps: 'إجمالي التكرارات', totalVolume: 'الحجم الكلي', bestWeight: 'أفضل وزن', recent: 'آخر التمارين', noHistory: 'لا توجد تمارين بعد.',
    units: 'الوحدات', language: 'اللغة', backgroundAccent: 'لون الخلفية', backgroundAccentDesc: 'اختر لون الخلفية والأزرار والعناصر الرئيسية.', dateFormat: 'تنسيق التاريخ', backupReminder: 'تذكير النسخ', lastBackup: 'آخر نسخة', never: 'أبدا', days: 'أيام', export: 'تصدير البيانات', import: 'استيراد البيانات', clear: 'حذف كل البيانات',
    backupTitle: 'تذكير النسخ', backupText: 'أنشئ تصديرا جديدا حتى لا تفقد البيانات المحلية.', showFeedbackBtn: 'زر الملاحظات', showFeedbackBtnDesc: 'إظهار أو إخفاء زر الملاحظات.', installApp: 'تثبيت التطبيق', installAppDesc: 'أضف PowerGraph إلى الشاشة الرئيسية أو سطح المكتب.', installBtn: 'تثبيت',
    login: 'تسجيل الدخول', signup: 'إنشاء حساب', logout: 'خروج', email: 'البريد الإلكتروني', password: 'كلمة المرور', confirmPassword: 'تأكيد كلمة المرور', authTitle: 'ادخل إلى PowerGraph', authSubtitle: 'يبقى التدريب والتغذية والتقدم مفصولا حسب الملف الشخصي.', authLoginTitle: 'مرحبا بعودتك', authSignupTitle: 'أنشئ ملفا آمنا', authEnter: 'متابعة', authCreate: 'إنشاء حساب',
    calorieGoal: 'الهدف اليومي', trackerMode: 'وضع التتبع', simpleTracker: 'بسيط', advancedTracker: 'متقدم', tutorialOpen: 'افتح الدليل', tutorialOpenDesc: 'اعرض دليل المبتدئين.',
  },
  ja: {
    dashboard: 'ダッシュボード', history: '履歴', exercises: 'エクササイズ', advisor: 'アドバイザー', settings: '設定', calories: 'カロリー', bodyweight: '体重', rankings: 'ランキング', ocenjevalec: 'カロリー推定',
    title: '進捗を記録', subtitle: 'ブラウザ内のローカルトレーニングログと毎日の提案。', addWorkout: 'ワークアウト追加', chart: '種目別の進捗',
    date: '日付', exercise: '種目', weight: '重量', sets: 'セット', repsPerSet: 'セットごとの回数', addSet: 'セット追加', save: '保存', saveChanges: '変更を保存', cancel: 'キャンセル', edit: '編集', delete: '削除',
    workouts: 'ワークアウト', totalSets: '総セット', totalReps: '総回数', totalVolume: '総ボリューム', bestWeight: '最高重量', recent: '最近のワークアウト', noHistory: 'まだワークアウトがありません。',
    units: '単位', language: '言語', backgroundAccent: '背景色', backgroundAccentDesc: '背景、ボタン、アクセントの色を選びます。', dateFormat: '日付形式', backupReminder: 'バックアップ通知', lastBackup: '最終バックアップ', never: 'なし', days: '日', export: 'データを書き出す', import: 'データを読み込む', clear: 'すべて削除',
    backupTitle: 'バックアップ通知', backupText: 'ローカルデータを失わないように新しく書き出してください。', showFeedbackBtn: 'フィードバックボタン', showFeedbackBtnDesc: 'フィードバックボタンを表示または非表示にします。', installApp: 'アプリをインストール', installAppDesc: 'PowerGraphをホーム画面またはデスクトップに追加します。', installBtn: 'インストール',
    login: 'ログイン', signup: '登録', logout: 'ログアウト', email: 'メール', password: 'パスワード', confirmPassword: '確認', authTitle: 'PowerGraphへ', authSubtitle: 'トレーニング、栄養、進捗はプロフィールごとに分かれます。', authLoginTitle: 'おかえりなさい', authSignupTitle: '安全なプロフィールを作成', authEnter: '続ける', authCreate: 'アカウント作成',
    calorieGoal: '1日の目標', trackerMode: 'トラッカーモード', simpleTracker: 'シンプル', advancedTracker: '詳細', tutorialOpen: 'ガイドを開く', tutorialOpenDesc: '初心者ガイドを表示します。',
  },
  zh: {
    dashboard: '仪表盘', history: '历史', exercises: '训练动作', advisor: '建议', settings: '设置', calories: '热量', bodyweight: '体重', rankings: '排名', ocenjevalec: '热量估算',
    title: '追踪你的进步', subtitle: '浏览器本地训练日志，并提供每日智能建议。', addWorkout: '添加训练', chart: '动作进展',
    date: '日期', exercise: '动作', weight: '重量', sets: '组数', repsPerSet: '每组次数', addSet: '添加组', save: '保存训练', saveChanges: '保存更改', cancel: '取消', edit: '编辑', delete: '删除',
    workouts: '训练', totalSets: '总组数', totalReps: '总次数', totalVolume: '总训练量', bestWeight: '最佳重量', recent: '最近训练', noHistory: '还没有训练记录。',
    units: '单位', language: '语言', backgroundAccent: '背景颜色', backgroundAccentDesc: '选择背景、按钮和主要强调色。', dateFormat: '日期格式', backupReminder: '备份提醒', lastBackup: '上次备份', never: '从不', days: '天', export: '导出数据', import: '导入数据', clear: '删除所有数据',
    backupTitle: '备份提醒', backupText: '创建新的导出，避免丢失本地数据。', showFeedbackBtn: '反馈按钮', showFeedbackBtnDesc: '显示或隐藏反馈按钮。', installApp: '安装应用', installAppDesc: '将 PowerGraph 添加到主屏幕或桌面。', installBtn: '安装',
    login: '登录', signup: '注册', logout: '退出', email: '邮箱', password: '密码', confirmPassword: '确认密码', authTitle: '进入 PowerGraph', authSubtitle: '训练、营养和进度按个人资料分开保存。', authLoginTitle: '欢迎回来', authSignupTitle: '创建安全资料', authEnter: '继续', authCreate: '创建账号',
    calorieGoal: '每日目标', trackerMode: '追踪模式', simpleTracker: '简单', advancedTracker: '高级', tutorialOpen: '打开指南', tutorialOpenDesc: '显示新手指南。',
  },
  ru: {
    dashboard: 'Панель', history: 'История', exercises: 'Упражнения', advisor: 'Советник', settings: 'Настройки', calories: 'Калории', bodyweight: 'Вес тела', rankings: 'Ранги', ocenjevalec: 'Оценка калорий',
    title: 'Отслеживай прогресс', subtitle: 'Локальный журнал тренировок в браузере с умными ежедневными советами.', addWorkout: 'Добавить тренировку', chart: 'Прогресс по упражнениям',
    date: 'Дата', exercise: 'Упражнение', weight: 'Вес', sets: 'Подходы', repsPerSet: 'Повторы в подходе', addSet: 'Добавить подход', save: 'Сохранить', saveChanges: 'Сохранить изменения', cancel: 'Отмена', edit: 'Изменить', delete: 'Удалить',
    workouts: 'Тренировки', totalSets: 'Всего подходов', totalReps: 'Всего повторов', totalVolume: 'Общий объем', bestWeight: 'Лучший вес', recent: 'Последние тренировки', noHistory: 'Тренировок пока нет.',
    units: 'Единицы', language: 'Язык', backgroundAccent: 'Цвет фона', backgroundAccentDesc: 'Выбери цвет фона, кнопок и основных акцентов.', dateFormat: 'Формат даты', backupReminder: 'Напоминание о копии', lastBackup: 'Последняя копия', never: 'Никогда', days: 'дней', export: 'Экспорт данных', import: 'Импорт данных', clear: 'Удалить все данные',
    backupTitle: 'Напоминание о копии', backupText: 'Создай новый экспорт, чтобы не потерять локальные данные.', showFeedbackBtn: 'Кнопка отзыва', showFeedbackBtnDesc: 'Показать или скрыть кнопку обратной связи.', installApp: 'Установить приложение', installAppDesc: 'Добавь PowerGraph на главный экран или рабочий стол.', installBtn: 'Установить',
    login: 'Войти', signup: 'Регистрация', logout: 'Выйти', email: 'Email', password: 'Пароль', confirmPassword: 'Подтвердить пароль', authTitle: 'Войти в PowerGraph', authSubtitle: 'Тренировки, питание и прогресс хранятся отдельно по профилям.', authLoginTitle: 'С возвращением', authSignupTitle: 'Создай защищенный профиль', authEnter: 'Продолжить', authCreate: 'Создать аккаунт',
    calorieGoal: 'Дневная цель', trackerMode: 'Режим трекера', simpleTracker: 'Простой', advancedTracker: 'Расширенный', tutorialOpen: 'Открыть гид', tutorialOpenDesc: 'Показать руководство для начинающих.',
  },
};

function getCopy(language) {
  return { ...ui.en, ...(ui[language] || {}), ...(uiOverrides[language] || {}) };
}

function getLocalizedLabel(labels, language) {
  return labels?.[language] || labels?.en || '';
}

const sections = {
  Chest: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Chest Fly', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Pec Deck Fly', 'Machine Chest Press', 'Smith Machine Bench Press', 'Low Cable Fly', 'High Cable Fly', 'Weighted Chest Dip', 'Landmine Chest Press', 'Plate Squeeze Press'],
  Legs: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Walking Lunge', 'Leg Extension', 'Hack Squat', 'Front Squat', 'Goblet Squat', 'Hip Thrust', 'Lying Leg Curl', 'Seated Leg Curl', 'Standing Calf Raise', 'Seated Calf Raise', 'Smith Machine Squat', 'Cable Pull-Through'],
  Triceps: ['Triceps Pushdown', 'Overhead Triceps Extension', 'Close Grip Bench Press', 'Skull Crusher', 'Rope Triceps Pushdown', 'Cable Overhead Triceps Extension', 'Dumbbell Kickback', 'Machine Triceps Dip', 'EZ-Bar French Press', 'Single-Arm Cable Pushdown', 'Cross-Body Cable Extension', 'Reverse Grip Triceps Pushdown', 'JM Press', 'Tate Press', 'Seated Dumbbell Triceps Extension'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Incline Dumbbell Curl', 'Concentration Curl', 'EZ-Bar Curl', 'Spider Curl', 'Bayesian Cable Curl', 'Machine Preacher Curl', 'Rope Hammer Curl', 'Cable Reverse Curl', 'Zottman Curl', 'Drag Curl'],
  Forearms: ['Wrist Curl', 'Reverse Wrist Curl', 'Farmer Carry', 'Plate Pinch Hold', 'Reverse Curl', 'Behind-the-Back Wrist Curl', 'Cable Wrist Curl', 'Dumbbell Wrist Rotation', 'Wrist Roller', 'Fat Grip Farmer Carry', 'Barbell Hold', 'Gripper Squeeze', 'Pronated Dumbbell Curl', 'Suitcase Carry', 'Cable Pronation Supination'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press', 'Cable Lateral Raise', 'Upright Row', 'Face Pull', 'Reverse Pec Deck', 'Landmine Press', 'Push Press', 'Cable Y Raise', 'Dumbbell Shrug'],
  'Stamina/Cardio': ['Treadmill Run', 'Stationary Bike', 'Rowing Machine', 'Elliptical Trainer', 'Stair Climber', 'Assault Bike', 'SkiErg', 'Battle Ropes', 'Sled Push', 'Incline Treadmill Walk', 'Spin Bike Intervals', 'Treadmill Sprints', 'StepMill Intervals', 'Air Rower Intervals', 'Prowler Push'],
  Back: ['Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Straight Arm Pulldown', 'Deadlift', 'T-Bar Row', 'Chest-Supported Row', 'Single-Arm Dumbbell Row', 'Machine Row', 'Wide Grip Lat Pulldown', 'Close Grip Lat Pulldown', 'Cable Pullover', 'Rack Pull', 'Meadows Row', 'Assisted Pull-Up Machine'],
  Abs: ['Crunch', 'Cable Crunch', 'Machine Crunch', 'Weighted Crunch', 'Decline Sit-Up', 'Hanging Knee Raise', 'Captain\'s Chair Knee Raise', 'Ab Wheel Rollout', 'Medicine Ball Russian Twist', 'Pallof Press', 'Cable Woodchop', 'Weighted Plank', 'Stability Ball Crunch', 'Decline Reverse Crunch', 'Landmine Rotation'],
};

const exerciseInfo = {
  'Bench Press': { sl: 'Potisk s prsi', en: 'Bench Press', targets: { sl: 'Prsa, sprednja rama, triceps', en: 'Chest, front delts, triceps' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Palico spusti na prsni ko\u0161 in jo potisni nazaj gor.', en: 'Lower the bar to the chest and press it back up.' }, cues: { sl: 'Lopatice stisni skupaj in stopala dr\u017ei na tleh.', en: 'Keep the shoulder blades tight and feet planted.' } },
  'Incline Bench Press': { sl: 'Potisk na nagnjeni klopi', en: 'Incline Bench Press', targets: { sl: 'Zgornji del prsi, rame, triceps', en: 'Upper chest, shoulders, triceps' }, primary: { sl: 'Zgornji del prsi', en: 'Upper chest' }, howTo: { sl: 'Na nagnjeni klopi spusti breme proti zgornjemu delu prsnega ko\u0161a in potisni gor.', en: 'Lower the load toward the upper chest on an incline bench and press up.' }, cues: { sl: 'Komolcev ne \u0161iri preve\u010d v stran.', en: 'Do not flare the elbows too wide.' } },
  'Decline Bench Press': { sl: 'Potisk na spu\u0161\u010deni klopi', en: 'Decline Bench Press', targets: { sl: 'Spodnji del prsi, triceps', en: 'Lower chest, triceps' }, primary: { sl: 'Spodnji del prsi', en: 'Lower chest' }, howTo: { sl: 'Kontrolirano spusti palico na spodnji del prsnega ko\u0161a in jo potisni nazaj.', en: 'Lower the bar toward the lower chest and press it back up.' }, cues: { sl: 'Jedro naj ostane napeto skozi cel gib.', en: 'Keep your core braced through the whole movement.' } },
  'Chest Fly': { sl: 'Metulj za prsa', en: 'Chest Fly', targets: { sl: 'Prsa, notranji del prsi', en: 'Chest, inner chest' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Roke odpri v stran in jih v loku zdru\u017ei pred telesom.', en: 'Open the arms wide and bring them together in an arc.' }, cues: { sl: 'V komolcih ohrani rahel kot.', en: 'Keep a slight bend in the elbows.' } },
  'Push-Up': { sl: 'Sklece', en: 'Push-Up', targets: { sl: 'Prsa, triceps, rame, jedro', en: 'Chest, triceps, shoulders, core' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Spusti prsni ko\u0161 proti tlom in se odrini nazaj.', en: 'Lower your chest toward the floor and press back up.' }, cues: { sl: 'Telo naj ostane v ravni liniji.', en: 'Keep your body in a straight line.' } },
  Squat: { sl: 'Po\u010dep', en: 'Squat', targets: { sl: 'Kvadricepsi, gluteusi, zadnja lo\u017ea', en: 'Quads, glutes, hamstrings' }, primary: { sl: 'Noge', en: 'Legs' }, howTo: { sl: 'Spusti se v po\u010dep in se odrini nazaj navzgor.', en: 'Sit down into the squat and drive back up.' }, cues: { sl: 'Kolena naj sledijo smeri prstov.', en: 'Keep the knees tracking over the toes.' } },
  'Leg Press': { sl: 'No\u017eni potisk', en: 'Leg Press', targets: { sl: 'Kvadricepsi, gluteusi', en: 'Quads, glutes' }, primary: { sl: 'Kvadricepsi', en: 'Quads' }, howTo: { sl: 'Platformo odrini stran od sebe in jo kontrolirano vrni.', en: 'Press the platform away and return it under control.' }, cues: { sl: 'Na vrhu ne zaklepaj kolen.', en: 'Do not lock the knees at the top.' } },
  'Romanian Deadlift': { sl: 'Romunski mrtvi dvig', en: 'Romanian Deadlift', targets: { sl: 'Zadnja lo\u017ea, gluteusi, spodnji hrbet', en: 'Hamstrings, glutes, lower back' }, primary: { sl: 'Zadnja lo\u017ea', en: 'Hamstrings' }, howTo: { sl: 'Boke potisni nazaj in breme vodi ob telesu.', en: 'Push the hips back and keep the weight close to the body.' }, cues: { sl: 'Hrbet naj ostane raven.', en: 'Keep your back flat.' } },
  'Walking Lunge': { sl: 'Hoja v izpadnih korakih', en: 'Walking Lunge', targets: { sl: 'Kvadricepsi, gluteusi, jedro', en: 'Quads, glutes, core' }, primary: { sl: 'Gluteusi', en: 'Glutes' }, howTo: { sl: 'Stopaj naprej v izpadni korak in menjaj noge.', en: 'Step forward into each lunge and alternate legs.' }, cues: { sl: 'Trup naj ostane pokon\u010den.', en: 'Keep the torso upright.' } },
  'Leg Extension': { sl: 'Izteg kolena na napravi', en: 'Leg Extension', targets: { sl: 'Kvadricepsi', en: 'Quads' }, primary: { sl: 'Kvadricepsi', en: 'Quads' }, howTo: { sl: 'Iztegni kolena do vrha in se po\u010dasi vrni.', en: 'Extend the knees to the top and lower slowly.' }, cues: { sl: 'Ne uporabljaj zagona.', en: 'Avoid using momentum.' } },
  'Triceps Pushdown': { sl: 'Potisk za triceps navzdol', en: 'Triceps Pushdown', targets: { sl: 'Triceps', en: 'Triceps' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Ro\u010daj potisni navzdol do iztega komolcev.', en: 'Push the handle down until the elbows are extended.' }, cues: { sl: 'Komolci naj ostanejo ob telesu.', en: 'Keep the elbows close to the body.' } },
  'Overhead Triceps Extension': { sl: 'Nadglavni izteg za triceps', en: 'Overhead Triceps Extension', targets: { sl: 'Triceps, dolga glava', en: 'Triceps, long head' }, primary: { sl: 'Dolga glava tricepsa', en: 'Long head of triceps' }, howTo: { sl: 'Breme spusti za glavo in ga iztegni nazaj gor.', en: 'Lower the weight behind the head and extend it overhead.' }, cues: { sl: 'Komolce usmeri naprej.', en: 'Point the elbows forward.' } },
  'Close Grip Bench Press': { sl: 'Ozki potisk s prsi', en: 'Close Grip Bench Press', targets: { sl: 'Triceps, prsa', en: 'Triceps, chest' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Na benchu uporabi ozek prijem in potiskaj navzgor.', en: 'Use a close grip on the bench and press upward.' }, cues: { sl: 'Zapestja naj bodo poravnana.', en: 'Keep the wrists stacked.' } },
  'Bench Dip': { sl: 'Dip na klopi', en: 'Bench Dip', targets: { sl: 'Triceps, sprednja rama', en: 'Triceps, front delts' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Spu\u0161\u010daj telo ob klopi in se odrini nazaj gor.', en: 'Lower the body off the bench and press back up.' }, cues: { sl: 'Ne pogrezaj ramen.', en: 'Do not sink into the shoulders.' } },
  'Skull Crusher': { sl: 'Le\u017ee\u010di izteg za triceps', en: 'Skull Crusher', targets: { sl: 'Triceps', en: 'Triceps' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Spusti palico proti \u010delu in jo iztegni nazaj.', en: 'Lower the bar toward the forehead and extend it back up.' }, cues: { sl: 'Nadlahti naj ostanejo \u010dim bolj mirne.', en: 'Keep the upper arms as still as possible.' } },
  'Barbell Curl': { sl: 'Pregib s palico', en: 'Barbell Curl', targets: { sl: 'Biceps, podlaht', en: 'Biceps, forearms' }, primary: { sl: 'Biceps', en: 'Biceps' }, howTo: { sl: 'Palico dvigni s pregibom komolcev in jo po\u010dasi spusti.', en: 'Curl the bar up and lower it slowly.' }, cues: { sl: 'Ne pomagaj si z boki.', en: 'Do not use the hips for momentum.' } },
  'Dumbbell Curl': { sl: 'Pregib z ro\u010dkami', en: 'Dumbbell Curl', targets: { sl: 'Biceps', en: 'Biceps' }, primary: { sl: 'Biceps', en: 'Biceps' }, howTo: { sl: 'Ro\u010dki dvigni proti ramenom in jih kontrolirano spusti.', en: 'Raise the dumbbells toward the shoulders and lower them with control.' }, cues: { sl: 'Komolci naj ostanejo ob telesu.', en: 'Keep the elbows close to the body.' } },
  'Hammer Curl': { sl: 'Kladivni pregib', en: 'Hammer Curl', targets: { sl: 'Brachialis, biceps, podlaht', en: 'Brachialis, biceps, forearms' }, primary: { sl: 'Brachialis', en: 'Brachialis' }, howTo: { sl: 'Uporabi nevtralen prijem in dviguj ob telesu.', en: 'Use a neutral grip and curl along the body.' }, cues: { sl: 'Ne obracaj dlani med gibom.', en: 'Do not rotate the hands during the movement.' } },
  'Preacher Curl': { sl: 'Scott pregib', en: 'Preacher Curl', targets: { sl: 'Biceps', en: 'Biceps' }, primary: { sl: 'Biceps', en: 'Biceps' }, howTo: { sl: 'Na Scott klopi pokr\u010di komolce in dvigni breme.', en: 'On the preacher bench, curl the weight upward.' }, cues: { sl: 'Spust naj bo po\u010dasen.', en: 'Control the lowering phase.' } },
  'Cable Curl': { sl: 'Pregib na \u0161kripcu', en: 'Cable Curl', targets: { sl: 'Biceps', en: 'Biceps' }, primary: { sl: 'Biceps', en: 'Biceps' }, howTo: { sl: 'Ro\u010daj povleci proti ramenom brez zibanja trupa.', en: 'Pull the handle toward the shoulders without rocking the torso.' }, cues: { sl: 'Telo naj ostane pri miru.', en: 'Keep the body still.' } },
  'Wrist Curl': { sl: 'Pregib zapestja', en: 'Wrist Curl', targets: { sl: 'Podlaht, fleksorji zapestja', en: 'Forearms, wrist flexors' }, primary: { sl: 'Podlaht', en: 'Forearms' }, howTo: { sl: 'Te\u017eo dviguj samo z gibanjem v zapestju.', en: 'Lift the weight using only the wrists.' }, cues: { sl: 'Podlahti naj ostanejo fiksne.', en: 'Keep the forearms fixed.' } },
  'Reverse Wrist Curl': { sl: 'Obratni pregib zapestja', en: 'Reverse Wrist Curl', targets: { sl: 'Podlaht, ekstenzorji zapestja', en: 'Forearms, wrist extensors' }, primary: { sl: 'Podlaht', en: 'Forearms' }, howTo: { sl: 'Dlani obrni navzdol in dviguj iz zapestja.', en: 'Turn the palms down and lift through the wrists.' }, cues: { sl: 'Gib naj bo majhen in kontroliran.', en: 'Keep the range short and controlled.' } },
  'Farmer Carry': { sl: 'Kme\u010dka hoja', en: 'Farmer Carry', targets: { sl: 'Prijem, podlaht, trapez, jedro', en: 'Grip, forearms, traps, core' }, primary: { sl: 'Prijem', en: 'Grip' }, howTo: { sl: 'Hodi z obremenitvijo ob telesu dolo\u010den \u010das ali razdaljo.', en: 'Walk with heavy weights at your sides for time or distance.' }, cues: { sl: 'Ramena dr\u017ei nizko in prsni ko\u0161 odprt.', en: 'Keep the shoulders down and chest open.' } },
  'Plate Pinch Hold': { sl: 'Stisk plo\u0161\u010d', en: 'Plate Pinch Hold', targets: { sl: 'Prijem, podlaht', en: 'Grip, forearms' }, primary: { sl: 'Prijem', en: 'Grip' }, howTo: { sl: 'Plo\u0161\u010di stisni med prsti in jih dr\u017ei v zraku.', en: 'Pinch the plates between the fingers and hold them off the ground.' }, cues: { sl: 'Ne opiraj jih ob telo.', en: 'Do not brace them against the body.' } },
  'Reverse Curl': { sl: 'Obratni pregib', en: 'Reverse Curl', targets: { sl: 'Podlaht, biceps', en: 'Forearms, biceps' }, primary: { sl: 'Podlaht', en: 'Forearms' }, howTo: { sl: 'Palico dr\u017ei z nadprijemom in jo dvigni kot pregib.', en: 'Use an overhand grip and curl the bar upward.' }, cues: { sl: 'Komolci naj ostanejo ob telesu.', en: 'Keep the elbows tucked in.' } },
  'Overhead Press': { sl: 'Potisk nad glavo', en: 'Overhead Press', targets: { sl: 'Ramena, triceps, jedro', en: 'Shoulders, triceps, core' }, primary: { sl: 'Ramena', en: 'Shoulders' }, howTo: { sl: 'Breme potisni nad glavo in ga kontrolirano vrni.', en: 'Press the weight overhead and lower it with control.' }, cues: { sl: 'Ne lomi ledvenega dela.', en: 'Do not overarch the lower back.' } },
  'Lateral Raise': { sl: 'Stranski dvig', en: 'Lateral Raise', targets: { sl: 'Srednja rama', en: 'Lateral delts' }, primary: { sl: 'Srednja rama', en: 'Lateral delts' }, howTo: { sl: 'Roke dviguj v stran do vi\u0161ine ramen.', en: 'Raise the arms out to the sides up to shoulder height.' }, cues: { sl: 'Ne zamahuj s telesom.', en: 'Avoid swinging the torso.' } },
  'Front Raise': { sl: 'Sprednji dvig', en: 'Front Raise', targets: { sl: 'Sprednja rama', en: 'Front delts' }, primary: { sl: 'Sprednja rama', en: 'Front delts' }, howTo: { sl: 'Roke dvigni pred telo do vi\u0161ine ramen.', en: 'Raise the arms in front of the body to shoulder height.' }, cues: { sl: 'Dvig naj bo gladek.', en: 'Keep the raise smooth.' } },
  'Rear Delt Fly': { sl: 'Metulj za zadnjo ramo', en: 'Rear Delt Fly', targets: { sl: 'Zadnja rama, zgornji hrbet', en: 'Rear delts, upper back' }, primary: { sl: 'Zadnja rama', en: 'Rear delts' }, howTo: { sl: 'V predklonu odpiraj roke v stran.', en: 'Hinge over and open the arms out wide.' }, cues: { sl: 'Ne dviguj ramen proti u\u0161esom.', en: 'Do not shrug the shoulders.' } },
  'Arnold Press': { sl: 'Arnold potisk', en: 'Arnold Press', targets: { sl: 'Ramena, triceps', en: 'Shoulders, triceps' }, primary: { sl: 'Ramena', en: 'Shoulders' }, howTo: { sl: 'Med potiskom zasuci dlani navzven in zaklju\u010di nad glavo.', en: 'Rotate the palms outward as you press overhead.' }, cues: { sl: 'Jedro naj ostane aktivno.', en: 'Keep the core engaged.' } },
  Running: { sl: 'Tek', en: 'Running', targets: { sl: 'Srce, plju\u010da, noge', en: 'Heart, lungs, legs' }, primary: { sl: 'Vzdr\u017eljivost', en: 'Endurance' }, howTo: { sl: 'Teci v enakomernem ali intervalnem tempu.', en: 'Run at a steady pace or in intervals.' }, cues: { sl: 'Ritem dihanja naj ostane pod kontrolo.', en: 'Keep your breathing rhythm under control.' } },
  Cycling: { sl: 'Kolesarjenje', en: 'Cycling', targets: { sl: 'Srce, noge, vzdr\u017eljivost', en: 'Heart, legs, endurance' }, primary: { sl: 'Vzdr\u017eljivost', en: 'Endurance' }, howTo: { sl: 'Kolesari v enakomernem tempu ali po intervalih.', en: 'Cycle at a steady pace or in intervals.' }, cues: { sl: 'Nastavi pravilen polo\u017eaj sede\u017ea.', en: 'Set the saddle position correctly.' } },
  Rowing: { sl: 'Veslanje', en: 'Rowing', targets: { sl: 'Srce, hrbet, noge', en: 'Heart, back, legs' }, primary: { sl: 'Kardio celega telesa', en: 'Full-body cardio' }, howTo: { sl: 'Najprej odrini z nogami, nato dokon\u010daj z rokami.', en: 'Drive with the legs first and finish with the arms.' }, cues: { sl: 'Ne vleci samo z rokami.', en: 'Do not pull only with the arms.' } },
  'Jump Rope': { sl: 'Kolebnica', en: 'Jump Rope', targets: { sl: 'Srce, me\u010da, koordinacija', en: 'Heart, calves, coordination' }, primary: { sl: 'Cardio', en: 'Cardio' }, howTo: { sl: 'Ska\u010di ritmi\u010dno in vrti kolebnico iz zapestij.', en: 'Jump rhythmically and turn the rope with the wrists.' }, cues: { sl: 'Skoki naj bodo nizki in lahki.', en: 'Keep the jumps light and low.' } },
  Burpee: { sl: 'Burpee', en: 'Burpee', targets: { sl: 'Srce, noge, prsa, jedro', en: 'Heart, legs, chest, core' }, primary: { sl: 'Cardio', en: 'Cardio' }, howTo: { sl: 'Spusti se na tla, odsko\u010di nazaj in eksplozivno sko\u010di gor.', en: 'Drop down, kick back, and finish with an explosive jump.' }, cues: { sl: 'Dr\u017ei tempo brez izgube tehnike.', en: 'Keep the pace without losing technique.' } },
  'Barbell Row': { sl: 'Veslanje s palico', en: 'Barbell Row', targets: { sl: 'Hrbet, zadnja rama, biceps', en: 'Back, rear delts, biceps' }, primary: { sl: 'Hrbet', en: 'Back' }, howTo: { sl: 'V predklonu vleci palico proti spodnjim rebrom.', en: 'Row the bar toward the lower ribs from a bent-over position.' }, cues: { sl: 'Hrbet naj ostane raven.', en: 'Keep the back flat.' } },
  'Lat Pulldown': { sl: 'Poteg na prsi', en: 'Lat Pulldown', targets: { sl: 'Lats, biceps, srednji hrbet', en: 'Lats, biceps, mid-back' }, primary: { sl: '\u0160ir\u0161i hrbet', en: 'Lats' }, howTo: { sl: 'Ro\u010daj povleci proti zgornjemu delu prsnega ko\u0161a.', en: 'Pull the bar toward the upper chest.' }, cues: { sl: 'Ne vleci za vrat.', en: 'Do not pull behind the neck.' } },
  'Pull-Up': { sl: 'Dvigi na drogu', en: 'Pull-Up', targets: { sl: 'Lats, biceps, jedro', en: 'Lats, biceps, core' }, primary: { sl: '\u0160ir\u0161i hrbet', en: 'Lats' }, howTo: { sl: 'Iz vesa se dvigni, dokler brada ne pride nad drog.', en: 'Pull yourself up until your chin clears the bar.' }, cues: { sl: 'Ne izgubi napetosti v ramenih.', en: 'Keep tension in the shoulders.' } },
  'Seated Cable Row': { sl: 'Sede\u010de veslanje na \u0161kripcu', en: 'Seated Cable Row', targets: { sl: 'Srednji hrbet, lats, biceps', en: 'Mid-back, lats, biceps' }, primary: { sl: 'Srednji hrbet', en: 'Mid-back' }, howTo: { sl: 'Ro\u010daj povleci proti trebuhu in se kontrolirano vrni.', en: 'Pull the handle toward the stomach and return under control.' }, cues: { sl: 'Ne zibaj trupa naprej in nazaj.', en: 'Do not rock the torso.' } },
  'Straight Arm Pulldown': { sl: 'Pulldown z iztegnjenimi rokami', en: 'Straight Arm Pulldown', targets: { sl: 'Lats, jedro', en: 'Lats, core' }, primary: { sl: 'Lats', en: 'Lats' }, howTo: { sl: 'Z iztegnjenimi rokami povleci ro\u010daj proti bokom.', en: 'With straight arms, pull the handle down toward the hips.' }, cues: { sl: 'Komolci naj ostanejo skoraj iztegnjeni.', en: 'Keep the elbows nearly straight.' } },
  Crunch: { sl: 'Trebu\u0161njak', en: 'Crunch', targets: { sl: 'Trebu\u0161ne mi\u0161ice', en: 'Abdominals' }, primary: { sl: 'Abs', en: 'Abs' }, howTo: { sl: 'Dvigni lopatice od tal s skr\u010devanjem trupa.', en: 'Lift the shoulder blades off the floor by curling the torso.' }, cues: { sl: 'Ne vleci glave z rokami.', en: 'Do not pull on your head.' } },
  'Leg Raise': { sl: 'Dvig nog', en: 'Leg Raise', targets: { sl: 'Spodnji abs, upogibalke kolka', en: 'Lower abs, hip flexors' }, primary: { sl: 'Spodnji abs', en: 'Lower abs' }, howTo: { sl: 'Dvigni noge proti stropu in jih po\u010dasi spusti.', en: 'Raise the legs upward and lower them slowly.' }, cues: { sl: 'Ledveni del naj ostane pod kontrolo.', en: 'Keep the lower back under control.' } },
  Plank: { sl: 'Plank', en: 'Plank', targets: { sl: 'Jedro, abs, spodnji hrbet', en: 'Core, abs, lower back' }, primary: { sl: 'Jedro', en: 'Core' }, howTo: { sl: 'Dr\u017ei telo v ravni liniji na podlahteh ali dlaneh.', en: 'Hold the body in a straight line on the forearms or hands.' }, cues: { sl: 'Boki naj ne padejo.', en: 'Do not let the hips sag.' } },
  'Russian Twist': { sl: 'Ruski zasuk', en: 'Russian Twist', targets: { sl: 'Stranski abs, jedro', en: 'Obliques, core' }, primary: { sl: 'Stranski abs', en: 'Obliques' }, howTo: { sl: 'V sede rotiraj trup levo in desno.', en: 'Rotate the torso side to side from a seated position.' }, cues: { sl: 'Rotacija naj pride iz trupa.', en: 'Rotate from the torso.' } },
  'Cable Crunch': { sl: 'Trebu\u0161njak na \u0161kripcu', en: 'Cable Crunch', targets: { sl: 'Trebu\u0161ne mi\u0161ice', en: 'Abdominals' }, primary: { sl: 'Abs', en: 'Abs' }, howTo: { sl: 'Skr\u010di trup navzdol proti tlom z vrha \u0161kripca.', en: 'Crunch the torso downward using a high cable.' }, cues: { sl: 'Boki naj ostanejo \u010dim bolj pri miru.', en: 'Keep the hips as still as possible.' } },
};

const exerciseEquipment = {
  'Bench Press': { sl: 'Bench klop, palica, rack, ute\u017ei', en: 'Bench, barbell, rack, plates' },
  'Incline Bench Press': { sl: 'Nagnjena klop, palica ali ro\u010dki', en: 'Incline bench, barbell or dumbbells' },
  'Decline Bench Press': { sl: 'Spu\u0161\u010dena klop, palica ali ro\u010dki', en: 'Decline bench, barbell or dumbbells' },
  'Chest Fly': { sl: 'Ro\u010dki ali pec-deck naprava', en: 'Dumbbells or pec-deck machine' },
  'Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or an exercise mat' },
  Squat: { sl: 'Rack, palica, ute\u017ei', en: 'Rack, barbell, plates' },
  'Leg Press': { sl: 'Leg press naprava', en: 'Leg press machine' },
  'Romanian Deadlift': { sl: 'Palica ali ro\u010dki', en: 'Barbell or dumbbells' },
  'Walking Lunge': { sl: 'Ro\u010dki ali palica', en: 'Dumbbells or barbell' },
  'Leg Extension': { sl: 'Leg extension naprava', en: 'Leg extension machine' },
  'Triceps Pushdown': { sl: 'Kabelski \u0161kripec z ro\u010dajem ali vrvjo', en: 'Cable station with bar or rope attachment' },
  'Overhead Triceps Extension': { sl: 'Ro\u010dka, vrv na \u0161kripcu ali EZ palica', en: 'Dumbbell, rope cable, or EZ bar' },
  'Close Grip Bench Press': { sl: 'Bench klop, palica, rack, ute\u017ei', en: 'Bench, barbell, rack, plates' },
  'Bench Dip': { sl: 'Klop', en: 'Bench' },
  'Skull Crusher': { sl: 'EZ palica ali ro\u010dki, klop', en: 'EZ bar or dumbbells, bench' },
  'Barbell Curl': { sl: 'Palica ali EZ palica', en: 'Barbell or EZ bar' },
  'Dumbbell Curl': { sl: 'Ro\u010dki', en: 'Dumbbells' },
  'Hammer Curl': { sl: 'Ro\u010dki', en: 'Dumbbells' },
  'Preacher Curl': { sl: 'Scott klop in EZ palica ali naprava', en: 'Preacher bench and EZ bar or machine' },
  'Cable Curl': { sl: 'Kabelski \u0161kripec', en: 'Cable station' },
  'Wrist Curl': { sl: 'Palica ali ro\u010dki, klop', en: 'Barbell or dumbbells, bench' },
  'Reverse Wrist Curl': { sl: 'Palica ali ro\u010dki, klop', en: 'Barbell or dumbbells, bench' },
  'Farmer Carry': { sl: 'Te\u017eki ro\u010dki ali farmer handles', en: 'Heavy dumbbells or farmer handles' },
  'Plate Pinch Hold': { sl: 'Ute\u017ene plo\u0161\u010de', en: 'Weight plates' },
  'Reverse Curl': { sl: 'Palica ali EZ palica', en: 'Barbell or EZ bar' },
  'Overhead Press': { sl: 'Palica ali ro\u010dki', en: 'Barbell or dumbbells' },
  'Lateral Raise': { sl: 'Ro\u010dki ali kabel', en: 'Dumbbells or cable machine' },
  'Front Raise': { sl: 'Ro\u010dki, plo\u0161\u010da ali kabel', en: 'Dumbbells, plate, or cable' },
  'Rear Delt Fly': { sl: 'Ro\u010dki ali reverse pec-deck naprava', en: 'Dumbbells or reverse pec-deck machine' },
  'Arnold Press': { sl: 'Ro\u010dki', en: 'Dumbbells' },
  Running: { sl: 'Tekaški copati ali tekalna steza', en: 'Running shoes or treadmill' },
  Cycling: { sl: 'Kolo ali sobno kolo', en: 'Bike or stationary bike' },
  Rowing: { sl: 'Vesla\u0161ka naprava', en: 'Rowing machine' },
  'Jump Rope': { sl: 'Kolebnica', en: 'Jump rope' },
  Burpee: { sl: 'Brez opreme ali podloge', en: 'No equipment or an exercise mat' },
  'Barbell Row': { sl: 'Palica in ute\u017ei', en: 'Barbell and plates' },
  'Lat Pulldown': { sl: 'Lat pulldown naprava', en: 'Lat pulldown machine' },
  'Pull-Up': { sl: 'Drog za zgibe', en: 'Pull-up bar' },
  'Seated Cable Row': { sl: 'Seated row naprava ali kabel', en: 'Seated row machine or cable station' },
  'Straight Arm Pulldown': { sl: 'Kabelski \u0161kripec z ravnim ro\u010dajem ali vrvjo', en: 'Cable station with straight bar or rope' },
  Crunch: { sl: 'Podloga', en: 'Exercise mat' },
  'Leg Raise': { sl: 'Podloga ali drog za hanging leg raise', en: 'Exercise mat or pull-up bar for hanging version' },
  Plank: { sl: 'Podloga', en: 'Exercise mat' },
  'Russian Twist': { sl: 'Podloga, po \u017eelji medicinka ali ro\u010dka', en: 'Exercise mat, optional medicine ball or dumbbell' },
  'Cable Crunch': { sl: 'Kabelski \u0161kripec z vrvjo', en: 'Cable station with rope attachment' },
  'Wide Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Diamond Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Archer Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Pseudo-Planche Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Chin-Up': { sl: 'Drog za zgibe', en: 'Pull-up bar' },
  'Inverted Row': { sl: 'Nizka pre\u010dka ali TRX', en: 'Low bar or TRX' },
  'Australian Pull-Up': { sl: 'Nizka pre\u010dka', en: 'Low bar' },
  'Muscle-Up': { sl: 'Drog za zgibe', en: 'Pull-up bar or rings' },
  'Bodyweight Squat': { sl: 'Brez opreme', en: 'No equipment' },
  'Bulgarian Split Squat': { sl: 'Klop ali stol', en: 'Bench or chair' },
  'Pistol Squat': { sl: 'Brez opreme', en: 'No equipment' },
  'Jump Squat': { sl: 'Brez opreme', en: 'No equipment' },
  'Wall Sit': { sl: 'Stena', en: 'Wall' },
  'Archer Pull-Up': { sl: 'Drog za zgibe', en: 'Pull-up bar' },
  'Commando Pull-Up': { sl: 'Drog za zgibe', en: 'Pull-up bar' },
  'Dip': { sl: 'Parale ali klopi', en: 'Parallel bars or bench' },
  'Close Grip Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Pike Push-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Handstand Push-Up': { sl: 'Stena', en: 'Wall' },
  'Shoulder Tap': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Mountain Climber': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Box Jump': { sl: 'Plo\u0161\u010dad ali \u0161katla', en: 'Box or platform' },
  'L-Sit': { sl: 'Parale, \u0161katle ali paraleti', en: 'Parallel bars, boxes, or parallettes' },
  'Hollow Body Hold': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'V-Up': { sl: 'Brez opreme ali podloge', en: 'No equipment or mat' },
  'Dead Hang': { sl: 'Drog za zgibe', en: 'Pull-up bar' },
};

const exerciseDifficulty = {
  'Bench Press': { sl: 'Srednja', en: 'Intermediate' },
  'Incline Bench Press': { sl: 'Srednja', en: 'Intermediate' },
  'Decline Bench Press': { sl: 'Srednja', en: 'Intermediate' },
  'Chest Fly': { sl: 'Začetniška', en: 'Beginner' },
  'Push-Up': { sl: 'Začetniška', en: 'Beginner' },
  Squat: { sl: 'Srednja', en: 'Intermediate' },
  'Leg Press': { sl: 'Začetniška', en: 'Beginner' },
  'Romanian Deadlift': { sl: 'Srednja', en: 'Intermediate' },
  'Walking Lunge': { sl: 'Začetniška', en: 'Beginner' },
  'Leg Extension': { sl: 'Začetniška', en: 'Beginner' },
  'Triceps Pushdown': { sl: 'Začetniška', en: 'Beginner' },
  'Overhead Triceps Extension': { sl: 'Začetniška', en: 'Beginner' },
  'Close Grip Bench Press': { sl: 'Srednja', en: 'Intermediate' },
  'Bench Dip': { sl: 'Začetniška', en: 'Beginner' },
  'Skull Crusher': { sl: 'Srednja', en: 'Intermediate' },
  'Barbell Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Dumbbell Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Hammer Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Preacher Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Cable Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Wrist Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Reverse Wrist Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Farmer Carry': { sl: 'Začetniška', en: 'Beginner' },
  'Plate Pinch Hold': { sl: 'Začetniška', en: 'Beginner' },
  'Reverse Curl': { sl: 'Začetniška', en: 'Beginner' },
  'Overhead Press': { sl: 'Srednja', en: 'Intermediate' },
  'Lateral Raise': { sl: 'Začetniška', en: 'Beginner' },
  'Front Raise': { sl: 'Začetniška', en: 'Beginner' },
  'Rear Delt Fly': { sl: 'Začetniška', en: 'Beginner' },
  'Arnold Press': { sl: 'Srednja', en: 'Intermediate' },
  Running: { sl: 'Začetniška', en: 'Beginner' },
  Cycling: { sl: 'Začetniška', en: 'Beginner' },
  Rowing: { sl: 'Začetniška', en: 'Beginner' },
  'Jump Rope': { sl: 'Začetniška', en: 'Beginner' },
  Burpee: { sl: 'Srednja', en: 'Intermediate' },
  'Barbell Row': { sl: 'Srednja', en: 'Intermediate' },
  'Lat Pulldown': { sl: 'Začetniška', en: 'Beginner' },
  'Pull-Up': { sl: 'Srednja', en: 'Intermediate' },
  'Seated Cable Row': { sl: 'Začetniška', en: 'Beginner' },
  'Straight Arm Pulldown': { sl: 'Začetniška', en: 'Beginner' },
  Crunch: { sl: 'Začetniška', en: 'Beginner' },
  'Leg Raise': { sl: 'Začetniška', en: 'Beginner' },
  Plank: { sl: 'Začetniška', en: 'Beginner' },
  'Russian Twist': { sl: 'Začetniška', en: 'Beginner' },
  'Cable Crunch': { sl: 'Začetniška', en: 'Beginner' },
  'Wide Push-Up': { sl: 'Začetniška', en: 'Beginner' },
  'Diamond Push-Up': { sl: 'Začetniška', en: 'Beginner' },
  'Archer Push-Up': { sl: 'Napredna', en: 'Advanced' },
  'Pseudo-Planche Push-Up': { sl: 'Napredna', en: 'Advanced' },
  'Chin-Up': { sl: 'Srednja', en: 'Intermediate' },
  'Inverted Row': { sl: 'Začetniška', en: 'Beginner' },
  'Australian Pull-Up': { sl: 'Začetniška', en: 'Beginner' },
  'Muscle-Up': { sl: 'Napredna', en: 'Advanced' },
  'Bodyweight Squat': { sl: 'Začetniška', en: 'Beginner' },
  'Bulgarian Split Squat': { sl: 'Srednja', en: 'Intermediate' },
  'Pistol Squat': { sl: 'Napredna', en: 'Advanced' },
  'Jump Squat': { sl: 'Srednja', en: 'Intermediate' },
  'Wall Sit': { sl: 'Začetniška', en: 'Beginner' },
  'Archer Pull-Up': { sl: 'Napredna', en: 'Advanced' },
  'Commando Pull-Up': { sl: 'Srednja', en: 'Intermediate' },
  Dip: { sl: 'Srednja', en: 'Intermediate' },
  'Close Grip Push-Up': { sl: 'Začetniška', en: 'Beginner' },
  'Pike Push-Up': { sl: 'Srednja', en: 'Intermediate' },
  'Handstand Push-Up': { sl: 'Napredna', en: 'Advanced' },
  'Shoulder Tap': { sl: 'Srednja', en: 'Intermediate' },
  'Mountain Climber': { sl: 'Srednja', en: 'Intermediate' },
  'Box Jump': { sl: 'Srednja', en: 'Intermediate' },
  'L-Sit': { sl: 'Napredna', en: 'Advanced' },
  'Hollow Body Hold': { sl: 'Srednja', en: 'Intermediate' },
  'V-Up': { sl: 'Srednja', en: 'Intermediate' },
  'Dead Hang': { sl: 'Začetniška', en: 'Beginner' },
};

const calisthenicsSections = {
  Chest: ['Push-Up', 'Wide Push-Up', 'Archer Push-Up', 'Pseudo-Planche Push-Up', 'Decline Push-Up', 'Deficit Push-Up', 'Ring Push-Up', 'Clap Push-Up', 'Spiderman Push-Up', 'Typewriter Push-Up', 'One-Arm Push-Up', 'Feet-Elevated Push-Up', 'Suspended Push-Up', 'Explosive Push-Up', 'Slow Eccentric Push-Up'],
  Back: ['Pull-Up', 'Inverted Row', 'Australian Pull-Up', 'Muscle-Up', 'Scapular Pull-Up', 'Wide Grip Pull-Up', 'Close Grip Pull-Up', 'L-Sit Pull-Up', 'Towel Pull-Up', 'Negative Pull-Up', 'Chest-to-Bar Pull-Up', 'Ring Row', 'Front Lever Row', 'Tuck Front Lever Pull', 'Superman Pull'],
  Legs: ['Bodyweight Squat', 'Bulgarian Split Squat', 'Pistol Squat', 'Jump Squat', 'Wall Sit', 'Reverse Lunge', 'Cossack Squat', 'Shrimp Squat', 'Step-Up', 'Single-Leg Glute Bridge', 'Nordic Curl', 'Calf Raise', 'Skater Squat', 'Sissy Squat', 'Broad Jump'],
  Triceps: ['Dip', 'Close Grip Push-Up', 'Bench Dip', 'Diamond Push-Up', 'Korean Dip', 'Straight Bar Dip', 'Ring Dip', 'Bodyweight Triceps Extension', 'Tiger Bend Push-Up', 'Sphinx Push-Up', 'Reverse Plank Triceps Dip', 'Bench Triceps Extension', 'Feet-Elevated Close Push-Up', 'Negative Dip', 'Support Hold Dip'],
  Biceps: ['Chin-Up', 'Archer Pull-Up', 'Commando Pull-Up', 'Close Grip Chin-Up', 'Towel Chin-Up', 'Ring Chin-Up', 'Negative Chin-Up', 'Headbanger Pull-Up', 'Pelican Curl', 'Bodyweight Biceps Curl', 'Inverted Biceps Row', 'Isometric Chin Hold', 'Supinated Australian Row', 'Assisted One-Arm Chin-Up', 'Mixed Grip Chin-Up'],
  Forearms: ['Dead Hang', 'Active Hang', 'Towel Hang', 'Fingertip Plank', 'Fingertip Push-Up', 'Wrist Push-Up', 'Knuckle Push-Up', 'Palm Pulse', 'Reverse Palm Plank', 'Pronation Push-Up Hold', 'Doorframe Finger Hold', 'False Grip Hang', 'Ring Support Hold', 'Rope Climb Pull', 'Monkey Bar Traverse'],
  Shoulders: ['Pike Push-Up', 'Handstand Push-Up', 'Shoulder Tap', 'Wall Walk', 'Handstand Hold', 'Frog Stand', 'Planche Lean', 'Dive Bomber Push-Up', 'Hindu Push-Up', 'Wall Handstand Shoulder Tap', 'Elevated Pike Push-Up', 'Tuck Planche Hold', 'Scapular Push-Up', 'Pike Hold', 'Crow Pose Push-Up'],
  'Stamina/Cardio': ['Burpee', 'Mountain Climber', 'Jump Rope', 'Box Jump', 'Running', 'High Knees', 'Jumping Jacks', 'Skater Hops', 'Squat Thrust', 'Bear Crawl', 'Crab Walk', 'Shuttle Run', 'Tuck Jump', 'Lateral Bounds', 'Sprint Intervals'],
  Abs: ['Plank', 'L-Sit', 'Hollow Body Hold', 'Leg Raise', 'V-Up', 'Reverse Crunch', 'Bicycle Crunch', 'Dead Bug', 'Flutter Kick', 'Side Plank', 'Hollow Rock', 'Toe Touch', 'Windshield Wiper', 'Dragon Flag', 'Plank Jack'],
};

const GYM_SPLIT_COMBOS = [
  { id: 'push', sections: ['Chest', 'Triceps', 'Shoulders'], label: { sl: 'Push', en: 'Push' } },
  { id: 'pull', sections: ['Back', 'Biceps', 'Forearms'],    label: { sl: 'Pull', en: 'Pull' } },
  { id: 'legs', sections: ['Legs', 'Abs'],                   label: { sl: 'Noge', en: 'Legs' } },
];

Object.assign(exerciseInfo, {
  'Wide Push-Up': { sl: '\u0160iroke sklece', en: 'Wide Push-Up', targets: { sl: 'Prsa, zunanja glava, triceps', en: 'Outer chest, triceps' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Postavi roke \u0161ir\u0161e kot ramena in se spusti do tal.', en: 'Place hands wider than shoulders and lower chest to floor.' }, cues: { sl: 'Komolce dr\u017ei v 45\u00b0 kotu.', en: 'Keep elbows at a 45\u00b0 angle.' } },
  'Diamond Push-Up': { sl: 'Diamantne sklece', en: 'Diamond Push-Up', targets: { sl: 'Triceps, notranja prsa', en: 'Triceps, inner chest' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Palce in kazalce spoji v obliki diamanta pod prsmi.', en: 'Form a diamond shape with thumbs and index fingers under chest.' }, cues: { sl: 'Komolce dr\u017ei ob telesu.', en: 'Keep elbows close to body.' } },
  'Archer Push-Up': { sl: 'Lokostrelske sklece', en: 'Archer Push-Up', targets: { sl: 'Prsa, triceps, jedro', en: 'Chest, triceps, core' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Ena roka ravna v stran, z drugo roko se spusti nizko.', en: 'One arm extended to side, lower body with the other.' }, cues: { sl: 'Telo dr\u017ei v ravni liniji.', en: 'Keep the body in a straight line.' } },
  'Pseudo-Planche Push-Up': { sl: 'Pseudo planche sklece', en: 'Pseudo-Planche Push-Up', targets: { sl: 'Prsa, rame, jedro, zapestja', en: 'Chest, shoulders, core, wrists' }, primary: { sl: 'Prsa', en: 'Chest' }, howTo: { sl: 'Prste usmeri nazaj, roke pomakni ni\u017eje na bokih in se spusti.', en: 'Fingers pointing back, shift hands to hips and lower down.' }, cues: { sl: 'Nagni telo naprej nad dlanmi.', en: 'Lean body forward over the hands.' } },
  'Chin-Up': { sl: 'Zgibi s podprijemom', en: 'Chin-Up', targets: { sl: 'Biceps, lats, jedro', en: 'Biceps, lats, core' }, primary: { sl: 'Biceps', en: 'Biceps' }, howTo: { sl: 'Z dlanmi obrnjenim k sebi se dvigni do brade nad drogu.', en: 'Palms facing you, pull up until chin is over the bar.' }, cues: { sl: 'Komolce potegni k bokom.', en: 'Drive elbows to hips.' } },
  'Inverted Row': { sl: 'Vodoravno veslanje', en: 'Inverted Row', targets: { sl: 'Hrbet, biceps, jedro', en: 'Back, biceps, core' }, primary: { sl: 'Hrbet', en: 'Back' }, howTo: { sl: 'Le\u017ei pod nizko pre\u010dko in se dvigni k njej.', en: 'Lie under a low bar and pull yourself up to it.' }, cues: { sl: 'Telo dr\u017ei v ravni liniji.', en: 'Keep the body straight throughout.' } },
  'Australian Pull-Up': { sl: 'Avstralski zgib', en: 'Australian Pull-Up', targets: { sl: 'Hrbet, biceps', en: 'Back, biceps' }, primary: { sl: 'Hrbet', en: 'Back' }, howTo: { sl: 'Dr\u017ei nizko pre\u010dko v kotu in potegni prsi k njej.', en: 'Hold a low bar at an angle and pull chest to it.' }, cues: { sl: 'Pete ostanejo na tleh.', en: 'Heels stay on the floor.' } },
  'Muscle-Up': { sl: 'Muscle up', en: 'Muscle-Up', targets: { sl: 'Celotno zgornje telo', en: 'Full upper body' }, primary: { sl: 'Lats, triceps', en: 'Lats, triceps' }, howTo: { sl: 'Eksplozivno se dvigni nad drog in potisni navzgor.', en: 'Explosively pull above the bar and press up.' }, cues: { sl: 'Mah iz bokov za za\u010detek giba.', en: 'Use hip drive to initiate the movement.' } },
  'Bodyweight Squat': { sl: 'Po\u010dep z lastno te\u017eo', en: 'Bodyweight Squat', targets: { sl: 'Kvadricepsi, gluteusi, zadnja lo\u017ea', en: 'Quads, glutes, hamstrings' }, primary: { sl: 'Noge', en: 'Legs' }, howTo: { sl: 'Noge v \u0161irini ramen, po\u010dep do ravnine kolka ali ni\u017eje.', en: 'Feet shoulder-width, squat to parallel or below.' }, cues: { sl: 'Kolena sledijo prstom, prsa pokon\u010di.', en: 'Knees track toes, chest up.' } },
  'Bulgarian Split Squat': { sl: 'Bolgarski po\u010dep', en: 'Bulgarian Split Squat', targets: { sl: 'Kvadricepsi, gluteusi', en: 'Quads, glutes' }, primary: { sl: 'Gluteusi', en: 'Glutes' }, howTo: { sl: 'Zadnjo nogo polo\u017ei na klop in po\u010depni navpi\u010dno.', en: 'Rear foot on bench, squat straight down.' }, cues: { sl: 'Sprednje koleno ne sme iti \u010dez prste.', en: 'Front knee should not pass the toes.' } },
  'Pistol Squat': { sl: 'Pistolski po\u010dep', en: 'Pistol Squat', targets: { sl: 'Kvadricepsi, gluteusi, ravnote\u017eje', en: 'Quads, glutes, balance' }, primary: { sl: 'Kvadricepsi', en: 'Quads' }, howTo: { sl: 'Ena noga iztegnjena naprej, po\u010dep na drugi nogi.', en: 'One leg extended forward, squat on the other.' }, cues: { sl: 'Hrbet dr\u017ei raven, roke naprej za ravnote\u017eje.', en: 'Keep back straight, arms forward for balance.' } },
  'Jump Squat': { sl: 'Skok iz po\u010depa', en: 'Jump Squat', targets: { sl: 'Noge, eksplozivna mo\u010d', en: 'Legs, explosive power' }, primary: { sl: 'Noge', en: 'Legs' }, howTo: { sl: 'Po\u010depni in eksplozivno sko\u010di navzgor.', en: 'Squat down and explode upward.' }, cues: { sl: 'Mehko pristani z ukrivljenimi koleni.', en: 'Land softly with bent knees.' } },
  'Wall Sit': { sl: 'Stenska sede\u017ena vaja', en: 'Wall Sit', targets: { sl: 'Kvadricepsi, izometri\u010dna vzdr\u017eljivost', en: 'Quads, isometric endurance' }, primary: { sl: 'Kvadricepsi', en: 'Quads' }, howTo: { sl: 'Hrbet na steni, kolena v kotu 90\u00b0 \u2013 dr\u017ei.', en: 'Back against wall, knees at 90\u00b0 \u2013 hold.' }, cues: { sl: 'Stegna vzporedna s tlemi.', en: 'Thighs parallel to the floor.' } },
  'Archer Pull-Up': { sl: 'Lokostrelski zgib', en: 'Archer Pull-Up', targets: { sl: 'Lats, biceps enostransko', en: 'Lats, biceps unilaterally' }, primary: { sl: 'Lats', en: 'Lats' }, howTo: { sl: 'Ena roka ravna v stran, z drugo se dvigni.', en: 'One arm extended, pull with the other.' }, cues: { sl: 'Obe roki sta na drogu ves \u010das.', en: 'Both hands on bar throughout.' } },
  'Commando Pull-Up': { sl: 'Commando zgib', en: 'Commando Pull-Up', targets: { sl: 'Lats, biceps, jedro', en: 'Lats, biceps, core' }, primary: { sl: 'Lats', en: 'Lats' }, howTo: { sl: 'Nevtralni prijem, dvigni se izmenjaje na vsako stran.', en: 'Neutral grip, alternate sides each rep.' }, cues: { sl: 'Jedro napeto skozi cel gib.', en: 'Core braced throughout.' } },
  'Dip': { sl: 'Dip na paralah', en: 'Dip', targets: { sl: 'Triceps, prsa, sprednje rame', en: 'Triceps, chest, front delts' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Na paralah se spusti do kota 90\u00b0 v komolcih in se odrini.', en: 'On bars, lower to 90\u00b0 elbow bend and press back up.' }, cues: { sl: 'Trup rahlo naprej za prsa, pokon\u010di za triceps.', en: 'Lean forward for chest, upright for triceps.' } },
  'Close Grip Push-Up': { sl: 'Ozke sklece', en: 'Close Grip Push-Up', targets: { sl: 'Triceps, notranja prsa', en: 'Triceps, inner chest' }, primary: { sl: 'Triceps', en: 'Triceps' }, howTo: { sl: 'Roke skupaj pod prsmi, spusti se in potisni.', en: 'Hands together under chest, lower and press.' }, cues: { sl: 'Komolce dr\u017ei ob telesu.', en: 'Keep elbows close.' } },
  'Pike Push-Up': { sl: 'Skleca pike', en: 'Pike Push-Up', targets: { sl: 'Rame, triceps', en: 'Shoulders, triceps' }, primary: { sl: 'Rame', en: 'Shoulders' }, howTo: { sl: 'V obliki V spusti glavo med roke in se odrini.', en: 'In V-shape, lower head between hands and press.' }, cues: { sl: 'Boki visoko, hrbet raven.', en: 'Hips high, back straight.' } },
  'Handstand Push-Up': { sl: 'Skleca v stoji na rokah', en: 'Handstand Push-Up', targets: { sl: 'Rame, triceps, jedro', en: 'Shoulders, triceps, core' }, primary: { sl: 'Rame', en: 'Shoulders' }, howTo: { sl: 'V stoji na rokah ob steni se spusti do tal in odrini.', en: 'In wall handstand, lower head to floor and press up.' }, cues: { sl: 'Jedro napeto, komolce dr\u017ei pred telesom.', en: 'Core tight, elbows in front.' } },
  'Shoulder Tap': { sl: 'Tapkanje rame', en: 'Shoulder Tap', targets: { sl: 'Jedro, rame, stabilizatorji', en: 'Core, shoulders, stabilizers' }, primary: { sl: 'Jedro', en: 'Core' }, howTo: { sl: 'V deski izmenjaje tapni nasprotno ramo.', en: 'In plank position, alternately tap opposite shoulder.' }, cues: { sl: 'Boke dr\u017ei ravne brez rotacije.', en: 'Keep hips level with no rotation.' } },
  'Mountain Climber': { sl: 'Plezalec', en: 'Mountain Climber', targets: { sl: 'Jedro, kardio, noge', en: 'Core, cardio, legs' }, primary: { sl: 'Jedro', en: 'Core' }, howTo: { sl: 'V deski hitro izmenjaj kolena k prsim.', en: 'In plank, rapidly alternate knees to chest.' }, cues: { sl: 'Boki ne smejo biti previsoki.', en: 'Do not let hips rise.' } },
  'Box Jump': { sl: 'Skok na \u0161katlo', en: 'Box Jump', targets: { sl: 'Noge, eksplozivna mo\u010d, kardio', en: 'Legs, explosive power, cardio' }, primary: { sl: 'Noge', en: 'Legs' }, howTo: { sl: 'Iz po\u010depa eksplozivno sko\u010di na vi\u0161jo povr\u0161ino.', en: 'Explode from a squat onto a higher surface.' }, cues: { sl: 'Mehko pristani z ukrivljenimi koleni.', en: 'Absorb landing with soft bent knees.' } },
  'L-Sit': { sl: 'L-sed', en: 'L-Sit', targets: { sl: 'Abs, upogibalke kolka, triceps', en: 'Abs, hip flexors, triceps' }, primary: { sl: 'Jedro', en: 'Core' }, howTo: { sl: 'Na paralah iztegni noge v horizontalo in dr\u017ei.', en: 'On bars or ground, extend legs to horizontal and hold.' }, cues: { sl: 'Noge popolnoma iztegnjene, prsti v loku.', en: 'Legs fully extended, toes pointed.' } },
  'Hollow Body Hold': { sl: 'Votla dr\u017ea', en: 'Hollow Body Hold', targets: { sl: 'Jedro, abs, stabilizatorji', en: 'Core, abs, stabilizers' }, primary: { sl: 'Jedro', en: 'Core' }, howTo: { sl: 'Na hrbtu iztegni roke in noge ter dvigni oba para od tal.', en: 'On back, extend arms and legs, raise both off the floor.' }, cues: { sl: 'Spodnji hrbet pritisni v tla.', en: 'Press lower back into the floor.' } },
  'V-Up': { sl: 'V-dvig', en: 'V-Up', targets: { sl: 'Abs, upogibalke kolka', en: 'Abs, hip flexors' }, primary: { sl: 'Abs', en: 'Abs' }, howTo: { sl: 'Hkrati dvigni ravne noge in trup ter se dotakni prstov na nogah.', en: 'Simultaneously raise straight legs and torso, touch toes.' }, cues: { sl: 'Ne zamahuj z nogami.', en: 'Avoid swinging the legs.' } },
  'Dead Hang': { sl: 'Mrtvo ve\u0161anje', en: 'Dead Hang', targets: { sl: 'Prijem, podlahti, rame, jedro', en: 'Grip, forearms, shoulders, core' }, primary: { sl: 'Prijem', en: 'Grip' }, howTo: { sl: 'Visi na drogu z iztegnjenimi rokami \u010dim dalje.', en: 'Hang from bar with straight arms as long as possible.' }, cues: { sl: 'Rame rahlo aktiviraj, ne visi pasivno.', en: 'Slightly activate shoulders, do not hang passively.' } },
});

const CAL_DIFFICULTY_LABELS = {
  Beginner: { sl: 'Zacetniska', en: 'Beginner' },
  Intermediate: { sl: 'Srednja', en: 'Intermediate' },
  Advanced: { sl: 'Napredna', en: 'Advanced' },
};

const CAL_EQUIPMENT_LABELS = {
  floor: { sl: 'Brez opreme ali podloga', en: 'No equipment or mat' },
  bar: { sl: 'Drog za zgibe', en: 'Pull-up bar' },
  lowBar: { sl: 'Nizka precka, miza ali TRX', en: 'Low bar, table, or TRX' },
  rings: { sl: 'Gimnasticni obroci ali TRX', en: 'Gymnastic rings or TRX' },
  wall: { sl: 'Stena in podloga', en: 'Wall and mat' },
  bench: { sl: 'Klop, stopnica ali stabilen stol', en: 'Bench, step, or stable chair' },
  box: { sl: 'Skatla, stopnica ali ploscad', en: 'Box, step, or platform' },
  towel: { sl: 'Drog in brisaca', en: 'Pull-up bar and towel' },
  rope: { sl: 'Vrv, drog ali plezalna konstrukcija', en: 'Rope, bar, or climbing frame' },
  space: { sl: 'Odprt prostor', en: 'Open space' },
  timer: { sl: 'Brez opreme, po zelji timer', en: 'No equipment, optional timer' },
};

const CAL_SECTION_LABELS = {
  Chest: { sl: 'Prsa', en: 'Chest' },
  Back: { sl: 'Hrbet', en: 'Back' },
  Legs: { sl: 'Noge', en: 'Legs' },
  Triceps: { sl: 'Triceps', en: 'Triceps' },
  Biceps: { sl: 'Biceps', en: 'Biceps' },
  Forearms: { sl: 'Podlahti', en: 'Forearms' },
  Shoulders: { sl: 'Ramena', en: 'Shoulders' },
  Abs: { sl: 'Trebusne misice', en: 'Abs' },
  'Stamina/Cardio': { sl: 'Kondicija', en: 'Stamina/Cardio' },
};

const CAL_SECTION_COPY = {
  Chest: {
    howTo: { sl: 'Izvedi variacijo sklece kontrolirano: spusti prsni kos, ohrani napeto jedro in se potisni nazaj.', en: 'Perform the push-up variation under control: lower the chest, keep the core tight, and press back up.' },
    cues: { sl: 'Rebra zakleni navzdol, lopatice naj se gibajo naravno, komolce vodi stabilno.', en: 'Lock the ribs down, let the shoulder blades move naturally, and keep the elbows stable.' },
  },
  Back: {
    howTo: { sl: 'Zacni iz aktivnih ramen, povleci komolce proti bokom in koncaj z nadzorovanim spustom.', en: 'Start from active shoulders, pull the elbows toward the hips, and finish with a controlled lower.' },
    cues: { sl: 'Najprej aktiviraj lopatice, ne brcaj z nogami in ne izgubi napetosti v jedru.', en: 'Set the shoulder blades first, avoid kicking, and keep the core braced.' },
  },
  Legs: {
    howTo: { sl: 'Stopalo naj bo stabilno, spusti se skozi kolk in koleno ter se odrini brez izgube ravnotezja.', en: 'Keep the foot stable, descend through the hip and knee, and drive up without losing balance.' },
    cues: { sl: 'Koleno naj sledi prstom, trup ostane miren, pristanek naj bo mehak.', en: 'Track the knee over the toes, keep the torso quiet, and land softly.' },
  },
  Triceps: {
    howTo: { sl: 'Spusti telo ali roke kontrolirano, nato iztegni komolce do mocnega zakljucka.', en: 'Lower the body or arms under control, then extend the elbows to a strong finish.' },
    cues: { sl: 'Komolce drzi blizu linije telesa in ne pogrezaj ramen.', en: 'Keep the elbows close to the body line and do not sink into the shoulders.' },
  },
  Biceps: {
    howTo: { sl: 'Uporabi podprijem ali supinirano vleko, povleci prsi proti opori in pocasi spusti.', en: 'Use an underhand or supinated pull, drive the chest toward the support, and lower slowly.' },
    cues: { sl: 'Komolce vodi proti rebrom, zapestja naj ostanejo cvrsta, ne zanihaj s trupom.', en: 'Drive elbows toward the ribs, keep the wrists firm, and avoid swinging the torso.' },
  },
  Forearms: {
    howTo: { sl: 'Drzi oporo ali polozaj z aktivnim prijemom ter postopno podaljsuj cas pod napetostjo.', en: 'Hold the support or position with an active grip and gradually extend time under tension.' },
    cues: { sl: 'Stisk naj bo enakomeren, ramena aktivna, zapestja pa brez bolecine.', en: 'Keep the squeeze even, shoulders active, and wrists pain-free.' },
  },
  Shoulders: {
    howTo: { sl: 'Postavi telo v mocno oporo, prenesi tezo cez dlani in potiskaj z rameni.', en: 'Set a strong support, shift weight through the hands, and press with the shoulders.' },
    cues: { sl: 'Dlani potisni v tla, jedro napni in ne lomi ledvenega dela.', en: 'Push the hands into the floor, brace the core, and avoid over-arching the low back.' },
  },
  Abs: {
    howTo: { sl: 'Zakleni rebra in medenico, izvedi gib iz jedra ter ohrani kontroliran tempo.', en: 'Lock ribs and pelvis, move from the core, and keep the tempo controlled.' },
    cues: { sl: 'Spodnji hrbet naj ostane pod nadzorom, dihaj kratko in ne hitri.', en: 'Keep the lower back controlled, breathe in short cycles, and do not rush.' },
  },
  'Stamina/Cardio': {
    howTo: { sl: 'Izvedi gib ritmicno v intervalih ali serijah, tako da tempo ostane vzdrzen.', en: 'Perform the movement rhythmically in intervals or sets while keeping a sustainable pace.' },
    cues: { sl: 'Pristajaj mehko, dihanje naj bo pod kontrolo in tehnika naj ne razpade.', en: 'Land softly, keep breathing under control, and do not let technique break down.' },
  },
};

const CAL_SECTION_DEFAULT_WEIGHTS = {
  Chest: { Chest: 0.7, Triceps: 0.2, Shoulders: 0.1 },
  Back: { Back: 0.65, Biceps: 0.25, Forearms: 0.1 },
  Legs: { Legs: 0.88, Abs: 0.12 },
  Triceps: { Triceps: 0.65, Chest: 0.25, Shoulders: 0.1 },
  Biceps: { Biceps: 0.5, Back: 0.4, Forearms: 0.1 },
  Forearms: { Forearms: 0.75, Back: 0.15, Shoulders: 0.1 },
  Shoulders: { Shoulders: 0.65, Triceps: 0.2, Abs: 0.15 },
  Abs: { Abs: 0.85, Legs: 0.1, Shoulders: 0.05 },
  'Stamina/Cardio': { 'Stamina/Cardio': 0.65, Legs: 0.25, Abs: 0.1 },
};

function makeCalisthenicsTargets(weights, lang) {
  return Object.keys(weights)
    .map((key) => CAL_SECTION_LABELS[key]?.[lang] || key)
    .join(', ');
}

function makeAdditionalCalisthenicsExercise([section, name, sl, difficulty = 'Intermediate', equipment = 'floor', loadFactor = 0.5, weights]) {
  const resolvedWeights = weights || CAL_SECTION_DEFAULT_WEIGHTS[section] || { [section]: 1 };
  const copy = CAL_SECTION_COPY[section] || CAL_SECTION_COPY.Chest;
  const primary = CAL_SECTION_LABELS[section] || { sl: section, en: section };
  return {
    section,
    name,
    loadFactor,
    weights: resolvedWeights,
    info: {
      sl,
      en: name,
      targets: {
        sl: makeCalisthenicsTargets(resolvedWeights, 'sl'),
        en: makeCalisthenicsTargets(resolvedWeights, 'en'),
      },
      primary,
      howTo: {
        sl: `${sl}: ${copy.howTo.sl}`,
        en: `${name}: ${copy.howTo.en}`,
      },
      cues: copy.cues,
    },
    equipment: CAL_EQUIPMENT_LABELS[equipment] || CAL_EQUIPMENT_LABELS.floor,
    difficulty: CAL_DIFFICULTY_LABELS[difficulty] || CAL_DIFFICULTY_LABELS.Intermediate,
  };
}

const ADDITIONAL_CALISTHENICS_EXERCISES = [
  ['Chest', 'Decline Push-Up', 'Sklece z dvignjenimi nogami', 'Intermediate', 'bench', 0.68],
  ['Chest', 'Deficit Push-Up', 'Globoke sklece na oporah', 'Intermediate', 'bench', 0.68],
  ['Chest', 'Ring Push-Up', 'Sklece na obrocih', 'Intermediate', 'rings', 0.7],
  ['Chest', 'Clap Push-Up', 'Sklece s ploskom', 'Advanced', 'floor', 0.72, { Chest: 0.65, Triceps: 0.2, Shoulders: 0.15 }],
  ['Chest', 'Spiderman Push-Up', 'Spiderman sklece', 'Intermediate', 'floor', 0.66, { Chest: 0.58, Abs: 0.22, Triceps: 0.12, Shoulders: 0.08 }],
  ['Chest', 'Typewriter Push-Up', 'Typewriter sklece', 'Advanced', 'floor', 0.74],
  ['Chest', 'One-Arm Push-Up', 'Skleca z eno roko', 'Advanced', 'floor', 0.82, { Chest: 0.62, Triceps: 0.22, Abs: 0.1, Shoulders: 0.06 }],
  ['Chest', 'Feet-Elevated Push-Up', 'Sklece z nogami na klopi', 'Intermediate', 'bench', 0.68],
  ['Chest', 'Suspended Push-Up', 'Sklece na trakovih', 'Intermediate', 'rings', 0.7, { Chest: 0.62, Triceps: 0.18, Shoulders: 0.12, Abs: 0.08 }],
  ['Chest', 'Explosive Push-Up', 'Eksplozivne sklece', 'Advanced', 'floor', 0.72],
  ['Chest', 'Slow Eccentric Push-Up', 'Pocasne ekscentricne sklece', 'Beginner', 'floor', 0.64],
  ['Back', 'Scapular Pull-Up', 'Lopaticni zgib', 'Beginner', 'bar', 0.65, { Back: 0.6, Shoulders: 0.25, Forearms: 0.15 }],
  ['Back', 'Wide Grip Pull-Up', 'Siroki zgib', 'Intermediate', 'bar', 1],
  ['Back', 'Close Grip Pull-Up', 'Ozki zgib', 'Intermediate', 'bar', 1, { Back: 0.58, Biceps: 0.3, Forearms: 0.12 }],
  ['Back', 'L-Sit Pull-Up', 'L-sit zgib', 'Advanced', 'bar', 1.05, { Back: 0.55, Biceps: 0.2, Abs: 0.15, Forearms: 0.1 }],
  ['Back', 'Towel Pull-Up', 'Zgib z brisaco', 'Advanced', 'towel', 1.05, { Back: 0.55, Biceps: 0.22, Forearms: 0.23 }],
  ['Back', 'Negative Pull-Up', 'Negativni zgib', 'Beginner', 'bar', 0.9],
  ['Back', 'Chest-to-Bar Pull-Up', 'Zgib do prsi', 'Advanced', 'bar', 1.05],
  ['Back', 'Ring Row', 'Veslanje na obrocih', 'Beginner', 'rings', 0.75],
  ['Back', 'Front Lever Row', 'Front lever veslanje', 'Advanced', 'bar', 0.95, { Back: 0.62, Biceps: 0.16, Abs: 0.12, Forearms: 0.1 }],
  ['Back', 'Tuck Front Lever Pull', 'Tuck front lever poteg', 'Advanced', 'bar', 0.9, { Back: 0.62, Abs: 0.18, Biceps: 0.1, Forearms: 0.1 }],
  ['Back', 'Superman Pull', 'Superman poteg na tleh', 'Beginner', 'floor', 0.28, { Back: 0.75, Shoulders: 0.15, Abs: 0.1 }],
  ['Legs', 'Reverse Lunge', 'Vzvratni izpadni korak', 'Beginner', 'floor', 0.72],
  ['Legs', 'Cossack Squat', 'Kozaski pocep', 'Intermediate', 'floor', 0.78],
  ['Legs', 'Shrimp Squat', 'Shrimp pocep', 'Advanced', 'floor', 0.84],
  ['Legs', 'Step-Up', 'Stopanje na klop', 'Beginner', 'bench', 0.72],
  ['Legs', 'Single-Leg Glute Bridge', 'Enonozni glute bridge', 'Beginner', 'floor', 0.58, { Legs: 0.82, Abs: 0.18 }],
  ['Legs', 'Nordic Curl', 'Nordijski upogib', 'Advanced', 'bench', 0.72, { Legs: 0.9, Abs: 0.1 }],
  ['Legs', 'Calf Raise', 'Dvig na prste', 'Beginner', 'floor', 0.45, { Legs: 0.95, Abs: 0.05 }],
  ['Legs', 'Skater Squat', 'Skaterski pocep', 'Intermediate', 'floor', 0.8],
  ['Legs', 'Sissy Squat', 'Sissy pocep', 'Advanced', 'floor', 0.78],
  ['Legs', 'Broad Jump', 'Skok v daljino z mesta', 'Intermediate', 'space', 0.76, { Legs: 0.75, 'Stamina/Cardio': 0.2, Abs: 0.05 }],
  ['Triceps', 'Korean Dip', 'Korejski dip', 'Advanced', 'bar', 0.85],
  ['Triceps', 'Straight Bar Dip', 'Dip na ravnem drogu', 'Advanced', 'bar', 0.86],
  ['Triceps', 'Ring Dip', 'Dip na obrocih', 'Advanced', 'rings', 0.88],
  ['Triceps', 'Bodyweight Triceps Extension', 'Triceps izteg z lastno tezo', 'Intermediate', 'lowBar', 0.6, { Triceps: 0.8, Shoulders: 0.12, Abs: 0.08 }],
  ['Triceps', 'Tiger Bend Push-Up', 'Tiger bend sklece', 'Advanced', 'floor', 0.72],
  ['Triceps', 'Sphinx Push-Up', 'Sphinx sklece', 'Intermediate', 'floor', 0.62, { Triceps: 0.72, Chest: 0.16, Shoulders: 0.12 }],
  ['Triceps', 'Reverse Plank Triceps Dip', 'Triceps dip iz obratne deske', 'Beginner', 'floor', 0.55],
  ['Triceps', 'Bench Triceps Extension', 'Triceps izteg na klopi', 'Intermediate', 'bench', 0.6, { Triceps: 0.82, Shoulders: 0.1, Abs: 0.08 }],
  ['Triceps', 'Feet-Elevated Close Push-Up', 'Ozke sklece z dvignjenimi nogami', 'Intermediate', 'bench', 0.68],
  ['Triceps', 'Negative Dip', 'Negativni dip', 'Beginner', 'bar', 0.78],
  ['Triceps', 'Support Hold Dip', 'Drza opore za dip', 'Beginner', 'bar', 0.45, { Triceps: 0.55, Shoulders: 0.3, Chest: 0.15 }],
  ['Biceps', 'Close Grip Chin-Up', 'Ozki zgib s podprijemom', 'Intermediate', 'bar', 1],
  ['Biceps', 'Towel Chin-Up', 'Zgib s podprijemom na brisaci', 'Advanced', 'towel', 1.05, { Biceps: 0.42, Back: 0.35, Forearms: 0.23 }],
  ['Biceps', 'Ring Chin-Up', 'Zgib s podprijemom na obrocih', 'Intermediate', 'rings', 1],
  ['Biceps', 'Negative Chin-Up', 'Negativni zgib s podprijemom', 'Beginner', 'bar', 0.9],
  ['Biceps', 'Headbanger Pull-Up', 'Headbanger zgib', 'Advanced', 'bar', 1.05, { Biceps: 0.45, Back: 0.38, Forearms: 0.12, Abs: 0.05 }],
  ['Biceps', 'Pelican Curl', 'Pelican pregib na obrocih', 'Advanced', 'rings', 0.75, { Biceps: 0.65, Forearms: 0.15, Shoulders: 0.12, Chest: 0.08 }],
  ['Biceps', 'Bodyweight Biceps Curl', 'Biceps pregib z lastno tezo', 'Intermediate', 'lowBar', 0.58, { Biceps: 0.7, Forearms: 0.18, Back: 0.12 }],
  ['Biceps', 'Inverted Biceps Row', 'Obrnjeno biceps veslanje', 'Intermediate', 'lowBar', 0.65],
  ['Biceps', 'Isometric Chin Hold', 'Izometricna drza v zgibu', 'Intermediate', 'bar', 0.85],
  ['Biceps', 'Supinated Australian Row', 'Avstralsko veslanje s podprijemom', 'Beginner', 'lowBar', 0.7],
  ['Biceps', 'Assisted One-Arm Chin-Up', 'Asistirani enorocni zgib s podprijemom', 'Advanced', 'bar', 1.08, { Biceps: 0.48, Back: 0.36, Forearms: 0.12, Abs: 0.04 }],
  ['Biceps', 'Mixed Grip Chin-Up', 'Zgib z mesanim prijemom', 'Intermediate', 'bar', 1],
  ['Forearms', 'Active Hang', 'Aktivno visenje', 'Beginner', 'bar', 0.62],
  ['Forearms', 'Towel Hang', 'Visenje na brisaci', 'Intermediate', 'towel', 0.72, { Forearms: 0.8, Back: 0.12, Shoulders: 0.08 }],
  ['Forearms', 'Fingertip Plank', 'Deska na prstih', 'Intermediate', 'floor', 0.36, { Forearms: 0.58, Abs: 0.28, Shoulders: 0.14 }],
  ['Forearms', 'Fingertip Push-Up', 'Sklece na prstih', 'Advanced', 'floor', 0.66, { Forearms: 0.42, Chest: 0.36, Triceps: 0.14, Shoulders: 0.08 }],
  ['Forearms', 'Wrist Push-Up', 'Sklece za zapestja', 'Advanced', 'floor', 0.5, { Forearms: 0.62, Triceps: 0.18, Shoulders: 0.12, Chest: 0.08 }],
  ['Forearms', 'Knuckle Push-Up', 'Sklece na clenki', 'Intermediate', 'floor', 0.64, { Forearms: 0.32, Chest: 0.45, Triceps: 0.15, Shoulders: 0.08 }],
  ['Forearms', 'Palm Pulse', 'Pulziranje dlani', 'Beginner', 'floor', 0.22, { Forearms: 1 }],
  ['Forearms', 'Reverse Palm Plank', 'Obratna deska na dlaneh', 'Beginner', 'floor', 0.35, { Forearms: 0.55, Shoulders: 0.25, Abs: 0.2 }],
  ['Forearms', 'Pronation Push-Up Hold', 'Drza v proniranem oporu', 'Intermediate', 'floor', 0.4, { Forearms: 0.65, Shoulders: 0.2, Abs: 0.15 }],
  ['Forearms', 'Doorframe Finger Hold', 'Drza prstov na podboju', 'Intermediate', 'space', 0.45, { Forearms: 0.9, Back: 0.1 }],
  ['Forearms', 'False Grip Hang', 'False grip visenje', 'Advanced', 'rings', 0.72, { Forearms: 0.78, Back: 0.12, Shoulders: 0.1 }],
  ['Forearms', 'Ring Support Hold', 'Drza opore na obrocih', 'Intermediate', 'rings', 0.52, { Forearms: 0.45, Shoulders: 0.3, Triceps: 0.18, Abs: 0.07 }],
  ['Forearms', 'Rope Climb Pull', 'Poteg pri plezanju po vrvi', 'Advanced', 'rope', 0.95, { Forearms: 0.42, Back: 0.35, Biceps: 0.18, Abs: 0.05 }],
  ['Forearms', 'Monkey Bar Traverse', 'Premikanje po letveniku', 'Intermediate', 'bar', 0.72, { Forearms: 0.55, Back: 0.25, Shoulders: 0.12, Abs: 0.08 }],
  ['Shoulders', 'Wall Walk', 'Hoja z nogami po steni', 'Advanced', 'wall', 0.72],
  ['Shoulders', 'Handstand Hold', 'Drza stoje na rokah', 'Intermediate', 'wall', 0.55, { Shoulders: 0.58, Abs: 0.28, Triceps: 0.14 }],
  ['Shoulders', 'Frog Stand', 'Zabja stoja', 'Beginner', 'floor', 0.42, { Shoulders: 0.55, Abs: 0.25, Triceps: 0.2 }],
  ['Shoulders', 'Planche Lean', 'Planche nagib', 'Intermediate', 'floor', 0.52, { Shoulders: 0.55, Chest: 0.22, Abs: 0.15, Triceps: 0.08 }],
  ['Shoulders', 'Dive Bomber Push-Up', 'Dive bomber sklece', 'Intermediate', 'floor', 0.66, { Shoulders: 0.45, Chest: 0.28, Triceps: 0.17, Abs: 0.1 }],
  ['Shoulders', 'Hindu Push-Up', 'Hindu sklece', 'Intermediate', 'floor', 0.62],
  ['Shoulders', 'Wall Handstand Shoulder Tap', 'Tapkanje ramen v stoji ob steni', 'Advanced', 'wall', 0.62],
  ['Shoulders', 'Elevated Pike Push-Up', 'Pike sklece z dvignjenimi nogami', 'Advanced', 'bench', 0.75],
  ['Shoulders', 'Tuck Planche Hold', 'Tuck planche drza', 'Advanced', 'floor', 0.58, { Shoulders: 0.52, Abs: 0.25, Triceps: 0.15, Chest: 0.08 }],
  ['Shoulders', 'Scapular Push-Up', 'Lopaticne sklece', 'Beginner', 'floor', 0.42, { Shoulders: 0.5, Chest: 0.25, Abs: 0.15, Triceps: 0.1 }],
  ['Shoulders', 'Pike Hold', 'Pike drza', 'Beginner', 'floor', 0.4],
  ['Shoulders', 'Crow Pose Push-Up', 'Skleca iz crow poze', 'Advanced', 'floor', 0.62, { Shoulders: 0.52, Triceps: 0.22, Abs: 0.18, Chest: 0.08 }],
  ['Stamina/Cardio', 'High Knees', 'Visoka kolena', 'Beginner', 'space', 0.28],
  ['Stamina/Cardio', 'Jumping Jacks', 'Poskoki jumping jack', 'Beginner', 'space', 0.28],
  ['Stamina/Cardio', 'Skater Hops', 'Skaterski poskoki', 'Intermediate', 'space', 0.4, { 'Stamina/Cardio': 0.55, Legs: 0.35, Abs: 0.1 }],
  ['Stamina/Cardio', 'Squat Thrust', 'Squat thrust', 'Intermediate', 'space', 0.48],
  ['Stamina/Cardio', 'Bear Crawl', 'Medvedja hoja', 'Intermediate', 'space', 0.42, { 'Stamina/Cardio': 0.4, Shoulders: 0.25, Abs: 0.2, Legs: 0.15 }],
  ['Stamina/Cardio', 'Crab Walk', 'Racja hoja', 'Beginner', 'space', 0.38, { 'Stamina/Cardio': 0.35, Triceps: 0.22, Shoulders: 0.18, Legs: 0.15, Abs: 0.1 }],
  ['Stamina/Cardio', 'Shuttle Run', 'Shuttle tek', 'Intermediate', 'space', 0.45],
  ['Stamina/Cardio', 'Tuck Jump', 'Skok s koleni k prsim', 'Intermediate', 'space', 0.5, { 'Stamina/Cardio': 0.52, Legs: 0.38, Abs: 0.1 }],
  ['Stamina/Cardio', 'Lateral Bounds', 'Stranski poskoki', 'Intermediate', 'space', 0.46, { 'Stamina/Cardio': 0.5, Legs: 0.4, Abs: 0.1 }],
  ['Stamina/Cardio', 'Sprint Intervals', 'Sprint intervali', 'Advanced', 'space', 0.55, { 'Stamina/Cardio': 0.65, Legs: 0.3, Abs: 0.05 }],
  ['Abs', 'Reverse Crunch', 'Obratni trebusnjak', 'Beginner', 'floor', 0.28],
  ['Abs', 'Bicycle Crunch', 'Kolesarski trebusnjak', 'Beginner', 'floor', 0.28],
  ['Abs', 'Dead Bug', 'Dead bug', 'Beginner', 'floor', 0.25, { Abs: 0.9, Legs: 0.05, Shoulders: 0.05 }],
  ['Abs', 'Flutter Kick', 'Flutter kick', 'Beginner', 'floor', 0.3],
  ['Abs', 'Side Plank', 'Stranska deska', 'Beginner', 'floor', 0.3, { Abs: 0.82, Shoulders: 0.12, Legs: 0.06 }],
  ['Abs', 'Hollow Rock', 'Hollow rock', 'Intermediate', 'floor', 0.35],
  ['Abs', 'Toe Touch', 'Dotik prstov na nogah', 'Beginner', 'floor', 0.28],
  ['Abs', 'Windshield Wiper', 'Brisalci', 'Advanced', 'floor', 0.4, { Abs: 0.82, Legs: 0.12, Shoulders: 0.06 }],
  ['Abs', 'Dragon Flag', 'Dragon flag', 'Advanced', 'bench', 0.55, { Abs: 0.78, Legs: 0.12, Back: 0.06, Shoulders: 0.04 }],
  ['Abs', 'Plank Jack', 'Plank jack', 'Intermediate', 'floor', 0.38, { Abs: 0.55, 'Stamina/Cardio': 0.25, Shoulders: 0.12, Legs: 0.08 }],
].map(makeAdditionalCalisthenicsExercise);

ADDITIONAL_CALISTHENICS_EXERCISES.forEach((exercise) => {
  if (!exerciseInfo[exercise.name]) exerciseInfo[exercise.name] = exercise.info;
  if (!exerciseEquipment[exercise.name]) exerciseEquipment[exercise.name] = exercise.equipment;
  if (!exerciseDifficulty[exercise.name]) exerciseDifficulty[exercise.name] = exercise.difficulty;
});

const GYM_EQUIPMENT_LABELS = {
  barbell: { sl: 'Palica, rack in utezi', en: 'Barbell, rack, and plates' },
  dumbbells: { sl: 'Rocke in klop', en: 'Dumbbells and bench' },
  cable: { sl: 'Kabelski skripec', en: 'Cable station' },
  machine: { sl: 'Naprava', en: 'Machine' },
  smith: { sl: 'Smith naprava', en: 'Smith machine' },
  bench: { sl: 'Klop in utezi', en: 'Bench and weights' },
  landmine: { sl: 'Landmine nastavek in palica', en: 'Landmine attachment and barbell' },
  dip: { sl: 'Dip postaja in pas ali plosca', en: 'Dip station and belt or plate' },
  pullup: { sl: 'Drog za zgibe ali kapitanski stol', en: 'Pull-up bar or captain chair' },
  plate: { sl: 'Utezna plosca', en: 'Weight plate' },
  kettlebell: { sl: 'Rocna utez ali kettlebell', en: 'Dumbbell or kettlebell' },
  cardio: { sl: 'Kardio naprava', en: 'Cardio machine' },
  sled: { sl: 'Sani ali prowler', en: 'Sled or prowler' },
  rope: { sl: 'Bojne vrvi', en: 'Battle ropes' },
  wheel: { sl: 'Ab wheel in podloga', en: 'Ab wheel and mat' },
  ab: { sl: 'Podloga ali naprava za jedro', en: 'Mat or core machine' },
  roller: { sl: 'Wrist roller ali palica z vrvjo', en: 'Wrist roller or bar with rope' },
  grip: { sl: 'Grip pripomocek ali debele rocice', en: 'Grip tool or thick handles' },
};

const GYM_SECTION_COPY = {
  Chest: {
    howTo: { sl: 'Nastavi klop ali napravo, spusti breme kontrolirano proti prsim in potisni skozi stabilen lok.', en: 'Set the bench or machine, lower the load toward the chest under control, and press through a stable path.' },
    cues: { sl: 'Lopatice stisni, rebra zakleni in komolce vodi pod nadzorom.', en: 'Pin the shoulder blades, lock the ribs down, and keep the elbows controlled.' },
  },
  Back: {
    howTo: { sl: 'Zacni z napetim trupom, povleci komolce nazaj ali navzdol in breme vrni brez zibanja.', en: 'Start with a braced torso, pull the elbows back or down, and return the load without rocking.' },
    cues: { sl: 'Najprej premakni lopatice, ne vleci z vratom in ne izgubi ravnega hrbta.', en: 'Move the shoulder blades first, do not pull with the neck, and keep the back flat.' },
  },
  Legs: {
    howTo: { sl: 'Nastavi stopala stabilno, spusti se skozi kolk in koleno ter odrini breme z enakomerno kontrolo.', en: 'Set the feet firmly, move through the hips and knees, and drive the load with steady control.' },
    cues: { sl: 'Kolena naj sledijo prstom, pete ostanejo tezke, tempo naj ostane miren.', en: 'Track knees over toes, keep the heels heavy, and keep the tempo calm.' },
  },
  Triceps: {
    howTo: { sl: 'Zakleni nadlahti, spusti ali potisni breme skozi komolce in zakljuci s popolnim iztegom.', en: 'Lock the upper arms, move the load through the elbows, and finish with a full extension.' },
    cues: { sl: 'Komolci naj ne bezijo narazen, zapestja ostanejo ravna.', en: 'Do not let the elbows drift wide, and keep the wrists straight.' },
  },
  Biceps: {
    howTo: { sl: 'Dvigni breme s pregibom komolcev, vrh stisni in spusti pocasi brez zamaha.', en: 'Curl the load through the elbows, squeeze the top, and lower slowly without swinging.' },
    cues: { sl: 'Komolci ostanejo mirni, ramena naj ne prevzamejo giba.', en: 'Keep the elbows quiet and do not let the shoulders take over.' },
  },
  Forearms: {
    howTo: { sl: 'Premik ali drzo izvedi iz zapestij in prijema, z majhnim obsegom in konstantno napetostjo.', en: 'Move or hold through the wrists and grip with a small range and constant tension.' },
    cues: { sl: 'Ne hiti, stisk naj bo enakomeren in brez bolecine v zapestju.', en: 'Do not rush, keep the squeeze even, and avoid wrist pain.' },
  },
  Shoulders: {
    howTo: { sl: 'Breme vodi iz ramen, dviguj po stabilni liniji in spusti pod kontrolo.', en: 'Move the load from the shoulders, lift through a stable line, and lower under control.' },
    cues: { sl: 'Ne lomi ledvenega dela, vrat naj ostane sproscen, lopatice naj delajo naravno.', en: 'Do not overarch the low back, keep the neck relaxed, and let the shoulder blades move naturally.' },
  },
  Abs: {
    howTo: { sl: 'Zakleni medenico in rebra, skrci trup ali se upiraj rotaciji s polno kontrolo.', en: 'Lock pelvis and ribs, curl the torso or resist rotation with full control.' },
    cues: { sl: 'Gib naj pride iz jedra, ne iz vratu ali bokov.', en: 'Let the movement come from the core, not the neck or hips.' },
  },
  'Stamina/Cardio': {
    howTo: { sl: 'Izberi interval ali enakomeren tempo in ohrani tehniko skozi celoten delovni blok.', en: 'Choose intervals or a steady pace and keep technique clean for the whole work block.' },
    cues: { sl: 'Dihanje naj ostane ritmicno, intenzivnost stopnjuj postopno.', en: 'Keep breathing rhythmic and build intensity gradually.' },
  },
};

const GYM_SECTION_DEFAULT_WEIGHTS = {
  Chest: { Chest: 0.72, Triceps: 0.18, Shoulders: 0.1 },
  Back: { Back: 0.72, Biceps: 0.18, Forearms: 0.1 },
  Legs: { Legs: 0.9, Abs: 0.1 },
  Triceps: { Triceps: 0.85, Chest: 0.1, Shoulders: 0.05 },
  Biceps: { Biceps: 0.85, Forearms: 0.15 },
  Forearms: { Forearms: 0.9, Biceps: 0.1 },
  Shoulders: { Shoulders: 0.78, Triceps: 0.12, Abs: 0.1 },
  Abs: { Abs: 0.9, Legs: 0.05, Shoulders: 0.05 },
  'Stamina/Cardio': { 'Stamina/Cardio': 0.7, Legs: 0.2, Abs: 0.1 },
};

function makeAdditionalGymExercise([section, name, sl, difficulty = 'Intermediate', equipment = 'machine', weights]) {
  const resolvedWeights = weights || GYM_SECTION_DEFAULT_WEIGHTS[section] || { [section]: 1 };
  const copy = GYM_SECTION_COPY[section] || GYM_SECTION_COPY.Chest;
  const primary = CAL_SECTION_LABELS[section] || { sl: section, en: section };
  return {
    section,
    name,
    weights: resolvedWeights,
    info: {
      sl,
      en: name,
      targets: {
        sl: makeCalisthenicsTargets(resolvedWeights, 'sl'),
        en: makeCalisthenicsTargets(resolvedWeights, 'en'),
      },
      primary,
      howTo: {
        sl: `${sl}: ${copy.howTo.sl}`,
        en: `${name}: ${copy.howTo.en}`,
      },
      cues: copy.cues,
    },
    equipment: GYM_EQUIPMENT_LABELS[equipment] || GYM_EQUIPMENT_LABELS.machine,
    difficulty: CAL_DIFFICULTY_LABELS[difficulty] || CAL_DIFFICULTY_LABELS.Intermediate,
  };
}

const ADDITIONAL_GYM_EXERCISES = [
  ['Chest', 'Dumbbell Bench Press', 'Potisk z rockami na ravni klopi', 'Intermediate', 'dumbbells'],
  ['Chest', 'Incline Dumbbell Press', 'Potisk z rockami na nagnjeni klopi', 'Intermediate', 'dumbbells', { Chest: 0.65, Shoulders: 0.22, Triceps: 0.13 }],
  ['Chest', 'Cable Fly', 'Metulj na kablih', 'Beginner', 'cable', { Chest: 1 }],
  ['Chest', 'Pec Deck Fly', 'Pec deck metulj', 'Beginner', 'machine', { Chest: 1 }],
  ['Chest', 'Machine Chest Press', 'Potisk za prsa na napravi', 'Beginner', 'machine'],
  ['Chest', 'Smith Machine Bench Press', 'Smith potisk s prsi', 'Intermediate', 'smith'],
  ['Chest', 'Low Cable Fly', 'Metulj na kablih od spodaj', 'Beginner', 'cable', { Chest: 0.9, Shoulders: 0.1 }],
  ['Chest', 'High Cable Fly', 'Metulj na kablih od zgoraj', 'Beginner', 'cable', { Chest: 0.95, Shoulders: 0.05 }],
  ['Chest', 'Weighted Chest Dip', 'Obtezeni dip za prsa', 'Advanced', 'dip', { Chest: 0.55, Triceps: 0.3, Shoulders: 0.15 }],
  ['Chest', 'Landmine Chest Press', 'Landmine potisk za prsa', 'Intermediate', 'landmine', { Chest: 0.55, Shoulders: 0.3, Triceps: 0.15 }],
  ['Chest', 'Plate Squeeze Press', 'Potisk s stiskom plosce', 'Beginner', 'plate', { Chest: 0.85, Triceps: 0.1, Shoulders: 0.05 }],
  ['Legs', 'Hack Squat', 'Hack pocep', 'Intermediate', 'machine'],
  ['Legs', 'Front Squat', 'Sprednji pocep', 'Advanced', 'barbell', { Legs: 0.86, Abs: 0.14 }],
  ['Legs', 'Goblet Squat', 'Goblet pocep', 'Beginner', 'kettlebell'],
  ['Legs', 'Hip Thrust', 'Potisk bokov', 'Intermediate', 'barbell', { Legs: 0.85, Abs: 0.15 }],
  ['Legs', 'Lying Leg Curl', 'Lezeci upogib nog', 'Beginner', 'machine', { Legs: 1 }],
  ['Legs', 'Seated Leg Curl', 'Sedeci upogib nog', 'Beginner', 'machine', { Legs: 1 }],
  ['Legs', 'Standing Calf Raise', 'Stojeci dvig na prste', 'Beginner', 'machine', { Legs: 1 }],
  ['Legs', 'Seated Calf Raise', 'Sedeci dvig na prste', 'Beginner', 'machine', { Legs: 1 }],
  ['Legs', 'Smith Machine Squat', 'Smith pocep', 'Intermediate', 'smith'],
  ['Legs', 'Cable Pull-Through', 'Cable pull-through', 'Beginner', 'cable', { Legs: 0.8, Back: 0.1, Abs: 0.1 }],
  ['Triceps', 'Rope Triceps Pushdown', 'Potisk vrvi za triceps', 'Beginner', 'cable'],
  ['Triceps', 'Cable Overhead Triceps Extension', 'Nadglavni cable izteg za triceps', 'Beginner', 'cable'],
  ['Triceps', 'Dumbbell Kickback', 'Triceps kickback z rocko', 'Beginner', 'dumbbells'],
  ['Triceps', 'Machine Triceps Dip', 'Dip za triceps na napravi', 'Beginner', 'machine'],
  ['Triceps', 'EZ-Bar French Press', 'Francoski potisk z EZ palico', 'Intermediate', 'barbell'],
  ['Triceps', 'Single-Arm Cable Pushdown', 'Enorocni cable pushdown', 'Beginner', 'cable'],
  ['Triceps', 'Cross-Body Cable Extension', 'Cable izteg preko telesa', 'Beginner', 'cable'],
  ['Triceps', 'Reverse Grip Triceps Pushdown', 'Triceps pushdown s podprijemom', 'Beginner', 'cable'],
  ['Triceps', 'JM Press', 'JM press', 'Advanced', 'barbell', { Triceps: 0.7, Chest: 0.2, Shoulders: 0.1 }],
  ['Triceps', 'Tate Press', 'Tate press', 'Intermediate', 'dumbbells'],
  ['Triceps', 'Seated Dumbbell Triceps Extension', 'Sedeci triceps izteg z rocko', 'Beginner', 'dumbbells'],
  ['Biceps', 'Incline Dumbbell Curl', 'Pregib z rockami na nagnjeni klopi', 'Intermediate', 'dumbbells'],
  ['Biceps', 'Concentration Curl', 'Koncentracijski pregib', 'Beginner', 'dumbbells'],
  ['Biceps', 'EZ-Bar Curl', 'Pregib z EZ palico', 'Beginner', 'barbell'],
  ['Biceps', 'Spider Curl', 'Spider pregib', 'Intermediate', 'bench'],
  ['Biceps', 'Bayesian Cable Curl', 'Bayesian cable pregib', 'Intermediate', 'cable'],
  ['Biceps', 'Machine Preacher Curl', 'Scott pregib na napravi', 'Beginner', 'machine'],
  ['Biceps', 'Rope Hammer Curl', 'Kladivni pregib z vrvjo', 'Beginner', 'cable', { Biceps: 0.65, Forearms: 0.35 }],
  ['Biceps', 'Cable Reverse Curl', 'Obratni pregib na kablu', 'Beginner', 'cable', { Biceps: 0.45, Forearms: 0.55 }],
  ['Biceps', 'Zottman Curl', 'Zottman pregib', 'Intermediate', 'dumbbells', { Biceps: 0.65, Forearms: 0.35 }],
  ['Biceps', 'Drag Curl', 'Drag pregib', 'Intermediate', 'barbell'],
  ['Forearms', 'Behind-the-Back Wrist Curl', 'Pregib zapestja za hrbtom', 'Beginner', 'barbell', { Forearms: 1 }],
  ['Forearms', 'Cable Wrist Curl', 'Pregib zapestja na kablu', 'Beginner', 'cable', { Forearms: 1 }],
  ['Forearms', 'Dumbbell Wrist Rotation', 'Rotacija zapestja z rocko', 'Beginner', 'dumbbells', { Forearms: 1 }],
  ['Forearms', 'Wrist Roller', 'Wrist roller', 'Intermediate', 'roller', { Forearms: 1 }],
  ['Forearms', 'Fat Grip Farmer Carry', 'Kmecka hoja z debelim prijemom', 'Intermediate', 'grip', { Forearms: 0.65, Back: 0.2, Abs: 0.15 }],
  ['Forearms', 'Barbell Hold', 'Drza palice', 'Beginner', 'barbell', { Forearms: 0.85, Back: 0.1, Abs: 0.05 }],
  ['Forearms', 'Gripper Squeeze', 'Stisk gripperja', 'Beginner', 'grip', { Forearms: 1 }],
  ['Forearms', 'Pronated Dumbbell Curl', 'Proniran pregib z rockami', 'Beginner', 'dumbbells', { Forearms: 0.6, Biceps: 0.4 }],
  ['Forearms', 'Suitcase Carry', 'Enorocna kmecka hoja', 'Beginner', 'dumbbells', { Forearms: 0.5, Abs: 0.3, Back: 0.2 }],
  ['Forearms', 'Cable Pronation Supination', 'Pronacija in supinacija na kablu', 'Beginner', 'cable', { Forearms: 1 }],
  ['Shoulders', 'Dumbbell Shoulder Press', 'Ramenski potisk z rockami', 'Intermediate', 'dumbbells'],
  ['Shoulders', 'Machine Shoulder Press', 'Ramenski potisk na napravi', 'Beginner', 'machine'],
  ['Shoulders', 'Cable Lateral Raise', 'Stranski dvig na kablu', 'Beginner', 'cable', { Shoulders: 1 }],
  ['Shoulders', 'Upright Row', 'Veslanje stoje', 'Intermediate', 'barbell', { Shoulders: 0.7, Back: 0.2, Forearms: 0.1 }],
  ['Shoulders', 'Face Pull', 'Face pull', 'Beginner', 'cable', { Shoulders: 0.65, Back: 0.3, Forearms: 0.05 }],
  ['Shoulders', 'Reverse Pec Deck', 'Obratni pec deck', 'Beginner', 'machine', { Shoulders: 0.75, Back: 0.25 }],
  ['Shoulders', 'Landmine Press', 'Landmine ramenski potisk', 'Intermediate', 'landmine'],
  ['Shoulders', 'Push Press', 'Push press', 'Advanced', 'barbell', { Shoulders: 0.55, Triceps: 0.2, Legs: 0.15, Abs: 0.1 }],
  ['Shoulders', 'Cable Y Raise', 'Y dvig na kablu', 'Beginner', 'cable', { Shoulders: 0.9, Back: 0.1 }],
  ['Shoulders', 'Dumbbell Shrug', 'Skomig z rockami', 'Beginner', 'dumbbells', { Shoulders: 0.55, Back: 0.35, Forearms: 0.1 }],
  ['Stamina/Cardio', 'Treadmill Run', 'Tek na tekalni stezi', 'Beginner', 'cardio'],
  ['Stamina/Cardio', 'Stationary Bike', 'Sobno kolo', 'Beginner', 'cardio', { 'Stamina/Cardio': 0.65, Legs: 0.3, Abs: 0.05 }],
  ['Stamina/Cardio', 'Rowing Machine', 'Veslaska naprava', 'Beginner', 'cardio', { 'Stamina/Cardio': 0.4, Back: 0.25, Legs: 0.25, Biceps: 0.1 }],
  ['Stamina/Cardio', 'Elliptical Trainer', 'Elipticni trener', 'Beginner', 'cardio'],
  ['Stamina/Cardio', 'Stair Climber', 'Stopnicni simulator', 'Beginner', 'cardio', { 'Stamina/Cardio': 0.55, Legs: 0.4, Abs: 0.05 }],
  ['Stamina/Cardio', 'Assault Bike', 'Assault bike', 'Intermediate', 'cardio', { 'Stamina/Cardio': 0.5, Legs: 0.25, Shoulders: 0.15, Back: 0.1 }],
  ['Stamina/Cardio', 'SkiErg', 'SkiErg', 'Intermediate', 'cardio', { 'Stamina/Cardio': 0.45, Back: 0.25, Abs: 0.15, Triceps: 0.15 }],
  ['Stamina/Cardio', 'Battle Ropes', 'Bojne vrvi', 'Intermediate', 'rope', { 'Stamina/Cardio': 0.45, Shoulders: 0.25, Abs: 0.2, Forearms: 0.1 }],
  ['Stamina/Cardio', 'Sled Push', 'Potisk sani', 'Intermediate', 'sled', { 'Stamina/Cardio': 0.45, Legs: 0.45, Abs: 0.1 }],
  ['Stamina/Cardio', 'Incline Treadmill Walk', 'Hoja v klanec na tekalni stezi', 'Beginner', 'cardio', { 'Stamina/Cardio': 0.55, Legs: 0.4, Abs: 0.05 }],
  ['Stamina/Cardio', 'Spin Bike Intervals', 'Intervali na spinning kolesu', 'Intermediate', 'cardio', { 'Stamina/Cardio': 0.65, Legs: 0.3, Abs: 0.05 }],
  ['Stamina/Cardio', 'Treadmill Sprints', 'Sprinti na tekalni stezi', 'Advanced', 'cardio', { 'Stamina/Cardio': 0.65, Legs: 0.3, Abs: 0.05 }],
  ['Stamina/Cardio', 'StepMill Intervals', 'Intervali na StepMill napravi', 'Intermediate', 'cardio', { 'Stamina/Cardio': 0.58, Legs: 0.37, Abs: 0.05 }],
  ['Stamina/Cardio', 'Air Rower Intervals', 'Intervali na air rowerju', 'Intermediate', 'cardio', { 'Stamina/Cardio': 0.42, Back: 0.25, Legs: 0.23, Biceps: 0.1 }],
  ['Stamina/Cardio', 'Prowler Push', 'Prowler potisk', 'Advanced', 'sled', { 'Stamina/Cardio': 0.45, Legs: 0.45, Abs: 0.1 }],
  ['Back', 'Deadlift', 'Mrtvi dvig', 'Advanced', 'barbell', { Back: 0.45, Legs: 0.4, Abs: 0.15 }],
  ['Back', 'T-Bar Row', 'T-bar veslanje', 'Intermediate', 'barbell'],
  ['Back', 'Chest-Supported Row', 'Veslanje s podporo prsi', 'Beginner', 'bench'],
  ['Back', 'Single-Arm Dumbbell Row', 'Enorocno veslanje z rocko', 'Beginner', 'dumbbells'],
  ['Back', 'Machine Row', 'Veslanje na napravi', 'Beginner', 'machine'],
  ['Back', 'Wide Grip Lat Pulldown', 'Siroki poteg na prsi', 'Beginner', 'machine'],
  ['Back', 'Close Grip Lat Pulldown', 'Ozki poteg na prsi', 'Beginner', 'machine', { Back: 0.68, Biceps: 0.22, Forearms: 0.1 }],
  ['Back', 'Cable Pullover', 'Cable pullover', 'Beginner', 'cable', { Back: 0.85, Abs: 0.15 }],
  ['Back', 'Rack Pull', 'Rack pull', 'Advanced', 'barbell', { Back: 0.62, Legs: 0.25, Abs: 0.13 }],
  ['Back', 'Meadows Row', 'Meadows veslanje', 'Intermediate', 'landmine'],
  ['Back', 'Assisted Pull-Up Machine', 'Asistirani zgib na napravi', 'Beginner', 'machine'],
  ['Abs', 'Machine Crunch', 'Trebusnjak na napravi', 'Beginner', 'machine', { Abs: 1 }],
  ['Abs', 'Weighted Crunch', 'Obtezeni trebusnjak', 'Beginner', 'plate', { Abs: 1 }],
  ['Abs', 'Decline Sit-Up', 'Trebusnjak na negativni klopi', 'Intermediate', 'bench', { Abs: 0.9, Legs: 0.1 }],
  ['Abs', 'Hanging Knee Raise', 'Dvig kolen v visenju', 'Intermediate', 'pullup', { Abs: 0.82, Legs: 0.12, Forearms: 0.06 }],
  ['Abs', "Captain's Chair Knee Raise", 'Dvig kolen na kapitanskem stolu', 'Beginner', 'machine', { Abs: 0.85, Legs: 0.1, Shoulders: 0.05 }],
  ['Abs', 'Ab Wheel Rollout', 'Ab wheel rollout', 'Intermediate', 'wheel', { Abs: 0.75, Shoulders: 0.15, Back: 0.1 }],
  ['Abs', 'Medicine Ball Russian Twist', 'Ruski zasuk z medicinko', 'Beginner', 'plate', { Abs: 1 }],
  ['Abs', 'Pallof Press', 'Pallof press', 'Beginner', 'cable', { Abs: 0.85, Shoulders: 0.1, Chest: 0.05 }],
  ['Abs', 'Cable Woodchop', 'Sekanje na kablu', 'Intermediate', 'cable', { Abs: 0.82, Shoulders: 0.1, Back: 0.08 }],
  ['Abs', 'Weighted Plank', 'Obtezena deska', 'Intermediate', 'plate', { Abs: 0.82, Back: 0.1, Shoulders: 0.08 }],
  ['Abs', 'Stability Ball Crunch', 'Trebusnjak na zogi', 'Beginner', 'ab', { Abs: 1 }],
  ['Abs', 'Decline Reverse Crunch', 'Obratni trebusnjak na negativni klopi', 'Intermediate', 'bench', { Abs: 0.9, Legs: 0.1 }],
  ['Abs', 'Landmine Rotation', 'Landmine rotacija', 'Intermediate', 'landmine', { Abs: 0.78, Shoulders: 0.12, Back: 0.1 }],
].map(makeAdditionalGymExercise);

ADDITIONAL_GYM_EXERCISES.forEach((exercise) => {
  if (!exerciseInfo[exercise.name]) exerciseInfo[exercise.name] = exercise.info;
  if (!exerciseEquipment[exercise.name]) exerciseEquipment[exercise.name] = exercise.equipment;
  if (!exerciseDifficulty[exercise.name]) exerciseDifficulty[exercise.name] = exercise.difficulty;
});


const EXERCISE_MUSCLE_WEIGHTS = {
  'Bench Press': { Chest: 0.7, Triceps: 0.2, Shoulders: 0.1 },
  'Incline Bench Press': { Chest: 0.65, Shoulders: 0.2, Triceps: 0.15 },
  'Decline Bench Press': { Chest: 0.75, Triceps: 0.2, Shoulders: 0.05 },
  'Chest Fly': { Chest: 1 },
  'Push-Up': { Chest: 0.65, Triceps: 0.25, Shoulders: 0.1 },
  'Wide Push-Up': { Chest: 0.8, Triceps: 0.12, Shoulders: 0.08 },
  'Diamond Push-Up': { Triceps: 0.55, Chest: 0.35, Shoulders: 0.1 },
  'Archer Push-Up': { Chest: 0.7, Triceps: 0.2, Shoulders: 0.1 },
  'Pseudo-Planche Push-Up': { Chest: 0.45, Shoulders: 0.35, Triceps: 0.2 },
  Squat: { Legs: 0.9, Abs: 0.1 },
  'Leg Press': { Legs: 1 },
  'Romanian Deadlift': { Legs: 0.65, Back: 0.25, Abs: 0.1 },
  'Walking Lunge': { Legs: 0.9, Abs: 0.1 },
  'Leg Extension': { Legs: 1 },
  'Bodyweight Squat': { Legs: 0.9, Abs: 0.1 },
  'Bulgarian Split Squat': { Legs: 0.9, Abs: 0.1 },
  'Pistol Squat': { Legs: 0.9, Abs: 0.1 },
  'Jump Squat': { Legs: 0.85, 'Stamina/Cardio': 0.15 },
  'Wall Sit': { Legs: 0.85, Abs: 0.15 },
  'Triceps Pushdown': { Triceps: 1 },
  'Overhead Triceps Extension': { Triceps: 1 },
  'Close Grip Bench Press': { Triceps: 0.55, Chest: 0.3, Shoulders: 0.15 },
  'Bench Dip': { Triceps: 0.65, Chest: 0.25, Shoulders: 0.1 },
  'Skull Crusher': { Triceps: 1 },
  Dip: { Triceps: 0.55, Chest: 0.3, Shoulders: 0.15 },
  'Close Grip Push-Up': { Triceps: 0.6, Chest: 0.3, Shoulders: 0.1 },
  'Barbell Curl': { Biceps: 0.8, Forearms: 0.2 },
  'Dumbbell Curl': { Biceps: 0.85, Forearms: 0.15 },
  'Hammer Curl': { Biceps: 0.65, Forearms: 0.35 },
  'Preacher Curl': { Biceps: 0.9, Forearms: 0.1 },
  'Cable Curl': { Biceps: 0.85, Forearms: 0.15 },
  'Chin-Up': { Biceps: 0.45, Back: 0.45, Forearms: 0.1 },
  'Archer Pull-Up': { Back: 0.6, Biceps: 0.3, Forearms: 0.1 },
  'Commando Pull-Up': { Back: 0.55, Biceps: 0.35, Forearms: 0.1 },
  'Wrist Curl': { Forearms: 1 },
  'Reverse Wrist Curl': { Forearms: 1 },
  'Farmer Carry': { Forearms: 0.55, Back: 0.3, Abs: 0.15 },
  'Plate Pinch Hold': { Forearms: 1 },
  'Reverse Curl': { Forearms: 0.55, Biceps: 0.45 },
  'Dead Hang': { Forearms: 0.55, Back: 0.3, Shoulders: 0.15 },
  'Overhead Press': { Shoulders: 0.7, Triceps: 0.2, Abs: 0.1 },
  'Lateral Raise': { Shoulders: 1 },
  'Front Raise': { Shoulders: 1 },
  'Rear Delt Fly': { Shoulders: 0.7, Back: 0.3 },
  'Arnold Press': { Shoulders: 0.7, Triceps: 0.2, Abs: 0.1 },
  'Pike Push-Up': { Shoulders: 0.6, Triceps: 0.25, Chest: 0.15 },
  'Handstand Push-Up': { Shoulders: 0.65, Triceps: 0.25, Abs: 0.1 },
  'Shoulder Tap': { Shoulders: 0.45, Abs: 0.45, Triceps: 0.1 },
  Running: { 'Stamina/Cardio': 0.7, Legs: 0.3 },
  Cycling: { 'Stamina/Cardio': 0.6, Legs: 0.4 },
  Rowing: { 'Stamina/Cardio': 0.35, Back: 0.3, Legs: 0.25, Biceps: 0.1 },
  'Jump Rope': { 'Stamina/Cardio': 0.65, Legs: 0.25, Forearms: 0.1 },
  Burpee: { 'Stamina/Cardio': 0.4, Legs: 0.25, Chest: 0.2, Abs: 0.15 },
  'Mountain Climber': { 'Stamina/Cardio': 0.35, Abs: 0.35, Legs: 0.2, Shoulders: 0.1 },
  'Box Jump': { Legs: 0.65, 'Stamina/Cardio': 0.35 },
  'Barbell Row': { Back: 0.75, Biceps: 0.15, Forearms: 0.1 },
  'Lat Pulldown': { Back: 0.75, Biceps: 0.15, Forearms: 0.1 },
  'Pull-Up': { Back: 0.65, Biceps: 0.25, Forearms: 0.1 },
  'Seated Cable Row': { Back: 0.75, Biceps: 0.15, Forearms: 0.1 },
  'Straight Arm Pulldown': { Back: 0.85, Abs: 0.15 },
  'Inverted Row': { Back: 0.65, Biceps: 0.25, Forearms: 0.1 },
  'Australian Pull-Up': { Back: 0.65, Biceps: 0.25, Forearms: 0.1 },
  'Muscle-Up': { Back: 0.4, Triceps: 0.25, Chest: 0.15, Biceps: 0.1, Shoulders: 0.1 },
  Crunch: { Abs: 1 },
  'Leg Raise': { Abs: 0.85, Legs: 0.15 },
  Plank: { Abs: 0.75, Back: 0.15, Shoulders: 0.1 },
  'Russian Twist': { Abs: 1 },
  'Cable Crunch': { Abs: 1 },
  'L-Sit': { Abs: 0.65, Triceps: 0.2, Shoulders: 0.15 },
  'Hollow Body Hold': { Abs: 1 },
  'V-Up': { Abs: 0.9, Legs: 0.1 },
};

const BODYWEIGHT_LOAD_FACTORS = {
  'Push-Up': 0.64,
  'Wide Push-Up': 0.64,
  'Diamond Push-Up': 0.64,
  'Archer Push-Up': 0.7,
  'Pseudo-Planche Push-Up': 0.72,
  'Bodyweight Squat': 0.75,
  'Bulgarian Split Squat': 0.8,
  'Pistol Squat': 0.85,
  'Jump Squat': 0.75,
  'Wall Sit': 0.55,
  Dip: 0.82,
  'Close Grip Push-Up': 0.64,
  'Chin-Up': 1,
  'Archer Pull-Up': 1,
  'Commando Pull-Up': 1,
  'Dead Hang': 0.65,
  'Pike Push-Up': 0.7,
  'Handstand Push-Up': 0.9,
  'Shoulder Tap': 0.35,
  Running: 0.3,
  Cycling: 0.28,
  Rowing: 0.45,
  'Jump Rope': 0.25,
  Burpee: 0.55,
  'Mountain Climber': 0.35,
  'Box Jump': 0.65,
  'Pull-Up': 1,
  'Inverted Row': 0.75,
  'Australian Pull-Up': 0.75,
  'Muscle-Up': 1.15,
  Crunch: 0.25,
  'Leg Raise': 0.35,
  Plank: 0.3,
  'Russian Twist': 0.25,
  'L-Sit': 0.45,
  'Hollow Body Hold': 0.3,
  'V-Up': 0.35,
};

ADDITIONAL_CALISTHENICS_EXERCISES.forEach((exercise) => {
  EXERCISE_MUSCLE_WEIGHTS[exercise.name] = exercise.weights;
  BODYWEIGHT_LOAD_FACTORS[exercise.name] = exercise.loadFactor;
});

ADDITIONAL_GYM_EXERCISES.forEach((exercise) => {
  EXERCISE_MUSCLE_WEIGHTS[exercise.name] = exercise.weights;
});

const normalizeWorkout = (w, i = 0) => {
  const setDetails = (Array.isArray(w.setDetails) ? w.setDetails : [])
    .map((v) => Math.round(cleanNumber(v, 1, 500, 0)))
    .filter((v) => v > 0);
  const setWeights = Array.isArray(w.setWeights)
    ? w.setWeights.map((v) => cleanNumber(v, 0, 1000, 0)).filter((v) => v > 0)
    : null;
  return {
    id: Number.isSafeInteger(Number(w.id)) ? Number(w.id) : Date.now() + i,
    date: isCleanDate(w.date) ? w.date : todayKey(),
    exercise: cleanText(w.exercise, 120) || 'Bench Press',
    weight: cleanNumber(w.weight, 0, 1000, 0),
    setDetails: setDetails.length ? setDetails.slice(0, 50) : [1],
    comment: cleanText(w.comment ?? w.notes, 1200),
    ...(w.demo ? { demo: true } : {}),
    ...(isCleanDate(w.copiedFromDate) ? { copiedFromDate: w.copiedFromDate } : {}),
    ...(setWeights?.length ? { setWeights: setWeights.slice(0, 50) } : {}),
  };
};
const getSetCount = (w) => w.setDetails.length;
const getTotalReps = (w) => w.setDetails.reduce((s, v) => s + v, 0);
const formatSetDetails = (w) => w.setDetails.join(' / ');
const convertWeight = (kg, units) => (units === 'lbs' ? kg * 2.20462 : kg);
const formatWeight = (kg, units) => `${units === 'lbs' ? Math.round(convertWeight(kg, units)) : Number(convertWeight(kg, units).toFixed(1))} ${units}`;
const formatVolume = (kg, units) => `${Math.round(convertWeight(kg, units)).toLocaleString()} ${units}`;
const formatLiters = (ml, digits = 2) => Number((Number(ml) / 1000).toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });
const findSection = (exercise) => (
  Object.entries(sections).find(([, items]) => items.includes(exercise))?.[0]
  ?? Object.entries(calisthenicsSections).find(([, items]) => items.includes(exercise))?.[0]
  ?? 'Chest'
);
function getExerciseSection(exercise, customExercises = []) {
  const builtIn = Object.entries(sections).find(([, items]) => items.includes(exercise))?.[0];
  if (builtIn) return builtIn;
  const calisthenics = Object.entries(calisthenicsSections).find(([, items]) => items.includes(exercise))?.[0];
  if (calisthenics) return calisthenics;
  const custom = customExercises.find((item) => item.name === exercise);
  return custom?.section || 'Chest';
}
function getLatestBodyWeightKg(entries, gender = 'male') {
  const latest = [...(entries || [])]
    .map((entry) => ({ ...entry, weight: Number(entry.weight) || 0 }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .at(-1);
  return latest?.weight || (gender === 'female' ? 62 : 78);
}
function getExerciseMuscleWeights(exercise, customExercises = []) {
  return EXERCISE_MUSCLE_WEIGHTS[exercise] || { [getExerciseSection(exercise, customExercises)]: 1 };
}
function getEstimatedExerciseLoad(exercise, bodyWeightKg, customExercises = []) {
  const explicitFactor = BODYWEIGHT_LOAD_FACTORS[exercise];
  if (explicitFactor !== undefined) return bodyWeightKg * explicitFactor;
  const section = getExerciseSection(exercise, customExercises);
  if (section === 'Stamina/Cardio') return bodyWeightKg * 0.3;
  if (section === 'Abs') return bodyWeightKg * 0.3;
  return 0;
}
function getWorkoutVolumeKg(workout, bodyWeightKg = 0, customExercises = []) {
  const reps = getTotalReps(workout);
  if (!reps) return 0;
  const perSetVolume = Array.isArray(workout.setWeights) && workout.setWeights.some((value) => Number(value) > 0)
    ? workout.setDetails.reduce((sum, repCount, index) => sum + ((Number(repCount) || 0) * (Number(workout.setWeights[index]) || 0)), 0)
    : 0;
  if (perSetVolume > 0) return perSetVolume;
  const loggedLoad = Number(workout.weight) || 0;
  const effectiveLoad = loggedLoad > 0 ? loggedLoad : getEstimatedExerciseLoad(workout.exercise, bodyWeightKg, customExercises);
  return effectiveLoad * reps;
}
function getWorkoutStrengthVolume(workout, bodyWeightKg, customExercises = []) {
  return getWorkoutVolumeKg(workout, bodyWeightKg, customExercises);
}
function getMuscleVolumeData(muscleKey, workouts, bodyWeightEntries = [], settings = {}, customExercises = []) {
  const bodyWeightKg = getLatestBodyWeightKg(bodyWeightEntries, settings.gender || 'male');
  const exerciseTotals = {};
  const records = {};
  let sessions = 0;
  let sets = 0;
  let weightedVolume = 0;

  workouts.forEach((workout) => {
    const weights = getExerciseMuscleWeights(workout.exercise, customExercises);
    const share = Number(weights[muscleKey]) || 0;
    if (share <= 0) return;
    const baseVolume = getWorkoutStrengthVolume(workout, bodyWeightKg, customExercises);
    const muscleVolume = baseVolume * share;
    if (muscleVolume <= 0) return;
    sessions += 1;
    sets += getSetCount(workout);
    weightedVolume += muscleVolume;
    exerciseTotals[workout.exercise] = (exerciseTotals[workout.exercise] || 0) + muscleVolume;
    const recordLoad = Number(workout.weight) || getEstimatedExerciseLoad(workout.exercise, bodyWeightKg, customExercises);
    records[workout.exercise] = Math.max(records[workout.exercise] || 0, recordLoad);
  });

  const topExercises = Object.entries(exerciseTotals)
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume);
  const volume = Math.round(weightedVolume);
  const rank = getMuscleRank(volume, settings.language || 'en');
  return {
    pts: volume,
    volume,
    sessions,
    sets,
    prs: Object.keys(records).length,
    rank,
    topExercise: topExercises[0] || null,
    topExercises,
    bodyWeightKg,
  };
}
function getAllMuscleVolumeData(workouts, bodyWeightEntries = [], settings = {}, customExercises = []) {
  return MUSCLE_KEYS.reduce((map, muscleKey) => {
    map[muscleKey] = getMuscleVolumeData(muscleKey, workouts, bodyWeightEntries, settings, customExercises);
    return map;
  }, {});
}
const localize = (pair, lang) => pair?.[lang] ?? pair?.en ?? pair?.sl ?? '';
const getExerciseInfo = (exercise) => ({
  ...(exerciseInfo[exercise] ?? { sl: exercise, en: exercise, targets: { sl: '', en: '' }, primary: { sl: '', en: '' }, howTo: { sl: '', en: '' }, cues: { sl: '', en: '' } }),
  equipment: exerciseEquipment[exercise] ?? { sl: 'Osnovna gym oprema', en: 'Basic gym equipment' },
  difficulty: exerciseDifficulty[exercise] ?? { sl: 'Srednja', en: 'Intermediate' },
});
const getExerciseName = (exercise, lang) => getExerciseInfo(exercise)[lang] ?? exercise;
const getWorkoutStorageKey = (email) => `${WORKOUTS_KEY_PREFIX}${email}`;
const getSettingsStorageKey = (email) => `${SETTINGS_KEY_PREFIX}${email}`;
const getCaloriesStorageKey = (email) => `${CALORIES_KEY_PREFIX}${email}`;
function getUserBadge(email) {
  const local = (email || '').split('@')[0].trim();
  if (!local) return 'U';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return local.slice(0, Math.min(2, local.length)).toUpperCase();
}

function sanitizeSettings(input) {
  const safe = { ...defaultSettings };
  if (input && typeof input === 'object') {
    if (input.units === 'kg' || input.units === 'lbs') safe.units = input.units;
    if (SUPPORTED_LANGUAGES.includes(input.language)) safe.language = input.language;
    if (SUPPORTED_BACKGROUNDS.includes(input.backgroundAccent)) safe.backgroundAccent = input.backgroundAccent;
    if (['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'].includes(input.dateFormat)) safe.dateFormat = input.dateFormat;
    if ([3, 7, 14, 30].includes(Number(input.backupReminderDays))) safe.backupReminderDays = Number(input.backupReminderDays);
    if (typeof input.lastBackupAt === 'string') safe.lastBackupAt = input.lastBackupAt;
    if (Number(input.calorieGoal) >= 1000 && Number(input.calorieGoal) <= 10000) safe.calorieGoal = Number(input.calorieGoal);
    if (Number(input.waterGoalMl) >= 1000 && Number(input.waterGoalMl) <= 8000) safe.waterGoalMl = Number(input.waterGoalMl);
    if (input.calorieTrackerMode === 'simple' || input.calorieTrackerMode === 'advanced') safe.calorieTrackerMode = input.calorieTrackerMode;
    if (typeof input.weightDrop === 'boolean') safe.weightDrop = input.weightDrop;
    if (input.gender === 'male' || input.gender === 'female') safe.gender = input.gender;
    if (typeof input.age === 'string' || typeof input.age === 'number') safe.age = String(input.age);
    if (typeof input.height === 'string' || typeof input.height === 'number') safe.height = String(input.height);
    if (typeof input.showFeedbackBtn === 'boolean') safe.showFeedbackBtn = input.showFeedbackBtn;
  }
  return safe;
}

function sanitizeUser(input) {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.email !== 'string' || typeof input.passwordHash !== 'string') return null;
  return { email: input.email.trim().toLowerCase(), passwordHash: input.passwordHash, createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString() };
}

function loadUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeUser).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function updateStoredUserPassword(email, passwordHash) {
  const users = loadUsers();
  const nextUsers = users.map((user) => (
    user.email === email ? { ...user, passwordHash } : user
  ));
  localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
}

function getAdminBonusKey(email) { return `powergraph_adminbonus_${email}`; }
function loadAdminBonus(email) { if (!email) return 0; try { return Number(localStorage.getItem(getAdminBonusKey(email)) || 0); } catch { return 0; } }
function saveAdminBonus(email, pts) { localStorage.setItem(getAdminBonusKey(email), String(pts)); }

function loadRatings() { try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '[]'); } catch { return []; } }
function saveRatings(ratings) { localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings)); }
function loadBanned() { try { return JSON.parse(localStorage.getItem(BANNED_KEY) || '[]'); } catch { return []; } }
function saveBanned(list) { localStorage.setItem(BANNED_KEY, JSON.stringify(list)); }
function loadMods() { try { return JSON.parse(localStorage.getItem(MODS_KEY) || '[]'); } catch { return []; } }
function saveMods(list) { localStorage.setItem(MODS_KEY, JSON.stringify(list)); }
function sanitizeAdminConfig(input) {
  const safe = { ...defaultAdminConfig };
  if (input && typeof input === 'object') {
    if (typeof input.appName === 'string') safe.appName = input.appName.trim().slice(0, 32) || defaultAdminConfig.appName;
    if (typeof input.announcementEnabled === 'boolean') safe.announcementEnabled = input.announcementEnabled;
    if (typeof input.announcementText === 'string') safe.announcementText = input.announcementText.trim().slice(0, 220);
    if (typeof input.maintenanceMode === 'boolean') safe.maintenanceMode = input.maintenanceMode;
    if (typeof input.signupEnabled === 'boolean') safe.signupEnabled = input.signupEnabled;
    if (typeof input.feedbackEnabled === 'boolean') safe.feedbackEnabled = input.feedbackEnabled;
    if (typeof input.backupBannerEnabled === 'boolean') safe.backupBannerEnabled = input.backupBannerEnabled;
    if (SUPPORTED_LANGUAGES.includes(input.defaultLanguage)) safe.defaultLanguage = input.defaultLanguage;
    if (SUPPORTED_BACKGROUNDS.includes(input.defaultAccent)) safe.defaultAccent = input.defaultAccent;
    if (input.defaultUnits === 'kg' || input.defaultUnits === 'lbs') safe.defaultUnits = input.defaultUnits;
    if (Number(input.defaultCalorieGoal) >= 1000 && Number(input.defaultCalorieGoal) <= 10000) safe.defaultCalorieGoal = Number(input.defaultCalorieGoal);
    if (Number(input.defaultWaterGoalMl) >= 1000 && Number(input.defaultWaterGoalMl) <= 8000) safe.defaultWaterGoalMl = Number(input.defaultWaterGoalMl);
    if (typeof input.adminNote === 'string') safe.adminNote = input.adminNote.trim().slice(0, 420);
  }
  return safe;
}
function loadAdminConfig() {
  try { return sanitizeAdminConfig(JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || 'null') || {}); }
  catch { return { ...defaultAdminConfig }; }
}
function saveAdminConfig(config) { localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(sanitizeAdminConfig(config))); }
function loadAdminAudit() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_AUDIT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 300) : [];
  } catch { return []; }
}
function saveAdminAudit(list) { localStorage.setItem(ADMIN_AUDIT_KEY, JSON.stringify((Array.isArray(list) ? list : []).slice(0, 300))); }


function playTimerAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.6, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.4);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.4);
    });
  } catch {}
}

const TIMER_WORKER_SRC = `var t=null;self.onmessage=function(e){if(e.data.type==='start'){clearInterval(t);var end=e.data.endAt;t=setInterval(function(){var r=Math.max(0,Math.round((end-Date.now())/1000));self.postMessage({remaining:r});if(r<=0)clearInterval(t);},200);}else if(e.data.type==='stop'){clearInterval(t);}};`;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
}

function recordLogin(email, type) {
  try {
    const logs = JSON.parse(localStorage.getItem(LOGINS_KEY) || '[]');
    logs.push({ email, type, ts: new Date().toISOString() });
    localStorage.setItem(LOGINS_KEY, JSON.stringify(logs.slice(-500)));
  } catch {}
}

const RANKS = [
  { name: 'Začetnik', nameEn: 'Beginner', min: 0, icon: '🌱' },
  { name: 'Rekreativec', nameEn: 'Recreational', min: 300, icon: '🏃' },
  { name: 'Borec', nameEn: 'Fighter', min: 700, icon: '⚔️' },
  { name: 'Aktivni', nameEn: 'Active', min: 1500, icon: '💪' },
  { name: 'Napredni', nameEn: 'Advanced', min: 3000, icon: '🔥' },
  { name: 'Veteran', nameEn: 'Veteran', min: 5500, icon: '🛡️' },
  { name: 'Elite', nameEn: 'Elite', min: 9000, icon: '⚡' },
  { name: 'Legenda', nameEn: 'Legend', min: 15000, icon: '👑' },
];

const MUSCLE_RANKS = [
  { nameEn: 'Wood',     nameSl: 'Les',      min: 0,    color: '#a16207', bg: 'linear-gradient(135deg,#78350f,#b45309)' },
  { nameEn: 'Bronze',   nameSl: 'Bron',     min: 2500, color: '#d97706', bg: 'linear-gradient(135deg,#92400e,#fbbf24)' },
  { nameEn: 'Silver',   nameSl: 'Srebro',   min: 7500, color: '#94a3b8', bg: 'linear-gradient(135deg,#475569,#cbd5e1)' },
  { nameEn: 'Gold',     nameSl: 'Zlato',    min: 15000, color: '#f59e0b', bg: 'linear-gradient(135deg,#b45309,#fde68a)' },
  { nameEn: 'Platinum', nameSl: 'Platina',  min: 30000, color: '#67e8f9', bg: 'linear-gradient(135deg,#0e7490,#a5f3fc)' },
  { nameEn: 'Diamond',  nameSl: 'Diamant',  min: 60000, color: '#a78bfa', bg: 'linear-gradient(135deg,#6d28d9,#ddd6fe)' },
  { nameEn: 'Champion', nameSl: 'Prvak',    min: 100000, color: '#f472b6', bg: 'linear-gradient(135deg,#be185d,#fbcfe8)' },
  { nameEn: 'Titan',    nameSl: 'Titan',    min: 160000, color: '#f87171', bg: 'linear-gradient(135deg,#7f1d1d,#fca5a5)' },
  { nameEn: 'Olympian', nameSl: 'Olimpijec',min: 250000, color: '#fcd34d', bg: 'linear-gradient(135deg,#78350f,#fcd34d,#67e8f9)' },
];
const MUSCLE_RANK_ICONS = ['🪵','🥉','🥈','🥇','💠','💎','🏅','🔥','⚡'];
const MUSCLE_KEYS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Legs', 'Abs', 'Stamina/Cardio'];
const MUSCLE_COLORS = {
  Chest: '#3b82f6', Back: '#6366f1', Shoulders: '#f59e0b',
  Biceps: '#8b5cf6', Triceps: '#ec4899', Forearms: '#10b981',
  Legs: '#f97316', Abs: '#06b6d4', 'Stamina/Cardio': '#ef4444',
};

function getRank(points, lang) {
  let rank = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i].min) { rank = RANKS[i]; break; }
  }
  return { ...rank, displayName: lang === 'sl' ? rank.name : rank.nameEn };
}

function calculatePoints(workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, calorieGoal) {
  let pts = 0;
  pts += workouts.length * 5;
  const exMax = {};
  [...workouts].sort((a, b) => a.date.localeCompare(b.date)).forEach(w => {
    if (exMax[w.exercise] !== undefined && w.weight > exMax[w.exercise]) pts += 15;
    if (exMax[w.exercise] === undefined || w.weight > exMax[w.exercise]) exMax[w.exercise] = w.weight;
  });
  pts += restDays.length * 3;
  pts += bodyWeightEntries.length * 1;
  const calByDate = {};
  calorieEntries.forEach(e => { if (!calByDate[e.date]) calByDate[e.date] = 0; calByDate[e.date] += Number(e.calories) || 0; });
  const cheatSet = new Set(cheatDays);
  Object.entries(calByDate).forEach(([date, total]) => {
    if (cheatSet.has(date)) { pts += 2; }
    else { pts += 2; if (Math.abs(total - calorieGoal) <= 200) pts += 8; else if (total > calorieGoal + 200) pts -= 3; }
  });
  const workoutDates = new Set(workouts.map(w => w.date));
  const restSet = new Set(restDays);
  const allDates = [...workoutDates, ...restSet];
  if (allDates.length > 0) {
    const firstDate = allDates.reduce((a, b) => a < b ? a : b);
    const today = new Date().toISOString().slice(0, 10);
    let d = new Date(firstDate);
    const todayD = new Date(today);
    let cons = 0;
    while (d <= todayD) {
      const ds = d.toISOString().slice(0, 10);
      if (workoutDates.has(ds) || restSet.has(ds)) { cons = 0; } else { cons++; if (cons > 2) pts -= 4; }
      d.setDate(d.getDate() + 1);
    }
  }
  return Math.max(0, pts);
}

function getMuscleRank(pts, lang) {
  let rank = MUSCLE_RANKS[0];
  for (let i = MUSCLE_RANKS.length - 1; i >= 0; i--) {
    if (pts >= MUSCLE_RANKS[i].min) { rank = MUSCLE_RANKS[i]; break; }
  }
  return { ...rank, displayName: lang === 'sl' ? rank.nameSl : rank.nameEn, idx: MUSCLE_RANKS.indexOf(rank) };
}

function getOverallMuscleRankData(muscleStats = {}, lang = 'en') {
  const volumes = MUSCLE_KEYS.map((key) => Math.max(0, Number(muscleStats[key]?.volume) || 0));
  const totalVolume = volumes.reduce((sum, value) => sum + value, 0);
  const averageVolume = Math.round(totalVolume / MUSCLE_KEYS.length);
  const trainedGroups = volumes.filter((value) => value > 0).length;
  const rank = getMuscleRank(averageVolume, lang);
  const nextRank = MUSCLE_RANKS[rank.idx + 1] || null;
  const progressPct = nextRank
    ? Math.min(100, Math.max(0, Math.round(((averageVolume - rank.min) / (nextRank.min - rank.min)) * 100)))
    : 100;

  return {
    averageVolume,
    totalVolume: Math.round(totalVolume),
    trainedGroups,
    totalGroups: MUSCLE_KEYS.length,
    rank,
    nextRank,
    progressPct,
  };
}

const KCAL_PER_KG_BODY_MASS = 7700;
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryactive: 1.9,
};

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getMifflinBmr(weightKg, heightCm, age, gender = 'male') {
  return gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

function getActivityMultiplier(activityLevel) {
  return ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
}

function simulateWeightFromCalories({ startWeight, dailyCalories, days, age, height, gender = 'male', activityLevel = 'moderate' }) {
  const multiplier = getActivityMultiplier(activityLevel);
  let weight = Number(startWeight) || 0;
  let totalTdee = 0;
  const totalDays = Math.max(1, Math.round(Number(days) || 1));

  // Recalculate expenditure as projected body weight changes, so the target is not based on a static TDEE.
  for (let day = 0; day < totalDays; day += 1) {
    const dayAge = (Number(age) || 28) + (day / 365);
    const bmr = getMifflinBmr(weight, height, dayAge, gender);
    const tdee = Math.max(900, bmr * multiplier);
    totalTdee += tdee;
    weight += (dailyCalories - tdee) / KCAL_PER_KG_BODY_MASS;
    weight = clampNumber(weight, 25, 350);
  }

  return {
    finalWeight: weight,
    averageTdee: totalTdee / totalDays,
  };
}

function findCaloriesForGoal({ currentWeight, goalWeight, days, age, height, gender, activityLevel, minCalories, maxCalories }) {
  let low = minCalories;
  let high = maxCalories;
  const gaining = goalWeight > currentWeight;

  for (let i = 0; i < 34; i += 1) {
    const mid = (low + high) / 2;
    const projected = simulateWeightFromCalories({
      startWeight: currentWeight,
      dailyCalories: mid,
      days,
      age,
      height,
      gender,
      activityLevel,
    }).finalWeight;

    if (gaining) {
      if (projected < goalWeight) low = mid;
      else high = mid;
    } else if (projected > goalWeight) high = mid;
    else low = mid;
  }

  return Math.round((low + high) / 2);
}

function getRequestedTimeframePlan({ currentWeight, goalWeight, days, age, height, gender, activityLevel, tdee }) {
  const gaining = goalWeight > currentWeight;
  const staticDailyAdjustment = ((currentWeight - goalWeight) * KCAL_PER_KG_BODY_MASS) / Math.max(1, days);

  if (currentWeight === goalWeight) {
    return {
      feasible: true,
      target: tdee,
      dailyAdjustment: 0,
      simpleTarget: tdee,
      boundaryWeight: currentWeight,
    };
  }

  const boundaryCalories = gaining ? 10000 : 0;
  const boundary = simulateWeightFromCalories({
    startWeight: currentWeight,
    dailyCalories: boundaryCalories,
    days,
    age,
    height,
    gender,
    activityLevel,
  });
  const feasible = gaining ? boundary.finalWeight >= goalWeight : boundary.finalWeight <= goalWeight;

  if (!feasible) {
    return {
      feasible: false,
      target: null,
      dailyAdjustment: Math.round(staticDailyAdjustment),
      simpleTarget: Math.round(tdee - staticDailyAdjustment),
      boundaryWeight: Number(boundary.finalWeight.toFixed(1)),
    };
  }

  const target = findCaloriesForGoal({
    currentWeight,
    goalWeight,
    days,
    age,
    height,
    gender,
    activityLevel,
    minCalories: 0,
    maxCalories: 10000,
  });

  return {
    feasible: true,
    target,
    dailyAdjustment: Math.round(tdee - target),
    simpleTarget: target,
    boundaryWeight: Number(boundary.finalWeight.toFixed(1)),
  };
}

function estimateWeeksToGoalFromCalories({ currentWeight, goalWeight, dailyCalories, age, height, gender, activityLevel, maxWeeks = 260 }) {
  const gaining = goalWeight > currentWeight;
  let weight = currentWeight;
  const multiplier = getActivityMultiplier(activityLevel);
  const maxDays = maxWeeks * 7;

  for (let day = 1; day <= maxDays; day += 1) {
    const bmr = getMifflinBmr(weight, height, (Number(age) || 28) + (day / 365), gender);
    const tdee = Math.max(900, bmr * multiplier);
    weight += (dailyCalories - tdee) / KCAL_PER_KG_BODY_MASS;
    weight = clampNumber(weight, 25, 350);
    if (gaining ? weight >= goalWeight : weight <= goalWeight) return Math.ceil(day / 7);
  }

  return null;
}

function getHydrationPlan({ weightKg, gender = 'male', activityLevel = 'moderate' }) {
  const weight = Number(weightKg) || (gender === 'female' ? 62 : 78);
  const referenceWeight = gender === 'female' ? 62 : 78;
  const nasemBeverageBaseline = gender === 'female' ? 2200 : 3000;
  const bodySizeMl = weight * 32;
  const sizeAdjustedBaseline = nasemBeverageBaseline + ((weight - referenceWeight) * 12);
  const activityWater = { sedentary: 0, light: 250, moderate: 450, active: 700, veryactive: 950 }[activityLevel] || 450;
  const waterMl = Math.round(clampNumber((sizeAdjustedBaseline * 0.6) + (bodySizeMl * 0.4) + activityWater, 1500, 6000) / 100) * 100;

  return {
    waterMl,
    baseMl: Math.round(((sizeAdjustedBaseline * 0.6) + (bodySizeMl * 0.4)) / 100) * 100,
    activityMl: activityWater,
  };
}

function getNutritionPlan({ currentWeight, goalWeight, weeks, age, height, gender = 'male', activityLevel = 'moderate' }) {
  const cw = Number(currentWeight);
  const gw = Number(goalWeight);
  const durationWeeks = Math.max(1, Number(weeks) || 1);
  const durationDays = durationWeeks * 7;
  const userAge = Number(age) || 28;
  const userHeight = Number(height) || (gender === 'female' ? 166 : 178);
  const multiplier = getActivityMultiplier(activityLevel);
  const bmr = getMifflinBmr(cw, userHeight, userAge, gender);
  const goalBmr = getMifflinBmr(gw, userHeight, userAge + (durationWeeks / 52), gender);
  const tdee = Math.round(bmr * multiplier);
  const goalMaintenance = Math.round(goalBmr * multiplier);
  const goalType = gw < cw ? 'cut' : gw > cw ? 'bulk' : 'maintain';
  const isTeen = userAge < 18;
  const requestedPlan = getRequestedTimeframePlan({
    currentWeight: cw,
    goalWeight: gw,
    days: durationDays,
    age: userAge,
    height: userHeight,
    gender,
    activityLevel,
    tdee,
  });
  const targetFloor = isTeen ? (gender === 'female' ? 1600 : 1800) : (gender === 'female' ? 1200 : 1500);
  const targetCeiling = Math.max(targetFloor + 300, Math.round(tdee * 1.2));
  const rawTarget = goalType === 'maintain'
    ? tdee
    : findCaloriesForGoal({
        currentWeight: cw,
        goalWeight: gw,
        days: durationDays,
        age: userAge,
        height: userHeight,
        gender,
        activityLevel,
        minCalories: targetFloor,
        maxCalories: targetCeiling,
      });
  const safeLossKgPerWeek = isTeen ? Math.min(0.45, Math.max(0.15, cw * 0.005)) : Math.min(0.9, Math.max(0.25, cw * 0.01));
  const safeGainKgPerWeek = isTeen ? Math.min(0.25, Math.max(0.1, cw * 0.0025)) : Math.min(0.5, Math.max(0.15, cw * 0.005));
  const maxDeficit = Math.round(Math.min(isTeen ? tdee * 0.1 : tdee * 0.3, 1000, (safeLossKgPerWeek * KCAL_PER_KG_BODY_MASS) / 7));
  const maxSurplus = Math.round(Math.min(isTeen ? tdee * 0.08 : tdee * 0.15, 500, (safeGainKgPerWeek * KCAL_PER_KG_BODY_MASS) / 7));
  const target = goalType === 'cut'
    ? Math.round(clampNumber(rawTarget, Math.max(targetFloor, tdee - maxDeficit), tdee))
    : goalType === 'bulk'
      ? Math.round(clampNumber(rawTarget, tdee, Math.min(targetCeiling, tdee + maxSurplus)))
      : tdee;
  const simulated = simulateWeightFromCalories({
    startWeight: cw,
    dailyCalories: target,
    days: durationDays,
    age: userAge,
    height: userHeight,
    gender,
    activityLevel,
  });
  const recommendedWeeks = goalType === 'maintain' ? durationWeeks : estimateWeeksToGoalFromCalories({
    currentWeight: cw,
    goalWeight: gw,
    dailyCalories: target,
    age: userAge,
    height: userHeight,
    gender,
    activityLevel,
  });
  const rawDailyAdjustment = Math.round(tdee - rawTarget);
  const dailyAdjustment = Math.round(tdee - target);
  const proteinFactor = goalType === 'cut' ? 2.0 : goalType === 'bulk' ? 1.8 : 1.6;
  const proteinG = Math.round(Math.min(cw * proteinFactor, (target * 0.35) / 4));
  const fatFloor = Math.round(Math.min(cw * 0.6, (target * 0.2) / 9));
  const fatTarget = Math.round(target * 0.27 / 9);
  const fatG = Math.round(clampNumber(fatTarget, fatFloor, (target * 0.35) / 9));
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));
  const hydration = getHydrationPlan({ weightKg: cw, gender, activityLevel });
  const capped = Math.abs(rawTarget - target) > 25;
  const desiredWeeklyChange = (gw - cw) / durationWeeks;
  const projectedWeeklyChange = (simulated.finalWeight - cw) / durationWeeks;

  return {
    bmr: Math.round(bmr),
    tdee,
    goalMaintenance,
    averageTdee: Math.round(simulated.averageTdee),
    target,
    rawDailyAdjustment,
    dailyAdjustment,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
    waterMl: hydration.waterMl,
    waterBaseMl: hydration.baseMl,
    waterActivityMl: hydration.activityMl,
    goalType,
    capped,
    isTeen,
    requestedWeeks: durationWeeks,
    requestedFeasible: requestedPlan.feasible,
    requestedTarget: requestedPlan.target,
    requestedDailyAdjustment: requestedPlan.dailyAdjustment,
    requestedSimpleTarget: requestedPlan.simpleTarget,
    requestedBoundaryWeight: requestedPlan.boundaryWeight,
    desiredWeeklyChange,
    projectedWeeklyChange,
    predictedWeight: Number(simulated.finalWeight.toFixed(1)),
    recommendedWeeks,
    safeLossKgPerWeek,
    safeGainKgPerWeek,
  };
}

async function fetchLoginLogs(email = '') {
  if (email && API_URL && getJwt(email)) {
    const rows = await apiCall(email, '/api/admin/logs');
    if (Array.isArray(rows)) {
      return rows.map((entry) => ({
        email: entry.email,
        type: entry.type,
        ts: entry.timestamp || entry.ts || new Date().toISOString(),
        ip: entry.ip,
      }));
    }
  }
  try { return JSON.parse(localStorage.getItem(LOGINS_KEY) || '[]'); } catch { return []; }
}

async function pushLoginLog(email, type) {
  recordLogin(email, type);
}

function loadLoginLogs() { try { return JSON.parse(localStorage.getItem(LOGINS_KEY) || '[]'); } catch { return []; } }
function loadPresence() { try { return JSON.parse(localStorage.getItem(PRESENCE_KEY) || '[]'); } catch { return []; } }
function savePresence(list) { localStorage.setItem(PRESENCE_KEY, JSON.stringify(list)); }
async function pushPresence(email) {
  const ua = navigator.userAgent.slice(0, 80);
  const entry = { email, ts: new Date().toISOString(), ua };
  const list = loadPresence().filter(p => p.email !== email);
  list.push(entry);
  savePresence(list.slice(-200));
}
async function fetchPresence() {
  return loadPresence();
}

function mergeById(local, remote) {
  if (!Array.isArray(remote) || !remote.length) return local;
  const ids = new Set(local.map(i => i.id));
  return [...local, ...remote.filter(i => !ids.has(i.id))];
}

function mergeStrings(local, remote) {
  if (!Array.isArray(remote) || !remote.length) return local;
  return [...new Set([...local, ...remote])];
}

async function applyRemoteData(email, remoteData) {
  if (!remoteData) return;
  const lw = loadWorkouts(email);
  const mw = mergeById(lw, (remoteData.workouts || []).map(normalizeWorkout));
  if (mw.length > lw.length) localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify(mw));
  const lc = loadCalories(email);
  const mc = mergeById(lc, remoteData.calorieEntries || remoteData.calories || []);
  if (mc.length > lc.length) localStorage.setItem(getCaloriesStorageKey(email), JSON.stringify(mc));
  const lb = loadBodyWeight(email);
  const mb = mergeById(lb, remoteData.bodyWeightEntries || remoteData.bodyWeight || []);
  if (mb.length > lb.length) localStorage.setItem(getBodyWeightKey(email), JSON.stringify(mb));
  const lr = loadRestDays(email); const mr = mergeStrings(lr, remoteData.restDays || []);
  if (mr.length > lr.length) localStorage.setItem(getRestKey(email), JSON.stringify(mr));
  const lch = loadCheatDays(email); const mch = mergeStrings(lch, remoteData.cheatDays || []);
  if (mch.length > lch.length) localStorage.setItem(getCheatKey(email), JSON.stringify(mch));
  const lcalh = loadCalHistory(email);
  const mcalh = mergeById(lcalh, remoteData.calHistory || []);
  if (mcalh.length > lcalh.length) localStorage.setItem(getCalHistoryKey(email), JSON.stringify(mcalh));
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function legacySha256(value) {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function hashPassword(value) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(value, storedHash) {
  if (typeof storedHash !== 'string') return false;
  if (!storedHash.startsWith('pbkdf2$')) {
    return constantTimeEqual(await legacySha256(value), storedHash);
  }
  const [, iterationsRaw, saltRaw, expectedRaw] = storedHash.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !saltRaw || !expectedRaw) return false;
  try {
    const salt = base64ToBytes(saltRaw);
    const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256
    );
    return constantTimeEqual(bytesToBase64(new Uint8Array(bits)), expectedRaw);
  } catch {
    return false;
  }
}

function shouldUpgradePasswordHash(storedHash) {
  if (typeof storedHash !== 'string') return true;
  if (!storedHash.startsWith('pbkdf2$')) return true;
  const iterations = Number(storedHash.split('$')[1]);
  return !iterations || iterations < PBKDF2_ITERATIONS;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'letmein', 'welcome', 'admin', 'iloveyou',
  'powergraph', 'fitness', 'workout', 'slovenia', 'geslo', 'geslo123',
]);

function getPasswordChecks(password, email) {
  const value = password || '';
  const emailLocal = (email || '').split('@')[0].toLowerCase();
  const lower = value.toLowerCase();
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  return {
    length: value.length >= 10,
    variety: value.length >= 14 || varietyCount >= 3,
    noEmail: !emailLocal || emailLocal.length < 3 || !lower.includes(emailLocal),
    common: value.length > 0 && !COMMON_PASSWORDS.has(lower) && !/(.)\1{5,}/.test(value) && !/^(123|abc|qwe|asd)/i.test(value),
  };
}

function getPasswordScore(password, email) {
  const checks = getPasswordChecks(password, email);
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, ok: checks.length && checks.noEmail && checks.common && score >= 3 };
}

function formatAuthWait(ms, lang) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return lang === 'sl' ? `${minutes} min` : `${minutes} min`;
}

function getAuthThrottleKey(email) { return `${AUTH_THROTTLE_KEY_PREFIX}${email || 'unknown'}`; }

function loadAuthThrottle(email) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getAuthThrottleKey(email)) || '{}');
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function getAuthLockRemaining(email) {
  const throttle = loadAuthThrottle(email);
  return Math.max(0, throttle.lockedUntil - Date.now());
}

function recordAuthFailure(email) {
  const throttle = loadAuthThrottle(email);
  const attempts = throttle.lockedUntil > Date.now() ? throttle.attempts : throttle.attempts + 1;
  const lockedUntil = attempts >= AUTH_MAX_ATTEMPTS ? Date.now() + AUTH_LOCK_MS : 0;
  localStorage.setItem(getAuthThrottleKey(email), JSON.stringify({ attempts, lockedUntil }));
}

function clearAuthThrottle(email) {
  localStorage.removeItem(getAuthThrottleKey(email));
}

function formatDateValue(dateString, format) {
  const [y, m, d] = dateString.split('-');
  if (!y) return dateString;
  if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  return `${d}.${m}.${y}`;
}

function calculateStreak(workouts) {
  const dates = [...new Set(workouts.map((w) => w.date))].sort().reverse();
  if (!dates.length) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i += 1) {
    if (Math.round((new Date(dates[i - 1]) - new Date(dates[i])) / 86400000) === 1) streak += 1;
    else break;
  }
  return streak;
}

function loadWorkouts(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getWorkoutStorageKey(email)) || 'null');
    return Array.isArray(stored) ? stored.map(normalizeWorkout) : [];
  } catch {
    return [];
  }
}

function loadSettings(email) {
  if (!email) return defaultSettings;
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(getSettingsStorageKey(email)) || 'null') || {});
  } catch {
    return defaultSettings;
  }
}

function loadCalories(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getCaloriesStorageKey(email)) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function callGemini(email, parts, options = {}) {
  const data = await apiCall(email, '/api/gemini', 'POST', { parts, ...options });
  return typeof data?.text === 'string' ? data.text : null;
}

const MUSCLE_PREFERRED_VIEW = {
  Chest: 'front',
  Back: 'back',
  Shoulders: 'front',
  Biceps: 'front',
  Triceps: 'back',
  Forearms: 'front',
  Legs: 'front',
  Abs: 'front',
  'Stamina/Cardio': 'front',
};


const VECTOR_ATLAS_ZONES = {
  front: {
    Chest: {
      paths: {
        male: [
          'M82 118 C91 101 113 99 120 116 L120 149 C108 157 88 152 82 139 C78 131 78 124 82 118 Z',
          'M158 118 C149 101 127 99 120 116 L120 149 C132 157 152 152 158 139 C162 131 162 124 158 118 Z',
        ],
        female: [
          'M86 120 C95 104 113 105 120 121 L120 147 C108 154 91 151 86 139 C82 131 82 125 86 120 Z',
          'M154 120 C145 104 127 105 120 121 L120 147 C132 154 149 151 154 139 C158 131 158 125 154 120 Z',
        ],
      },
      fibers: ['M86 132 C97 126 109 123 119 124', 'M154 132 C143 126 131 123 121 124', 'M88 145 C101 148 111 148 120 145', 'M152 145 C139 148 129 148 120 145'],
    },
    Shoulders: {
      paths: {
        male: ['M58 105 C66 93 82 94 91 108 C88 127 80 143 64 149 C54 142 51 119 58 105 Z', 'M182 105 C174 93 158 94 149 108 C152 127 160 143 176 149 C186 142 189 119 182 105 Z'],
        female: ['M64 106 C71 96 83 96 90 109 C87 125 80 140 67 145 C58 138 57 119 64 106 Z', 'M176 106 C169 96 157 96 150 109 C153 125 160 140 173 145 C182 138 183 119 176 106 Z'],
      },
    },
    Biceps: {
      paths: {
        male: ['M50 151 C60 149 69 158 68 178 C67 204 61 225 49 234 C39 218 40 171 50 151 Z', 'M190 151 C180 149 171 158 172 178 C173 204 179 225 191 234 C201 218 200 171 190 151 Z'],
        female: ['M56 148 C64 148 70 158 69 177 C68 202 62 220 53 228 C45 214 46 166 56 148 Z', 'M184 148 C176 148 170 158 171 177 C172 202 178 220 187 228 C195 214 194 166 184 148 Z'],
      },
      fibers: ['M55 162 C49 180 49 207 54 224', 'M185 162 C191 180 191 207 186 224'],
    },
    Forearms: {
      paths: {
        male: ['M45 235 C55 235 61 248 59 272 C57 303 50 329 38 338 C29 316 34 260 45 235 Z', 'M195 235 C185 235 179 248 181 272 C183 303 190 329 202 338 C211 316 206 260 195 235 Z'],
        female: ['M50 229 C58 230 63 244 60 269 C58 299 52 320 42 328 C34 308 39 252 50 229 Z', 'M190 229 C182 230 177 244 180 269 C182 299 188 320 198 328 C206 308 201 252 190 229 Z'],
      },
      fibers: ['M47 244 C42 274 41 305 43 326', 'M193 244 C198 274 199 305 197 326'],
    },
    Abs: {
      paths: {
        male: [
          'M100 157 C106 153 115 154 119 160 L119 184 C114 188 105 188 100 184 Z',
          'M121 160 C125 154 134 153 140 157 L140 184 C135 188 126 188 121 184 Z',
          'M99 188 C105 185 115 185 119 189 L119 215 C114 219 105 219 99 215 Z',
          'M121 189 C125 185 135 185 141 188 L141 215 C135 219 126 219 121 215 Z',
          'M101 219 C108 217 115 217 120 221 L120 241 C113 244 106 242 101 237 Z',
          'M120 221 C125 217 132 217 139 219 L139 237 C134 242 127 244 120 241 Z',
          'M86 158 C94 172 98 200 96 232 C88 224 82 197 82 174 C82 166 83 161 86 158 Z',
          'M154 158 C146 172 142 200 144 232 C152 224 158 197 158 174 C158 166 157 161 154 158 Z',
        ],
        female: [
          'M102 158 C108 155 115 155 119 161 L119 184 C114 187 107 187 102 184 Z',
          'M121 161 C125 155 132 155 138 158 L138 184 C133 187 126 187 121 184 Z',
          'M101 188 C107 185 115 185 119 190 L119 214 C114 218 107 218 101 214 Z',
          'M121 190 C125 185 133 185 139 188 L139 214 C133 218 126 218 121 214 Z',
          'M103 218 C109 217 115 217 120 221 L120 238 C114 241 108 240 103 236 Z',
          'M120 221 C125 217 131 217 137 218 L137 236 C132 240 126 241 120 238 Z',
          'M90 160 C96 174 100 198 98 227 C91 219 87 196 87 175 C87 167 88 162 90 160 Z',
          'M150 160 C144 174 140 198 142 227 C149 219 153 196 153 175 C153 167 152 162 150 160 Z',
        ],
      },
      fibers: ['M120 158 L120 241', 'M100 185 C110 188 130 188 140 185', 'M99 216 C110 219 130 219 141 216'],
    },
    Legs: {
      paths: {
        male: [
          'M78 271 C90 261 107 264 113 282 C116 316 110 352 101 381 C90 386 80 381 75 368 C74 333 73 298 78 271 Z',
          'M162 271 C150 261 133 264 127 282 C124 316 130 352 139 381 C150 386 160 381 165 368 C166 333 167 298 162 271 Z',
          'M78 379 C91 387 101 386 108 376 C111 410 108 455 99 486 C87 491 76 482 77 459 C78 429 73 405 78 379 Z',
          'M162 379 C149 387 139 386 132 376 C129 410 132 455 141 486 C153 491 164 482 163 459 C162 429 167 405 162 379 Z',
        ],
        female: [
          'M75 273 C88 263 107 266 113 286 C116 319 111 351 101 379 C88 386 77 380 72 365 C71 333 70 299 75 273 Z',
          'M165 273 C152 263 133 266 127 286 C124 319 129 351 139 379 C152 386 163 380 168 365 C169 333 170 299 165 273 Z',
          'M78 377 C91 386 101 384 107 375 C110 410 106 452 97 482 C85 487 76 479 77 456 C78 426 74 404 78 377 Z',
          'M162 377 C149 386 139 384 133 375 C130 410 134 452 143 482 C155 487 164 479 163 456 C162 426 166 404 162 377 Z',
        ],
      },
      fibers: ['M92 276 C96 309 94 345 83 374', 'M148 276 C144 309 146 345 157 374', 'M91 390 C94 421 92 456 87 484', 'M149 390 C146 421 148 456 153 484'],
    },
    'Stamina/Cardio': {
      paths: ['M120 130 C116 122 104 122 104 133 C104 143 120 155 120 155 C120 155 136 143 136 133 C136 122 124 122 120 130 Z'],
      fibers: ['M111 139 L118 139 L122 131 L127 145 L131 139'],
    },
  },
  back: {
    Back: {
      paths: {
        male: [
          'M88 95 C98 82 142 82 152 95 C168 122 167 163 158 198 C151 224 139 246 127 255 L120 239 L113 255 C101 246 89 224 82 198 C73 163 72 122 88 95 Z',
          'M84 143 C90 163 98 190 111 229 C99 225 82 211 75 188 C70 168 73 151 84 143 Z',
          'M156 143 C150 163 142 190 129 229 C141 225 158 211 165 188 C170 168 167 151 156 143 Z',
        ],
        female: [
          'M91 96 C101 84 139 84 149 96 C162 121 162 158 154 193 C148 218 137 239 127 249 L120 234 L113 249 C103 239 92 218 86 193 C78 158 78 121 91 96 Z',
          'M87 144 C93 164 101 187 112 219 C101 216 86 204 80 185 C75 166 78 151 87 144 Z',
          'M153 144 C147 164 139 187 128 219 C139 216 154 204 160 185 C165 166 162 151 153 144 Z',
        ],
      },
      fibers: ['M120 91 L120 239', 'M96 104 C104 121 113 132 120 137', 'M144 104 C136 121 127 132 120 137', 'M89 151 C98 177 107 203 116 229', 'M151 151 C142 177 133 203 124 229'],
    },
    Shoulders: {
      paths: {
        male: ['M58 106 C66 94 82 95 91 109 C88 127 80 143 64 148 C54 141 51 120 58 106 Z', 'M182 106 C174 94 158 95 149 109 C152 127 160 143 176 148 C186 141 189 120 182 106 Z'],
        female: ['M64 107 C71 97 83 97 90 110 C87 125 80 140 67 145 C58 138 57 120 64 107 Z', 'M176 107 C169 97 157 97 150 110 C153 125 160 140 173 145 C182 138 183 120 176 107 Z'],
      },
    },
    Triceps: {
      paths: {
        male: ['M51 150 C62 151 69 163 69 185 C68 212 61 239 50 250 C38 231 40 171 51 150 Z', 'M189 150 C178 151 171 163 171 185 C172 212 179 239 190 250 C202 231 200 171 189 150 Z'],
        female: ['M56 149 C65 150 70 163 70 184 C69 208 63 232 53 242 C44 226 46 169 56 149 Z', 'M184 149 C175 150 170 163 170 184 C171 208 177 232 187 242 C196 226 194 169 184 149 Z'],
      },
      fibers: ['M57 160 C53 184 53 217 56 241', 'M183 160 C187 184 187 217 184 241'],
    },
    Forearms: {
      paths: {
        male: ['M47 246 C57 247 62 260 59 284 C56 314 49 337 37 346 C30 321 35 267 47 246 Z', 'M193 246 C183 247 178 260 181 284 C184 314 191 337 203 346 C210 321 205 267 193 246 Z'],
        female: ['M51 239 C59 240 63 254 60 278 C57 306 52 328 42 336 C35 314 40 260 51 239 Z', 'M189 239 C181 240 177 254 180 278 C183 306 188 328 198 336 C205 314 200 260 189 239 Z'],
      },
    },
    Legs: {
      paths: {
        male: [
          'M78 270 C90 262 107 265 113 285 C115 319 111 352 101 379 C89 384 80 378 76 365 C74 331 73 295 78 270 Z',
          'M162 270 C150 262 133 265 127 285 C125 319 129 352 139 379 C151 384 160 378 164 365 C166 331 167 295 162 270 Z',
          'M78 378 C91 386 101 384 108 374 C111 407 107 454 98 487 C86 491 76 481 77 458 C78 428 73 403 78 378 Z',
          'M162 378 C149 386 139 384 132 374 C129 407 133 454 142 487 C154 491 164 481 163 458 C162 428 167 403 162 378 Z',
        ],
        female: [
          'M75 271 C88 263 107 267 113 287 C115 319 110 350 100 377 C88 384 77 377 73 364 C71 331 70 296 75 271 Z',
          'M165 271 C152 263 133 267 127 287 C125 319 130 350 140 377 C152 384 163 377 167 364 C169 331 170 296 165 271 Z',
          'M78 377 C90 386 101 384 107 374 C110 408 106 452 97 482 C85 487 76 479 77 456 C78 426 74 404 78 377 Z',
          'M162 377 C150 386 139 384 133 374 C130 408 134 452 143 482 C155 487 164 479 163 456 C162 426 166 404 162 377 Z',
        ],
      },
      fibers: ['M91 284 C95 315 94 346 84 373', 'M149 284 C145 315 146 346 156 373', 'M91 390 C94 421 92 456 87 484', 'M149 390 C146 421 148 456 153 484'],
    },
  },
};

function getVectorZonePaths(zone, gender) {
  return Array.isArray(zone.paths) ? zone.paths : (zone.paths?.[gender] || zone.paths?.male || []);
}

function AtlasBaseBody({ gender, view }) {
  const female = gender === 'female';
  const back = view === 'back';
  const gradientId = `atlasSkin${female ? 'Female' : 'Male'}${back ? 'Back' : 'Front'}`;
  return (
    <g className="atlas-base-body">
      <defs>
        <linearGradient id={gradientId} x1="54" x2="186" y1="28" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8fafc" stopOpacity="0.95" />
          <stop offset="0.48" stopColor="#cbd5e1" stopOpacity="0.86" />
          <stop offset="1" stopColor="#94a3b8" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <ellipse className="atlas-skin atlas-head" style={{ fill: `url(#${gradientId})` }} cx="120" cy="42" rx={female ? 20 : 22} ry={female ? 26 : 27} />
      <ellipse className="atlas-skin atlas-ear" style={{ fill: `url(#${gradientId})` }} cx={female ? 99 : 97} cy="44" rx={female ? 3.2 : 3.6} ry={female ? 6.8 : 7.2} />
      <ellipse className="atlas-skin atlas-ear" style={{ fill: `url(#${gradientId})` }} cx={female ? 141 : 143} cy="44" rx={female ? 3.2 : 3.6} ry={female ? 6.8 : 7.2} />
      <path className="atlas-skin atlas-neck" style={{ fill: `url(#${gradientId})` }} d={female ? 'M105 66 C110 76 130 76 135 66 L136 91 C128 96 112 96 104 91 Z' : 'M103 66 C109 78 131 78 137 66 L139 92 C130 99 110 99 101 92 Z'} />
      <path className="atlas-skin atlas-torso" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M65 104 C78 89 99 88 120 93 C141 88 162 89 175 104 C164 119 160 174 154 224 C150 253 90 253 86 224 C80 174 76 119 65 104 Z'
        : 'M58 102 C75 84 99 86 120 92 C141 86 165 84 182 102 C169 120 162 176 154 225 C150 252 90 252 86 225 C78 176 71 120 58 102 Z'} />
      <path className="atlas-skin atlas-pelvis" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M91 229 C105 246 135 246 149 229 C161 251 169 275 167 298 C154 309 136 305 120 295 C104 305 86 309 73 298 C71 275 79 251 91 229 Z'
        : 'M90 229 C104 244 136 244 150 229 C158 250 164 271 162 292 C148 301 132 298 120 289 C108 298 92 301 78 292 C76 271 82 250 90 229 Z'} />
      <path className="atlas-skin atlas-arm-left" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M66 116 C50 139 42 179 42 224 C44 249 48 289 40 333 C58 329 65 293 68 256 C71 213 76 164 86 124 Z'
        : 'M59 116 C42 140 34 178 36 224 C38 251 43 293 36 342 C55 337 64 301 67 260 C70 215 77 164 88 123 Z'} />
      <path className="atlas-skin atlas-arm-right" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M174 116 C190 139 198 179 198 224 C196 249 192 289 200 333 C182 329 175 293 172 256 C169 213 164 164 154 124 Z'
        : 'M181 116 C198 140 206 178 204 224 C202 251 197 293 204 342 C185 337 176 301 173 260 C170 215 163 164 152 123 Z'} />
      <path className="atlas-skin atlas-leg-left" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M75 298 C90 304 107 301 120 291 C115 343 112 424 99 491 C87 497 76 489 76 464 C77 411 67 349 75 298 Z'
        : 'M78 292 C93 300 108 297 120 288 C116 342 112 426 99 491 C86 497 76 489 76 463 C78 410 69 344 78 292 Z'} />
      <path className="atlas-skin atlas-leg-right" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M165 298 C150 304 133 301 120 291 C125 343 128 424 141 491 C153 497 164 489 164 464 C163 411 173 349 165 298 Z'
        : 'M162 292 C147 300 132 297 120 288 C124 342 128 426 141 491 C154 497 164 489 164 463 C162 410 171 344 162 292 Z'} />
      <path className="atlas-skin atlas-foot-left" style={{ fill: `url(#${gradientId})` }} d={female ? 'M78 486 C86 497 98 498 105 490 C108 500 99 506 83 505 C72 504 70 496 78 486 Z' : 'M77 486 C86 498 99 499 106 490 C111 501 100 507 82 506 C70 505 68 495 77 486 Z'} />
      <path className="atlas-skin atlas-foot-right" style={{ fill: `url(#${gradientId})` }} d={female ? 'M135 490 C142 498 154 497 162 486 C170 496 168 504 157 505 C141 506 132 500 135 490 Z' : 'M134 490 C141 499 154 498 163 486 C172 495 170 505 158 506 C140 507 129 501 134 490 Z'} />
      <g className={`atlas-hair ${female ? 'atlas-hair-female' : 'atlas-hair-male'}`}>
        {female ? (
          back ? (
            <>
              <path className="atlas-hair-bun" d="M86 37 C83 25 91 17 102 19 C113 21 116 35 108 43 C100 51 89 48 86 37 Z" />
              <path className="atlas-hair-bun" d="M154 37 C157 25 149 17 138 19 C127 21 124 35 132 43 C140 51 151 48 154 37 Z" />
              <path className="atlas-hair-main" d="M98 38 C98 17 142 17 142 38 C143 62 133 78 120 80 C107 78 97 62 98 38 Z" />
              <path className="atlas-hair-lock" d="M101 53 C96 68 95 84 101 100 C91 87 88 68 95 49 Z" />
              <path className="atlas-hair-lock" d="M139 53 C144 68 145 84 139 100 C149 87 152 68 145 49 Z" />
            </>
          ) : (
            <>
              <path className="atlas-hair-loop" d="M113 20 C112 8 118 7 120 22 C122 7 128 8 127 20" />
              <path className="atlas-hair-bun" d="M84 39 C80 27 88 17 100 18 C112 19 116 34 108 43 C99 52 87 49 84 39 Z" />
              <path className="atlas-hair-bun" d="M156 39 C160 27 152 17 140 18 C128 19 124 34 132 43 C141 52 153 49 156 39 Z" />
              <path className="atlas-hair-main" d="M98 36 C101 17 139 17 142 36 C137 32 132 35 127 39 C124 29 116 29 113 39 C108 34 103 33 98 36 Z" />
              <path className="atlas-hair-bang" d="M101 34 C107 24 116 22 120 31 C114 34 109 40 108 50 C104 44 101 39 101 34 Z" />
              <path className="atlas-hair-bang" d="M120 31 C124 22 133 24 139 34 C139 39 136 44 132 50 C131 40 126 34 120 31 Z" />
              <path className="atlas-hair-lock" d="M101 45 C96 64 95 88 91 111 C99 102 106 72 107 44 Z" />
              <path className="atlas-hair-lock" d="M139 45 C144 64 145 88 149 111 C141 102 134 72 133 44 Z" />
            </>
          )
        ) : (
          back ? (
            <path className="atlas-hair-main" d="M98 32 C101 17 111 12 120 13 C130 12 139 17 142 32 C136 26 128 25 120 27 C112 25 104 26 98 32 Z" />
          ) : (
            <path className="atlas-hair-main" d="M95 35 C98 17 111 10 121 14 C130 9 142 19 145 35 C137 30 132 34 127 37 C123 29 115 29 111 38 C106 32 101 32 95 35 Z" />
          )
        )}
      </g>
      <g className="atlas-hands" style={{ '--atlas-skin-fill': `url(#${gradientId})` }}>
        <path className="atlas-skin atlas-hand-palm" d={female
          ? 'M39 324 C35 331 36 341 43 347 C49 346 53 337 51 329 C48 324 43 322 39 324 Z'
          : 'M35 333 C31 341 33 352 40 358 C47 358 52 348 50 338 C47 332 40 330 35 333 Z'} />
        <path className="atlas-skin atlas-hand-palm" d={female
          ? 'M201 324 C205 331 204 341 197 347 C191 346 187 337 189 329 C192 324 197 322 201 324 Z'
          : 'M205 333 C209 341 207 352 200 358 C193 358 188 348 190 338 C193 332 200 330 205 333 Z'} />
        <path className="atlas-skin atlas-thumb" d={female ? 'M39 333 C34 335 32 341 34 345 C38 345 41 339 42 334 Z' : 'M35 343 C30 345 28 352 31 356 C35 355 38 349 38 343 Z'} />
        <path className="atlas-skin atlas-thumb" d={female ? 'M201 333 C206 335 208 341 206 345 C202 345 199 339 198 334 Z' : 'M205 343 C210 345 212 352 209 356 C205 355 202 349 202 343 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M40 344 C38 349 38 354 41 356 C44 354 44 349 43 344 Z' : 'M37 352 C35 357 35 363 38 365 C41 363 41 357 40 352 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M44 345 C43 351 44 357 47 357 C50 355 49 350 48 345 Z' : 'M41 352 C40 359 41 366 44 366 C47 364 47 358 46 352 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M48 344 C48 350 50 355 53 354 C55 351 53 346 51 343 Z' : 'M46 351 C46 357 48 363 51 362 C53 359 52 354 49 351 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M200 344 C202 349 202 354 199 356 C196 354 196 349 197 344 Z' : 'M203 352 C205 357 205 363 202 365 C199 363 199 357 200 352 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M196 345 C197 351 196 357 193 357 C190 355 191 350 192 345 Z' : 'M199 352 C200 359 199 366 196 366 C193 364 193 358 194 352 Z'} />
        <path className="atlas-skin atlas-finger" d={female ? 'M192 344 C192 350 190 355 187 354 C185 351 187 346 189 343 Z' : 'M194 351 C194 357 192 363 189 362 C187 359 188 354 191 351 Z'} />
        <path className="atlas-hand-crease" d={female ? 'M39 337 C43 340 48 340 51 337' : 'M35 346 C40 349 46 349 50 346'} />
        <path className="atlas-hand-crease" d={female ? 'M201 337 C197 340 192 340 189 337' : 'M205 346 C200 349 194 349 190 346'} />
      </g>
      <g className="atlas-body-lines">
        <path d={back ? 'M120 88 L120 250' : 'M120 92 L120 247'} />
        <path d={female ? 'M82 228 C102 236 138 236 158 228' : 'M84 226 C103 235 137 235 156 226'} />
        <path d="M78 292 C94 304 108 298 120 288 C132 298 146 304 162 292" />
        <path d={female ? 'M70 142 C78 165 80 193 76 219' : 'M62 142 C72 166 75 195 70 224'} />
        <path d={female ? 'M170 142 C162 165 160 193 164 219' : 'M178 142 C168 166 165 195 170 224'} />
        <path d={female ? 'M70 221 C61 233 59 245 65 256' : 'M68 225 C59 237 57 250 64 262'} />
        <path d={female ? 'M170 221 C179 233 181 245 175 256' : 'M172 225 C181 237 183 250 176 262'} />
        <path d="M95 304 C96 356 91 425 87 487" />
        <path d="M145 304 C144 356 149 425 153 487" />
        {back ? (
          <>
            <path d="M92 106 C104 121 113 133 120 141 C127 133 136 121 148 106" />
            <path d="M91 129 C104 139 111 150 117 178" />
            <path d="M149 129 C136 139 129 150 123 178" />
            <path d="M88 171 C100 196 108 218 114 242" />
            <path d="M152 171 C140 196 132 218 126 242" />
          </>
        ) : (
          <>
            <path d="M84 124 C99 111 112 113 120 126 C128 113 141 111 156 124" />
            <path d="M86 150 C104 157 136 157 154 150" />
            <path d="M101 160 C109 166 113 180 113 238" />
            <path d="M139 160 C131 166 127 180 127 238" />
            <path d="M96 187 C108 191 132 191 144 187" />
            <path d="M98 218 C110 222 130 222 142 218" />
          </>
        )}
        <path d="M67 153 C58 181 56 207 61 235" />
        <path d="M173 153 C182 181 184 207 179 235" />
        <path d="M48 248 C45 278 44 309 41 335" />
        <path d="M192 248 C195 278 196 309 199 335" />
        <path d="M88 306 C101 329 104 355 98 383" />
        <path d="M152 306 C139 329 136 355 142 383" />
        <path d={female ? 'M82 381 C90 386 99 386 106 380' : 'M82 383 C91 388 101 387 108 379'} />
        <path d={female ? 'M134 380 C141 386 150 386 158 381' : 'M132 379 C139 387 149 388 158 383'} />
        <path d="M91 389 C95 419 94 453 89 486" />
        <path d="M149 389 C145 419 146 453 151 486" />
      </g>
      <g className="atlas-foot-lines">
        <path d={female ? 'M80 493 C88 498 96 498 103 492' : 'M78 494 C88 500 99 500 106 492'} />
        <path d={female ? 'M137 492 C144 498 152 498 160 493' : 'M134 492 C141 500 152 500 162 494'} />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="82" cy={female ? 501 : 502} rx="2.7" ry="3.8" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="88" cy={female ? 502 : 503} rx="2.4" ry="3.2" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="94" cy={female ? 501 : 502} rx="2.2" ry="2.9" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="100" cy={female ? 499 : 500} rx="2.1" ry="2.6" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="158" cy={female ? 501 : 502} rx="2.7" ry="3.8" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="152" cy={female ? 502 : 503} rx="2.4" ry="3.2" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="146" cy={female ? 501 : 502} rx="2.2" ry="2.9" />
        <ellipse className="atlas-toe" style={{ fill: `url(#${gradientId})` }} cx="140" cy={female ? 499 : 500} rx="2.1" ry="2.6" />
      </g>
    </g>
  );
}

function AnatomyRankModel({ selected, onSelect, gender = 'male', language = 'en', muscleStats = {}, sectionNames = {} }) {
  const preferredView = MUSCLE_PREFERRED_VIEW[selected] || 'front';
  const [view, setView] = useState(preferredView);
  useEffect(() => { setView(preferredView); }, [preferredView]);

  const showBack = view === 'back';
  const zones = VECTOR_ATLAS_ZONES[view] || {};
  const modelLabel = gender === 'female'
    ? (language === 'sl' ? 'Zenski model' : 'Female model')
    : (language === 'sl' ? 'Moski model' : 'Male model');
  const viewLabel = showBack
    ? (language === 'sl' ? 'Zadnji pogled' : 'Back view')
    : (language === 'sl' ? 'Sprednji pogled' : 'Front view');

  const selectMuscle = (muscleKey) => {
    setView(MUSCLE_PREFERRED_VIEW[muscleKey] || view);
    onSelect(muscleKey);
  };
  const zoneProps = (muscleKey) => {
    const data = muscleStats[muscleKey] || { volume: 0, rank: getMuscleRank(0, language) };
    const color = data.rank?.color || MUSCLE_COLORS[muscleKey] || '#38bdf8';
    const active = selected === muscleKey;
    return {
      fill: color,
      fillOpacity: active ? 0.62 : 0,
      stroke: color,
      strokeOpacity: active ? 0.96 : 0,
      strokeWidth: active ? 1.25 : 0.85,
      vectorEffect: 'non-scaling-stroke',
      pointerEvents: 'all',
      className: `muscle-zone ${active ? 'selected' : ''}`,
      style: { '--muscle-color': color, cursor: 'pointer' },
    };
  };
  const fiberProps = (muscleKey) => {
    const data = muscleStats[muscleKey] || { volume: 0, rank: getMuscleRank(0, language) };
    const color = data.rank?.color || MUSCLE_COLORS[muscleKey] || '#38bdf8';
    return {
      fill: 'none',
      stroke: color,
      strokeOpacity: selected === muscleKey ? 0.72 : 0,
      strokeWidth: 0.55,
      vectorEffect: 'non-scaling-stroke',
      className: 'muscle-fiber-line',
      pointerEvents: 'none',
    };
  };

  return (
    <div className="anatomy-rank-model">
      <div className="anatomy-model-meta">
        <span>{modelLabel}</span>
        <strong>{viewLabel}</strong>
      </div>
      <div className="anatomy-stage">
        <svg className="muscle-map-svg anatomy-atlas-svg" viewBox="0 0 240 520" role="img" aria-label={`${modelLabel} ${viewLabel}`}>
          <AtlasBaseBody gender={gender} view={view} />
          <g className="atlas-muscle-zones">
            {Object.entries(zones).map(([muscleKey, zone]) => (
              <g
                key={muscleKey}
                role="button"
                tabIndex={0}
                aria-label={sectionNames[muscleKey] || muscleKey}
                data-muscle={muscleKey}
                onClick={() => selectMuscle(muscleKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectMuscle(muscleKey);
                  }
                }}
              >
                {getVectorZonePaths(zone, gender).map((d, index) => <path key={`${muscleKey}-p-${index}`} d={d} {...zoneProps(muscleKey)} />)}
                {(zone.fibers || []).map((d, index) => <path key={`${muscleKey}-f-${index}`} d={d} {...fiberProps(muscleKey)} />)}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="anatomy-view-toggle" role="group" aria-label={language === 'sl' ? 'Pogled modela' : 'Model view'}>
        <button className={view === 'front' ? 'active' : ''} type="button" onClick={() => setView('front')}>{language === 'sl' ? 'Spredaj' : 'Front'}</button>
        <button className={view === 'back' ? 'active' : ''} type="button" onClick={() => setView('back')}>{language === 'sl' ? 'Zadaj' : 'Back'}</button>
      </div>
    </div>
  );
}

export default function App() {
  const initialSessionEmail = localStorage.getItem(SESSION_KEY) || '';
  const fileInputRef = useRef(null);
  const calImageRef = useRef(null);
  const previousCountRef = useRef(0);
  const previousExerciseRef = useRef('Bench Press');
  const timerWorkerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const notifTimerRef = useRef(null);
  const timerEndAtRef = useRef(null);
  const timerAlarmFnRef = useRef(null);
  const bodyFatFrontRef = useRef(null);
  const bodyFatSideRef = useRef(null);
  const bodyFatBackRef = useRef(null);
  const mainContentRef = useRef(null);
  const commandInputRef = useRef(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const [currentUser, setCurrentUser] = useState(() => initialSessionEmail);
  const aiEnabled = Boolean(API_URL && currentUser && getJwt(currentUser));
  const [workouts, setWorkouts] = useState(() => loadWorkouts(initialSessionEmail));
  const [calorieEntries, setCalorieEntries] = useState(() => loadCalories(initialSessionEmail));
  const [settings, setSettings] = useState(() => loadSettings(initialSessionEmail));
  const [activeSection, setActiveSection] = useState(() => getInitialSection(initialSessionEmail));
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [toast, setToast] = useState('');
  const [swUpdatePending, setSwUpdatePending] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState('week');
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editingMealId, setEditingMealId] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '', gender: 'male' });
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirm, setShowAuthConfirm] = useState(false);
  const [authTouched, setAuthTouched] = useState({ email: false, password: false, confirmPassword: false });
  const [formData, setFormData] = useState(() => loadDraft(initialSessionEmail, 'workoutForm', getDefaultWorkoutForm()));
  const [calorieForm, setCalorieForm] = useState(() => loadDraft(initialSessionEmail, 'mealForm', getDefaultMealForm()));
  const [calQuery, setCalQuery] = useState('');
  const [calGrams, setCalGrams] = useState('');
  const [calResult, setCalResult] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
  const [calImage, setCalImage] = useState(null);
  const [calImageLoading, setCalImageLoading] = useState(false);
  const [calPhotoResult, setCalPhotoResult] = useState(null);
  const [calPhotoError, setCalPhotoError] = useState('');
  const [foodCorrectionText, setFoodCorrectionText] = useState('');
  const [calHistory, setCalHistory] = useState(() => loadCalHistory(initialSessionEmail));
  const [bodyWeightEntries, setBodyWeightEntries] = useState(() => loadBodyWeight(initialSessionEmail));
  const [bwForm, setBwForm] = useState(() => loadDraft(initialSessionEmail, 'bodyWeightForm', getDefaultBodyWeightForm()));
  const [tdeeForm, setTdeeForm] = useState(() => loadDraft(initialSessionEmail, 'tdeeForm', { currentWeight: '', goalWeight: '', weeks: '12', activityLevel: 'moderate', gender: settings.gender || 'male', age: settings.age || '', height: settings.height || '' }));
  const [tdeeResult, setTdeeResult] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerActive, setTimerActive] = useState(false);
  const [timerPreset, setTimerPreset] = useState(90);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const [adminLogs, setAdminLogs] = useState(null);
  const [adminPresence, setAdminPresence] = useState([]);
  const [adminBonus, setAdminBonus] = useState(() => loadAdminBonus(initialSessionEmail));
  const [adminConfig, setAdminConfig] = useState(() => loadAdminConfig());
  const [adminConfigDraft, setAdminConfigDraft] = useState(() => loadAdminConfig());
  const [adminAudit, setAdminAudit] = useState(() => loadAdminAudit());
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSelectedEmail, setAdminSelectedEmail] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [restDays, setRestDays] = useState(() => loadRestDays(initialSessionEmail));
  const [cheatDays, setCheatDays] = useState(() => loadCheatDays(initialSessionEmail));
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [formExSearch, setFormExSearch] = useState('');
  const [chartSection, setChartSection] = useState(null);
  const [ratings, setRatings] = useState(() => loadRatings());
  const [ratingForm, setRatingForm] = useState({ stars: 5, comment: '', privateComment: '' });
  const [timerDone, setTimerDone] = useState(false);
  const [advisorMode, setAdvisorMode] = useState('gym');
  const [advisorSplitId, setAdvisorSplitId] = useState('auto');
  const [customSplitSections, setCustomSplitSections] = useState([]);
  const [waterToday, setWaterToday] = useState(() => loadWaterMl(initialSessionEmail));
  const [waterCustomMl, setWaterCustomMl] = useState('');
  const [bannedUsers, setBannedUsers] = useState(() => loadBanned());
  const [modUsers, setModUsers] = useState(() => loadMods());
  const [timerCustomInput, setTimerCustomInput] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [helpTopic, setHelpTopic] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [customExercises, setCustomExercises] = useState(() => loadCustomExercises(initialSessionEmail));
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addExForm, setAddExForm] = useState({ name: '', section: 'Back' });
  const [addExLoading, setAddExLoading] = useState(false);
  const [addExError, setAddExError] = useState('');
  const [selectedRankMuscle, setSelectedRankMuscle] = useState('Chest');
  const initialIngredientDraft = loadDraft(initialSessionEmail, 'ingredientForm', { mode: 'quick', query: '', items: [{ name: '', grams: '100' }] });
  const [ingredientMode, setIngredientMode] = useState(() => initialIngredientDraft.mode === 'precise' ? 'precise' : 'quick');
  const [ingredientQuery, setIngredientQuery] = useState(() => typeof initialIngredientDraft.query === 'string' ? initialIngredientDraft.query : '');
  const [ingredientItems, setIngredientItems] = useState(() => Array.isArray(initialIngredientDraft.items) && initialIngredientDraft.items.length ? initialIngredientDraft.items : [{ name: '', grams: '100' }]);
  const [ingredientResults, setIngredientResults] = useState(null);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [ingredientError, setIngredientError] = useState('');
  const [bodyFatImages, setBodyFatImages] = useState({ front: null, side: null, back: null });
  const [bodyFatMetrics, setBodyFatMetrics] = useState({ gender: settings.gender || 'male', age: settings.age || '', height: settings.height || '', weight: '', waist: '', neck: '', hip: '' });
  const [bodyFatResult, setBodyFatResult] = useState(null);
  const [bodyFatHistory, setBodyFatHistory] = useState(() => loadBodyFatHistory(initialSessionEmail));
  const [bodyFatLoading, setBodyFatLoading] = useState(false);
  const [bodyFatError, setBodyFatError] = useState('');
  const [reverseCalDailyKcal, setReverseCalDailyKcal] = useState('');
  const [reverseCalResult, setReverseCalResult] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const copy = getCopy(settings.language);
  const sectionNames = { Chest: copy.chest, Legs: copy.legs, Triceps: copy.triceps, Biceps: copy.biceps, Forearms: copy.forearms, Shoulders: copy.shoulders, 'Stamina/Cardio': copy.cardio, Back: copy.back, Abs: copy.abs };
  const sectionDescriptions = {
    dashboard: settings.language === 'sl' ? 'Pregled napredka, statistike in hiter vnos novega treninga.' : 'A quick overview of progress, stats, and fast workout logging.',
    history: settings.language === 'sl' ? 'Preglej pretekle vnose in hitro preveri svoje zadnje treninge.' : 'Review past entries and quickly check your latest sessions.',
    exercises: settings.language === 'sl' ? 'Knjižnica vaj z opisi izvedbe, targeti in osnovnimi cue-ji.' : 'Exercise library with execution notes, targets, and key cues.',
    advisor: settings.language === 'sl' ? 'Pameten dnevni predlog na podlagi tvojih preteklih treningov.' : 'A smart daily suggestion based on your recent training history.',
    calories: settings.language === 'sl' ? 'Beleži obroke, kalorije in osnovne makrote po dnevih.' : 'Track meals, calories, and basic macros by day.',
    ocenjevalec: settings.language === 'sl' ? 'Vpiši jed in grame ter izvedi iskanje kalorij.' : 'Enter a food and grams to look up its calorie count.',
    rankings: settings.language === 'sl' ? 'Preglej povprecni misicni rang, volumen in napredek skozi vse stopnje.' : 'View your average muscle rank, volume, and progression through all tiers.',
    bodyweight: settings.language === 'sl' ? 'Sledi telesni teži in izračunaj dnevne kalorijske potrebe.' : 'Track your body weight and calculate your daily calorie needs.',
    settings: settings.language === 'sl' ? 'Uredi lokalne nastavitve, backup in prikaz podatkov.' : 'Adjust local preferences, backups, and data display.',
    ratings: settings.language === 'sl' ? 'Oceni aplikacijo z zvezdami in napiši predlog za izboljšavo.' : 'Rate the app with stars and write a suggestion for improvement.',
    admin: settings.language === 'sl' ? 'Nadzorni center za app kontrole, uporabnike, feedback, varnost in podatke.' : 'Control center for app settings, users, feedback, security and data.',
  };
  const guidedTutorialSteps = useMemo(() => {
    const sl = settings.language === 'sl';
    const t = (slText, enText) => (sl ? slText : enText);
    const steps = [
      {
        section: 'dashboard',
        target: 'section-intro',
        title: t('PowerGraph v 3 minutah', 'PowerGraph in 3 minutes'),
        body: t('Ta vodič ni samo tekst. Sam odpira pravi zavihek, oznaci funkcijo in ti pove, zakaj jo uporabljas.', 'This guide is not only text. It opens the right tab, highlights the feature, and explains why you use it.'),
        bullets: [t('Kjerkoli vidis ?, klikni za kratko razlago.', 'Wherever you see ?, click it for a short explanation.'), t('Naprej te bo vodil cez cel app.', 'Next walks you through the whole app.')],
      },
      {
        section: 'dashboard',
        target: 'navigation',
        title: t('Navigacija', 'Navigation'),
        body: t('Levi meni na racunalniku in spodnji meni na telefonu sta glavni zemljevid aplikacije.', 'The left menu on desktop and bottom menu on phone are the main map of the app.'),
        bullets: [t('Domov je hiter vnos treninga.', 'Home is fast workout logging.'), t('Teza, Obroki, Isci in Rang so povezani s cilji in napredkom.', 'Weight, Meals, Search, and Rank connect to goals and progress.')],
      },
      {
        section: 'dashboard',
        target: 'dashboard-overview',
        title: t('Domov in dnevni center', 'Home and daily control'),
        body: t('Tukaj vidis danasnji status: trening, kalorije, voda in osnovne statistike. To je najhitrejsi pogled na dan.', 'Here you see today: training, calories, water, and base stats. It is the fastest daily overview.'),
      },
      {
        section: 'dashboard',
        target: 'add-workout',
        title: t('Dodaj trening', 'Add a workout'),
        body: t('Izberi vajo, vnesi serije, ponovitve in tezo. Ta vnos hrani zgodovino, graf, osebne rekorde in misicne range.', 'Choose an exercise, enter sets, reps, and weight. This powers history, charts, personal records, and muscle ranks.'),
        bullets: [t('Weight-drop nacin omogoci razlicno tezo za vsak set.', 'Weight-drop mode lets each set have its own weight.'), t('Zadnja uporabljena teza se ponudi za hitrejsi vnos.', 'Last used weight is offered for faster logging.')],
      },
      {
        section: 'dashboard',
        target: 'timer-rest',
        title: t('Timer in pocitek', 'Timer and rest'),
        body: t('Timer je za pavze med seti. Rest day oznaka pove appu, da je danes nacrtovan pocitek, ne pozabljen trening.', 'The timer is for rest between sets. Rest day tells the app today is planned recovery, not a missed workout.'),
      },
      {
        section: 'history',
        target: 'history-log',
        title: t('Zgodovina treningov', 'Workout history'),
        body: t('Zgodovina je mesto za popravljanje, ponavljanje in brisanje treningov. Vsaka sprememba se odrazi v statistiki in rangih.', 'History is where you edit, repeat, and delete workouts. Every change updates stats and ranks.'),
      },
      {
        section: 'exercises',
        target: 'exercise-library',
        title: t('Knjiznica vaj', 'Exercise library'),
        body: t('Vaje so razdeljene na gym in calisthenics. Vsaka ima target, opremo, zahtevnost, izvedbo in cue-je.', 'Exercises are split into gym and calisthenics. Each has targets, equipment, difficulty, instructions, and cues.'),
        bullets: [t('Iskanje najde vaje po imenu.', 'Search finds exercises by name.'), t('Dodaj lahko tudi svojo vajo.', 'You can add your own exercise too.')],
      },
      {
        section: 'bodyweight',
        target: 'bodyweight-tracker',
        title: t('Telesna teza', 'Body weight'),
        body: t('Teza hrani trend in pomaga kalkulatorjem pri bolj realnih ciljih. Redni vnosi so boljsi kot en sam popoln vnos.', 'Weight stores your trend and helps calculators make more realistic targets. Regular entries beat one perfect entry.'),
      },
      {
        section: 'bodyweight',
        target: 'water-tracker',
        title: t('Voda', 'Water'),
        body: t('Voda ima hiter vnos po 250/500/750/1000 ml in osebni cilj. Cilj se lahko nastavi rocno ali iz kalkulatorja kalorij.', 'Water has quick 250/500/750/1000 ml logging and a personal goal. The goal can be manual or updated from the calorie calculator.'),
      },
      {
        section: 'bodyweight',
        target: 'calorie-calculator',
        title: t('Calorie calculator', 'Calorie calculator'),
        body: t('Kalkulator uporablja BMR, aktivnost, cilj, rok in varnostne omejitve. Ce je izbran rok preagresiven, prikaze varen cilj in razlozi zakaj.', 'The calculator uses BMR, activity, goal, timeframe, and safety caps. If the timeframe is too aggressive, it shows a safe target and explains why.'),
        bullets: [t('Izbran rok je se vedno prikazan v rezultatu.', 'Your selected timeframe is still shown in the result.'), t('Set as my goal shrani kalorije v Settings.', 'Set as my goal saves calories to Settings.')],
      },
      {
        section: 'calories',
        target: 'calorie-progress',
        title: t('Dnevni obroki', 'Daily meals'),
        body: t('Obroki primerjajo vnos s tvojim dnevnim ciljem. Advanced nacin prikaze se protein, ogljikove hidrate in mascobe.', 'Meals compare intake with your daily goal. Advanced mode also shows protein, carbs, and fat.'),
      },
      {
        section: 'calories',
        target: 'add-meal',
        title: t('Rocni vnos obroka', 'Manual meal entry'),
        body: t('Tukaj dodas obrok, popravis prejsnji vnos ali ponovno uporabis star obrok iz zgodovine.', 'Here you add a meal, edit an old entry, or reuse a previous meal from history.'),
      },
      {
        section: 'ocenjevalec',
        target: 'ingredient-tracker',
        title: t('AI / offline ocena hrane', 'AI / offline food estimate'),
        body: t('Quick nacin sprejme normalen opis hrane. Precise nacin je boljsi, ko poznas sestavine in grame. Ce AI ni povezan, app uporabi lokalno bazo.', 'Quick mode accepts a normal food description. Precise mode is better when you know ingredients and grams. If AI is not connected, the app uses the local database.'),
      },
      {
        section: 'ocenjevalec',
        target: 'body-fat-estimator',
        title: t('Body fat estimate', 'Body fat estimate'),
        body: t('Najboljsi rezultat dobis z visino, tezo, pasom, vratom, boki in 1-3 fotografijami. Rezultat je ocena, ne medicinska diagnoza.', 'Best results come from height, weight, waist, neck, hips, and 1-3 photos. The result is an estimate, not a medical diagnosis.'),
      },
      {
        section: 'rankings',
        target: 'muscle-rankings',
        title: t('Misicni rangi', 'Muscle ranks'),
        body: t('Klik na telo ali chip izbere misicno skupino. Barva in rang prideta iz tehtanega volumna vaj, ki dejansko trenirajo ta del.', 'Clicking the body or a chip selects a muscle group. Color and rank come from weighted volume of exercises that actually train that area.'),
      },
      {
        section: 'rankings',
        target: 'overall-rank',
        title: t('Skupni rang', 'Overall rank'),
        body: t('Skupni rang ni nakljucen. Je povprecje vseh misicnih skupin, zato neuravnotezen trening ne dvigne vsega na silo.', 'Overall rank is not random. It is the average of all muscle groups, so uneven training cannot drag everything up unfairly.'),
      },
      {
        section: 'advisor',
        target: 'advisor-panel',
        title: t('Advisor', 'Advisor'),
        body: t('Advisor predlaga trening glede na zadnje vnose in manj trenirane skupine. Uporabi ga, ko ne ves, kaj bi treniral danes.', 'Advisor suggests training based on recent logs and undertrained groups. Use it when you are not sure what to train today.'),
      },
      {
        section: 'settings',
        target: 'settings-main',
        title: t('Settings', 'Settings'),
        body: t('Settings je kontrolna soba: enote, jezik, barva ozadja, backup, calorie goal, tracker mode in install app.', 'Settings is the control room: units, language, background color, backup, calorie goal, tracker mode, and install app.'),
      },
      {
        section: 'settings',
        target: 'settings-appearance',
        title: t('Izgled in jezik', 'Appearance and language'),
        body: t('Tu izberes accent ozadja, jezik, format datuma in enote. Te nastavitve so shranjene na uporabnika.', 'Here you choose background accent, language, date format, and units. These settings are saved per user.'),
      },
      {
        section: 'settings',
        target: 'settings-data',
        title: t('Backup in podatki', 'Backup and data'),
        body: t('Export shrani kopijo podatkov, import jo nalozi nazaj, clear pa brise lokalne podatke. To so pomembne kontrole.', 'Export saves a copy of your data, import loads it back, and clear deletes local data. These are important controls.'),
      },
      {
        section: 'settings',
        target: 'settings-help',
        title: t('Tutorial in ? pomoc', 'Tutorial and ? help'),
        body: t('Ta vodič lahko vedno ponovno odpres tukaj. Za hitre razlage pa klikni ? ob funkcijah po aplikaciji.', 'You can always reopen this guide here. For quick explanations, click ? next to features across the app.'),
      },
      {
        section: 'settings',
        target: 'personal-targets',
        title: t('Osebni cilji', 'Personal targets'),
        body: t('Osebni cilji povezejo kalkulatorje z vsakodnevno uporabo: kalorije in voda se uporabljajo na dashboardu in trackerjih.', 'Personal targets connect calculators to daily use: calories and water are used on the dashboard and trackers.'),
      },
    ];
    if (currentUser === ADMIN_EMAIL) {
      steps.push({
        section: 'admin',
        target: 'admin-command-center',
        title: t('Admin center', 'Admin center'),
        body: t('Admin panel je viden samo tebi. Od tu upravljas nastavitve appa, uporabnike, feedback, maintenance in exporte.', 'The admin panel is visible only to you. From here you manage app settings, users, feedback, maintenance, and exports.'),
      });
    }
    return steps;
  }, [currentUser, settings.language]);
  const activeTutorialStep = guidedTutorialSteps[Math.min(tutorialStep, Math.max(0, guidedTutorialSteps.length - 1))] || null;
  const helpTopics = useMemo(() => {
    const sl = settings.language === 'sl';
    const t = (slText, enText) => (sl ? slText : enText);
    return {
      sectionIntro: { title: t('Opis trenutnega zavihka', 'Current tab summary'), body: t('Ta kartica pove, kaj je namen odprtega zavihka in kdaj ga uporabis.', 'This card tells you what the open tab is for and when to use it.') },
      navigation: { title: t('Navigacija', 'Navigation'), body: t('Menijem se premikas med glavnimi funkcijami. Na telefonu je isti sistem optimiziran za hitro tapkanje.', 'Use the menu to move between core features. On phone the same system is optimized for quick taps.') },
      dashboardOverview: { title: t('Dnevni center', 'Daily control'), body: t('Zdruzi trening, kalorije in vodo v en signal, da hitro vidis ali je dan pod kontrolo.', 'Combines training, calories, and water into one signal so you can quickly see if the day is on track.') },
      chart: { title: t('Graf napredka', 'Progress chart'), body: t('Graf prikazuje volumen izbrane vaje skozi cas. Filtri po misicah pomagajo hitro najti pravo vajo.', 'The chart shows selected exercise volume over time. Muscle filters help you find the right exercise fast.') },
      addWorkout: { title: t('Dodaj trening', 'Add workout'), body: t('To je najpomembnejsi vnos za napredek. Shrani vajo, datum, serije, ponovitve in tezo.', 'This is the most important progress entry. It saves exercise, date, sets, reps, and weight.') },
      timerRest: { title: t('Timer in rest day', 'Timer and rest day'), body: t('Timer vodi pavze med seti. Rest day pove appu, da je pocitek nacrtovan in naj ne kvari dnevnega signala.', 'Timer guides rest between sets. Rest day tells the app recovery is planned and should not hurt the daily signal.') },
      history: { title: t('Zgodovina', 'History'), body: t('Vsi treningi so tukaj. Lahko jih ponovis, uredjas, izbrises ali dodas komentar.', 'All workouts are here. You can repeat, edit, delete, or comment on them.') },
      exercises: { title: t('Vaje', 'Exercises'), body: t('Knjiznica razlozi izvedbo in target vsake vaje. Gym/calisthenics preklop spremeni katalog.', 'The library explains execution and targets for each exercise. Gym/calisthenics toggles change the catalog.') },
      advisor: { title: t('Advisor', 'Advisor'), body: t('Predlaga trening glede na zgodovino, premalo trenirane skupine in izbran split.', 'Suggests training based on history, undertrained groups, and selected split.') },
      calories: { title: t('Kalorije', 'Calories'), body: t('Primerja obroke s ciljem. Simple je hiter, advanced doda makrote.', 'Compares meals to your target. Simple is fast, advanced adds macros.') },
      addMeal: { title: t('Dodaj obrok', 'Add meal'), body: t('Rocno shrani obrok. V advanced nacinu dodas protein, carbs in fat.', 'Manually saves a meal. In advanced mode you add protein, carbs, and fat.') },
      ingredient: { title: t('Ingredient tracker', 'Ingredient tracker'), body: t('Quick sprejme navaden opis hrane, precise sprejme sestavine z grami. Rezultat lahko dodas v obroke.', 'Quick accepts normal food text, precise accepts ingredients with grams. The result can be added to meals.') },
      bodyFat: { title: t('Body fat estimate', 'Body fat estimate'), body: t('Uporablja mere in po zelji slike za boljso oceno. Za tocnost vnesi pas in vrat, pri zenskah tudi boke.', 'Uses measurements and optional photos for a better estimate. For accuracy enter waist and neck, and hips for women.') },
      rankings: { title: t('Misicni ranking', 'Muscle ranking'), body: t('Rang vsake misice temelji na tehtanem volumnu vaj za to misico. Model je samo interaktivni prikaz izracuna.', 'Each muscle rank is based on weighted volume for that muscle. The model is an interactive view of the calculation.') },
      overallRank: { title: t('Skupni rang', 'Overall rank'), body: t('Skupni rang je povprecje vseh misicnih skupin. To nagrajuje uravnotezen trening.', 'Overall rank is the average of all muscle groups. This rewards balanced training.') },
      bodyweight: { title: t('Telesna teza', 'Body weight'), body: t('Shranjuje trend teze in pomaga pri kalkulatorjih. Vnosi so lokalno shranjeni na tvoj profil.', 'Stores weight trend and helps calculators. Entries are saved locally to your profile.') },
      water: { title: t('Voda', 'Water'), body: t('Hitri gumbi pospesijo vnos. Cilj vode lahko nastavis rocno ali iz TDEE rezultata.', 'Quick buttons speed up logging. Water target can be set manually or from the TDEE result.') },
      tdee: { title: t('Calorie calculator', 'Calorie calculator'), body: t('Izracuna BMR, TDEE, cilj, makrote, vodo in realen cas do cilja. Varnostne omejitve preprecujejo ekstremne cilje.', 'Calculates BMR, TDEE, target, macros, water, and realistic time to goal. Safety caps prevent extreme targets.') },
      settings: { title: t('Settings', 'Settings'), body: t('Tu spreminjas jezik, enote, ozadje, backup, tracker mode, feedback gumb, tutorial in osebne cilje.', 'Here you change language, units, background, backup, tracker mode, feedback button, tutorial, and personal goals.') },
      appearance: { title: t('Izgled', 'Appearance'), body: t('Accent barva spremeni vizualni obcutek appa brez spreminjanja funkcij.', 'Accent color changes the feel of the app without changing features.') },
      data: { title: t('Backup', 'Backup'), body: t('Export je tvoja varnostna kopija. Import jo vrne. Clear uporabljaj samo, ko res zelis zaceti znova.', 'Export is your backup. Import restores it. Use Clear only when you really want to start over.') },
      tutorial: { title: t('Tutorial in pomoc', 'Tutorial and help'), body: t('Odpre celoten vodeni tutorial. Vsak ? gumb odpre samo hitro razlago trenutne funkcije.', 'Opens the full guided tutorial. Each ? button opens a quick explanation for that feature.') },
      admin: { title: t('Admin center', 'Admin center'), body: t('Vidno samo adminu. Omogoca upravljanje aplikacije, uporabnikov, feedbacka, maintenance in exportov.', 'Visible only to admin. Allows management of the app, users, feedback, maintenance, and exports.') },
      personalTargets: { title: t('Osebni cilji', 'Personal targets'), body: t('Kalorije in voda iz nastavitev poganjajo dashboard, water tracker in meal tracker.', 'Calories and water from settings power the dashboard, water tracker, and meal tracker.') },
    };
  }, [settings.language]);
  const getHelpTopic = (key) => helpTopics[key] || {
    title: settings.language === 'sl' ? 'Pomoc' : 'Help',
    body: settings.language === 'sl' ? 'Ta funkcija pomaga pri uporabi aplikacije.' : 'This feature helps you use the app.',
  };
  const helpButton = (topic, extraClass = '') => (
    <button
      className={`context-help-btn ${extraClass}`.trim()}
      type="button"
      aria-label={settings.language === 'sl' ? 'Razlozi funkcijo' : 'Explain this feature'}
      title={settings.language === 'sl' ? 'Razlozi funkcijo' : 'Explain this feature'}
      onClick={(event) => {
        event.stopPropagation();
        setHelpTopic(topic);
      }}
    >
      ?
    </button>
  );
  const tourAttrs = (id) => ({
    'data-tour': id,
    'data-tour-active': showTutorial && activeTutorialStep?.target === id ? 'true' : undefined,
  });
  useEffect(() => {
    if (!showTutorial || !activeTutorialStep) return;
    if (activeTutorialStep.section && activeTutorialStep.section !== activeSection) {
      setActiveSection(activeTutorialStep.section);
      return;
    }
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-tour="${activeTutorialStep.target}"]`);
      const isMobileTour = window.matchMedia('(max-width: 720px)').matches;
      if (target && isMobileTour && mainContentRef.current) {
        const scroller = mainContentRef.current;
        const targetRect = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const targetTop = scroller.scrollTop + targetRect.top - scrollerRect.top - 84;
        scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        const pageTop = window.scrollY + targetRect.top - 84;
        window.scrollTo({ top: Math.max(0, pageTop), behavior: 'smooth' });
        return;
      }
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeSection, activeTutorialStep, showTutorial]);
  useEffect(() => {
    if (!showTutorial) return;
    if (tutorialStep >= guidedTutorialSteps.length) setTutorialStep(Math.max(0, guidedTutorialSteps.length - 1));
  }, [guidedTutorialSteps.length, showTutorial, tutorialStep]);
  const exerciseOptions = useMemo(() => [...new Set([...Object.values(sections).flat(), ...Object.values(calisthenicsSections).flat(), ...workouts.map((w) => w.exercise), ...customExercises.map(e => e.name)])].sort(), [workouts, customExercises]);
  const selectedWorkouts = useMemo(() => workouts.filter((w) => w.exercise === selectedExercise).sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id), [selectedExercise, workouts]);
  const sortedWorkouts = useMemo(() => [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id), [workouts]);
  const backupDue = useMemo(() => !settings.lastBackupAt || Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000) >= Number(settings.backupReminderDays), [settings.backupReminderDays, settings.lastBackupAt]);
  const selectedFormExerciseInfo = getExerciseInfo(formData.exercise);
  const calorieEntriesSorted = useMemo(() => [...calorieEntries].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id), [calorieEntries]);
  const selectedDayEntries = useMemo(() => calorieEntries.filter((entry) => entry.date === calorieForm.date), [calorieEntries, calorieForm.date]);
  const selectedDayTotals = useMemo(() => selectedDayEntries.reduce((acc, entry) => ({ calories: acc.calories + Number(entry.calories || 0), protein: acc.protein + Number(entry.protein || 0), carbs: acc.carbs + Number(entry.carbs || 0), fat: acc.fat + Number(entry.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [selectedDayEntries]);
  const dashboardBodyWeightKg = useMemo(() => getLatestBodyWeightKg(bodyWeightEntries, settings.gender || 'male'), [bodyWeightEntries, settings.gender]);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayWorkouts = useMemo(() => workouts.filter((workout) => workout.date === todayKey), [todayKey, workouts]);
  const todayCalories = useMemo(() => calorieEntries.filter((entry) => entry.date === todayKey), [calorieEntries, todayKey]);
  const todayTotals = useMemo(() => todayCalories.reduce((acc, entry) => ({ calories: acc.calories + Number(entry.calories || 0), protein: acc.protein + Number(entry.protein || 0), carbs: acc.carbs + Number(entry.carbs || 0), fat: acc.fat + Number(entry.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [todayCalories]);
  const latestBodyWeightEntry = useMemo(() => [...bodyWeightEntries].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)[0] || null, [bodyWeightEntries]);
  const workoutStreak = useMemo(() => calculateStreak(workouts), [workouts]);
  const weeklyVolumeKg = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    return workouts
      .filter((workout) => new Date(workout.date) >= cutoff)
      .reduce((total, workout) => total + getWorkoutVolumeKg(workout, dashboardBodyWeightKg, customExercises), 0);
  }, [customExercises, dashboardBodyWeightKg, workouts]);
  const hasProgressData = workouts.length || calorieEntries.length || bodyWeightEntries.length || waterToday > 0;
  const waterGoalMl = Math.max(1000, Number(tdeeResult?.waterMl || settings.waterGoalMl || defaultSettings.waterGoalMl));
  const dailyControl = useMemo(() => {
    const lastWorkoutDate = sortedWorkouts[0]?.date || '';
    const daysSinceWorkout = lastWorkoutDate ? Math.max(0, Math.floor((new Date(todayKey) - new Date(lastWorkoutDate)) / 86400000)) : null;
    const trainedToday = todayWorkouts.length > 0;
    const restToday = restDays.includes(todayKey);
    const calorieGoal = Math.max(1, Number(settings.calorieGoal) || defaultSettings.calorieGoal);
    const calorieDelta = Math.round(calorieGoal - todayTotals.calories);
    const calorieAccuracy = todayTotals.calories > 0 ? Math.max(0, 100 - Math.min(100, Math.abs(calorieDelta) / calorieGoal * 100)) : 35;
    const hydrationPct = Math.min(100, Math.round((waterToday / waterGoalMl) * 100));
    const trainingScore = trainedToday ? 100 : restToday ? 82 : daysSinceWorkout === null ? 45 : daysSinceWorkout <= 1 ? 70 : daysSinceWorkout <= 3 ? 55 : 35;
    const score = Math.round(clampNumber(trainingScore * 0.4 + hydrationPct * 0.3 + calorieAccuracy * 0.3, 0, 100));
    const label = score >= 85 ? 'locked in' : score >= 65 ? 'on track' : score >= 45 ? 'needs attention' : 'reset day';
    const isSl = settings.language === 'sl';
    const trainingText = trainedToday
      ? isSl
        ? `${todayWorkouts.length} ${todayWorkouts.length === 1 ? 'trening' : 'treningov'} danes`
        : `${todayWorkouts.length} ${todayWorkouts.length === 1 ? 'session' : 'sessions'} logged`
      : restToday
        ? (isSl ? 'pocitek oznacen' : 'rest day marked')
        : daysSinceWorkout === null
          ? (isSl ? 'se brez treningov' : 'no sessions yet')
          : (isSl ? `${daysSinceWorkout} dni od treninga` : `${daysSinceWorkout}d since training`);
    return { score, label, hydrationPct, calorieDelta, trainingText, waterGoalMl };
  }, [restDays, settings.calorieGoal, settings.language, sortedWorkouts, todayKey, todayTotals.calories, todayWorkouts, waterGoalMl, waterToday]);
  const overall = useMemo(() => workouts.reduce((a, w) => ({ workouts: a.workouts + 1, sets: a.sets + getSetCount(w), reps: a.reps + getTotalReps(w), volumeKg: a.volumeKg + getWorkoutVolumeKg(w, dashboardBodyWeightKg, customExercises), bestKg: Math.max(a.bestKg, w.weight) }), { workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }), [customExercises, dashboardBodyWeightKg, workouts]);
  const selectedStats = useMemo(() => selectedWorkouts.reduce((a, w) => ({ workouts: a.workouts + 1, sets: a.sets + getSetCount(w), reps: a.reps + getTotalReps(w), volumeKg: a.volumeKg + getWorkoutVolumeKg(w, dashboardBodyWeightKg, customExercises), bestKg: Math.max(a.bestKg, w.weight) }), { workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }), [customExercises, dashboardBodyWeightKg, selectedWorkouts]);
  const perExercise = useMemo(() => Object.values(workouts.reduce((map, w) => { const item = map[w.exercise] ?? { name: w.exercise, workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }; item.workouts += 1; item.sets += getSetCount(w); item.reps += getTotalReps(w); item.volumeKg += getWorkoutVolumeKg(w, dashboardBodyWeightKg, customExercises); item.bestKg = Math.max(item.bestKg, w.weight); map[w.exercise] = item; return map; }, {})).sort((a, b) => b.volumeKg - a.volumeKg), [customExercises, dashboardBodyWeightKg, workouts]);
  const analyticsDays = analyticsRange === 'week' ? 7 : 30;
  const analyticsCutoff = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (analyticsDays - 1));
    return date;
  }, [analyticsDays]);
  const analyticsWorkouts = useMemo(() => workouts.filter((workout) => new Date(workout.date) >= analyticsCutoff), [analyticsCutoff, workouts]);
  const analyticsCalories = useMemo(() => calorieEntries.filter((entry) => new Date(entry.date) >= analyticsCutoff), [analyticsCutoff, calorieEntries]);
  const analyticsTraining = useMemo(() => analyticsWorkouts.reduce((acc, workout) => ({ workouts: acc.workouts + 1, sets: acc.sets + getSetCount(workout), volumeKg: acc.volumeKg + getWorkoutVolumeKg(workout, dashboardBodyWeightKg, customExercises) }), { workouts: 0, sets: 0, volumeKg: 0 }), [analyticsWorkouts, customExercises, dashboardBodyWeightKg]);
  const analyticsFood = useMemo(() => analyticsCalories.reduce((acc, entry) => ({ entries: acc.entries + 1, calories: acc.calories + Number(entry.calories || 0), protein: acc.protein + Number(entry.protein || 0) }), { entries: 0, calories: 0, protein: 0 }), [analyticsCalories]);
  const personalRecords = useMemo(() => workouts.reduce((map, w) => { if (!map[w.exercise] || w.weight > map[w.exercise]) map[w.exercise] = w.weight; return map; }, {}), [workouts]);
  const bwSorted = useMemo(() => [...bodyWeightEntries].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-30), [bodyWeightEntries]);
  const bodyWeightChartData = useMemo(() => ({ labels: bwSorted.map((e) => formatDateValue(e.date, settings.dateFormat)), datasets: [{ data: bwSorted.map((e) => e.weight), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.18)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4 }] }), [bwSorted, settings.dateFormat]);
  const heatmapDays = useMemo(() => {
    if (!workouts.length) return [];
    const workoutDates = new Set(workouts.map(w => w.date));
    const earliest = workouts.reduce((min, w) => w.date < min ? w.date : min, workouts[0].date);
    const start = new Date(earliest);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // back to Monday
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const days = [];
    const cur = new Date(start);
    while (cur <= today) {
      const key = cur.toISOString().slice(0, 10);
      days.push({ key, active: workoutDates.has(key), today: key === todayStr });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [workouts]);

  const lastUsedWeight = useMemo(() => {
    const matches = workouts.filter(w => w.exercise === formData.exercise).sort((a, b) => b.date.localeCompare(a.date));
    return matches.length ? matches[0].weight : null;
  }, [workouts, formData.exercise]);

  const activeAdvisorSections = advisorMode === 'calisthenics' ? calisthenicsSections : sections;
  const advisor = useMemo(() => {
    const latestSectionDate = {};
    const latestExerciseDate = {};
    workouts.forEach((w) => {
      const section = Object.entries(activeAdvisorSections).find(([, items]) => items.includes(w.exercise))?.[0] ?? findSection(w.exercise);
      if (!latestSectionDate[section] || w.date > latestSectionDate[section]) latestSectionDate[section] = w.date;
      if (!latestExerciseDate[w.exercise] || w.date > latestExerciseDate[w.exercise]) latestExerciseDate[w.exercise] = w.date;
    });
    const todayMs = Date.now() - (Date.now() % 86400000);
    const sectionScore = (sec) => latestSectionDate[sec] ? Math.floor((todayMs - new Date(latestSectionDate[sec]).getTime()) / 86400000) : 9999;

    let chosenSections;
    let comboLabel = '';

    if (advisorSplitId === 'custom') {
      chosenSections = customSplitSections.length ? customSplitSections : Object.keys(activeAdvisorSections).slice(0, 1);
      comboLabel = chosenSections.map(s => sectionNames[s] || s).join(' + ');
    } else if (advisorSplitId !== 'auto') {
      const preset = GYM_SPLIT_COMBOS.find(c => c.id === advisorSplitId);
      chosenSections = preset ? preset.sections : Object.keys(activeAdvisorSections).slice(0, 1);
      comboLabel = preset ? preset.label[settings.language] || preset.label.en : '';
    } else if (advisorMode === 'gym') {
      // auto: pick the GYM_SPLIT_COMBO where the least-trained section is the most neglected
      const scored = GYM_SPLIT_COMBOS.map(combo => ({
        combo,
        score: Math.max(...combo.sections.map(sectionScore)),
      })).sort((a, b) => b.score - a.score);
      const best = scored[0].combo;
      chosenSections = best.sections;
      comboLabel = best.label[settings.language] || best.label.en;
    } else {
      // calisthenics auto: original single-section logic
      const ranked = Object.keys(activeAdvisorSections)
        .map((section) => ({ section, score: sectionScore(section) }))
        .sort((a, b) => b.score - a.score);
      chosenSections = [ranked[0].section];
      comboLabel = '';
    }

    const last = chosenSections.reduce((best, sec) => {
      const d = latestSectionDate[sec] ?? '';
      return !best || d > best ? d : best;
    }, '');
    const worstScore = Math.max(...chosenSections.map(sectionScore));
    const reason = !last ? copy.reasonEmpty : worstScore >= 4 ? copy.reasonCold : copy.reasonBalance;
    const plan = chosenSections.includes('Stamina/Cardio') ? copy.planCardio : copy.planStrength;

    const exercises = chosenSections.flatMap(sec =>
      (activeAdvisorSections[sec] || sections[sec] || [])
        .map(name => ({ name, last: latestExerciseDate[name] ?? '', section: sec }))
        .sort((a, b) => (a.last || '').localeCompare(b.last || ''))
        .slice(0, 4)
    );

    return { sections: chosenSections, comboLabel, last, reason, plan, exercises };
  }, [copy.planCardio, copy.planStrength, copy.reasonBalance, copy.reasonCold, copy.reasonEmpty, workouts, advisorMode, advisorSplitId, customSplitSections, activeAdvisorSections, settings.language]);

  const muscleStats = useMemo(() => getAllMuscleVolumeData(workouts, bodyWeightEntries, settings, customExercises), [workouts, bodyWeightEntries, settings, customExercises]);
  const overallMuscleRankData = useMemo(() => getOverallMuscleRankData(muscleStats, settings.language), [muscleStats, settings.language]);

  const chartData = useMemo(() => ({ labels: selectedWorkouts.map((w, i) => `${formatDateValue(w.date, settings.dateFormat)} #${i + 1}`), datasets: [{ data: selectedWorkouts.map((w) => Math.round(convertWeight(getWorkoutVolumeKg(w, dashboardBodyWeightKg, customExercises), settings.units))), borderColor: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.18)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4 }] }), [customExercises, dashboardBodyWeightKg, selectedWorkouts, settings.dateFormat, settings.units]);
  const chartOptions = useMemo(() => {
    const prev = previousCountRef.current;
    const same = previousExerciseRef.current === selectedExercise;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        x: { type: 'number', easing: 'easeOutQuart', duration: (ctx) => (same && ctx.index >= prev ? 400 : 0), from: (ctx) => ctx.chart.getDatasetMeta(ctx.datasetIndex).data[Math.max(ctx.index - 1, 0)]?.x },
        y: { type: 'number', easing: 'easeOutQuart', duration: (ctx) => (same && ctx.index >= prev ? 400 : 0), from: (ctx) => ctx.chart.getDatasetMeta(ctx.datasetIndex).data[Math.max(ctx.index - 1, 0)]?.y ?? ctx.chart.scales.y.getPixelForValue(0) },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => { const w = selectedWorkouts[items[0]?.dataIndex ?? 0]; return w ? getExerciseName(w.exercise, settings.language) : ''; }, label: (ctx) => { const w = selectedWorkouts[ctx.dataIndex]; return w ? [`${copy.weight}: ${formatWeight(w.weight, settings.units)}`, `${copy.sets}: ${getSetCount(w)}`, `${copy.repsPerSet}: ${formatSetDetails(w)}`] : ''; } } } },
      scales: { x: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } }, y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } } },
    };
  }, [copy.repsPerSet, copy.sets, copy.weight, selectedExercise, selectedWorkouts, settings.units]);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);


  useEffect(() => {
    const handleSwUpdate = () => setSwUpdatePending(true);
    if (window.__swUpdated) handleSwUpdate();
    window.addEventListener('sw-updated', handleSwUpdate);
    return () => window.removeEventListener('sw-updated', handleSwUpdate);
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.accent = settings.backgroundAccent || defaultSettings.backgroundAccent;
  }, [settings.backgroundAccent]);
  useEffect(() => {
    document.title = adminConfig.appName || copy.app;
  }, [adminConfig.appName, copy.app]);
  useEffect(() => {
    if (!adminConfig.signupEnabled && authMode === 'signup') setAuthMode('login');
  }, [adminConfig.signupEnabled, authMode]);
  useEffect(() => {
    if (tdeeForm.currentWeight || !bodyWeightEntries.length) return;
    const latest = getLatestBodyWeightKg(bodyWeightEntries, settings.gender || 'male');
    if (latest) setTdeeForm((current) => ({ ...current, currentWeight: String(latest) }));
  }, [bodyWeightEntries, settings.gender, tdeeForm.currentWeight]);
  useEffect(() => {
    const latest = getLatestBodyWeightKg(bodyWeightEntries, settings.gender || 'male');
    setBodyFatMetrics((current) => ({
      ...current,
      gender: current.gender || settings.gender || 'male',
      age: current.age || settings.age || '',
      height: current.height || settings.height || '',
      weight: current.weight || (latest ? String(latest) : ''),
    }));
  }, [bodyWeightEntries, settings.age, settings.gender, settings.height]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(SESSION_KEY, currentUser);
    requestPersistentStorage();
    const nextSettings = loadSettings(currentUser);
    const nextWorkoutDraft = loadDraft(currentUser, 'workoutForm', getDefaultWorkoutForm());
    const nextIngredientDraft = loadDraft(currentUser, 'ingredientForm', { mode: 'quick', query: '', items: [{ name: '', grams: '100' }] });
    setWorkouts(loadWorkouts(currentUser));
    setCalorieEntries(loadCalories(currentUser));
    setSettings(nextSettings);
    setCalHistory(loadCalHistory(currentUser));
    setBodyFatHistory(loadBodyFatHistory(currentUser));
    setBodyWeightEntries(loadBodyWeight(currentUser));
    setRestDays(loadRestDays(currentUser));
    setCheatDays(loadCheatDays(currentUser));
    setAdminBonus(loadAdminBonus(currentUser));
    setCustomExercises(loadCustomExercises(currentUser));
    setWaterToday(loadWaterMl(currentUser));
    setFormData(nextWorkoutDraft);
    setCalorieForm(loadDraft(currentUser, 'mealForm', getDefaultMealForm()));
    setBwForm(loadDraft(currentUser, 'bodyWeightForm', getDefaultBodyWeightForm()));
    setTdeeForm(loadDraft(currentUser, 'tdeeForm', { currentWeight: '', goalWeight: '', weeks: '12', activityLevel: 'moderate', gender: nextSettings.gender || 'male', age: nextSettings.age || '', height: nextSettings.height || '' }));
    setIngredientMode(nextIngredientDraft.mode === 'precise' ? 'precise' : 'quick');
    setIngredientQuery(typeof nextIngredientDraft.query === 'string' ? nextIngredientDraft.query : '');
    setIngredientItems(Array.isArray(nextIngredientDraft.items) && nextIngredientDraft.items.length ? nextIngredientDraft.items : [{ name: '', grams: '100' }]);
    setSelectedExercise(nextWorkoutDraft.exercise || 'Bench Press');
    setActiveSection(getInitialSection(currentUser));
    // Monthly recap check
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastSeen = localStorage.getItem(getRecapKey(currentUser)) || '';
    if (lastSeen !== currentMonthKey) {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const allW = loadWorkouts(currentUser);
      const prevMonthWorkouts = allW.filter((w) => w.date.startsWith(prevKey));
      if (prevMonthWorkouts.length) {
        const prevMonthStart = `${prevKey}-01`;
        const beforePRs = allW.filter((w) => w.date < prevMonthStart).reduce((m, w) => { if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight; return m; }, {});
        const monthPRs = prevMonthWorkouts.reduce((m, w) => { if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight; return m; }, {});
        const broken = Object.entries(monthPRs).filter(([ex, w]) => !beforePRs[ex] || w > beforePRs[ex]).map(([ex, w]) => ({ exercise: ex, weight: w, prev: beforePRs[ex] || 0 }));
        setRecapData({ month: prevKey, workoutCount: prevMonthWorkouts.length, broken });
        setShowRecap(true);
      }
      localStorage.setItem(getRecapKey(currentUser), currentMonthKey);
    }
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    if (activeSection === 'admin' && currentUser !== ADMIN_EMAIL) return;
    try { localStorage.setItem(getLastSectionKey(currentUser), activeSection); } catch {}
  }, [activeSection, currentUser]);
  useEffect(() => {
    if (!currentUser || editingWorkoutId) return;
    saveDraft(currentUser, 'workoutForm', formData);
  }, [currentUser, editingWorkoutId, formData]);
  useEffect(() => {
    if (!currentUser || editingMealId) return;
    saveDraft(currentUser, 'mealForm', calorieForm);
  }, [calorieForm, currentUser, editingMealId]);
  useEffect(() => {
    if (!currentUser) return;
    saveDraft(currentUser, 'bodyWeightForm', bwForm);
  }, [bwForm, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    saveDraft(currentUser, 'tdeeForm', tdeeForm);
  }, [currentUser, tdeeForm]);
  useEffect(() => {
    if (!currentUser) return;
    saveDraft(currentUser, 'ingredientForm', { mode: ingredientMode, query: ingredientQuery, items: ingredientItems });
  }, [currentUser, ingredientItems, ingredientMode, ingredientQuery]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getWorkoutStorageKey(currentUser), JSON.stringify(workouts));
  }, [currentUser, workouts]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getCaloriesStorageKey(currentUser), JSON.stringify(calorieEntries));
  }, [calorieEntries, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getSettingsStorageKey(currentUser), JSON.stringify(settings));
  }, [currentUser, settings]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getCalHistoryKey(currentUser), JSON.stringify(calHistory));
  }, [calHistory, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getBodyFatKey(currentUser), JSON.stringify(bodyFatHistory));
  }, [bodyFatHistory, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getBodyWeightKey(currentUser), JSON.stringify(bodyWeightEntries));
  }, [bodyWeightEntries, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getRestKey(currentUser), JSON.stringify(restDays));
  }, [currentUser, restDays]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getCheatKey(currentUser), JSON.stringify(cheatDays));
  }, [cheatDays, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getCustomExKey(currentUser), JSON.stringify(customExercises));
  }, [currentUser, customExercises]);
  useEffect(() => {
    timerAlarmFnRef.current = () => {
      playTimerAlarm();
      try { navigator.vibrate([400, 100, 400, 100, 600]); } catch {}
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(copy.timerAlarmTitle, { body: copy.timerAlarmBody, icon: '/icon-192.png' }); } catch {}
      }
    };
  }, [copy.timerAlarmTitle, copy.timerAlarmBody]);
  useEffect(() => {
    const blob = new Blob([TIMER_WORKER_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    timerWorkerRef.current = worker;
    worker.onmessage = (e) => {
      const { remaining } = e.data;
      setTimerSeconds(remaining);
      if (remaining <= 0) {
        setTimerActive(false);
        setTimerDone(true);
        timerAlarmFnRef.current?.();
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
    return () => { worker.terminate(); URL.revokeObjectURL(url); };
  }, []);
  useEffect(() => {
    function onVisibilityChange() {
      if (!timerEndAtRef.current) return;
      const remaining = Math.max(0, Math.round((timerEndAtRef.current - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining <= 0) {
        setTimerActive(false);
        setTimerDone(true);
        timerAlarmFnRef.current?.();
        timerWorkerRef.current?.postMessage({ type: 'stop' });
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
        timerEndAtRef.current = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  useEffect(() => { previousExerciseRef.current = selectedExercise; previousCountRef.current = selectedWorkouts.length; }, [selectedExercise, selectedWorkouts.length]);
  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeSection]);
  useEffect(() => {
    if (!currentUser) {
      setShowScrollTop(false);
      return undefined;
    }
    const scroller = mainContentRef.current;
    const updateScrollTopVisibility = () => {
      const y = Math.max(window.scrollY || 0, scroller?.scrollTop || 0);
      setShowScrollTop(y > 520);
    };
    updateScrollTopVisibility();
    window.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
    scroller?.addEventListener('scroll', updateScrollTopVisibility, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScrollTopVisibility);
      scroller?.removeEventListener('scroll', updateScrollTopVisibility);
    };
  }, [currentUser, activeSection]);
  useEffect(() => { if (!toast) return undefined; const id = window.setTimeout(() => setToast(''), 2500); return () => window.clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (activeSection !== 'admin' || currentUser !== ADMIN_EMAIL) return;
    setAdminLogs(null);
    fetchLoginLogs(currentUser).then(setAdminLogs);
    fetchPresence().then(setAdminPresence);
    const id = setInterval(() => fetchPresence().then(setAdminPresence), 30000);
    return () => clearInterval(id);
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (!currentUser) return undefined;
    pushPresence(currentUser);
    const id = setInterval(() => pushPresence(currentUser), 60000);
    return () => clearInterval(id);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !API_URL || !getJwt(currentUser)) return undefined;
    setSyncing(true);
    const id = setTimeout(async () => {
      try {
        await apiCall(currentUser, '/api/sync', 'POST', { workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, calHistory });
      } finally { setSyncing(false); }
    }, 1500);
    return () => { clearTimeout(id); setSyncing(false); };
  }, [currentUser, workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, calHistory]);

  async function hydrateFromBackend(email, password, mode = 'login') {
    const token = await backendLogin(email, password, mode);
    if (!token) return;
    const data = await pullFromBackend(email);
    await applyRemoteData(email, data);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const passwordScore = getPasswordScore(password, email);
    setAuthError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError(copy.authInvalidEmail);
      return;
    }
    if (!password) {
      setAuthError(copy.authPasswordRequired);
      return;
    }
    if (adminConfig.maintenanceMode && email !== ADMIN_EMAIL) {
      setAuthError(settings.language === 'sl' ? 'Aplikacija je trenutno v maintenance nacinu. Prijava je dovoljena samo adminu.' : 'The app is in maintenance mode. Only admin login is allowed.');
      return;
    }
    if (authMode === 'signup' && !adminConfig.signupEnabled) {
      setAuthError(settings.language === 'sl' ? 'Registracije so trenutno izklopljene.' : 'Signups are currently disabled.');
      return;
    }
    if (authMode === 'signup' && !passwordScore.ok) {
      setAuthError(password.length < 10 ? copy.authShortPassword : copy.authWeakPassword);
      return;
    }
    if (authMode === 'signup' && password !== authForm.confirmPassword) {
      setAuthError(copy.authPasswordsNoMatch);
      return;
    }
    if (authMode === 'login') {
      const lockedFor = getAuthLockRemaining(email);
      if (lockedFor > 0) {
        setAuthError(copy.authLocked.replace('{time}', formatAuthWait(lockedFor, settings.language)));
        return;
      }
    }

    setAuthLoading(true);
    try {
      const users = loadUsers();
      const existing = users.find((user) => user.email === email);

      if (authMode === 'signup') {
        if (existing) {
          setAuthError(copy.authExists);
          return;
        }
        const passwordHash = await hashPassword(password);
        const nextUsers = [...users, { email, passwordHash, createdAt: new Date().toISOString() }];
        localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
        localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify([]));
        localStorage.setItem(getSettingsStorageKey(email), JSON.stringify({
          ...defaultSettings,
          language: adminConfig.defaultLanguage,
          units: adminConfig.defaultUnits,
          backgroundAccent: adminConfig.defaultAccent,
          calorieGoal: adminConfig.defaultCalorieGoal,
          waterGoalMl: adminConfig.defaultWaterGoalMl,
          showFeedbackBtn: adminConfig.feedbackEnabled,
          gender: authForm.gender,
        }));
        clearAuthThrottle(email);
        await pushLoginLog(email, 'signup');
        await hydrateFromBackend(email, password, 'signup');
        setCurrentUser(email);
        setTutorialStep(0);
        setShowTutorial(true);
      } else {
        const banned = loadBanned();
        const isValidPassword = existing ? await verifyPassword(password, existing.passwordHash) : false;
        if (!existing || banned.includes(email) || !isValidPassword) {
          recordAuthFailure(email);
          setAuthError(copy.authLoginFailed);
          return;
        }
        clearAuthThrottle(email);
        if (shouldUpgradePasswordHash(existing.passwordHash)) {
          updateStoredUserPassword(email, await hashPassword(password));
        }
        await pushLoginLog(email, 'login');
        await hydrateFromBackend(email, password, 'login');
        setCurrentUser(email);
      }
      setAuthForm({ email: '', password: '', confirmPassword: '', gender: 'male' });
      setAuthTouched({ email: false, password: false, confirmPassword: false });
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser('');
    setWorkouts([]);
    setCalorieEntries([]);
    setCalHistory([]);
    setBodyFatHistory([]);
    setBodyWeightEntries([]);
    setSettings(defaultSettings);
    setAuthError('');
    setAuthForm({ email: '', password: '', confirmPassword: '', gender: 'male' });
    setShowAuthPassword(false);
    setShowAuthConfirm(false);
    setAuthTouched({ email: false, password: false, confirmPassword: false });
    setShowRecap(false);
    setRecapData(null);
    setRestDays([]);
    setCheatDays([]);
  }

  function changeSet(index, value) { setFormData((c) => ({ ...c, setDetails: c.setDetails.map((item, i) => (i === index ? value : item)) })); }
  function changeSetWeight(index, value) { setFormData((c) => ({ ...c, setWeights: (c.setWeights || []).map((item, i) => (i === index ? value : item)) })); }
  function addSet() { setFormData((c) => ({ ...c, setDetails: [...c.setDetails, ''], setWeights: [...(c.setWeights || []), ''] })); }
  function removeSet(index) { setFormData((c) => ({ ...c, setDetails: c.setDetails.length === 1 ? c.setDetails : c.setDetails.filter((_, i) => i !== index), setWeights: (c.setWeights || []).length <= 1 ? (c.setWeights || []) : (c.setWeights || []).filter((_, i) => i !== index) })); }
  function saveWorkout(event) {
    event.preventDefault();
    const cleanSets = formData.setDetails.map((v) => Number(v) || 0).filter((v) => v > 0);
    const isWD = settings.weightDrop;
    if (!formData.exercise || !formData.date || !cleanSets.length) return;
    if (!isWD && !formData.weight) return;
    const cleanWeights = isWD ? (formData.setWeights || []).map((v) => Number(v) || 0) : null;
    const maxWeight = isWD ? Math.max(...(cleanWeights || [0])) : Number(formData.weight);
    const next = normalizeWorkout({ id: Date.now(), date: formData.date, exercise: formData.exercise, weight: maxWeight, setDetails: cleanSets, ...(isWD ? { setWeights: cleanWeights } : {}) });
    setWorkouts((c) => [...c, next]);
    setSelectedExercise(next.exercise);
    setFormData((c) => ({ ...c, weight: '', setDetails: [''], setWeights: [''] }));
    setToast(copy.saved);
  }
  async function exportData() {
    const data = {
      workouts,
      calorieEntries,
      settings,
      calHistory,
      bodyFatHistory,
      bodyWeightEntries,
      restDays,
      cheatDays,
      customExercises,
    };
    const checksum = await sha256Text(JSON.stringify(data));
    const backup = {
      version: BACKUP_SCHEMA_VERSION,
      app: 'PowerGraph',
      exportedAt: new Date().toISOString(),
      profile: { emailHash: await sha256Text(currentUser || '') },
      integrity: { algorithm: 'SHA-256', checksum },
      data,
    };
    downloadFile(`powergraph-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
    setSettings((c) => ({ ...c, lastBackupAt: new Date().toISOString() }));
    setToast(copy.backupDone);
  }
  function saveMeal(event) {
    event.preventDefault();
    if (!calorieForm.name || !calorieForm.calories || !calorieForm.date) return;
    const isAdvancedCalories = settings.calorieTrackerMode === 'advanced';
    const entry = {
      id: Date.now(),
      date: calorieForm.date,
      mealType: calorieForm.mealType,
      name: calorieForm.name.trim(),
      calories: Number(calorieForm.calories) || 0,
      protein: isAdvancedCalories ? Number(calorieForm.protein) || 0 : 0,
      carbs: isAdvancedCalories ? Number(calorieForm.carbs) || 0 : 0,
      fat: isAdvancedCalories ? Number(calorieForm.fat) || 0 : 0,
    };
    setCalorieEntries((current) => [...current, entry]);
    setCalorieForm((current) => ({ ...current, name: '', calories: '', protein: '', carbs: '', fat: '' }));
    setToast(copy.mealSaved);
  }
  function importData(event) {
    const [file] = event.target.files ?? [];
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setToast(copy.importFail);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const payload = parsed?.data && parsed?.integrity ? parsed.data : parsed;
        if (parsed?.integrity?.checksum) {
          const actual = await sha256Text(JSON.stringify(payload));
          if (!constantTimeEqual(actual, parsed.integrity.checksum)) throw new Error('checksum');
        }
        const cleanBackup = sanitizeBackupPayload(payload);
        if (!cleanBackup) throw new Error('invalid');
        setWorkouts(cleanBackup.workouts);
        setCalorieEntries(cleanBackup.calorieEntries);
        if (cleanBackup.settings) setSettings(cleanBackup.settings);
        setCalHistory(cleanBackup.calHistory);
        setBodyFatHistory(cleanBackup.bodyFatHistory);
        setBodyWeightEntries(cleanBackup.bodyWeightEntries);
        setRestDays(cleanBackup.restDays);
        setCheatDays(cleanBackup.cheatDays);
        setCustomExercises(cleanBackup.customExercises);
        setToast(copy.importDone);
      } catch {
        setToast(copy.importFail);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }
  function clearData() {
    if (!window.confirm(copy.clearConfirm)) return;
    setWorkouts([]);
    setCalorieEntries([]);
    setCalHistory([]);
    setBodyFatHistory([]);
    setBodyWeightEntries([]);
    setRestDays([]);
    setCheatDays([]);
    setCustomExercises([]);
    clearUserDrafts(currentUser);
    setFormData(getDefaultWorkoutForm());
    setCalorieForm(getDefaultMealForm());
    setBwForm(getDefaultBodyWeightForm());
    setIngredientMode('quick');
    setIngredientQuery('');
    setIngredientItems([{ name: '', grams: '100' }]);
    localStorage.removeItem(getRestKey(currentUser));
    localStorage.removeItem(getCheatKey(currentUser));
    localStorage.removeItem(getCustomExKey(currentUser));
    localStorage.removeItem(getBodyFatKey(currentUser));
    setToast(copy.cleared);
  }

  function addDemoData() {
    if (!currentUser) return;
    const markers = readDemoDayMarkers(currentUser);
    const markerRest = new Set(markers.rest);
    const markerCheat = new Set(markers.cheat);
    const today = todayKey;
    const demoWaterToday = Number(localStorage.getItem(getDemoWaterKey(currentUser, today)) || 0);
    const hasRealData =
      workouts.some((item) => !item.demo) ||
      calorieEntries.some((item) => !item.demo) ||
      bodyWeightEntries.some((item) => !item.demo) ||
      bodyFatHistory.some((item) => !item.demo) ||
      calHistory.some((item) => !item.demo) ||
      restDays.some((date) => !markerRest.has(date)) ||
      cheatDays.some((date) => !markerCheat.has(date)) ||
      Math.max(0, waterToday - demoWaterToday) > 0;
    if (hasRealData && !window.confirm(copy.demoDataConfirm)) return;

    const now = Date.now();
    const demoWorkouts = [
      { id: now + 1, date: dateOffsetKey(-12), exercise: 'Bench Press', weight: 62.5, setDetails: [12, 10, 8], demo: true },
      { id: now + 2, date: dateOffsetKey(-10), exercise: 'Lat Pulldown', weight: 55, setDetails: [12, 12, 10], demo: true },
      { id: now + 3, date: dateOffsetKey(-8), exercise: 'Squat', weight: 82.5, setDetails: [10, 8, 8], demo: true },
      { id: now + 4, date: dateOffsetKey(-5), exercise: 'Overhead Press', weight: 35, setDetails: [10, 9, 8], demo: true },
      { id: now + 5, date: dateOffsetKey(-3), exercise: 'Barbell Curl', weight: 27.5, setDetails: [12, 10, 10], demo: true },
      { id: now + 6, date: dateOffsetKey(-1), exercise: 'Romanian Deadlift', weight: 90, setDetails: [10, 8, 8], demo: true },
    ].map(normalizeWorkout);
    const demoMeals = [
      { id: now + 101, date: today, mealType: 'breakfast', name: 'Greek yogurt, oats, berries', calories: 510, protein: 36, carbs: 62, fat: 11, demo: true },
      { id: now + 102, date: today, mealType: 'lunch', name: 'Chicken rice bowl', calories: 720, protein: 52, carbs: 86, fat: 14, demo: true },
      { id: now + 103, date: today, mealType: 'snack', name: 'Protein shake and banana', calories: 310, protein: 31, carbs: 39, fat: 4, demo: true },
      { id: now + 104, date: dateOffsetKey(-1), mealType: 'dinner', name: 'Salmon, potatoes, salad', calories: 680, protein: 44, carbs: 58, fat: 28, demo: true },
      { id: now + 105, date: dateOffsetKey(-1), mealType: 'breakfast', name: 'Eggs and toast', calories: 460, protein: 28, carbs: 38, fat: 22, demo: true },
    ];
    const demoWeights = [
      { id: now + 201, date: dateOffsetKey(-14), weight: 82.4, demo: true },
      { id: now + 202, date: dateOffsetKey(-10), weight: 82.0, demo: true },
      { id: now + 203, date: dateOffsetKey(-6), weight: 81.5, demo: true },
      { id: now + 204, date: dateOffsetKey(-2), weight: 81.1, demo: true },
    ];
    const demoRest = [dateOffsetKey(-7)];
    const demoCheat = [dateOffsetKey(-6)];
    const demoCalHistory = [
      { id: now + 301, date: today, name: 'Chicken rice bowl', grams: 420, kcalPer100: 171, total: 720, protein: 52, carbs: 86, fat: 14, demo: true },
    ];
    const demoBodyFat = [{
      id: now + 401,
      date: today,
      demo: true,
      photoCount: 0,
      metrics: { gender: settings.gender || 'male', weight: demoWeights.at(-1).weight, height: settings.height || '' },
      result: {
        bodyFatPercent: settings.gender === 'female' ? 24.8 : 16.4,
        category: settings.gender === 'female' ? 'Fitness' : 'Athletic',
        confidence: 'sample',
        fatMassKg: settings.gender === 'female' ? 20.1 : 13.3,
        leanMassKg: settings.gender === 'female' ? 61 : 67.8,
        description: 'Sample estimate for testing the dashboard.',
      },
    }];

    setWorkouts((current) => [...current.filter((item) => !item.demo), ...demoWorkouts]);
    setCalorieEntries((current) => [...current.filter((item) => !item.demo), ...demoMeals]);
    setBodyWeightEntries((current) => [...current.filter((item) => !item.demo), ...demoWeights]);
    setCalHistory((current) => [...current.filter((item) => !item.demo), ...demoCalHistory]);
    setBodyFatHistory((current) => [...current.filter((item) => !item.demo), ...demoBodyFat]);
    setRestDays((current) => [...new Set([...current.filter((date) => !markerRest.has(date)), ...demoRest])]);
    setCheatDays((current) => [...new Set([...current.filter((date) => !markerCheat.has(date)), ...demoCheat])]);
    localStorage.setItem(getDemoDaysKey(currentUser), JSON.stringify({ rest: demoRest, cheat: demoCheat }));

    const demoWaterMl = 1250;
    const previousDemoWater = Number(localStorage.getItem(getDemoWaterKey(currentUser, today)) || 0);
    setWaterToday((current) => {
      const next = Math.max(0, current - previousDemoWater) + demoWaterMl;
      saveWaterMl(currentUser, next);
      return next;
    });
    localStorage.setItem(getDemoWaterKey(currentUser, today), String(demoWaterMl));
    setSelectedExercise('Bench Press');
    setToast(copy.demoDataAdded);
  }

  function clearDemoData() {
    if (!currentUser) return;
    const markers = readDemoDayMarkers(currentUser);
    const markerRest = new Set(markers.rest);
    const markerCheat = new Set(markers.cheat);
    const today = todayKey;
    const demoWaterToday = Number(localStorage.getItem(getDemoWaterKey(currentUser, today)) || 0);

    setWorkouts((current) => current.filter((item) => !item.demo));
    setCalorieEntries((current) => current.filter((item) => !item.demo));
    setBodyWeightEntries((current) => current.filter((item) => !item.demo));
    setCalHistory((current) => current.filter((item) => !item.demo));
    setBodyFatHistory((current) => current.filter((item) => !item.demo));
    setRestDays((current) => current.filter((date) => !markerRest.has(date)));
    setCheatDays((current) => current.filter((date) => !markerCheat.has(date)));
    localStorage.removeItem(getDemoDaysKey(currentUser));
    localStorage.removeItem(getDemoWaterKey(currentUser, today));
    if (demoWaterToday > 0) {
      setWaterToday((current) => {
        const next = Math.max(0, current - demoWaterToday);
        saveWaterMl(currentUser, next);
        return next;
      });
    }
    setToast(copy.demoDataCleared);
  }

  function deleteWorkout(id) {
    if (!window.confirm(copy.deleteConfirmWorkout)) return;
    setWorkouts((current) => current.filter((item) => item.id !== id));
    if (editingWorkoutId === id) setEditingWorkoutId(null);
  }
  function saveComment(id) { setWorkouts(cur => cur.map(w => w.id === id ? { ...w, comment: commentText.trim() } : w)); setEditingCommentId(null); setCommentText(''); }
  function startEditComment(w) { setEditingCommentId(w.id); setCommentText(w.comment || ''); }

  async function triggerInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function applyServiceWorkerUpdate() {
    window.__powerGraphUpdating = true;
    const waitingWorker = window.__swRegistration?.waiting;
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  }


  function addWater(ml) {
    if (!currentUser) return;
    setWaterToday((current) => {
      const next = current + ml;
      saveWaterMl(currentUser, next);
      return next;
    });
    setToast(`+${ml} ml`);
  }
  function resetWater() {
    if (!window.confirm(copy.deleteConfirmWater)) return;
    setWaterToday(0);
    saveWaterMl(currentUser, 0);
  }

  function banUser(email) {
    if (!window.confirm(copy.adminBanConfirm)) return;
    const list = loadBanned();
    if (!list.includes(email)) { list.push(email); saveBanned(list); setBannedUsers([...list]); }
    writeAdminAudit('Banned user', email);
    setToast(`${copy.adminBan}: ${email}`);
  }
  function unbanUser(email) {
    const list = loadBanned().filter(e => e !== email);
    saveBanned(list); setBannedUsers([...list]);
    writeAdminAudit('Unbanned user', email);
    setToast(`${copy.adminUnban}: ${email}`);
  }
  function toggleMod(email) {
    const list = loadMods();
    const isMod = list.includes(email);
    const next = isMod ? list.filter(e => e !== email) : [...list, email];
    saveMods(next); setModUsers([...next]);
    writeAdminAudit(isMod ? 'Removed moderator' : 'Granted moderator', email);
    setToast(isMod ? `${copy.adminRemoveMod}: ${email}` : `${copy.adminSetMod}: ${email}`);
  }
  function adminShowRecap() {
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const allW = loadWorkouts(currentUser);
    const prevMonthWorkouts = allW.filter(w => w.date.startsWith(prevKey));
    const prevMonthStart = `${prevKey}-01`;
    const beforePRs = allW.filter(w => w.date < prevMonthStart).reduce((m, w) => { if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight; return m; }, {});
    const monthPRs = prevMonthWorkouts.reduce((m, w) => { if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight; return m; }, {});
    const broken = Object.entries(monthPRs).filter(([ex, w]) => !beforePRs[ex] || w > beforePRs[ex]).map(([ex, w]) => ({ exercise: ex, weight: w, prev: beforePRs[ex] || 0 }));
    setRecapData({ month: prevKey, workoutCount: prevMonthWorkouts.length || allW.length, broken });
    setShowRecap(true);
  }

  function adminChangeRank(email, direction) {
    const wList = loadWorkouts(email);
    const cList = loadCalories(email);
    const bwList = loadBodyWeight(email);
    const rDays = loadRestDays(email);
    const cDays = loadCheatDays(email);
    const sett = loadSettings(email);
    const currentBonus = loadAdminBonus(email);
    const basePts = calculatePoints(wList, cList, bwList, rDays, cDays, sett.calorieGoal);
    const totalPts = basePts + currentBonus;
    if (direction === 'up') {
      const nextRank = RANKS.find(r => r.min > totalPts);
      if (!nextRank) { setToast(copy.adminMaxRank); return; }
      const newBonus = currentBonus + (nextRank.min - totalPts);
      saveAdminBonus(email, newBonus);
      if (email === currentUser) setAdminBonus(newBonus);
      writeAdminAudit('Rank bonus increased', `${email} -> ${newBonus}`);
      setToast(`${copy.adminRankUpDone}: ${email}`);
    } else {
      const rankIdx = RANKS.findIndex(r => r.min > totalPts) - 1;
      const currentRankIdx = rankIdx < 0 ? RANKS.length - 1 : rankIdx;
      if (currentRankIdx <= 0) { setToast(copy.adminMinRank); return; }
      const prevRankMin = RANKS[currentRankIdx - 1].min;
      const newBonus = currentBonus - (totalPts - prevRankMin) - 1;
      saveAdminBonus(email, newBonus);
      if (email === currentUser) setAdminBonus(newBonus);
      writeAdminAudit('Rank bonus decreased', `${email} -> ${newBonus}`);
      setToast(`${copy.adminDemoteDone}: ${email}`);
    }
  }
  function writeAdminAudit(action, detail = '') {
    if (currentUser !== ADMIN_EMAIL) return;
    const entry = { id: Date.now(), ts: new Date().toISOString(), actor: currentUser, action, detail };
    const next = [entry, ...loadAdminAudit()].slice(0, 300);
    saveAdminAudit(next);
    setAdminAudit(next);
  }
  function saveAdminPanelConfig() {
    const next = sanitizeAdminConfig(adminConfigDraft);
    saveAdminConfig(next);
    setAdminConfig(next);
    setAdminConfigDraft(next);
    writeAdminAudit('Saved app controls', `${next.appName} | signup=${next.signupEnabled} | maintenance=${next.maintenanceMode}`);
    setToast(settings.language === 'sl' ? 'Admin kontrole shranjene' : 'Admin controls saved');
  }
  function resetAdminPanelConfig() {
    if (!window.confirm(settings.language === 'sl' ? 'Ponastavim admin kontrole na privzeto?' : 'Reset admin controls to default?')) return;
    saveAdminConfig(defaultAdminConfig);
    setAdminConfig(defaultAdminConfig);
    setAdminConfigDraft(defaultAdminConfig);
    writeAdminAudit('Reset app controls', 'defaultAdminConfig');
    setToast(settings.language === 'sl' ? 'Admin kontrole ponastavljene' : 'Admin controls reset');
  }
  function applyAdminDefaultsToMe() {
    const next = sanitizeAdminConfig(adminConfigDraft);
    setSettings((current) => ({
      ...current,
      language: next.defaultLanguage,
      units: next.defaultUnits,
      backgroundAccent: next.defaultAccent,
      calorieGoal: next.defaultCalorieGoal,
      waterGoalMl: next.defaultWaterGoalMl,
      showFeedbackBtn: next.feedbackEnabled,
    }));
    writeAdminAudit('Applied defaults to admin profile', currentUser);
    setToast(settings.language === 'sl' ? 'Privzete nastavitve uporabljene na tvojem profilu' : 'Defaults applied to your profile');
  }
  function applyAdminDefaultsToAllUsers() {
    if (!window.confirm(settings.language === 'sl' ? 'Uporabim privzete app nastavitve na vse profile v tem brskalniku?' : 'Apply default app settings to every profile in this browser?')) return;
    const next = sanitizeAdminConfig(adminConfigDraft);
    loadUsers().forEach((user) => {
      const userSettings = loadSettings(user.email);
      localStorage.setItem(getSettingsStorageKey(user.email), JSON.stringify({
        ...userSettings,
        language: next.defaultLanguage,
        units: next.defaultUnits,
        backgroundAccent: next.defaultAccent,
        calorieGoal: next.defaultCalorieGoal,
        waterGoalMl: next.defaultWaterGoalMl,
        showFeedbackBtn: next.feedbackEnabled,
      }));
    });
    if (currentUser) setSettings(loadSettings(currentUser));
    writeAdminAudit('Applied defaults to all local profiles', `${loadUsers().length} profiles`);
    setToast(settings.language === 'sl' ? 'Privzete nastavitve uporabljene na vseh profilih' : 'Defaults applied to all profiles');
  }
  function removeUserLocalData(email) {
    [
      getWorkoutStorageKey(email),
      getCaloriesStorageKey(email),
      getSettingsStorageKey(email),
      getCalHistoryKey(email),
      getBodyFatKey(email),
      getBodyWeightKey(email),
      getRestKey(email),
      getCheatKey(email),
      getCustomExKey(email),
      getAdminBonusKey(email),
      `${JWT_KEY_PREFIX}${email}`,
      getRecapKey(email),
    ].forEach((key) => localStorage.removeItem(key));
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key) => key && key.startsWith(`${WATER_KEY_PREFIX}${email}_`))
      .forEach((key) => localStorage.removeItem(key));
  }
  function adminExportUser(email) {
    const payload = {
      exportedAt: new Date().toISOString(),
      email,
      settings: loadSettings(email),
      workouts: loadWorkouts(email),
      calories: loadCalories(email),
      bodyWeight: loadBodyWeight(email),
      bodyFatHistory: loadBodyFatHistory(email),
      calorieHistory: loadCalHistory(email),
      restDays: loadRestDays(email),
      cheatDays: loadCheatDays(email),
      customExercises: loadCustomExercises(email),
      bonus: loadAdminBonus(email),
      banned: loadBanned().includes(email),
      moderator: loadMods().includes(email),
    };
    downloadFile(`powergraph-user-${email.replace(/[^a-z0-9]+/gi, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json');
    writeAdminAudit('Exported user', email);
  }
  function adminResetUserData(email) {
    if (!window.confirm(`${settings.language === 'sl' ? 'Izbrisem treninge, obroke in meritve za' : 'Delete workouts, meals and measurements for'} ${email}?`)) return;
    const previousSettings = loadSettings(email);
    removeUserLocalData(email);
    localStorage.setItem(getSettingsStorageKey(email), JSON.stringify({ ...defaultSettings, gender: previousSettings.gender || 'male' }));
    if (email === currentUser) {
      setWorkouts([]);
      setCalorieEntries([]);
      setCalHistory([]);
      setBodyFatHistory([]);
      setBodyWeightEntries([]);
      setRestDays([]);
      setCheatDays([]);
      setCustomExercises([]);
      setAdminBonus(0);
      setSettings(loadSettings(email));
    }
    writeAdminAudit('Reset user data', email);
    setToast(`${settings.language === 'sl' ? 'Podatki izbrisani' : 'Data reset'}: ${email}`);
  }
  function adminDeleteUser(email) {
    if (email === ADMIN_EMAIL) { setToast(settings.language === 'sl' ? 'Admin profila ni dovoljeno izbrisati' : 'Admin profile cannot be deleted'); return; }
    if (!window.confirm(`${settings.language === 'sl' ? 'Trajno izbrisem uporabnika' : 'Permanently delete user'} ${email}?`)) return;
    const nextUsers = loadUsers().filter((user) => user.email !== email);
    localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
    removeUserLocalData(email);
    const nextBanned = loadBanned().filter((item) => item !== email);
    const nextMods = loadMods().filter((item) => item !== email);
    saveBanned(nextBanned); setBannedUsers(nextBanned);
    saveMods(nextMods); setModUsers(nextMods);
    writeAdminAudit('Deleted user', email);
    setToast(`${settings.language === 'sl' ? 'Uporabnik izbrisan' : 'User deleted'}: ${email}`);
  }
  function exportAdminSnapshot() {
    const users = loadUsers().map((user) => ({
      email: user.email,
      createdAt: user.createdAt,
      settings: loadSettings(user.email),
      workouts: loadWorkouts(user.email).length,
      meals: loadCalories(user.email).length,
      bodyWeight: loadBodyWeight(user.email).length,
      bodyFat: loadBodyFatHistory(user.email).length,
      bonus: loadAdminBonus(user.email),
      banned: loadBanned().includes(user.email),
      moderator: loadMods().includes(user.email),
    }));
    const payload = {
      exportedAt: new Date().toISOString(),
      appConfig: adminConfig,
      users,
      ratings: loadRatings(),
      banned: loadBanned(),
      moderators: loadMods(),
      audit: loadAdminAudit(),
      logins: adminLogs || loadLoginLogs(),
      presence: adminPresence,
    };
    downloadFile(`powergraph-admin-snapshot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    writeAdminAudit('Exported admin snapshot', `${users.length} users`);
  }
  function clearAdminAuditLog() {
    if (!window.confirm(settings.language === 'sl' ? 'Izbrisem admin audit log?' : 'Clear admin audit log?')) return;
    saveAdminAudit([]);
    setAdminAudit([]);
    setToast(settings.language === 'sl' ? 'Audit log izbrisan' : 'Audit log cleared');
  }
  function clearAllFeedback() {
    if (!window.confirm(settings.language === 'sl' ? 'Izbrisem vse feedback komentarje?' : 'Clear all feedback comments?')) return;
    saveRatings([]);
    setRatings([]);
    writeAdminAudit('Cleared feedback', '');
    setToast(settings.language === 'sl' ? 'Feedback izbrisan' : 'Feedback cleared');
  }
  function startEditWorkout(workout) { setEditingWorkoutId(workout.id); setFormData({ date: workout.date, exercise: workout.exercise, weight: String(workout.weight), setDetails: workout.setDetails.map(String), setWeights: workout.setWeights ? workout.setWeights.map(String) : workout.setDetails.map(() => String(workout.weight)) }); setActiveSection('dashboard'); }
  function saveWorkoutEdit() {
    const cleanSets = formData.setDetails.map((v) => Number(v) || 0).filter((v) => v > 0);
    const isWD = settings.weightDrop;
    if (!editingWorkoutId || !formData.exercise || !formData.date || !cleanSets.length) return;
    if (!isWD && !formData.weight) return;
    const cleanWeights = isWD ? (formData.setWeights || []).map((v) => Number(v) || 0) : null;
    const maxWeight = isWD ? Math.max(...(cleanWeights || [0])) : Number(formData.weight);
    setWorkouts((current) => current.map((item) => (item.id === editingWorkoutId ? { ...item, date: formData.date, exercise: formData.exercise, weight: maxWeight, setDetails: cleanSets, ...(isWD ? { setWeights: cleanWeights } : {}) } : item)));
    setEditingWorkoutId(null);
  }
  function cancelWorkoutEdit() { setEditingWorkoutId(null); setFormData(getDefaultWorkoutForm()); }
  function deleteMeal(id) {
    if (!window.confirm(copy.deleteConfirmMeal)) return;
    setCalorieEntries((current) => current.filter((item) => item.id !== id));
    if (editingMealId === id) setEditingMealId(null);
  }
  function startEditMeal(entry) { setEditingMealId(entry.id); setCalorieForm({ date: entry.date, mealType: entry.mealType, name: entry.name, calories: String(entry.calories), protein: String(entry.protein), carbs: String(entry.carbs), fat: String(entry.fat) }); setActiveSection('calories'); }
  function saveMealEdit() {
    if (!editingMealId || !calorieForm.name || !calorieForm.calories || !calorieForm.date) return;
    setCalorieEntries((current) => current.map((item) => (item.id === editingMealId ? { ...item, date: calorieForm.date, mealType: calorieForm.mealType, name: calorieForm.name.trim(), calories: Number(calorieForm.calories) || 0, protein: Number(calorieForm.protein) || 0, carbs: Number(calorieForm.carbs) || 0, fat: Number(calorieForm.fat) || 0 } : item)));
    setEditingMealId(null);
    setCalorieForm({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' });
  }
  function cancelMealEdit() { setEditingMealId(null); setCalorieForm(getDefaultMealForm()); }

  async function searchCalories(e) {
    e.preventDefault();
    if (!calQuery.trim() || !calGrams) return;
    setCalLoading(true);
    setCalError('');
    setCalResult(null);

    const normalized = normalizeFoodQuery(calQuery);
    const local = LOCAL_FOODS[normalized];

    // 1. Gemini AI estimate via backend proxy, when configured
    if (aiEnabled) {
      try {
        const prompt = `You are a nutritionist. The user ate: "${calQuery.trim()}", ${calGrams}g.
Give a realistic average calorie estimate for this food (not a branded product).
Briefly state what ingredients/preparation you assumed (1 sentence).
Then on a new line write exactly: KCAL_PER_100G: <number>
Then on a new line write exactly: TOTAL_KCAL: <number>
Be concise. Use average homemade/generic values, not brand values.`;
        const text = await callGemini(currentUser, [{ text: prompt }]);
        if (text) {
          const per100Match = text.match(/KCAL_PER_100G:\s*(\d+)/i);
          const totalMatch = text.match(/TOTAL_KCAL:\s*(\d+)/i);
          if (per100Match && totalMatch) {
            const kcalPer100 = Number(per100Match[1]);
            const total = Number(totalMatch[1]);
            const aiText = text.replace(/KCAL_PER_100G:\s*\d+/i, '').replace(/TOTAL_KCAL:\s*\d+/i, '').trim();
            setCalResult({ name: calQuery.trim(), kcalPer100, total, aiText });
            setCalHistory(prev => [{ id: Date.now(), name: calQuery.trim(), grams: Number(calGrams), kcalPer100, total, date: new Date().toISOString().slice(0, 10) }, ...prev]);
            setToast(copy.calEstSaved);
            setCalLoading(false);
            return;
          }
        }
      } catch { /* fall through to local lookup */ }
    }

    // 2. Fallback: local database
    if (local) {
      const total = Math.round((local.kcal * Number(calGrams)) / 100);
      const result = { name: local.name, kcalPer100: local.kcal, total, aiText: null };
      setCalResult(result);
      setCalHistory(prev => [{ id: Date.now(), name: local.name, grams: Number(calGrams), kcalPer100: local.kcal, total, date: new Date().toISOString().slice(0, 10) }, ...prev]);
      setToast(copy.calEstSaved);
      setCalLoading(false);
      return;
    }

    // 3. Nothing found
    setCalError('noResult');
    setCalLoading(false);
  }
  function deleteCalHistoryEntry(id) {
    if (!window.confirm(copy.deleteConfirmEstimate)) return;
    setCalHistory(prev => prev.filter(e => e.id !== id));
  }

  function handleCalImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCalImage({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl });
      setCalPhotoResult(null);
      setCalPhotoError('');
      setFoodCorrectionText('');
    };
    img.onerror = () => { URL.revokeObjectURL(url); setCalPhotoError('error'); };
    img.src = url;
  }

  async function analyzeImageCalories() {
    if (!calImage) return;
    if (!aiEnabled) { setCalPhotoError('noKey'); return; }
    setCalImageLoading(true);
    setCalPhotoError('');
    setCalPhotoResult(null);
    setIngredientError('');
    try {
      const prompt = `You are PowerGraph Food Vision, a careful nutrition estimator.
Analyze this food photo and return ONLY valid JSON. Do not use markdown.

Goal:
- Identify every visible edible component separately.
- Estimate realistic grams for the visible portion in the image, using plate/bowl/utensil context when available.
- Estimate kcal, protein, carbs, fat, fiber, and sugar per item from the estimated grams.
- Include kcalPer100 for every item when possible.
- Use generic USDA-style averages, not branded values.
- Do not invent hidden oils, sauces, or ingredients unless visually likely; list them as assumptions when used.
- Use a realistic low-high calorieRange when portion size is uncertain.
- Be conservative when uncertain and explain uncertainty in assumptions/warnings.
- If the image is ambiguous, still provide the best estimate but mark confidence low.
- Make total equal the sum of item estimates.

JSON schema:
{"mealName":"short meal name","assumptions":["short assumption"],"warnings":["short warning if needed"],"calorieRange":{"low":0,"high":0},"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"food item","quantity":"visible quantity like 2 eggs or 1 bowl","unit":"pieces|g|ml|serving","grams":0,"kcalPer100":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"confidence":"low|moderate|high","assumption":"why this portion estimate was chosen"}]}`;
      const text = await callGemini(currentUser, [
        { inlineData: { mimeType: calImage.mimeType, data: calImage.base64 } },
        { text: prompt },
      ], { generationConfig: { responseMimeType: 'application/json', temperature: 0.05, maxOutputTokens: 1800 } });
      if (text) {
        const parsed = parseAiJson(text);
        if (parsed) {
          const result = sanitizeIngredientResult(parsed, 'photo-ai');
          if (result) {
            setCalPhotoResult(result);
            setIngredientResults(result);
            setFoodCorrectionText('');
            setToast(copy.foodEstimateReady);
          } else {
            setCalPhotoError('error');
          }
        } else {
          setCalPhotoError('error');
        }
      } else {
        setCalPhotoError('error');
      }
    } catch { setCalPhotoError('error'); }
    finally { setCalImageLoading(false); }
  }

  async function reanalyzeFoodPhotoWithCorrection() {
    if (!ingredientResults?.items?.length || !foodCorrectionText.trim()) return;
    if (!aiEnabled) { setCalPhotoError('noKey'); return; }
    setCalImageLoading(true);
    setCalPhotoError('');
    try {
      const currentEstimate = JSON.stringify({
        mealName: ingredientResults.mealName,
        assumptions: ingredientResults.assumptions || [],
        items: ingredientResults.items,
      });
      const prompt = `You are PowerGraph Food Vision. The previous food-photo estimate may be wrong.
User correction: "${foodCorrectionText.trim()}"
Current estimate JSON: ${currentEstimate}

Use the correction as truth. If a food identity changed, recalculate grams, kcal, and macros from generic USDA-style averages. Return ONLY valid JSON with the same schema:
If the user corrects only one item, keep the other visible items unless the correction says to remove them. Recalculate total from the final item list.
{"mealName":"short meal name","assumptions":["short assumption"],"warnings":["short warning if needed"],"calorieRange":{"low":0,"high":0},"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"food item","quantity":"visible or corrected quantity","unit":"pieces|g|ml|serving","grams":0,"kcalPer100":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"confidence":"low|moderate|high","assumption":"why this estimate was chosen"}]}`;
      const parts = [
        ...(calImage ? [{ inlineData: { mimeType: calImage.mimeType, data: calImage.base64 } }] : []),
        { text: prompt },
      ];
      const text = await callGemini(currentUser, parts, { generationConfig: { responseMimeType: 'application/json', temperature: 0.03, maxOutputTokens: 1800 } });
      const parsed = parseAiJson(text);
      if (!parsed) { setCalPhotoError('error'); return; }
      const result = sanitizeIngredientResult(parsed, calImage ? 'photo-ai-corrected' : 'ai-corrected');
      if (!result) { setCalPhotoError('error'); return; }
      setCalPhotoResult(result);
      setIngredientResults(result);
      setFoodCorrectionText('');
      setToast(copy.foodEstimateReady);
    } catch {
      setCalPhotoError('error');
    } finally {
      setCalImageLoading(false);
    }
  }

  async function handleAddCustomExercise() {
    const name = addExForm.name.trim();
    if (!name) return;
    setAddExLoading(true);
    setAddExError('');

    let howTo = { sl: '', en: '' };
    let cues = { sl: '', en: '' };
    let targets = { sl: '', en: '' };
    let primary = { sl: sectionNames[addExForm.section] || addExForm.section, en: addExForm.section };

    if (aiEnabled) {
      try {
        const prompt = `You are a fitness expert. For the exercise "${name}" targeting the "${addExForm.section}" muscle group, respond ONLY with this JSON object (no markdown, no extra text):
{"howTo":{"en":"...","sl":"..."},"cues":{"en":"...","sl":"..."},"targets":{"en":"...","sl":"..."},"primary":{"en":"...","sl":"..."}}
Keep each value to 1-2 sentences. "sl" is Slovenian language.`;
        const text = await callGemini(currentUser, [{ text: prompt }]);
        if (text) {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const p = JSON.parse(m[0]);
            if (p.howTo?.en) howTo = p.howTo;
            if (p.cues?.en) cues = p.cues;
            if (p.targets?.en) targets = p.targets;
            if (p.primary?.en) primary = p.primary;
          }
        }
      } catch { setAddExError(copy.customExError); setAddExLoading(false); return; }
    }

    const ex = { id: Date.now(), name, section: addExForm.section, howTo, cues, targets, primary };
    const updated = [...customExercises, ex];
    setCustomExercises(updated);
    localStorage.setItem(getCustomExKey(currentUser), JSON.stringify(updated));
    setAddExForm({ name: '', section: 'Back' });
    setShowAddExercise(false);
    setToast(copy.customExAdded);
    setAddExLoading(false);
  }

  function deleteCustomExercise(id) {
    if (!window.confirm(copy.deleteConfirmEstimate)) return;
    const updated = customExercises.filter(e => e.id !== id);
    setCustomExercises(updated);
    localStorage.setItem(getCustomExKey(currentUser), JSON.stringify(updated));
  }

  async function analyzeIngredients(e) {
    e.preventDefault();
    setIngredientLoading(true);
    setIngredientError('');
    setIngredientResults(null);
    const localFallback = analyzeIngredientsLocally({ mode: ingredientMode, query: ingredientQuery, preciseItems: ingredientItems });
    try {
      let prompt;
      if (ingredientMode === 'quick') {
        if (!ingredientQuery.trim()) { setIngredientLoading(false); return; }
        prompt = `You are a precise nutrition estimator using generic USDA-style average foods. Analyze these foods and estimate realistic portions:
"${ingredientQuery.trim()}"

Rules:
- Treat quantities like "2 eggs", "200g chicken", "1 cup rice" literally.
- If no quantity is given, use a normal serving size.
- Return JSON only, no markdown.
{"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"...","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"confidence":"low|moderate|high"}]}`;
      } else {
        const valid = ingredientItems.filter(i => i.name.trim() && Number(i.grams) > 0);
        if (!valid.length) { setIngredientLoading(false); return; }
        const list = valid.map(i => `- ${i.name.trim()} (${i.grams}g)`).join('\n');
        prompt = `You are a precise nutrition estimator using generic USDA-style average foods. Calculate exact nutrition for these ingredients:
${list}

Return JSON only, no markdown:
{"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"...","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"confidence":"low|moderate|high"}]}`;
      }
      let result = null;
      if (aiEnabled) {
        const text = await callGemini(currentUser, [{ text: prompt }], { generationConfig: { responseMimeType: 'application/json', temperature: 0.05, maxOutputTokens: 1600 } });
        const parsed = parseAiJson(text);
        if (parsed) result = sanitizeIngredientResult(parsed, 'ai');
      }
      if (!result) result = localFallback;
      if (!result) { setIngredientError('error'); return; }
      setIngredientResults(result);
      const totalKcal = Math.round(result.total.kcal);
      const label = getIngredientMealLabel(result);
      const totalGrams = result.items.reduce((sum, item) => sum + Number(item.grams || 0), 0);
      setCalHistory(prev => [{ id: Date.now(), name: label, grams: totalGrams, kcalPer100: totalGrams ? Math.round(totalKcal / totalGrams * 100) : 0, total: totalKcal, protein: Number(result.total.protein) || 0, carbs: Number(result.total.carbs) || 0, fat: Number(result.total.fat) || 0, date: new Date().toISOString().slice(0, 10) }, ...prev]);
      setToast(copy.calEstSaved);
    } catch {
      if (localFallback) {
        setIngredientResults(localFallback);
        const totalKcal = Math.round(localFallback.total.kcal);
        const label = getIngredientMealLabel(localFallback);
        const totalGrams = localFallback.items.reduce((sum, item) => sum + Number(item.grams || 0), 0);
        setCalHistory(prev => [{ id: Date.now(), name: label, grams: totalGrams, kcalPer100: totalGrams ? Math.round(totalKcal / totalGrams * 100) : 0, total: totalKcal, protein: Number(localFallback.total.protein) || 0, carbs: Number(localFallback.total.carbs) || 0, fat: Number(localFallback.total.fat) || 0, date: new Date().toISOString().slice(0, 10) }, ...prev]);
        setToast(copy.calEstSaved);
      } else {
        setIngredientError('error');
      }
    }
    finally { setIngredientLoading(false); }
  }

  function handleBodyFatImage(pose, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setBodyFatImages(prev => ({ ...prev, [pose]: { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl } }));
      setBodyFatResult(null); setBodyFatError('');
    };
    img.onerror = () => { URL.revokeObjectURL(url); setBodyFatError('error'); };
    img.src = url;
  }

  async function estimateBodyFat() {
    const photos = Object.entries(bodyFatImages).filter(([, img]) => img !== null);
    const metrics = {
      ...bodyFatMetrics,
      gender: bodyFatMetrics.gender || settings.gender || 'male',
      age: Number(bodyFatMetrics.age || settings.age) || 0,
      height: Number(bodyFatMetrics.height || settings.height) || 0,
      weight: Number(bodyFatMetrics.weight || dashboardBodyWeightKg) || 0,
      waist: Number(bodyFatMetrics.waist) || 0,
      neck: Number(bodyFatMetrics.neck) || 0,
      hip: Number(bodyFatMetrics.hip) || 0,
    };
    const measurementMethods = getMeasurementBodyFatMethods(metrics);
    if (!photos.length && !measurementMethods.length) return;
    setBodyFatLoading(true); setBodyFatError(''); setBodyFatResult(null);
    try {
      let photoEstimate = null;
      if (photos.length && aiEnabled) {
        const parts = [];
        photos.forEach(([pose, img]) => {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
          parts.push({ text: `This is the ${pose} view.` });
        });
        parts.push({ text: `Estimate visual body fat percentage from these photos. Use the measurements only as context, not as the final answer.
Context: gender=${metrics.gender}, age=${metrics.age || 'unknown'}, height_cm=${metrics.height || 'unknown'}, weight_kg=${metrics.weight || 'unknown'}, waist_cm=${metrics.waist || 'unknown'}, neck_cm=${metrics.neck || 'unknown'}, hip_cm=${metrics.hip || 'unknown'}.
Return ONLY JSON: {"bodyFatPercent":15.5,"confidence":"low|moderate|high","description":"one short reason"}` });
        const text = await callGemini(currentUser, parts);
        const m = text?.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (typeof parsed.bodyFatPercent === 'number') photoEstimate = parsed;
        }
      }
      const combined = combineBodyFatMethods(measurementMethods, photoEstimate, photos.length);
      if (!combined) { setBodyFatError('error'); return; }
      const weightKg = Number(metrics.weight) || 0;
      const fatMassKg = weightKg ? Number((weightKg * combined.bodyFatPercent / 100).toFixed(1)) : null;
      const leanMassKg = weightKg && fatMassKg !== null ? Number((weightKg - fatMassKg).toFixed(1)) : null;
      const nextResult = {
        ...combined,
        category: getBodyFatCategory(combined.bodyFatPercent, metrics.gender),
        fatMassKg,
        leanMassKg,
        description: settings.language === 'sl'
          ? 'Ocena uporablja obsege telesa, BMI/RFM in fotografije, ce je AI backend povezan. Za najtocnejse rezultate meri pas zjutraj in vnesi vrat ter boke pri zenskah.'
          : 'Estimate combines circumference formulas, BMI/RFM, and photos when the AI backend is connected. For best accuracy, measure waist in the morning and include neck plus hips for female users.',
      };
      setBodyFatResult(nextResult);
      setBodyFatHistory((current) => [{
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        result: nextResult,
        metrics,
        photoCount: photos.length,
      }, ...current].slice(0, 24));
      setToast(settings.language === 'sl' ? 'Ocena telesne mascobe shranjena.' : 'Body fat estimate saved.');
    } catch { setBodyFatError('error'); }
    finally { setBodyFatLoading(false); }
  }

  function calculateReverseCal(e) {
    e.preventDefault();
    const dailyKcal = Number(reverseCalDailyKcal);
    const goalWeight = Number(tdeeForm.goalWeight);
    const currentWeight = Number(tdeeForm.currentWeight);
    if (!dailyKcal || !goalWeight || !currentWeight) return;
    const userAge = Number(tdeeForm.age || settings.age) || 28;
    const userHeight = Number(tdeeForm.height || settings.height) || ((tdeeForm.gender || settings.gender) === 'female' ? 166 : 178);
    const gender = tdeeForm.gender || settings.gender || 'male';
    const activityLevel = tdeeForm.activityLevel || 'moderate';
    const plan = getNutritionPlan({
      currentWeight,
      goalWeight,
      weeks: Number(tdeeForm.weeks) || 12,
      age: userAge,
      height: userHeight,
      gender,
      activityLevel,
    });
    const totalDeltaKg = goalWeight - currentWeight;
    const firstWeek = simulateWeightFromCalories({
      startWeight: currentWeight,
      dailyCalories: dailyKcal,
      days: 7,
      age: userAge,
      height: userHeight,
      gender,
      activityLevel,
    });
    const firstWeekDelta = firstWeek.finalWeight - currentWeight;
    if (Math.abs(firstWeekDelta) < 0.02 || firstWeekDelta * totalDeltaKg <= 0) { setReverseCalResult({ error: 'noDiff' }); return; }
    const weeks = estimateWeeksToGoalFromCalories({
      currentWeight,
      goalWeight,
      dailyCalories: dailyKcal,
      age: userAge,
      height: userHeight,
      gender,
      activityLevel,
    });
    if (!weeks) { setReverseCalResult({ error: 'noDiff' }); return; }
    setReverseCalResult({ weeks, tdee: plan.tdee, dailyDiff: dailyKcal - plan.tdee, gaining: totalDeltaKg > 0 });
  }

  function saveBodyWeight(event) {
    event.preventDefault();
    if (!bwForm.weight || !bwForm.date) return;
    const entry = { id: Date.now(), date: bwForm.date, weight: Number(bwForm.weight) };
    setBodyWeightEntries((c) => [...c, entry].sort((a, b) => new Date(b.date) - new Date(a.date)));
    setBwForm((c) => ({ ...c, weight: '' }));
    setToast(copy.saved);
  }
  function deleteBodyWeightEntry(id) {
    if (!window.confirm(copy.deleteConfirmWeight)) return;
    setBodyWeightEntries((c) => c.filter((e) => e.id !== id));
  }
  function calculateTDEE(event) {
    event.preventDefault();
    const cw = Number(tdeeForm.currentWeight);
    const gw = Number(tdeeForm.goalWeight);
    const weeks = Number(tdeeForm.weeks);
    if (!cw || !gw || !weeks) return;
    const plan = getNutritionPlan({
      currentWeight: cw,
      goalWeight: gw,
      weeks,
      age: tdeeForm.age,
      height: tdeeForm.height,
      gender: tdeeForm.gender,
      activityLevel: tdeeForm.activityLevel,
    });
    setSettings(c => ({ ...c, gender: tdeeForm.gender, age: tdeeForm.age, height: tdeeForm.height, calorieGoal: plan.target, waterGoalMl: plan.waterMl }));
    setTdeeResult(plan);
  }
  function startTimer(seconds) {
    requestNotificationPermission();
    const s = Math.max(1, Math.round(seconds));
    setTimerPreset(s); setTimerSeconds(s); setTimerActive(true); setTimerDone(false);
    const endAt = Date.now() + s * 1000;
    timerEndAtRef.current = endAt;
    timerWorkerRef.current?.postMessage({ type: 'start', endAt });
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => { wakeLockRef.current = l; }).catch(() => {});
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    if ('Notification' in window && Notification.permission === 'granted') notifTimerRef.current = setTimeout(() => timerAlarmFnRef.current?.(), s * 1000);
  }
  function toggleTimer() {
    if (timerActive) {
      timerWorkerRef.current?.postMessage({ type: 'stop' });
      if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); notifTimerRef.current = null; }
      wakeLockRef.current?.release().catch(() => {}); wakeLockRef.current = null; timerEndAtRef.current = null;
      setTimerActive(false);
    } else {
      const s = timerSeconds > 0 ? timerSeconds : timerPreset;
      const endAt = Date.now() + s * 1000;
      timerEndAtRef.current = endAt;
      timerWorkerRef.current?.postMessage({ type: 'start', endAt });
      if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => { wakeLockRef.current = l; }).catch(() => {});
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      if ('Notification' in window && Notification.permission === 'granted') notifTimerRef.current = setTimeout(() => timerAlarmFnRef.current?.(), s * 1000);
      setTimerActive(true); setTimerDone(false);
    }
  }
  function resetTimer() {
    timerWorkerRef.current?.postMessage({ type: 'stop' });
    if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); notifTimerRef.current = null; }
    wakeLockRef.current?.release().catch(() => {}); wakeLockRef.current = null; timerEndAtRef.current = null;
    setTimerActive(false); setTimerSeconds(timerPreset); setTimerDone(false);
  }
  function adjustTimer(delta) {
    const newS = Math.max(5, timerSeconds + delta);
    setTimerSeconds(newS);
    if (timerActive) {
      const endAt = Date.now() + newS * 1000;
      timerEndAtRef.current = endAt;
      timerWorkerRef.current?.postMessage({ type: 'start', endAt });
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      if ('Notification' in window && Notification.permission === 'granted') notifTimerRef.current = setTimeout(() => timerAlarmFnRef.current?.(), newS * 1000);
    }
  }

  function toggleRestDay() {
    const today = new Date().toISOString().slice(0, 10);
    const updated = restDays.includes(today) ? restDays.filter(d => d !== today) : [...restDays, today];
    setRestDays(updated);
    localStorage.setItem(getRestKey(currentUser), JSON.stringify(updated));
  }

  function toggleCheatDay(date) {
    const updated = cheatDays.includes(date) ? cheatDays.filter(d => d !== date) : [...cheatDays, date];
    setCheatDays(updated);
    localStorage.setItem(getCheatKey(currentUser), JSON.stringify(updated));
  }

  function repeatWorkout(w) {
    if (!w) { setToast(copy.noWorkoutToRepeat); return; }
    if (!window.confirm(copy.repeatLastWorkoutConfirm)) return;
    setEditingWorkoutId(null);
    setFormData(c => ({ ...c, date: todayKey, exercise: w.exercise, weight: String(w.weight), setDetails: w.setDetails.map(String), setWeights: w.setWeights ? w.setWeights.map(String) : undefined }));
    setActiveSection('dashboard');
    window.setTimeout(() => scrollToFeatureTarget('add-workout'), 120);
  }

  function repeatLastWorkout() {
    repeatWorkout(sortedWorkouts[0]);
  }

  function reuseMeal(entry) {
    setCalorieForm({ date: new Date().toISOString().slice(0, 10), mealType: entry.mealType, name: entry.name, calories: String(entry.calories), protein: String(entry.protein || ''), carbs: String(entry.carbs || ''), fat: String(entry.fat || '') });
    setActiveSection('calories');
  }

  function copyYesterdayMeals() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const meals = calorieEntries.filter((entry) => entry.date === yesterdayKey);
    if (!meals.length) { setToast(copy.noYesterdayMeals); return; }
    const todayMealsCount = calorieEntries.filter((entry) => entry.date === todayKey).length;
    if (todayMealsCount && !window.confirm(copy.copyYesterdayDuplicateConfirm)) return;
    if (!todayMealsCount && !window.confirm(copy.copyYesterdayConfirm)) return;
    const now = Date.now();
    const copied = meals.map((entry, index) => ({
      ...entry,
      id: now + index,
      date: todayKey,
      copiedFromDate: yesterdayKey,
    }));
    setCalorieEntries((current) => [...current, ...copied]);
    setCalorieForm((current) => ({ ...current, date: todayKey }));
    setActiveSection('calories');
    window.setTimeout(() => scrollToFeatureTarget('add-meal'), 120);
    setToast(copy.copiedYesterdayMeals);
  }

  function copyYesterdayMealType(mealType) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const typeLabels = { breakfast: copy.breakfast, snack: copy.snack, lunch: copy.lunch, dinner: copy.dinner };
    const meals = calorieEntries.filter((entry) => entry.date === yesterdayKey && entry.mealType === mealType);
    const label = typeLabels[mealType] || mealType;
    setQuickActionsOpen(false);
    setCommandOpen(false);
    if (!meals.length) {
      setToast(settings.language === 'sl' ? `Včeraj ni vnosa za: ${label}.` : `No yesterday ${label.toLowerCase()} found.`);
      return;
    }
    const alreadyHasTypeToday = calorieEntries.some((entry) => entry.date === todayKey && entry.mealType === mealType);
    if (alreadyHasTypeToday && !window.confirm(copy.copyYesterdayDuplicateConfirm)) return;
    const now = Date.now();
    const copied = meals.map((entry, index) => ({
      ...entry,
      id: now + index,
      date: todayKey,
      copiedFromDate: yesterdayKey,
    }));
    setCalorieEntries((current) => [...current, ...copied]);
    setCalorieForm((current) => ({ ...current, date: todayKey, mealType }));
    setToast(settings.language === 'sl' ? `${label} dodan za danes.` : `${label} added for today.`);
  }

  function markTodayRestDay() {
    setQuickActionsOpen(false);
    setCommandOpen(false);
    if (restDays.includes(todayKey)) {
      setToast(copy.restDayDone);
      return;
    }
    const updated = [...restDays, todayKey];
    setRestDays(updated);
    localStorage.setItem(getRestKey(currentUser), JSON.stringify(updated));
    setToast(copy.restDayDone);
  }

  function markTodayCheatDay() {
    setQuickActionsOpen(false);
    setCommandOpen(false);
    if (cheatDays.includes(todayKey)) {
      setToast(copy.cheatDayDone);
      return;
    }
    const updated = [...cheatDays, todayKey];
    setCheatDays(updated);
    localStorage.setItem(getCheatKey(currentUser), JSON.stringify(updated));
    setToast(copy.cheatDayDone);
  }

  function getIngredientMealLabel(result = ingredientResults) {
    if (result?.mealName) return result.mealName;
    if (result?.source?.startsWith('photo') && result.items?.length) {
      return result.items.map((item) => item.name).filter(Boolean).slice(0, 3).join(', ') || 'Photo food estimate';
    }
    return ingredientMode === 'quick'
      ? (ingredientQuery.trim() || 'Estimated food')
      : ingredientItems.filter((item) => item.name.trim()).map((item) => item.name.trim()).join(', ') || 'Estimated food';
  }
  function rebuildIngredientResult(items, current = ingredientResults) {
    const cleaned = items.map((item) => ({
      ...item,
      name: String(item.name || 'Food').slice(0, 80),
      grams: Math.max(0, Math.round(Number(item.grams) || 0)),
      kcalPer100: Math.max(0, Math.round(Number(item.kcalPer100) || 0)),
      kcal: Math.max(0, Math.round(Number(item.kcal) || 0)),
      protein: Number((Number(item.protein) || 0).toFixed(1)),
      carbs: Number((Number(item.carbs) || 0).toFixed(1)),
      fat: Number((Number(item.fat) || 0).toFixed(1)),
      fiber: Number((Number(item.fiber) || 0).toFixed(1)),
      sugar: Number((Number(item.sugar) || 0).toFixed(1)),
      confidence: ['low', 'moderate', 'high'].includes(item.confidence) ? item.confidence : 'moderate',
    })).filter((item) => item.name && (item.kcal || item.grams));
    if (!cleaned.length) return null;
    const next = buildNutritionResult(cleaned, current?.source || 'manual');
    return {
      ...next,
      mealName: current?.mealName || '',
      assumptions: current?.assumptions || [],
      warnings: current?.warnings || [],
      calorieRange: current?.calorieRange || null,
      reviewed: true,
    };
  }
  function updateIngredientReviewItem(index, field, value) {
    setIngredientResults((current) => {
      if (!current?.items?.length) return current;
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'grams') {
          const oldGrams = Number(item.grams) || 0;
          const newGrams = Number(value) || 0;
          if (oldGrams > 0 && newGrams > 0) {
            const ratio = newGrams / oldGrams;
            ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'].forEach((key) => {
              next[key] = key === 'kcal'
                ? Math.round((Number(item[key]) || 0) * ratio)
                : Number(((Number(item[key]) || 0) * ratio).toFixed(1));
            });
          } else if (Number(item.kcalPer100) > 0 && newGrams > 0) {
            next.kcal = Math.round((Number(item.kcalPer100) * newGrams) / 100);
          }
        }
        if (field === 'kcal' && Number(item.grams) > 0) {
          next.kcalPer100 = Math.round((Number(value) || 0) / Number(item.grams) * 100);
        }
        return next;
      });
      return rebuildIngredientResult(items, current) || current;
    });
  }
  function removeIngredientReviewItem(index) {
    setIngredientResults((current) => {
      if (!current?.items?.length || current.items.length <= 1) return current;
      return rebuildIngredientResult(current.items.filter((_, itemIndex) => itemIndex !== index), current) || current;
    });
  }
  function addIngredientReviewItem() {
    setIngredientResults((current) => {
      const base = current || { source: 'manual', items: [], assumptions: [], warnings: [] };
      const nextItem = { name: 'Food item', grams: 100, kcalPer100: 100, kcal: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, confidence: 'low', assumption: 'Added manually' };
      return rebuildIngredientResult([...(base.items || []), nextItem], base) || base;
    });
  }
  function addIngredientResultToMeals(result = ingredientResults) {
    if (!result?.total) return;
    const entry = {
      id: Date.now(),
      date: calorieForm.date || new Date().toISOString().slice(0, 10),
      mealType: calorieForm.mealType || 'snack',
      name: getIngredientMealLabel(result),
      calories: Math.round(Number(result.total.kcal) || 0),
      protein: Number(result.total.protein) || 0,
      carbs: Number(result.total.carbs) || 0,
      fat: Number(result.total.fat) || 0,
    };
    setCalorieEntries((current) => [...current, entry]);
    const totalGrams = result.items?.reduce((sum, item) => sum + Number(item.grams || 0), 0) || 0;
    setCalHistory(prev => [{
      id: Date.now() + 1,
      name: entry.name,
      grams: totalGrams,
      kcalPer100: totalGrams ? Math.round(entry.calories / totalGrams * 100) : 0,
      total: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      date: entry.date,
      source: result.source,
    }, ...prev]);
    setToast(settings.language === 'sl' ? 'Ocena dodana v obroke.' : 'Estimate added to meals.');
  }
  function editIngredientResultAsMeal(result = ingredientResults) {
    if (!result?.total) return;
    setCalorieForm((current) => ({
      ...current,
      mealType: current.mealType || 'snack',
      name: getIngredientMealLabel(result),
      calories: String(Math.round(Number(result.total.kcal) || 0)),
      protein: String(Number(result.total.protein) || ''),
      carbs: String(Number(result.total.carbs) || ''),
      fat: String(Number(result.total.fat) || ''),
    }));
    setActiveSection('calories');
  }
  function reuseBodyFatEntry(entry) {
    if (!entry) return;
    if (entry.metrics) {
      setBodyFatMetrics({
        gender: entry.metrics.gender || settings.gender || 'male',
        age: entry.metrics.age ? String(entry.metrics.age) : '',
        height: entry.metrics.height ? String(entry.metrics.height) : '',
        weight: entry.metrics.weight ? String(entry.metrics.weight) : '',
        waist: entry.metrics.waist ? String(entry.metrics.waist) : '',
        neck: entry.metrics.neck ? String(entry.metrics.neck) : '',
        hip: entry.metrics.hip ? String(entry.metrics.hip) : '',
      });
    }
    if (entry.result) setBodyFatResult(entry.result);
    setToast(settings.language === 'sl' ? 'Meritve so nalozene.' : 'Measurements loaded.');
  }
  function deleteBodyFatEntry(id) {
    if (!window.confirm(copy.deleteConfirmEstimate)) return;
    setBodyFatHistory((current) => current.filter((entry) => entry.id !== id));
  }

  function submitRating(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!ratingForm.stars && !ratingForm.comment.trim()) return;
    const entry = { id: Date.now(), email: currentUser, stars: ratingForm.stars, comment: ratingForm.comment.trim(), privateComment: ratingForm.privateComment.trim(), date: new Date().toISOString().slice(0, 10) };
    const updated = [entry, ...ratings];
    setRatings(updated);
    saveRatings(updated);
    setRatingForm({ stars: 5, comment: '', privateComment: '' });
    setFeedbackSent(true);
    setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false); }, 1800);
  }

  const navIconProps = { size: 18, strokeWidth: 2.2 };
  const NAV_ICONS = {
    dashboard: <Home {...navIconProps} />,
    exercises: <Dumbbell {...navIconProps} />,
    history: <ClipboardList {...navIconProps} />,
    bodyweight: <Scale {...navIconProps} />,
    calories: <Utensils {...navIconProps} />,
    ocenjevalec: <Search {...navIconProps} />,
    rankings: <Trophy {...navIconProps} />,
    advisor: <Lightbulb {...navIconProps} />,
    settings: <Settings {...navIconProps} />,
    admin: <Shield {...navIconProps} />,
  };
  const NAV_SHORT_LABELS = {
    en: { dashboard: 'Home', exercises: 'Train', history: 'Log', bodyweight: 'Weight', calories: 'Meals', ocenjevalec: 'Search', rankings: 'Rank', advisor: 'Tips', settings: 'Options', admin: 'Admin' },
    sl: { dashboard: 'Domov', exercises: 'Vaje', history: 'Arhiv', bodyweight: 'Teza', calories: 'Obroki', ocenjevalec: 'Isci', rankings: 'Rang', advisor: 'Nasvet', settings: 'Opcije', admin: 'Admin' },
    es: { dashboard: 'Inicio', exercises: 'Entrena', history: 'Log', bodyweight: 'Peso', calories: 'Comidas', ocenjevalec: 'Buscar', rankings: 'Rango', advisor: 'Tips', settings: 'Opciones', admin: 'Admin' },
    pt: { dashboard: 'Inicio', exercises: 'Treino', history: 'Log', bodyweight: 'Peso', calories: 'Refeicoes', ocenjevalec: 'Busca', rankings: 'Rank', advisor: 'Dicas', settings: 'Opcoes', admin: 'Admin' },
    fr: { dashboard: 'Accueil', exercises: 'Sport', history: 'Log', bodyweight: 'Poids', calories: 'Repas', ocenjevalec: 'Chercher', rankings: 'Rang', advisor: 'Conseil', settings: 'Options', admin: 'Admin' },
    tr: { dashboard: 'Ana', exercises: 'Antren', history: 'Log', bodyweight: 'Kilo', calories: 'Ogun', ocenjevalec: 'Ara', rankings: 'Sira', advisor: 'Ipucu', settings: 'Ayar', admin: 'Admin' },
    ar: { dashboard: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629', exercises: '\u062a\u0645\u0631\u064a\u0646', history: '\u0633\u062c\u0644', bodyweight: '\u0648\u0632\u0646', calories: '\u0648\u062c\u0628\u0627\u062a', ocenjevalec: '\u0628\u062d\u062b', rankings: '\u0631\u062a\u0628\u0629', advisor: '\u0646\u0635\u064a\u062d\u0629', settings: '\u0625\u0639\u062f\u0627\u062f', admin: 'Admin' },
    ja: { dashboard: '\u30db\u30fc\u30e0', exercises: '\u904b\u52d5', history: '\u8a18\u9332', bodyweight: '\u4f53\u91cd', calories: '\u98df\u4e8b', ocenjevalec: '\u691c\u7d22', rankings: '\u30e9\u30f3\u30af', advisor: '\u63d0\u6848', settings: '\u8a2d\u5b9a', admin: 'Admin' },
    zh: { dashboard: '\u9996\u9875', exercises: '\u8bad\u7ec3', history: '\u8bb0\u5f55', bodyweight: '\u4f53\u91cd', calories: '\u9910\u98df', ocenjevalec: '\u641c\u7d22', rankings: '\u6392\u540d', advisor: '\u5efa\u8bae', settings: '\u8bbe\u7f6e', admin: 'Admin' },
    ru: { dashboard: '\u0414\u043e\u043c', exercises: '\u0422\u0440\u0435\u043d', history: '\u041b\u043e\u0433', bodyweight: '\u0412\u0435\u0441', calories: '\u0415\u0434\u0430', ocenjevalec: '\u041f\u043e\u0438\u0441\u043a', rankings: '\u0420\u0430\u043d\u0433', advisor: '\u0421\u043e\u0432\u0435\u0442', settings: '\u041e\u043f\u0446\u0438\u0438', admin: 'Admin' },
  };
  const NAV_SHORT = NAV_SHORT_LABELS[settings.language] || NAV_SHORT_LABELS.en;
  const nav = [['dashboard', copy.dashboard], ['exercises', copy.exercises], ['history', copy.history], ['bodyweight', copy.bodyweight], ['calories', copy.calories], ['ocenjevalec', copy.ocenjevalec], ['rankings', copy.rankings], ['advisor', copy.advisor], ['settings', copy.settings], ...(currentUser === ADMIN_EMAIL ? [['admin', copy.admin]] : [])];
  function scrollToFeatureTarget(targetId) {
    const target = document.querySelector(`[data-tour="${targetId}"]`);
    if (!target) return;
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (isMobile) {
      const targetRect = target.getBoundingClientRect();
      if (mainContentRef.current) {
        const scroller = mainContentRef.current;
        const scrollerRect = scroller.getBoundingClientRect();
        const targetTop = scroller.scrollTop + targetRect.top - scrollerRect.top - 84;
        scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
      const pageTop = window.scrollY + targetRect.top - 84;
      window.scrollTo({ top: Math.max(0, pageTop), behavior: 'smooth' });
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
  function goToFeature(section, targetId = 'section-intro') {
    setActiveSection(section);
    setCommandOpen(false);
    setQuickActionsOpen(false);
    setCommandQuery('');
    setHelpTopic(null);
    window.setTimeout(() => scrollToFeatureTarget(targetId), 120);
    window.setTimeout(() => scrollToFeatureTarget(targetId), 360);
  }
  function scrollToSettingsLanguage() {
    setHelpTopic(null);
    const scroll = () => {
      const target = document.getElementById('settings-language-card') || document.getElementById('lang');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    };
    window.setTimeout(scroll, 60);
    window.setTimeout(scroll, 240);
  }
  const slUi = settings.language === 'sl';
  const commandActions = [
    ...nav.map(([id, label]) => ({
      id: `nav-${id}`,
      label,
      description: sectionDescriptions[id] || '',
      icon: NAV_ICONS[id],
      keywords: `${id} ${label}`,
      quick: ['dashboard', 'calories', 'bodyweight', 'rankings', 'settings'].includes(id),
      run: () => goToFeature(id, 'section-intro'),
    })),
    { id: 'log-workout', label: slUi ? 'Dodaj trening' : 'Log workout', description: slUi ? 'Skoci direktno na vnos treninga.' : 'Jump directly to workout logging.', icon: NAV_ICONS.dashboard, keywords: 'workout trening add log sets reps weight', quick: true, run: () => goToFeature('dashboard', 'add-workout') },
    { id: 'rest-timer', label: slUi ? 'Timer za pavzo' : 'Rest timer', description: slUi ? 'Odpri timer in kontrole za pocitek.' : 'Open timer and recovery controls.', icon: NAV_ICONS.dashboard, keywords: 'timer rest pause pocitek', quick: true, run: () => goToFeature('dashboard', 'timer-rest') },
    { id: 'add-meal', label: slUi ? 'Dodaj obrok' : 'Add meal', description: slUi ? 'Skoci na hiter vnos obroka.' : 'Jump to meal entry.', icon: NAV_ICONS.calories, keywords: 'meal food calories obrok kalorije', quick: true, run: () => goToFeature('calories', 'add-meal') },
    { id: 'add-weight', label: copy.addWeight, description: slUi ? 'Skoci na meritev telesne teze.' : 'Jump to body-weight entry.', icon: NAV_ICONS.bodyweight, keywords: 'weight bodyweight teza measurement', quick: true, run: () => goToFeature('bodyweight', 'bodyweight-tracker') },
    { id: 'quick-water-add', label: slUi ? '+250 ml vode' : '+250 ml water', description: slUi ? 'Takoj dodaj 250 ml k danasnjemu vnosu.' : 'Instantly add 250 ml to today.', icon: NAV_ICONS.bodyweight, keywords: 'water voda add hydration', quick: true, run: () => { addWater(250); setQuickActionsOpen(false); setCommandOpen(false); } },
    { id: 'water', label: slUi ? 'Voda' : 'Water', description: slUi ? 'Hiter vnos vode in pregled cilja.' : 'Quick water logging and goal check.', icon: NAV_ICONS.bodyweight, keywords: 'water voda hydration hidracija', quick: true, run: () => goToFeature('bodyweight', 'water-tracker') },
    { id: 'calorie-calculator', label: slUi ? 'Kalkulator kalorij' : 'Calorie calculator', description: slUi ? 'Izracunaj cilj kalorij, makrote in realen cas.' : 'Calculate target calories, macros, and realistic time.', icon: NAV_ICONS.bodyweight, keywords: 'tdee calorie calculator macros kalkulator', quick: true, run: () => goToFeature('bodyweight', 'calorie-calculator') },
    { id: 'ingredient', label: slUi ? 'Oceni hrano' : 'Estimate food', description: slUi ? 'AI/offline ocena kalorij iz opisa hrane.' : 'AI/offline calorie estimate from a food description.', icon: NAV_ICONS.ocenjevalec, keywords: 'ai food ingredient estimate kcal hrana', quick: true, run: () => goToFeature('ocenjevalec', 'ingredient-tracker') },
    { id: 'body-fat', label: slUi ? 'Body fat ocena' : 'Body fat estimate', description: slUi ? 'Odpri meritve in foto oceno telesne mascobe.' : 'Open measurements and photo-based body-fat estimate.', icon: NAV_ICONS.ocenjevalec, keywords: 'body fat estimate mascoba photo', quick: false, run: () => goToFeature('ocenjevalec', 'body-fat-estimator') },
    { id: 'muscle-ranks', label: slUi ? 'Misicni rangi' : 'Muscle ranks', description: slUi ? 'Skoci na interaktivni ranking misic.' : 'Jump to interactive muscle ranking.', icon: NAV_ICONS.rankings, keywords: 'rank ranking muscle misice', quick: true, run: () => goToFeature('rankings', 'muscle-rankings') },
    { id: 'advisor-open', label: slUi ? 'Kaj trenirati danes' : 'What to train today', description: slUi ? 'Odpri advisor predlog za trening.' : 'Open the workout advisor suggestion.', icon: NAV_ICONS.advisor, keywords: 'advisor suggestion workout today nasvet', quick: true, run: () => goToFeature('advisor', 'advisor-panel') },
    { id: 'tutorial-open', label: copy.tutorialOpen, description: slUi ? 'Zazeni celoten vodeni tutorial.' : 'Start the full guided tutorial.', icon: '?', keywords: 'tutorial guide help pomoc vodič vodic', quick: false, run: () => { setCommandOpen(false); setQuickActionsOpen(false); setCommandQuery(''); setTutorialStep(0); setShowTutorial(true); } },
    { id: 'export-data', label: copy.export, description: slUi ? 'Prenesi varnostno kopijo podatkov.' : 'Download a backup of your data.', icon: 'JSON', keywords: 'export backup json data podatki', quick: false, run: () => { setCommandOpen(false); setQuickActionsOpen(false); setCommandQuery(''); exportData(); } },
  ];
  const commandSearch = commandQuery.trim().toLowerCase();
  const commandMatches = commandActions.filter((action) => !commandSearch || `${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(commandSearch)).slice(0, 12);
  const mealActionTypes = ['breakfast', 'snack', 'lunch', 'dinner'];
  const mealActionLabels = { breakfast: copy.breakfast, snack: copy.snack, lunch: copy.lunch, dinner: copy.dinner };
  const quickActions = [
    ...mealActionTypes.map((type) => ({
      id: `copy-yesterday-${type}`,
      label: slUi ? `Dodaj včerajšnji ${mealActionLabels[type].toLowerCase()}` : `Add yesterday ${mealActionLabels[type].toLowerCase()}`,
      description: slUi ? `Kopira včerajšnji ${mealActionLabels[type].toLowerCase()} na danes.` : `Copies yesterday ${mealActionLabels[type].toLowerCase()} to today.`,
      icon: NAV_ICONS.calories,
      run: () => copyYesterdayMealType(type),
    })),
    { id: 'action-water-250', label: slUi ? '+250 ml vode' : '+250 ml water', description: slUi ? 'Takoj dodaj 250 ml vode.' : 'Instantly add 250 ml water.', icon: NAV_ICONS.bodyweight, run: () => { addWater(250); setQuickActionsOpen(false); setCommandOpen(false); } },
    { id: 'action-rest-day', label: restDays.includes(todayKey) ? copy.restDayDone : copy.restDay, description: slUi ? 'Označi danes kot dan za počitek.' : 'Mark today as a rest day.', icon: NAV_ICONS.dashboard, run: markTodayRestDay },
    { id: 'action-cheat-day', label: cheatDays.includes(todayKey) ? copy.cheatDayDone : copy.cheatDay, description: slUi ? 'Označi danes kot cheat day.' : 'Mark today as a cheat day.', icon: NAV_ICONS.calories, run: markTodayCheatDay },
    { id: 'action-repeat-workout', label: copy.repeatLastWorkout, description: slUi ? 'Pripravi zadnji trening za ponoven vnos danes.' : 'Prepare your last workout to log again today.', icon: NAV_ICONS.dashboard, run: repeatLastWorkout },
  ];
  function runCommandAction(action) {
    if (!action) return;
    action.run();
  }
  useEffect(() => {
    if (!currentUser) return undefined;
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const isTyping = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        setQuickActionsOpen(false);
        return;
      }
      if (event.key === '/' && !isTyping && !commandOpen) {
        event.preventDefault();
        setCommandOpen(true);
        setQuickActionsOpen(false);
        return;
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setQuickActionsOpen(false);
        setHelpTopic(null);
        setFeedbackOpen(false);
        setShowTutorial(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen, currentUser]);
  useEffect(() => {
    if (!commandOpen) return undefined;
    const id = window.setTimeout(() => commandInputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [commandOpen]);
  const passwordStrength = getPasswordScore(authForm.password, authForm.email);
  const strengthLabels = [copy.authStrengthWeak, copy.authStrengthWeak, copy.authStrengthOk, copy.authStrengthGood, copy.authStrengthStrong];
  const passwordRules = [
    ['length', copy.authRuleLength],
    ['variety', copy.authRuleVariety],
    ['noEmail', copy.authRuleNoEmail],
    ['common', copy.authRuleCommon],
  ];

  if (!currentUser) {
    return (
      <div className="auth-shell auth-shell-premium">
        <section className="auth-stage">
          <div className="auth-hero-panel">
            <div className="auth-brand-lockup">
              <div className="logo-icon auth-logo">P</div>
              <div>
                <p className="auth-eyebrow">{copy.authEyebrow}</p>
                <h1>{adminConfig.appName || copy.app}</h1>
              </div>
            </div>
            <div className="auth-hero-copy">
              <h2>{copy.authTitle}</h2>
              <p>{copy.landingTagline || copy.authSubtitle}</p>
            </div>
            <div className="auth-feature-grid" aria-label="PowerGraph features">
              <article><strong>{copy.landingWorkoutCard}</strong><span>6x / week</span></article>
              <article><strong>{copy.landingCaloriesCard}</strong><span>1850 / 2200 kcal</span></article>
              <article><strong>{copy.landingProgressCard}</strong><span>Rank: Silver</span></article>
            </div>
            <div className="auth-preview-card">
              <div><span>{copy.landingTodayPreview}</span><strong>1850 / 2200 kcal</strong></div>
              <div><span>{copy.workouts}</span><strong>7 {settings.language === 'sl' ? 'ta teden' : 'this week'}</strong></div>
              <div><span>{copy.rankTitle}</span><strong>Silver</strong></div>
            </div>
            <div className="auth-security-strip" aria-label="Security highlights">
              <span>{copy.authSecurityLocal}</span>
              <span>{copy.authSecurityHash}</span>
              <span>{copy.authSecuritySync}</span>
            </div>
          </div>

          <section className="glass-panel auth-card auth-card-premium" aria-labelledby="auth-heading">
            <div className="auth-tabs auth-mode-tabs" role="tablist" aria-label="Authentication mode">
              <button className={`auth-mode-btn ${authMode === 'login' ? 'active' : ''}`} type="button" role="tab" aria-selected={authMode === 'login'} onClick={() => { setAuthMode('login'); setAuthError(''); }}>
                {copy.login}
              </button>
              {adminConfig.signupEnabled && <button className={`auth-mode-btn ${authMode === 'signup' ? 'active' : ''}`} type="button" role="tab" aria-selected={authMode === 'signup'} onClick={() => { setAuthMode('signup'); setAuthError(''); }}>
                {copy.signup}
              </button>}
            </div>

            <div className="auth-copy">
              <p className="auth-eyebrow">{authMode === 'signup' ? copy.signup : copy.login}</p>
              <h2 id="auth-heading">{authMode === 'signup' ? copy.authSignupTitle : copy.authLoginTitle}</h2>
              <p>{authMode === 'signup' ? copy.authSignupSubtitle : copy.authLoginSubtitle}</p>
            </div>

            <form className="premium-form auth-form" onSubmit={handleAuthSubmit}>
              <div className={`auth-field ${authTouched.email && authForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email.trim()) ? 'invalid' : ''}`}>
                <label htmlFor="auth-email">{copy.email}</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">@</span>
                  <input id="auth-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={authForm.email} onBlur={() => setAuthTouched((c) => ({ ...c, email: true }))} onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">{copy.password}</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">#</span>
                  <input id="auth-password" type={showAuthPassword ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authForm.password} onBlur={() => setAuthTouched((c) => ({ ...c, password: true }))} onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))} />
                  <button className="auth-field-action" type="button" onClick={() => setShowAuthPassword((v) => !v)} aria-label={showAuthPassword ? copy.authHidePassword : copy.authShowPassword}>{showAuthPassword ? copy.authHideShort : copy.authShowShort}</button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="password-quality" aria-live="polite">
                  <div className="password-quality-top"><span>{copy.authStrength}</span><strong>{strengthLabels[passwordStrength.score]}</strong></div>
                  <div className={`password-meter score-${passwordStrength.score}`}><span /></div>
                  <div className="password-rule-grid">
                    {passwordRules.map(([key, label]) => <span className={passwordStrength.checks[key] ? 'met' : ''} key={key}>{passwordStrength.checks[key] ? '✓' : '•'} {label}</span>)}
                  </div>
                  <p>{copy.authPasswordHint}</p>
                </div>
              )}

              {authMode === 'signup' ? (
                <div className="auth-field">
                  <label htmlFor="auth-confirm">{copy.confirmPassword}</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">#</span>
                    <input id="auth-confirm" type={showAuthConfirm ? 'text' : 'password'} autoComplete="new-password" value={authForm.confirmPassword} onBlur={() => setAuthTouched((c) => ({ ...c, confirmPassword: true }))} onChange={(e) => setAuthForm((c) => ({ ...c, confirmPassword: e.target.value }))} />
                    <button className="auth-field-action" type="button" onClick={() => setShowAuthConfirm((v) => !v)} aria-label={showAuthConfirm ? copy.authHidePassword : copy.authShowPassword}>{showAuthConfirm ? copy.authHideShort : copy.authShowShort}</button>
                  </div>
                </div>
              ) : null}

              {authMode === 'signup' ? (
                <div className="auth-field">
                  <label>{copy.genderTitle}</label>
                  <div className="auth-gender-toggle">
                    <button className={authForm.gender === 'male' ? 'active' : ''} type="button" onClick={() => setAuthForm((c) => ({ ...c, gender: 'male' }))}>{copy.tdeeMale}</button>
                    <button className={authForm.gender === 'female' ? 'active' : ''} type="button" onClick={() => setAuthForm((c) => ({ ...c, gender: 'female' }))}>{copy.tdeeFemale}</button>
                  </div>
                </div>
              ) : null}

              {authError ? <p className="auth-error auth-error-premium" role="alert">{authError}</p> : null}
              <button className="action-btn-primary full-width auth-submit" type="submit" disabled={authLoading}>{authLoading ? '...' : authMode === 'signup' ? copy.authCreate : copy.authEnter}</button>
            </form>

            {adminConfig.signupEnabled && <div className="auth-card-footer">
              <span>{authMode === 'signup' ? copy.authSwitchLogin : copy.authSwitchSignup}</span>
              <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }}>{authMode === 'signup' ? copy.login : copy.signup}</button>
            </div>}
            <p className="auth-local-note">{copy.authLocalOnly}</p>
          </section>
        </section>
      </div>
    );
  }

  if (adminConfig.maintenanceMode && currentUser !== ADMIN_EMAIL) {
    return (
      <div className="auth-shell auth-shell-premium">
        <section className="glass-panel auth-card auth-card-premium" style={{maxWidth:'460px',width:'100%'}}>
          <div className="auth-copy">
            <p className="auth-eyebrow">{adminConfig.appName || copy.app}</p>
            <h2>{settings.language === 'sl' ? 'Maintenance mode' : 'Maintenance mode'}</h2>
            <p>{settings.language === 'sl' ? 'Aplikacija je trenutno zaklenjena za uporabnike. Poskusi kasneje.' : 'The app is temporarily locked for users. Please come back later.'}</p>
          </div>
          {adminConfig.announcementText && <p className="auth-local-note">{adminConfig.announcementText}</p>}
          <button className="action-btn-primary full-width" type="button" onClick={logout}>{copy.logout}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="glass-panel sidebar" {...tourAttrs('navigation')}>
        <div className="brand"><div className="logo-icon">P</div><h2>{adminConfig.appName || copy.app}</h2></div>
        <nav className="nav-menu">{nav.map(([id, label]) => <button key={id} className={`nav-btn ${activeSection === id ? 'active' : ''}`} type="button" onClick={() => setActiveSection(id)}><span className="nav-icon">{NAV_ICONS[id]}</span><span className="nav-label-full">{label}</span><span className="nav-label-short">{NAV_SHORT[id]}</span></button>)}</nav>
      </aside>

      <main className="main-content" ref={mainContentRef}>
        <header className="topbar">
          <div className="greeting">
            <h2 data-mobile-title={adminConfig.appName || copy.app}>{activeSection === 'admin' ? (settings.language === 'sl' ? 'Admin center' : 'Admin Center') : copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
          <div className="settings-button-row topbar-actions">
            {(timerActive || timerDone) && activeSection !== 'dashboard' && (
              <button
                className={`action-btn-outline timer-float-btn${timerDone ? ' timer-float-done' : ''}`}
                type="button"
                onClick={() => setActiveSection('dashboard')}
                title={copy.timerTitle}
              >
                ⏱ {timerDone ? copy.timerDone : `${Math.floor(timerSeconds/60).toString().padStart(2,'0')}:${(timerSeconds%60).toString().padStart(2,'0')}`}
              </button>
            )}
            {syncing && <span className="sync-indicator" title={settings.language === 'sl' ? 'Sinhroniziram...' : 'Syncing...'}>↻</span>}
            <button className="quick-open-btn" type="button" onClick={() => { setQuickActionsOpen((open) => !open); setCommandOpen(false); }} title={slUi ? 'Akcije' : 'Actions'} aria-label={slUi ? 'Odpri akcije' : 'Open actions'} aria-expanded={quickActionsOpen}>
              <span>{slUi ? 'Akcije' : 'Actions'}</span>
            </button>
            <button className="context-help-btn topbar-help-btn" type="button" onClick={() => setHelpTopic('tutorial')} title={copy.tutorialOpen} aria-label={copy.tutorialOpen}>?</button>
            <span className="user-chip">{getUserBadge(currentUser)}</span>
            <button
              className="theme-toggle"
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              data-mode={theme}
              onClick={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}
            >
              <span aria-hidden="true">{theme === 'dark' ? 'LT' : 'DK'}</span>
            </button>
            <button className="action-btn-outline" type="button" onClick={logout}>{copy.logout}</button>
          </div>
        </header>
        <section className="glass-panel section-intro fade-in-up" {...tourAttrs('section-intro')}>
          <div>
            <p className="exercise-category"><span className="nav-icon" style={{marginRight:'0.4rem'}}>{NAV_ICONS[activeSection]}</span>{nav.find(([id]) => id === activeSection)?.[1]}</p>
            <p>{sectionDescriptions[activeSection]}</p>
          </div>
          {helpButton('sectionIntro')}
        </section>
        {adminConfig.announcementEnabled && adminConfig.announcementText && <section className="glass-panel admin-announcement-banner fade-in-up"><strong>{settings.language === 'sl' ? 'Admin obvestilo' : 'Admin notice'}</strong><span>{adminConfig.announcementText}</span></section>}
        {backupDue && adminConfig.backupBannerEnabled && <section className="glass-panel backup-banner fade-in-up"><div><h3>{copy.backupTitle}</h3><p>{copy.backupText}</p></div><button className="action-btn-primary" type="button" onClick={exportData}>{copy.export}</button></section>}

        {activeSection === 'dashboard' && <>
          <div className="dashboard-grid dashboard-home-grid">
            <StatCard icon={<Utensils size={22} strokeWidth={2.2} />} title={copy.dashboardTodayCalories} value={Math.round(todayTotals.calories)} unit={copy.kcalShort} glow="blue" />
            <StatCard icon={<Flame size={22} strokeWidth={2.2} />} title={copy.streak} value={workoutStreak} glow="green" />
            <StatCard icon={<Scale size={22} strokeWidth={2.2} />} title={copy.dashboardBodyWeight} value={latestBodyWeightEntry ? formatWeight(latestBodyWeightEntry.weight, settings.units) : '-'} glow="purple" />
            <StatCard icon={<Trophy size={22} strokeWidth={2.2} />} title={copy.dashboardWeeklyVolume} value={formatVolume(weeklyVolumeKg, settings.units)} glow="orange" />
            <section className="glass-panel daily-control-panel fade-in-up" {...tourAttrs('dashboard-overview')}>
              <div className="panel-header">
                <h3>{settings.language === 'sl' ? 'Dnevni center' : 'Daily Control'}</h3>
                <div className="settings-button-row panel-help-row">{helpButton('dashboardOverview')}<span className="history-count">{dailyControl.score}%</span></div>
              </div>
              <div className="daily-control-grid">
                <article>
                  <span>{settings.language === 'sl' ? 'Status' : 'Status'}</span>
                  <strong>{settings.language === 'sl' ? (dailyControl.label === 'locked in' ? 'odlicno' : dailyControl.label === 'on track' ? 'v ritmu' : dailyControl.label === 'needs attention' ? 'potrebuje fokus' : 'reset dan') : dailyControl.label}</strong>
                  <small>{settings.language === 'sl' ? 'Skupni signal za danes' : 'Today at a glance'}</small>
                </article>
                <article>
                  <span>{settings.language === 'sl' ? 'Trening' : 'Training'}</span>
                  <strong>{dailyControl.trainingText}</strong>
                  <small>{settings.language === 'sl' ? 'Trening ali oznacen pocitek stejeta pozitivno' : 'Training or a marked rest day both count'}</small>
                </article>
                <article>
                  <span>{settings.language === 'sl' ? 'Kalorije' : 'Calories'}</span>
                  <strong style={{color: dailyControl.calorieDelta < 0 ? 'var(--error)' : 'var(--secondary-glow)'}}>{dailyControl.calorieDelta >= 0 ? '+' : ''}{dailyControl.calorieDelta} kcal</strong>
                  <small>{settings.language === 'sl' ? 'Preostanek glede na dnevni cilj' : 'Remaining against daily goal'}</small>
                </article>
                <article>
                  <span>{settings.language === 'sl' ? 'Voda' : 'Water'}</span>
                  <strong>{dailyControl.hydrationPct}%</strong>
                  <small>{(waterToday / 1000).toFixed(1)} / {(dailyControl.waterGoalMl / 1000).toFixed(1)} L</small>
                </article>
              </div>
            </section>
            <section className="glass-panel chart-panel fade-in-up" {...tourAttrs('chart-progress')}>
              <div className="panel-header"><h3>{copy.chart}</h3><button className={`action-btn-${settings.weightDrop ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem',marginLeft:'auto'}} title={copy.weightDropDesc} onClick={() => setSettings(c => ({ ...c, weightDrop: !c.weightDrop }))}>⚖️ {copy.weightDrop}</button></div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.75rem'}}>
                {Object.keys(sections).map(sec => (
                  <button key={sec} type="button" className={`action-btn-outline${chartSection === sec ? ' active-filter' : ''}`} style={{fontSize:'0.78rem',padding:'0.25rem 0.65rem'}} onClick={() => { setChartSection(sec === chartSection ? null : sec); }}>
                    {sectionNames[sec]}
                  </button>
                ))}
              </div>
              {chartSection && (
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.75rem'}}>
                  {sections[chartSection].map(name => (
                    <button key={name} type="button" className={`action-btn-outline chart-ex-btn-active${selectedExercise === name ? ' active-filter' : ''}`} style={{fontSize:'0.78rem',padding:'0.25rem 0.65rem'}} onClick={() => setSelectedExercise(name)}>
                      {getExerciseName(name, settings.language)}
                    </button>
                  ))}
                </div>
              )}
              <div className="chart-container">{selectedWorkouts.length ? <Line data={chartData} options={chartOptions} /> : <EmptyState title={copy.chart} body={copy.noChart} actionLabel={copy.addWorkout} onAction={() => goToFeature('dashboard', 'add-workout')} />}</div>
            </section>

            <section className="glass-panel action-panel fade-in-up" {...tourAttrs('add-workout')}>
              <div className="panel-header"><h3>{copy.addWorkout}</h3>{helpButton('addWorkout')}</div>
              <form className="premium-form" onSubmit={editingWorkoutId ? (e) => { e.preventDefault(); saveWorkoutEdit(); } : saveWorkout}>
                <div className="input-group"><label htmlFor="date">{copy.date}</label><input id="date" type="date" value={formData.date} onChange={(e) => setFormData((c) => ({ ...c, date: e.target.value }))} /></div>
                <div className="input-group"><label>{copy.exercise}</label><div className="ex-search-wrap"><input type="text" className="ex-search-input" placeholder={`${getExerciseName(formData.exercise, settings.language)} — ${copy.searchExercise}`} value={formExSearch} onChange={(e) => setFormExSearch(e.target.value)} />{formExSearch && (<div className="ex-search-results">{(() => { const hits = exerciseOptions.filter(n => getExerciseName(n, settings.language).toLowerCase().includes(formExSearch.toLowerCase()) || n.toLowerCase().includes(formExSearch.toLowerCase())); return hits.length ? hits.slice(0, 10).map(n => (<button key={n} type="button" className={`ex-search-item${formData.exercise === n ? ' selected' : ''}`} onClick={() => { setFormData(c => ({...c, exercise: n})); setFormExSearch(''); }}><span className="ex-search-section">{sectionNames[findSection(n)]}</span>{getExerciseName(n, settings.language)}</button>)) : <div className="ex-search-empty">{copy.noExerciseResults}</div>; })()}</div>)}</div></div>
                <div className="helper-card">
                  <p><strong>{sectionNames[findSection(formData.exercise)]}</strong></p>
                  <p>{localize(selectedFormExerciseInfo.targets, settings.language)}</p>
                </div>
                {!settings.weightDrop && <div className="input-group"><label htmlFor="weight">{copy.weight}</label><input id="weight" type="number" step="0.5" min="0" value={formData.weight} onChange={(e) => setFormData((c) => ({ ...c, weight: e.target.value }))} placeholder={`0 ${settings.units}`} />{lastUsedWeight !== null && !editingWorkoutId && <span className="weight-hint" onClick={() => setFormData(c => ({...c, weight: String(lastUsedWeight)}))}>{settings.language === 'sl' ? 'Zadnjič' : 'Last'}: {formatWeight(lastUsedWeight, settings.units)} ↑</span>}</div>}
                <div className="input-group set-builder"><label>{settings.weightDrop ? (settings.language === 'sl' ? 'Seti — kg · ponov.' : 'Sets — kg · reps') : copy.repsPerSet}</label>{settings.weightDrop && <div className="wd-col-header"><span>{copy.sets}</span><span>{settings.units}</span><span>{settings.language === 'sl' ? 'Ponov.' : 'Reps'}</span><span/></div>}<div className="set-list">{formData.setDetails.map((value, index) => <div className={`set-row${settings.weightDrop ? ' weight-drop' : ''}`} key={`set-${index + 1}`}><span className="set-label"><button className="mini-btn mini-btn-inline" type="button" onClick={() => removeSet(index)}>−</button>{copy.sets} {index + 1}</span>{settings.weightDrop && <input type="number" step="0.5" min="0" value={(formData.setWeights || [])[index] || ''} onChange={(e) => changeSetWeight(index, e.target.value)} placeholder="0" className="wd-input" />}<input type="number" min="1" step="1" value={value} onChange={(e) => changeSet(index, e.target.value)} /><button className="mini-btn mini-btn-standalone" type="button" onClick={() => removeSet(index)}>−</button></div>)}</div><button className="action-btn-outline add-set-btn" type="button" onClick={addSet}>{copy.addSet}</button></div>
                <div className="settings-button-row">
                  <button className="action-btn-primary full-width" type="submit">{editingWorkoutId ? copy.saveChanges : copy.save}</button>
                  {editingWorkoutId ? <button className="action-btn-outline full-width" type="button" onClick={cancelWorkoutEdit}>{copy.cancel}</button> : null}
                </div>
              </form>
            </section>
          </div>

          <div className="dashboard-grid">
            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.prTitle}</h3></div>
              {Object.keys(personalRecords).length ? (
                <div className="pr-list">{Object.entries(personalRecords).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ex, w]) => (
                  <div className="pr-row" key={ex}><span>{getExerciseName(ex, settings.language)}</span><strong className="pr-value">{formatWeight(w, settings.units)} <span className="pr-badge">{copy.prBadge}</span></strong></div>
                ))}</div>
              ) : <div className="empty-state"><p>{copy.prNoData}</p></div>}
            </section>
            {(() => {
              const r = 54; const circ = 2 * Math.PI * r;
              const pct = timerPreset > 0 ? timerSeconds / timerPreset : 0;
              const dash = circ * (1 - Math.min(1, Math.max(0, pct)));
              const urgent = timerSeconds <= 5 && timerActive && timerSeconds > 0;
              return (
                <section className="glass-panel action-panel fade-in-up" {...tourAttrs('timer-rest')}>
                  <div className="panel-header"><h3>{copy.timerTitle}</h3>{helpButton('timerRest')}</div>
                  <div className="timer-display" style={{textAlign:'center',padding:'1rem 0'}}>
                    <svg width="140" height="140" viewBox="0 0 140 140" style={{display:'block',margin:'0 auto'}}>
                      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--glass-border)" strokeWidth="8"/>
                      <circle cx="70" cy="70" r={r} fill="none" stroke={timerDone ? '#4caf50' : urgent ? 'var(--error)' : 'var(--accent)'} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} transform="rotate(-90 70 70)" style={{transition:'stroke-dashoffset 0.2s linear,stroke 0.3s'}}/>
                      <text x="70" y="74" textAnchor="middle" dominantBaseline="middle" fill={timerDone ? '#4caf50' : urgent ? 'var(--error)' : 'var(--text-primary)'} fontSize="26" fontWeight="700" style={{fontFamily:'inherit'}}>{timerSeconds <= 0 ? '✓' : `${Math.floor(timerSeconds/60).toString().padStart(2,'0')}:${(timerSeconds%60).toString().padStart(2,'0')}`}</text>
                    </svg>
                    <div className="settings-button-row" style={{justifyContent:'center',gap:'0.5rem',marginTop:'1rem'}}>
                      {[60, 90, 120, 180].map((s) => <button key={s} className={`action-btn-outline${timerPreset === s && !timerActive ? ' active-filter' : ''}`} type="button" onClick={() => startTimer(s)}>{s < 60 ? `${s}s` : `${s/60}min`}</button>)}
                    </div>
                    <div className="settings-button-row" style={{justifyContent:'center',gap:'0.5rem',marginTop:'0.75rem'}}>
                      <button className="action-btn-primary" type="button" onClick={toggleTimer}>{timerActive ? copy.timerPause : copy.timerStart}</button>
                      <button className="action-btn-outline" type="button" onClick={resetTimer}>{copy.timerReset}</button>
                      <button className="action-btn-outline" type="button" onClick={() => adjustTimer(-15)}>−15s</button>
                      <button className="action-btn-outline" type="button" onClick={() => adjustTimer(15)}>+15s</button>
                    </div>
                    <div className="settings-button-row" style={{justifyContent:'center',gap:'0.5rem',marginTop:'0.75rem'}}>
                      <input type="number" min="5" max="3600" className="premium-select" style={{width:'80px',textAlign:'center'}} placeholder={copy.timerCustomLabel} value={timerCustomInput} onChange={e => setTimerCustomInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const s = Number(timerCustomInput); if (s >= 5) { startTimer(s); setTimerCustomInput(''); } } }}/>
                      <button className="action-btn-outline" type="button" onClick={() => { const s = Number(timerCustomInput); if (s >= 5) { startTimer(s); setTimerCustomInput(''); } }}>{copy.timerCustomGo}</button>
                    </div>
                  </div>
                </section>
              );
            })()}
            {(() => {
              const _todayStr = new Date().toISOString().slice(0, 10);
              const _lastRest = [...restDays].filter(d => d !== _todayStr).sort().at(-1);
              const { labels: _rLabels, data: _rData } = getMonthBarData(restDays, settings.language);
              return (
                <section className="glass-panel action-panel fade-in-up">
                  <div className="panel-header">
                    <h3>{copy.restDay}</h3>
                    {restDays.length > 0 && <span className="history-count">{restDays.length}</span>}
                  </div>
                  <div style={{textAlign:'center',paddingBottom:'0.5rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.75rem'}}>
                    <button className={`action-btn-${restDays.includes(_todayStr) ? 'primary' : 'outline'}`} type="button" onClick={toggleRestDay} style={{minWidth:'10rem'}}>
                      {restDays.includes(_todayStr) ? copy.restDayDone : copy.restDay}
                    </button>
                    <p style={{fontSize:'0.78rem',opacity:0.5,margin:0}}>{copy.restDayLast}: {_lastRest || copy.restDayNever}</p>
                  </div>
                  <div className="chart-container"><Bar data={{ labels: _rLabels, datasets: [{ data: _rData, backgroundColor: 'rgba(99,179,237,0.45)', borderColor: '#63b3ed', borderWidth: 2, borderRadius: 6 }] }} options={BAR_OPTS} /></div>
                </section>
              );
            })()}
          </div>

          <section className="glass-panel stats-section fade-in-up">
            <div className="panel-header"><h3>{copy.byExercise}</h3><div className="settings-button-row"><button className={`action-btn-outline ${analyticsRange === 'week' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('week')}>{copy.weekly}</button><button className={`action-btn-outline ${analyticsRange === 'month' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('month')}>{copy.monthly}</button></div></div>
            <div className="stats-split">
              <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.totalReps}</span><strong>{overall.reps}</strong></div><div className="stats-row"><span>{copy.bestWeight}</span><strong>{formatWeight(overall.bestKg, settings.units)}</strong></div><div className="stats-row"><span>{copy.streak}</span><strong>{calculateStreak(workouts)}</strong></div></div></div>
              <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.analytics}</span><strong>{analyticsRange === 'week' ? copy.weekly : copy.monthly}</strong></div><div className="stats-row"><span>{copy.trainingLoad}</span><strong>{formatVolume(analyticsTraining.volumeKg, settings.units)}</strong></div><div className="stats-row"><span>{copy.workouts}</span><strong>{analyticsTraining.workouts}</strong></div><div className="stats-row"><span>{copy.totalSets}</span><strong>{analyticsTraining.sets}</strong></div></div></div>
            </div>
            <div className="exercise-stats-grid">{perExercise.map((item) => <article className="exercise-stats-card" key={item.name}><div className="exercise-stats-top"><h4>{getExerciseName(item.name, settings.language)}</h4><span className="exercise-badge">{sectionNames[findSection(item.name)]}</span></div><div className="exercise-stats-body"><p><strong>{copy.workouts}:</strong> {item.workouts}</p><p><strong>{copy.totalSets}:</strong> {item.sets}</p><p><strong>{copy.totalReps}:</strong> {item.reps}</p><p><strong>{copy.totalVolume}:</strong> {formatVolume(item.volumeKg, settings.units)}</p><p><strong>{copy.bestWeight}:</strong> {formatWeight(item.bestKg, settings.units)}</p></div></article>)}</div>
          </section>

          <section className="glass-panel fade-in-up" style={{padding:'1.25rem 1.5rem'}}>
            <div className="panel-header"><h3>{copy.heatmapTitle}</h3><span className="history-count">{Math.ceil(heatmapDays.length / 7)} {settings.language === 'sl' ? 'tednov' : 'weeks'}</span></div>
            <div className="heatmap-grid">
              {heatmapDays.map(d => (
                <div key={d.key} title={d.key} className={`heatmap-cell${d.active ? ' active' : ''}${d.today ? ' today' : ''}`} />
              ))}
            </div>
          </section>
        </>}

        {activeSection === 'history' && (
          <section className="glass-panel history-section fade-in-up" {...tourAttrs('history-log')}>
            <div className="panel-header">
              <h3>{copy.recent}</h3>
              {helpButton('history')}
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <input className="history-search-input" type="search" placeholder={settings.language === 'sl' ? 'Išči vajo…' : 'Search exercise…'} value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                <span className="history-count">{sortedWorkouts.filter(w => !historySearch || getExerciseName(w.exercise, settings.language).toLowerCase().includes(historySearch.toLowerCase())).length}</span>
              </div>
            </div>
            <div className="history-list">
              {sortedWorkouts.filter(w => !historySearch || getExerciseName(w.exercise, settings.language).toLowerCase().includes(historySearch.toLowerCase())).length ? sortedWorkouts.filter(w => !historySearch || getExerciseName(w.exercise, settings.language).toLowerCase().includes(historySearch.toLowerCase())).map((w) => (
                <article className="history-item" key={w.id} style={{flexWrap:'wrap'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flex:1,minWidth:0}}>
                    <div className="history-avatar">{getExerciseName(w.exercise, settings.language)[0]}</div>
                    <div><h3>{getExerciseName(w.exercise, settings.language)}{personalRecords[w.exercise] === w.weight ? <span className="pr-badge">{copy.prBadge}</span> : null}</h3><p>{formatDateValue(w.date, settings.dateFormat)}</p></div>
                  </div>
                  <div className="history-metrics"><span>{formatWeight(w.weight, settings.units)}</span><span>{getSetCount(w)} {copy.sets.toLowerCase()}</span><span>{formatSetDetails(w)}</span><span>{formatVolume(getWorkoutVolumeKg(w, dashboardBodyWeightKg, customExercises), settings.units)}</span></div>
                  <div className="settings-button-row">
                    <button className="action-btn-outline" type="button" onClick={() => repeatWorkout(w)}>{copy.repeatWorkout}</button>
                    <button className="action-btn-outline" type="button" onClick={() => startEditWorkout(w)}>{copy.edit}</button>
                    <button className="action-btn-outline danger-button" type="button" onClick={() => deleteWorkout(w.id)}>{copy.delete}</button>
                    <button className="action-btn-outline" type="button" onClick={() => startEditComment(w)} style={{fontSize:'0.8rem'}}>✎</button>
                  </div>
                  {editingCommentId === w.id && (
                    <div style={{width:'100%',display:'flex',gap:'0.5rem',paddingTop:'0.5rem'}}>
                      <input className="premium-input" style={{flex:1,fontSize:'0.85rem',padding:'0.35rem 0.6rem'}} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={copy.commentPlaceholder} autoFocus />
                      <button className="action-btn-primary" type="button" onClick={() => saveComment(w.id)} style={{fontSize:'0.8rem',padding:'0.35rem 0.75rem'}}>{copy.saveComment}</button>
                      <button className="action-btn-outline" type="button" onClick={() => setEditingCommentId(null)} style={{fontSize:'0.8rem',padding:'0.35rem 0.75rem'}}>{copy.cancel}</button>
                    </div>
                  )}
                  {w.comment && editingCommentId !== w.id && (
                    <p style={{width:'100%',fontSize:'0.82rem',opacity:0.65,margin:'0.4rem 0 0',fontStyle:'italic'}}>"{w.comment}"</p>
                  )}
                </article>
              )) : <EmptyState icon="+" title={historySearch ? (settings.language === 'sl' ? 'Ni rezultatov' : 'No results') : copy.recent} body={historySearch ? (settings.language === 'sl' ? 'Poskusi z drugim iskanjem.' : 'Try a different search.') : copy.noHistory} actionLabel={historySearch ? '' : copy.addWorkout} onAction={historySearch ? undefined : () => goToFeature('dashboard', 'add-workout')} />}
            </div>
          </section>
        )}

        {activeSection === 'exercises' && <section className="glass-panel exercise-section fade-in-up" {...tourAttrs('exercise-library')}>
          <div className="panel-header"><h3>{copy.exercises}</h3><div style={{display:'flex',gap:'0.4rem',marginLeft:'auto',alignItems:'center'}}><button className={`action-btn-${advisorMode === 'gym' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => setAdvisorMode('gym')}>🏋️ {copy.gymMode}</button><button className={`action-btn-${advisorMode === 'calisthenics' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => setAdvisorMode('calisthenics')}>🤸 {copy.calisthenicsMode}</button></div><input className="history-search-input" type="search" placeholder={copy.searchExercise} value={exerciseSearch} onChange={e => setExerciseSearch(e.target.value)} /></div>
          {(() => {
            const q = exerciseSearch.toLowerCase().trim();
            const activeSections = advisorMode === 'calisthenics' ? calisthenicsSections : sections;
            const filtered = Object.entries(activeSections).map(([section, names]) => {
              const matchedNames = names.filter(name => !q || getExerciseName(name, settings.language).toLowerCase().includes(q) || name.toLowerCase().includes(q));
              return [section, matchedNames];
            }).filter(([, names]) => names.length > 0);
            const filteredCustom = customExercises.filter(ex => !q || ex.name.toLowerCase().includes(q));
            if (filtered.length === 0 && filteredCustom.length === 0) return <div className="empty-state"><p>{copy.noExerciseResults}</p></div>;
            return (
              <>
                {filtered.map(([section, names]) => (
                  <div className="exercise-section-block" key={section}>
                    <div className="exercise-section-header"><h4>{sectionNames[section]}</h4><span className="exercise-badge">{names.length}</span></div>
                    <div className="exercise-grid">{names.map((name) => { const meta = getExerciseInfo(name); return <article className="exercise-card" key={name}><div className="exercise-top"><div><p className="exercise-category">{sectionNames[section]}</p><h4>{getExerciseName(name, settings.language)}</h4></div><span className="exercise-badge">{localize(meta.primary, settings.language)}</span></div><div className="exercise-copy"><p><strong>{copy.difficulty}:</strong> {localize(meta.difficulty, settings.language)}</p><p><strong>{copy.primary}:</strong> {localize(meta.primary, settings.language)}</p><p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p><p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p><p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p></div></article>; })}</div>
                  </div>
                ))}
                <div className="exercise-section-block">
                  <div className="exercise-section-header">
                    <h4>🔧 {copy.myEquipmentTitle}</h4>
                    <button className="action-btn-primary" type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem',marginLeft:'auto'}} onClick={() => { setShowAddExercise(v => !v); setAddExError(''); }}>
                      {showAddExercise ? copy.cancel : `+ ${copy.addCustomExercise}`}
                    </button>
                  </div>
                  {showAddExercise && (
                    <div style={{marginBottom:'1rem',padding:'1rem',background:'var(--surface)',borderRadius:'0.5rem',display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={copy.customExName}
                        value={addExForm.name}
                        onChange={e => setAddExForm(f => ({...f, name: e.target.value}))}
                        onKeyDown={e => { if (e.key === 'Enter' && !addExLoading) handleAddCustomExercise(); }}
                      />
                      <select
                        className="form-input"
                        value={addExForm.section}
                        onChange={e => setAddExForm(f => ({...f, section: e.target.value}))}
                      >
                        {Object.keys(sections).map(s => (
                          <option key={s} value={s}>{sectionNames[s]}</option>
                        ))}
                      </select>
                      {addExError && <p style={{color:'var(--danger)',fontSize:'0.82rem',margin:0}}>{addExError}</p>}
                      <button
                        className="action-btn-primary"
                        type="button"
                        disabled={addExLoading || !addExForm.name.trim()}
                        onClick={handleAddCustomExercise}
                      >
                        {addExLoading ? copy.customExAdding : copy.customExFetch}
                      </button>
                    </div>
                  )}
                  {filteredCustom.length === 0 && !showAddExercise && (
                    <p className="settings-copy" style={{opacity:0.55,fontSize:'0.85rem'}}>{copy.customExEmpty}</p>
                  )}
                  {filteredCustom.length > 0 && (
                    <div className="exercise-grid">
                      {filteredCustom.map(ex => (
                        <article className="exercise-card" key={ex.id}>
                          <div className="exercise-top">
                            <div>
                              <p className="exercise-category">{sectionNames[ex.section] || ex.section}</p>
                              <h4>{ex.name}</h4>
                            </div>
                            <button type="button" className="action-btn-outline" style={{fontSize:'0.7rem',padding:'0.15rem 0.4rem',color:'var(--danger)',borderColor:'var(--danger)',marginLeft:'auto',flexShrink:0}} onClick={() => deleteCustomExercise(ex.id)}>✕</button>
                          </div>
                          <div className="exercise-copy">
                            {ex.primary?.en && <p><strong>{copy.primary}:</strong> {ex.primary[settings.language] || ex.primary.en}</p>}
                            {ex.targets?.en && <p><strong>{copy.target}:</strong> {ex.targets[settings.language] || ex.targets.en}</p>}
                            {ex.howTo?.en && <p><strong>{copy.howTo}:</strong> {ex.howTo[settings.language] || ex.howTo.en}</p>}
                            {ex.cues?.en && <p><strong>{copy.cues}:</strong> {ex.cues[settings.language] || ex.cues.en}</p>}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </section>}

        {activeSection === 'advisor' && <section className="glass-panel stats-section fade-in-up" {...tourAttrs('advisor-panel')}>
          <div className="panel-header">
            <h3>{copy.advisorTitle}</h3>
            {helpButton('advisor')}
            <div style={{display:'flex',gap:'0.4rem',marginLeft:'auto'}}>
              <button className={`action-btn-${advisorMode === 'gym' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => { setAdvisorMode('gym'); setAdvisorSplitId('auto'); }}>🏋️ {copy.gymMode}</button>
              <button className={`action-btn-${advisorMode === 'calisthenics' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => { setAdvisorMode('calisthenics'); setAdvisorSplitId('auto'); }}>🤸 {copy.calisthenicsMode}</button>
            </div>
          </div>

          {advisorMode === 'gym' && (
            <div style={{marginBottom:'1rem'}}>
              <p className="settings-label" style={{marginBottom:'0.5rem'}}>{copy.splitSectionTitle}</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom: advisorSplitId === 'custom' ? '0.75rem' : 0}}>
                <button className={`action-btn-${advisorSplitId === 'auto' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.25rem 0.6rem'}} onClick={() => setAdvisorSplitId('auto')}>⚡ {copy.splitAutoLabel}</button>
                {GYM_SPLIT_COMBOS.map(combo => (
                  <button key={combo.id} className={`action-btn-${advisorSplitId === combo.id ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.25rem 0.6rem'}} onClick={() => setAdvisorSplitId(combo.id)}>
                    {combo.label[settings.language] || combo.label.en}
                  </button>
                ))}
                <button className={`action-btn-${advisorSplitId === 'custom' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.25rem 0.6rem'}} onClick={() => setAdvisorSplitId('custom')}>✏️ {copy.splitCustomLabel}</button>
              </div>
              {advisorSplitId === 'custom' && (
                <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                    {Object.keys(sections).map(sec => (
                      <button key={sec} type="button"
                        className={`action-btn-${customSplitSections.includes(sec) ? 'primary' : 'outline'}`}
                        style={{fontSize:'0.75rem',padding:'0.25rem 0.6rem'}}
                        onClick={() => setCustomSplitSections(prev => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec])}>
                        {sectionNames[sec]}
                      </button>
                    ))}
                  </div>
                  {customSplitSections.length === 0 && (
                    <p className="settings-copy" style={{fontSize:'0.8rem',opacity:0.6,margin:0}}>
                      {settings.language === 'sl' ? 'Izberi vsaj eno mišično skupino.' : 'Select at least one muscle group.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="advisor-grid">
            <article className="advisor-card">
              <p className="exercise-category">{copy.focus}</p>
              <h3>{advisor.comboLabel || advisor.sections.map(s => sectionNames[s]).join(' + ')}</h3>
              <p className="settings-copy">{copy.advisorText}</p>
              <div className="stats-list mt-1">
                <div className="stats-row"><span>{copy.lastWorked}</span><strong>{advisor.last ? formatDateValue(advisor.last, settings.dateFormat) : copy.neverWorked}</strong></div>
                <div className="stats-row"><span>{copy.sets}</span><strong>{advisor.plan}</strong></div>
              </div>
            </article>
            <article className="advisor-card">
              <p className="exercise-category">{copy.why}</p>
              <p>{advisor.reason}</p>
            </article>
          </div>
          <div className="panel-header mt-1"><h3>{copy.suggested}</h3></div>
          <div className="exercise-grid">
            {advisor.exercises.map((item) => {
              const meta = getExerciseInfo(item.name);
              return <article className="exercise-card" key={item.name}>
                <div className="exercise-top">
                  <div><p className="exercise-category">{sectionNames[item.section]}</p><h4>{getExerciseName(item.name, settings.language)}</h4></div>
                  <span className="exercise-badge">{item.last ? formatDateValue(item.last, settings.dateFormat) : copy.neverWorked}</span>
                </div>
                <div className="exercise-copy">
                  <p><strong>{copy.target}:</strong> {localize(meta.targets, settings.language)}</p>
                  <p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p>
                  <p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p>
                  <p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p>
                </div>
              </article>;
            })}
          </div>
        </section>}

        {activeSection === 'calories' && <>
          <div className="dashboard-grid">
            <StatCard icon={<Utensils size={22} strokeWidth={2.2} />} title={copy.caloriesConsumed} value={Math.round(selectedDayTotals.calories)} unit={copy.kcalShort} glow="blue" />
            <StatCard icon={<Target size={22} strokeWidth={2.2} />} title={copy.calorieGoal} value={Math.round(settings.calorieGoal)} unit={copy.kcalShort} glow="green" />
            <StatCard icon={<Flame size={22} strokeWidth={2.2} />} title={copy.caloriesRemaining} value={Math.round(settings.calorieGoal - selectedDayTotals.calories)} unit={copy.kcalShort} glow="purple" />

            <section className="glass-panel chart-panel fade-in-up" {...tourAttrs('calorie-progress')}>
              <div className="panel-header"><h3>{copy.caloriesProgress}</h3><div className="settings-button-row panel-help-row">{helpButton('calories')}<button className={`action-btn-outline ${settings.calorieTrackerMode === 'simple' ? 'active-filter' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, calorieTrackerMode: 'simple' }))}>{copy.simpleTracker}</button><button className={`action-btn-outline ${settings.calorieTrackerMode === 'advanced' ? 'active-filter' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, calorieTrackerMode: 'advanced' }))}>{copy.advancedTracker}</button><input type="date" value={calorieForm.date} onChange={(e) => setCalorieForm((c) => ({ ...c, date: e.target.value }))} /></div></div>
              <div className="calorie-progress-card">
                <div className="progress-rail"><div className="progress-fill" style={{ width: `${Math.min((selectedDayTotals.calories / Math.max(settings.calorieGoal, 1)) * 100, 100)}%` }} /></div>
                {settings.calorieTrackerMode === 'advanced' ? <div className="stats-list mt-1">
                  <div className="stats-row"><span>{copy.protein}</span><strong>{Math.round(selectedDayTotals.protein)} g</strong></div>
                  <div className="stats-row"><span>{copy.carbs}</span><strong>{Math.round(selectedDayTotals.carbs)} g</strong></div>
                  <div className="stats-row"><span>{copy.fat}</span><strong>{Math.round(selectedDayTotals.fat)} g</strong></div>
                </div> : null}
              </div>
            </section>

            <section className="glass-panel action-panel fade-in-up" {...tourAttrs('add-meal')}>
              <div className="panel-header"><h3>{copy.addMeal}</h3><div className="settings-button-row panel-help-row">{helpButton('addMeal')}<button className="action-btn-outline" type="button" onClick={copyYesterdayMeals}>{copy.copyYesterdayMeals}</button></div></div>
              <form className="premium-form" onSubmit={editingMealId ? (e) => { e.preventDefault(); saveMealEdit(); } : saveMeal}>
                <div className="input-group"><label htmlFor="meal-date">{copy.date}</label><input id="meal-date" type="date" value={calorieForm.date} onChange={(e) => setCalorieForm((c) => ({ ...c, date: e.target.value }))} /></div>
                <div className="input-group"><label htmlFor="meal-type">{copy.mealType}</label><select id="meal-type" className="premium-select" value={calorieForm.mealType} onChange={(e) => setCalorieForm((c) => ({ ...c, mealType: e.target.value }))}><option value="breakfast">{copy.breakfast}</option><option value="lunch">{copy.lunch}</option><option value="dinner">{copy.dinner}</option><option value="snack">{copy.snack}</option></select></div>
                <div className="input-group"><label htmlFor="meal-name">{copy.mealName}</label><input id="meal-name" value={calorieForm.name} onChange={(e) => setCalorieForm((c) => ({ ...c, name: e.target.value }))} /></div>
                <div className="input-group"><label htmlFor="meal-calories">{copy.caloriesUnit}</label><input id="meal-calories" type="number" min="0" value={calorieForm.calories} onChange={(e) => setCalorieForm((c) => ({ ...c, calories: e.target.value }))} /></div>
                {settings.calorieTrackerMode === 'advanced' ? <div className="form-row triple">
                  <div className="input-group"><label htmlFor="meal-protein">{copy.protein}</label><input id="meal-protein" type="number" min="0" value={calorieForm.protein} onChange={(e) => setCalorieForm((c) => ({ ...c, protein: e.target.value }))} /></div>
                  <div className="input-group"><label htmlFor="meal-carbs">{copy.carbs}</label><input id="meal-carbs" type="number" min="0" value={calorieForm.carbs} onChange={(e) => setCalorieForm((c) => ({ ...c, carbs: e.target.value }))} /></div>
                  <div className="input-group"><label htmlFor="meal-fat">{copy.fat}</label><input id="meal-fat" type="number" min="0" value={calorieForm.fat} onChange={(e) => setCalorieForm((c) => ({ ...c, fat: e.target.value }))} /></div>
                </div> : null}
                <div className="settings-button-row">
                  <button className="action-btn-primary full-width" type="submit">{editingMealId ? copy.saveChanges : copy.addMeal}</button>
                  {editingMealId ? <button className="action-btn-outline full-width" type="button" onClick={cancelMealEdit}>{copy.cancel}</button> : null}
                </div>
              </form>
            </section>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',alignItems:'start'}}>
            <section className="glass-panel history-section fade-in-up">
              <div className="panel-header"><h3>{copy.mealsHistory}</h3><div className="settings-button-row"><button className={`action-btn-outline ${analyticsRange === 'week' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('week')}>{copy.weekly}</button><button className={`action-btn-outline ${analyticsRange === 'month' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('month')}>{copy.monthly}</button><span className="history-count">{selectedDayEntries.length}</span></div></div>
              <div className="stats-split">
                <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.analytics}</span><strong>{analyticsRange === 'week' ? copy.weekly : copy.monthly}</strong></div><div className="stats-row"><span>{copy.caloriesConsumed}</span><strong>{Math.round(analyticsFood.calories)} {copy.kcalShort}</strong></div><div className="stats-row"><span>{copy.mealCount}</span><strong>{analyticsFood.entries}</strong></div>{settings.calorieTrackerMode === 'advanced' ? <div className="stats-row"><span>{copy.protein}</span><strong>{Math.round(analyticsFood.protein)} g</strong></div> : null}</div></div>
              </div>
              <div className="history-list">
                {selectedDayEntries.length ? selectedDayEntries.map((entry) => <article className="history-item" key={entry.id}><div><h3>{entry.name}</h3><p>{({ breakfast: copy.breakfast, lunch: copy.lunch, dinner: copy.dinner, snack: copy.snack })[entry.mealType]}</p></div><div className="history-metrics"><span>{Math.round(entry.calories)} {copy.kcalShort}</span>{settings.calorieTrackerMode === 'advanced' ? <><span>P {Math.round(entry.protein)}g</span><span>C {Math.round(entry.carbs)}g</span><span>F {Math.round(entry.fat)}g</span></> : null}</div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={() => reuseMeal(entry)}>↻ {copy.reuseMeal}</button><button className="action-btn-outline" type="button" onClick={() => startEditMeal(entry)}>{copy.edit}</button><button className="action-btn-outline danger-button" type="button" onClick={() => deleteMeal(entry.id)}>{copy.delete}</button></div></article>) : <EmptyState title={copy.caloriesTitle} body={copy.noMeals} actionLabel={copy.addMeal} onAction={() => goToFeature('calories', 'add-meal')} />}
              </div>
            </section>

            {(() => {
              const { labels: _cLabels, data: _cData } = getMonthBarData(cheatDays, settings.language);
              return (
                <section className="glass-panel action-panel fade-in-up">
                  <div className="panel-header">
                    <h3>{copy.cheatDay}</h3>
                    {cheatDays.length > 0 && <span className="history-count">{cheatDays.length}</span>}
                  </div>
                  <div style={{textAlign:'center',paddingBottom:'0.5rem',display:'flex',flexDirection:'column',alignItems:'center',gap:'0.75rem'}}>
                    <button className={`action-btn-${cheatDays.includes(calorieForm.date) ? 'primary' : 'outline'}`} type="button" onClick={() => toggleCheatDay(calorieForm.date)} style={{minWidth:'10rem'}}>
                      {cheatDays.includes(calorieForm.date) ? copy.cheatDayDone : copy.cheatDay}
                    </button>
                  </div>
                  <div className="chart-container"><Bar data={{ labels: _cLabels, datasets: [{ data: _cData, backgroundColor: 'rgba(251,146,60,0.45)', borderColor: '#fb923c', borderWidth: 2, borderRadius: 6 }] }} options={BAR_OPTS} /></div>
                </section>
              );
            })()}
          </div>
        </>}

        {activeSection === 'ocenjevalec' && (<>
          {/* Ingredient Tracker */}
          <section className="glass-panel action-panel fade-in-up" {...tourAttrs('ingredient-tracker')}>
            <div className="panel-header"><h3>{copy.ingredientTracker}</h3>
              {helpButton('ingredient')}
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button type="button" className={`action-btn-${ingredientMode === 'quick' ? 'primary' : 'outline'}`} style={{fontSize:'0.8rem',padding:'0.25rem 0.7rem'}} onClick={() => setIngredientMode('quick')}>{copy.quickMode}</button>
                <button type="button" className={`action-btn-${ingredientMode === 'precise' ? 'primary' : 'outline'}`} style={{fontSize:'0.8rem',padding:'0.25rem 0.7rem'}} onClick={() => setIngredientMode('precise')}>{copy.preciseMode}</button>
              </div>
            </div>
            <form className="premium-form" onSubmit={analyzeIngredients}>
              {ingredientMode === 'quick' ? (
                <div className="input-group">
                  <label>{copy.ingredientName}</label>
                  <p className="settings-copy" style={{marginBottom:'0.4rem',fontSize:'0.8rem'}}>{copy.ingredientQuickDesc}</p>
                  <textarea rows={3} style={{width:'100%',resize:'vertical',padding:'0.6rem',borderRadius:'8px',background:'rgba(148,163,184,0.08)',border:'1px solid rgba(148,163,184,0.2)',color:'inherit',fontSize:'0.9rem'}} value={ingredientQuery} onChange={e => setIngredientQuery(e.target.value)} placeholder={copy.ingredientQuickPlaceholder} />
                </div>
              ) : (
                <div>
                  {ingredientItems.map((item, idx) => (
                    <div key={idx} style={{display:'flex',gap:'0.5rem',alignItems:'flex-end',marginBottom:'0.5rem'}}>
                      <div className="input-group" style={{flex:3,margin:0}}>
                        {idx === 0 && <label>{copy.ingredientName}</label>}
                        <input type="text" value={item.name} onChange={e => setIngredientItems(c => c.map((it,i) => i===idx ? {...it,name:e.target.value} : it))} placeholder={copy.ingredientName} />
                      </div>
                      <div className="input-group" style={{flex:1,margin:0}}>
                        {idx === 0 && <label>{copy.ingredientGrams}</label>}
                        <input type="number" min="1" value={item.grams} onChange={e => setIngredientItems(c => c.map((it,i) => i===idx ? {...it,grams:e.target.value} : it))} placeholder="100" />
                      </div>
                      {ingredientItems.length > 1 && <button type="button" className="action-btn-outline danger-button" style={{padding:'0.35rem 0.6rem',marginBottom:'0.1rem'}} onClick={() => setIngredientItems(c => c.filter((_,i) => i !== idx))}>✕</button>}
                    </div>
                  ))}
                  <button type="button" className="action-btn-outline" style={{width:'100%',marginBottom:'0.75rem'}} onClick={() => setIngredientItems(c => [...c, {name:'',grams:'100'}])}>+ {copy.addIngredient}</button>
                </div>
              )}
              <button className="action-btn-primary full-width" type="submit" disabled={ingredientLoading}>
                {ingredientLoading ? copy.ingredientAnalyzing : (aiEnabled ? copy.ingredientAnalyze : (settings.language === 'sl' ? 'Izracunaj hrano' : 'Analyze food'))}
              </button>
            </form>
            <div className="food-photo-analyzer">
              <div className="food-photo-head">
                <div>
                  <h4>{copy.calPhotoTitle}</h4>
                  <p className="settings-copy">{copy.calPhotoDesc}</p>
                </div>
                <span className="calc-method-pill">{aiEnabled ? 'AI vision' : 'Backend needed'}</span>
              </div>
              <input ref={calImageRef} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={handleCalImage} />
              {calImage ? (
                <div className="food-photo-preview">
                  <img src={calImage.preview} alt={settings.language === 'sl' ? 'Slika hrane' : 'Food preview'} />
                  <div className="food-photo-actions">
                    <button className="action-btn-primary" type="button" disabled={calImageLoading} onClick={analyzeImageCalories}>
                      {calImageLoading ? copy.ingredientAnalyzing : copy.calPhotoAnalyze}
                    </button>
                    <button className="action-btn-outline" type="button" onClick={() => calImageRef.current?.click()}>{copy.calPhotoChange}</button>
                    <button className="action-btn-outline danger-button" type="button" onClick={() => { setCalImage(null); setCalPhotoResult(null); setCalPhotoError(''); }}>
                      {copy.bodyFatRemove}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="food-photo-drop" type="button" onClick={() => calImageRef.current?.click()}>
                  <span>+</span>
                  <strong>{copy.calPhotoBtn}</strong>
                </button>
              )}
            </div>
            {ingredientError === 'noKey' && <p className="auth-error">{copy.ingredientNoKey}</p>}
            {ingredientError === 'error' && <p className="auth-error">{copy.ingredientError}</p>}
            {calPhotoError === 'noKey' && <p className="auth-error">{copy.calPhotoNoKey}</p>}
            {calPhotoError === 'error' && <p className="auth-error">{copy.calEstError}</p>}
            {ingredientResults && (
              <div style={{marginTop:'1.5rem'}}>
                {/* Total summary */}
                <div style={{padding:'1rem',borderRadius:'12px',background:'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))',marginBottom:'1rem'}}>
                  <h3 style={{margin:'0 0 0.6rem',fontSize:'1rem'}}>{ingredientResults.source?.startsWith('photo') ? copy.foodPhotoReviewTitle : copy.ingredientTotal}</h3>
                  {ingredientResults.source?.startsWith('photo') && <p className="settings-copy" style={{margin:'0 0 0.75rem',fontSize:'0.82rem'}}>{copy.foodPhotoReviewDesc}</p>}
                  <p className="settings-copy" style={{margin:'0 0 0.75rem',fontSize:'0.78rem'}}>
                    {ingredientResults.source?.startsWith('photo')
                      ? (settings.language === 'sl' ? 'Vir: AI vision + tvoj pregled' : 'Source: AI vision + your review')
                      : (ingredientResults.source?.includes('ai')
                        ? (settings.language === 'sl' ? 'Vir: AI + tvoj pregled makrov' : 'Source: AI + your macro review')
                        : (settings.language === 'sl' ? 'Vir: offline parser in lokalna baza hrane' : 'Source: offline parser and local food database'))}
                    {ingredientResults.unmatched?.length ? ` - ${settings.language === 'sl' ? 'Ni prepoznano' : 'Not recognized'}: ${ingredientResults.unmatched.join(', ')}` : ''}
                  </p>
                  {(ingredientResults.calorieRange?.low || ingredientResults.calorieRange?.high) ? <p className="settings-copy nutrition-note">{settings.language === 'sl' ? 'Realen razpon' : 'Realistic range'}: {ingredientResults.calorieRange.low}-{ingredientResults.calorieRange.high} kcal</p> : null}
                  {[...(ingredientResults.assumptions || []), ...(ingredientResults.warnings || [])].length ? (
                    <div className="nutrition-note-list">
                      {[...(ingredientResults.assumptions || []), ...(ingredientResults.warnings || [])].slice(0, 6).map((note, index) => <span key={`${note}-${index}`}>{note}</span>)}
                    </div>
                  ) : null}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:'0.5rem'}}>
                    {[['kcal','🔥','#f59e0b'],['protein','💪','#60a5fa'],['carbs','🌾','#fb923c'],['fat','🫙','#34d399'],['fiber','🌿','#86efac'],['sugar','🍬','#f472b6']].map(([key,icon,color]) => (
                      <div key={key} style={{textAlign:'center',padding:'0.4rem',borderRadius:'8px',background:'rgba(148,163,184,0.08)'}}>
                        <div style={{fontSize:'1.1rem'}}>{icon}</div>
                        <div style={{fontSize:'0.85rem',fontWeight:700,color}}>{ingredientResults.total[key]}{key==='kcal'?'':' g'}</div>
                        <div style={{fontSize:'0.68rem',opacity:0.6}}>{key}</div>
                      </div>
                    ))}
                  </div>
                  <div className="estimator-action-row">
                    <button className="action-btn-primary" type="button" onClick={() => addIngredientResultToMeals()}>
                      {settings.language === 'sl' ? 'Dodaj v obroke' : 'Add to meals'}
                    </button>
                    <button className="action-btn-outline" type="button" onClick={() => editIngredientResultAsMeal()}>
                      {settings.language === 'sl' ? 'Uredi pred shranjevanjem' : 'Edit before saving'}
                    </button>
                    <button className="action-btn-outline" type="button" onClick={addIngredientReviewItem}>
                      + {copy.foodItemAdd}
                    </button>
                  </div>
                  <div className="food-correction-box">
                    <label className="settings-label" htmlFor="food-correction">{copy.foodCorrectionLabel}</label>
                    <textarea id="food-correction" rows={2} value={foodCorrectionText} onChange={(event) => setFoodCorrectionText(event.target.value)} placeholder={copy.foodCorrectionPlaceholder} />
                    <button className="action-btn-outline" type="button" disabled={!foodCorrectionText.trim() || calImageLoading} onClick={reanalyzeFoodPhotoWithCorrection}>
                      {calImageLoading ? copy.ingredientAnalyzing : copy.foodCorrectionApply}
                    </button>
                  </div>
                </div>
                <div className="nutrition-review-table">
                  <div className="nutrition-review-row nutrition-review-header">
                    <span>{settings.language === 'sl' ? 'Hrana' : 'Food'}</span>
                    <span>g</span>
                    <span>kcal</span>
                    <span>P</span>
                    <span>C</span>
                    <span>F</span>
                    <span>{settings.language === 'sl' ? 'Zaup.' : 'Conf.'}</span>
                    <span />
                  </div>
                  {ingredientResults.items?.map((item, i) => (
                    <div className="nutrition-review-row" key={`${item.name}-${i}`}>
                      <input aria-label={settings.language === 'sl' ? 'Ime hrane' : 'Food name'} value={item.name} onChange={(event) => updateIngredientReviewItem(i, 'name', event.target.value)} />
                      <input aria-label="grams" type="number" min="0" inputMode="decimal" value={item.grams} onChange={(event) => updateIngredientReviewItem(i, 'grams', event.target.value)} />
                      <input aria-label="kcal" type="number" min="0" inputMode="decimal" value={item.kcal} onChange={(event) => updateIngredientReviewItem(i, 'kcal', event.target.value)} />
                      <input aria-label="protein" type="number" min="0" inputMode="decimal" value={item.protein} onChange={(event) => updateIngredientReviewItem(i, 'protein', event.target.value)} />
                      <input aria-label="carbs" type="number" min="0" inputMode="decimal" value={item.carbs} onChange={(event) => updateIngredientReviewItem(i, 'carbs', event.target.value)} />
                      <input aria-label="fat" type="number" min="0" inputMode="decimal" value={item.fat} onChange={(event) => updateIngredientReviewItem(i, 'fat', event.target.value)} />
                      <select aria-label={settings.language === 'sl' ? 'Zanesljivost' : 'Confidence'} value={item.confidence || 'moderate'} onChange={(event) => updateIngredientReviewItem(i, 'confidence', event.target.value)}>
                        <option value="low">low</option>
                        <option value="moderate">moderate</option>
                        <option value="high">high</option>
                      </select>
                      <button className="action-btn-outline danger-button" type="button" onClick={() => removeIngredientReviewItem(i)} aria-label={copy.foodItemRemove}>x</button>
                      {item.assumption ? <small>{item.assumption}</small> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Body Fat Estimation */}
          <section className="glass-panel action-panel fade-in-up" {...tourAttrs('body-fat-estimator')}>
            <div className="panel-header"><h3>{copy.bodyFatTitle}</h3>{helpButton('bodyFat')}</div>
            <p className="settings-copy" style={{marginBottom:'1rem'}}>{copy.bodyFatDesc}</p>
            <div className="body-fat-input-grid">
              <div className="input-group">
                <label>{copy.tdeeGender}</label>
                <select className="premium-select" value={bodyFatMetrics.gender} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, gender: e.target.value }))}>
                  <option value="male">{copy.tdeeMale}</option>
                  <option value="female">{copy.tdeeFemale}</option>
                </select>
              </div>
              <div className="input-group"><label>{copy.tdeeAge}</label><input type="number" min="5" max="100" value={bodyFatMetrics.age} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, age: e.target.value }))} placeholder="17" /></div>
              <div className="input-group"><label>{copy.tdeeHeight}</label><input type="number" min="100" max="250" value={bodyFatMetrics.height} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, height: e.target.value }))} placeholder="180" /></div>
              <div className="input-group"><label>{copy.bwWeight}</label><input type="number" min="20" step="0.1" value={bodyFatMetrics.weight} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, weight: e.target.value }))} placeholder="80" /></div>
              <div className="input-group"><label>{settings.language === 'sl' ? 'Pas (cm)' : 'Waist (cm)'}</label><input type="number" min="40" step="0.1" value={bodyFatMetrics.waist} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, waist: e.target.value }))} placeholder="82" /></div>
              <div className="input-group"><label>{settings.language === 'sl' ? 'Vrat (cm)' : 'Neck (cm)'}</label><input type="number" min="20" step="0.1" value={bodyFatMetrics.neck} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, neck: e.target.value }))} placeholder="38" /></div>
              <div className="input-group"><label>{settings.language === 'sl' ? 'Boki (cm)' : 'Hips (cm)'}</label><input type="number" min="50" step="0.1" value={bodyFatMetrics.hip} onChange={(e) => setBodyFatMetrics((c) => ({ ...c, hip: e.target.value }))} placeholder={bodyFatMetrics.gender === 'female' ? '96' : 'optional'} /></div>
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
              {[['front', copy.bodyFatFront, bodyFatFrontRef], ['side', copy.bodyFatSide, bodyFatSideRef], ['back', copy.bodyFatBack, bodyFatBackRef]].map(([pose, label, ref]) => (
                <div key={pose} style={{flex:1,minWidth:'100px'}}>
                  <input ref={ref} type="file" accept="image/*" className="hidden-input" onChange={e => handleBodyFatImage(pose, e)} />
                  {bodyFatImages[pose] ? (
                    <div style={{position:'relative',borderRadius:'10px',overflow:'hidden',aspectRatio:'3/4',background:'rgba(0,0,0,0.25)'}}>
                      <img src={bodyFatImages[pose].preview} alt={pose} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      <button type="button" onClick={() => setBodyFatImages(c => ({...c,[pose]:null}))} style={{position:'absolute',top:'4px',right:'4px',background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',borderRadius:'50%',width:'22px',height:'22px',cursor:'pointer',fontSize:'0.75rem',lineHeight:'22px',textAlign:'center'}}>✕</button>
                      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.45)',padding:'0.2rem',textAlign:'center',fontSize:'0.72rem',color:'#fff'}}>{label}</div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => ref.current?.click()} style={{width:'100%',aspectRatio:'3/4',borderRadius:'10px',border:'2px dashed rgba(148,163,184,0.3)',background:'rgba(148,163,184,0.06)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0.3rem',color:'rgba(148,163,184,0.7)',fontSize:'0.8rem'}}>
                      <span style={{fontSize:'1.4rem'}}>📷</span>{copy.bodyFatAddPhoto}<span style={{fontSize:'0.7rem',opacity:0.7}}>{label}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="action-btn-primary full-width" type="button" disabled={bodyFatLoading || (Object.values(bodyFatImages).every(v => v === null) && !(Number(bodyFatMetrics.height) > 80 && Number(bodyFatMetrics.weight) > 20 && Number(bodyFatMetrics.waist) > 40))} onClick={estimateBodyFat}>
              {bodyFatLoading ? copy.bodyFatAnalyzing : copy.bodyFatAnalyze}
            </button>
            {bodyFatError === 'noKey' && <p className="auth-error">{copy.bodyFatNoKey}</p>}
            {bodyFatError === 'error' && <p className="auth-error">{settings.language === 'sl' ? 'Dodaj vsaj visino, tezo in pas; za vecjo tocnost dodaj se vrat, boke in fotografije.' : 'Add at least height, weight, and waist; for better accuracy add neck, hips, and photos.'}</p>}
            {bodyFatResult && (
              <div style={{marginTop:'1.5rem',padding:'1.25rem',borderRadius:'12px',background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(236,72,153,0.1))'}}>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem'}}>
                  <div style={{fontSize:'2.5rem',fontWeight:800,color:'var(--primary-glow)'}}>{bodyFatResult.bodyFatPercent}%</div>
                  <div>
                    <p style={{margin:0,fontWeight:700,fontSize:'1rem'}}>{copy.bodyFatResultLabel}</p>
                    <p style={{margin:0,fontSize:'0.85rem',opacity:0.75}}>{copy.bodyFatCategory}: <strong>{bodyFatResult.category}</strong></p>
                    <p style={{margin:0,fontSize:'0.82rem',opacity:0.65}}>{copy.bodyFatConfidence}: {bodyFatResult.confidence}</p>
                  </div>
                </div>
                {(bodyFatResult.fatMassKg != null || bodyFatResult.leanMassKg != null) && (
                  <div className="body-fat-result-grid">
                    <div><span>{settings.language === 'sl' ? 'Masa mascobe' : 'Fat mass'}</span><strong>{bodyFatResult.fatMassKg ?? '-'} kg</strong></div>
                    <div><span>{settings.language === 'sl' ? 'Pusta masa' : 'Lean mass'}</span><strong>{bodyFatResult.leanMassKg ?? '-'} kg</strong></div>
                  </div>
                )}
                {bodyFatResult.methods?.length ? (
                  <div className="body-fat-methods">
                    {bodyFatResult.methods.map((method) => <span key={method.name}>{method.name}: {method.value}%</span>)}
                  </div>
                ) : null}
                {bodyFatResult.description && <p style={{fontSize:'0.85rem',lineHeight:1.55,opacity:0.8,margin:0}}>{bodyFatResult.description}</p>}
              </div>
            )}
            {bodyFatHistory.length ? (
              <div className="body-fat-history">
                <div className="panel-header compact-panel-header">
                  <h3>{settings.language === 'sl' ? 'Body-fat history' : 'Body fat history'}</h3>
                  <span className="history-count">{bodyFatHistory.length}</span>
                </div>
                <div className="history-list">
                  {bodyFatHistory.slice(0, 6).map((entry) => (
                    <article className="history-item" key={entry.id}>
                      <div>
                        <h3>{entry.result?.bodyFatPercent}%</h3>
                        <p>{entry.date} · {entry.metrics?.weight ? `${entry.metrics.weight} kg` : '-'} · {entry.photoCount || 0} {settings.language === 'sl' ? 'slik' : 'photos'}</p>
                      </div>
                      <div className="history-metrics">
                        <span>{entry.result?.category}</span>
                        {entry.result?.leanMassKg != null && <span>{entry.result.leanMassKg} kg lean</span>}
                      </div>
                      <div className="settings-button-row">
                        <button className="action-btn-outline" type="button" onClick={() => reuseBodyFatEntry(entry)}>{settings.language === 'sl' ? 'Nalozi' : 'Load'}</button>
                        <button className="action-btn-outline danger-button" type="button" onClick={() => deleteBodyFatEntry(entry.id)}>{copy.delete}</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : <EmptyState title={settings.language === 'sl' ? 'Ni ocen telesne mascobe' : 'No body fat estimates yet'} body={settings.language === 'sl' ? 'Dodaj meritve ali fotografije za prvo oceno.' : 'Add measurements or photos to create your first estimate.'} actionLabel={copy.bodyFatAddPhoto} onAction={() => bodyFatFrontRef.current?.click()} />}
          </section>

          {/* Cal history */}
          <section className="glass-panel history-section fade-in-up">
            <div className="panel-header"><h3>{copy.calEstHistory}</h3><span className="history-count">{calHistory.length}</span></div>
            <div className="history-list">
              {calHistory.length ? calHistory.map(entry => (
                <article className="history-item" key={entry.id}>
                  <div>
                    <h3>{entry.name}</h3>
                    <p>{entry.date} · {entry.grams !== undefined ? `${entry.grams} g` : ''}</p>
                  </div>
                  <div className="history-metrics">
                    {entry.kcalPer100 !== undefined && <span>{entry.kcalPer100} {copy.calEstPer100}</span>}
                    <span style={{fontWeight:700}}>{entry.total} kcal</span>
                  </div>
                  <div className="settings-button-row">
                    <button className="action-btn-outline" type="button" onClick={() => reuseMeal({ mealType: 'snack', name: entry.name, calories: String(entry.total), protein: String(entry.protein || ''), carbs: String(entry.carbs || ''), fat: String(entry.fat || '') })}>🔁 {copy.reuseMeal}</button>
                    <button className="action-btn-outline danger-button" type="button" onClick={() => deleteCalHistoryEntry(entry.id)}>{copy.delete}</button>
                  </div>
                </article>
              )) : <div className="empty-state"><p>{copy.calEstHistoryEmpty}</p></div>}
            </div>
          </section>
        </>)}

        {activeSection === 'rankings' && (
          <div className="dashboard-grid">
            {/* Muscle-specific ranking section */}
            <section className="glass-panel chart-panel fade-in-up muscle-rank-section" style={{gridColumn:'span 2'}} {...tourAttrs('muscle-rankings')}>
              <div className="panel-header"><h3>{copy.muscleRankTitle}</h3>{helpButton('rankings')}</div>
              <p className="settings-copy" style={{marginBottom:'1rem'}}>{settings.language === 'sl' ? 'Klikni misico na modelu. Rang in barva sta izracunana iz tehtanega volumna vaj, ki dejansko trenirajo ta del telesa.' : 'Click a muscle on the model. Rank and color are calculated from weighted volume of exercises that actually train that body part.'}</p>
              {(() => {
                const muscleData = muscleStats[selectedRankMuscle] || getMuscleVolumeData(selectedRankMuscle, workouts, bodyWeightEntries, settings, customExercises);
                const rank = muscleData.rank || getMuscleRank(muscleData.volume, settings.language);
                const nextIdx = rank.idx + 1;
                const next = nextIdx < MUSCLE_RANKS.length ? MUSCLE_RANKS[nextIdx] : null;
                const selectedColor = rank.color;
                const selectedLabel = sectionNames[selectedRankMuscle] || selectedRankMuscle;
                const progressPct = next ? Math.min(100, Math.max(0, Math.round(((muscleData.volume - rank.min) / (next.min - rank.min)) * 100))) : 100;
                const nextLabel = next ? (settings.language === 'sl' ? next.nameSl : next.nameEn) : '';
                const topExerciseLabel = muscleData.topExercise ? getExerciseName(muscleData.topExercise.name, settings.language) : '-';
                const volumeRankCopy = settings.language === 'sl' ? 'Rang po volumnu moci' : 'Strength volume rank';
                const volumeCopy = settings.language === 'sl' ? 'tehtanega volumna' : 'weighted volume';
                const nextCopy = settings.language === 'sl' ? 'do' : 'to';
                const emptyCopy = settings.language === 'sl'
                  ? 'Zabelezi vajo, ki trenira to misico, in rang se bo dvignil iz dejanskega volumna.'
                  : 'Log an exercise that trains this muscle and the rank will rise from real volume.';
                return (
                  <div className="muscle-rank-layout">
                    <div className="muscle-map-shell">
                      <AnatomyRankModel selected={selectedRankMuscle} onSelect={setSelectedRankMuscle} gender={settings.gender || 'male'} language={settings.language || 'en'} muscleStats={muscleStats} sectionNames={sectionNames} />
                    </div>
                    <div className="muscle-rank-detail" style={{'--muscle-color': selectedColor}}>
                      <div className="muscle-rank-head">
                        <div className="muscle-rank-icon" style={{background: rank.bg}}>{MUSCLE_RANK_ICONS[rank.idx]}</div>
                        <div>
                          <p className="exercise-category">{selectedLabel}</p>
                          <h2>{rank.displayName}</h2>
                          <p>{formatVolume(muscleData.volume, settings.units)} {volumeCopy}</p>
                        </div>
                      </div>
                      <div className="muscle-progress-copy">
                        <span>{next ? `${formatVolume(Math.max(0, next.min - muscleData.volume), settings.units)} ${nextCopy} ${nextLabel}` : copy.rankMax}</span>
                        {next ? <strong>{progressPct}%</strong> : null}
                      </div>
                      <div className="muscle-progress-rail"><span style={{width:`${progressPct}%`, background: rank.bg}} /></div>
                      {muscleData.sessions === 0 ? <p className="muscle-empty-note">{emptyCopy}</p> : null}
                      <div className="muscle-stat-grid">
                        <div><span>{volumeRankCopy}</span><strong>{formatVolume(muscleData.volume, settings.units)}</strong></div>
                        <div><span>{copy.muscleRankSessions}</span><strong>{muscleData.sessions}</strong></div>
                        <div><span>{settings.language === 'sl' ? 'Najmocnejsa vaja' : 'Top exercise'}</span><strong>{topExerciseLabel}</strong></div>
                      </div>
                      <div className="muscle-chip-row">
                        {MUSCLE_KEYS.map(k => (
                          <button key={k} className={`muscle-chip ${selectedRankMuscle === k ? 'active' : ''}`} style={{'--muscle-color': muscleStats[k]?.rank?.color || MUSCLE_COLORS[k]}} type="button" onClick={() => setSelectedRankMuscle(k)}>
                            {sectionNames[k] || k}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="muscle-overview-grid">
                      {MUSCLE_KEYS.map(k => {
                        const d = muscleStats[k] || getMuscleVolumeData(k, workouts, bodyWeightEntries, settings, customExercises);
                        const r = d.rank || getMuscleRank(d.volume, settings.language);
                        const isSelected = selectedRankMuscle === k;
                        return (
                          <button key={k} className={`muscle-overview-card ${isSelected ? 'active' : ''}`} style={{'--muscle-color': r.color}} type="button" onClick={() => setSelectedRankMuscle(k)}>
                            <div>
                              <span className="muscle-overview-icon">{MUSCLE_RANK_ICONS[r.idx]}</span>
                              <strong>{sectionNames[k] || k}</strong>
                            </div>
                            <span>{r.displayName}</span>
                            <small>{formatVolume(d.volume, settings.units)}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </section>
            <section className="glass-panel chart-panel fade-in-up" style={{gridColumn:'span 2'}} {...tourAttrs('overall-rank')}>
              <div className="panel-header"><h3>{copy.rankCurrentLabel}</h3>{helpButton('overallRank')}</div>
              {(() => {
                const overall = overallMuscleRankData;
                const rank = overall.rank;
                const next = overall.nextRank;
                const nextLabel = next ? (settings.language === 'sl' ? next.nameSl : next.nameEn) : '';
                const nextCopy = settings.language === 'sl' ? 'do' : 'to';
                const avgCopy = settings.language === 'sl' ? 'povprecnega misicnega volumna' : 'average muscle volume';
                const trainedCopy = settings.language === 'sl' ? 'aktivne skupine' : 'active groups';
                const totalCopy = settings.language === 'sl' ? 'skupni volumen' : 'total volume';
                return (
                  <div style={{padding:'1rem 0'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'1.2rem',marginBottom:'1.5rem'}}>
                      <div style={{background: rank.bg,borderRadius:'50%',width:'3.5rem',height:'3.5rem',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem',flexShrink:0}}>{MUSCLE_RANK_ICONS[rank.idx]}</div>
                      <div>
                        <h2 style={{fontSize:'1.8rem',fontWeight:700,margin:0}}>{rank.displayName}</h2>
                        <p style={{opacity:0.7,margin:0}}>{formatVolume(overall.averageVolume, settings.units)} {avgCopy}</p>
                      </div>
                    </div>
                    {next ? (<>
                      <p style={{fontSize:'0.85rem',opacity:0.7,marginBottom:'0.5rem'}}>{copy.rankProgress}: {formatVolume(Math.max(0, next.min - overall.averageVolume), settings.units)} {nextCopy} {nextLabel}</p>
                      <div style={{background:'rgba(148,163,184,0.15)',borderRadius:'999px',height:'0.6rem',overflow:'hidden'}}>
                        <div style={{
                          background: rank.bg,
                          height:'100%',
                          borderRadius:'999px',
                          width:`${overall.progressPct}%`,
                          transition:'width 0.6s ease'
                        }} />
                      </div>
                      <p style={{fontSize:'0.78rem',opacity:0.5,marginTop:'0.4rem',textAlign:'right'}}>{formatVolume(Math.max(0, next.min - overall.averageVolume), settings.units)} / {formatVolume(next.min - rank.min, settings.units)}</p>
                    </>) : (
                      <p style={{fontSize:'0.9rem',opacity:0.7}}>{copy.rankMax}</p>
                    )}
                    <div className="muscle-stat-grid" style={{marginTop:'1rem'}}>
                      <div><span>{settings.language === 'sl' ? 'Povprecje' : 'Average'}</span><strong>{formatVolume(overall.averageVolume, settings.units)}</strong></div>
                      <div><span>{trainedCopy}</span><strong>{overall.trainedGroups} / {overall.totalGroups}</strong></div>
                      <div><span>{totalCopy}</span><strong>{formatVolume(overall.totalVolume, settings.units)}</strong></div>
                    </div>
                  </div>
                );
              })()}
            </section>

            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon orange-glow"><Flame size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.streak}</p><h3 className="stat-value">{calculateStreak(workouts)}</h3></div></article>

            <section className="glass-panel history-section fade-in-up" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{settings.language === 'sl' ? 'Kako delujejo misicni rangi' : 'How muscle ranks work'}</h3></div>
              <div className="history-list">
                {(settings.language === 'sl' ? [
                  {text: 'Vaja doda tehtan volumen samo misicam, ki jih dejansko trenira.', color: 'var(--primary-glow)', icon: '01'},
                  {text: 'Rang posamezne misice raste iz njenega lastnega volumna.', color: '#f59e0b', icon: '02'},
                  {text: 'Trenutni rang je povprecje vseh devetih misicnih skupin.', color: '#34d399', icon: '03'},
                  {text: 'Uravnotezen trening dvigne skupni rang hitreje kot samo ena mocna skupina.', color: '#a78bfa', icon: '04'},
                ] : [
                  {text: 'Each exercise adds weighted volume only to the muscles it actually trains.', color: 'var(--primary-glow)', icon: '01'},
                  {text: 'Each muscle rank rises from that muscle group volume.', color: '#f59e0b', icon: '02'},
                  {text: 'Current rank is the average of all nine muscle groups.', color: '#34d399', icon: '03'},
                  {text: 'Balanced training raises the overall rank faster than one strong group only.', color: '#a78bfa', icon: '04'},
                ]).map((item, i) => (
                  <article className="history-item" key={i} style={{gap:'0.6rem'}}>
                    <span style={{fontSize:'0.8rem',flexShrink:0,fontWeight:800,color:item.color,minWidth:'1.6rem'}}>{item.icon}</span>
                    <strong style={{color: item.color, fontFamily:'monospace',fontSize:'0.9rem'}}>{item.text}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel history-section fade-in-up" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{copy.rankAllRanks}</h3></div>
              <div className="history-list">
                {MUSCLE_RANKS.map((r, i) => {
                  const isCurrent = overallMuscleRankData.rank.idx === i;
                  const isUnlocked = overallMuscleRankData.averageVolume >= r.min;
                  const rankName = settings.language === 'sl' ? r.nameSl : r.nameEn;
                  const remaining = Math.max(0, r.min - overallMuscleRankData.averageVolume);
                  return (
                    <article key={r.nameEn} className="history-item" style={{opacity: isUnlocked ? 1 : 0.4, background: isCurrent ? 'rgba(245,158,11,0.08)' : undefined, borderLeft: isCurrent ? `3px solid ${r.color}` : '3px solid transparent'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.8rem'}}>
                        <span style={{background:r.bg,borderRadius:'0.75rem',fontSize:'1.2rem',minWidth:'2.4rem',height:'2.4rem',display:'inline-flex',alignItems:'center',justifyContent:'center',textAlign:'center'}}>{MUSCLE_RANK_ICONS[i]}</span>
                        <div>
                          <h3 style={{margin:0,fontWeight: isCurrent ? 700 : 500}}>{rankName}{isCurrent ? ' <-' : ''}</h3>
                          <p style={{margin:0,fontSize:'0.8rem',opacity:0.6}}>{formatVolume(r.min, settings.units)} {settings.language === 'sl' ? 'povprecja' : 'average'}</p>
                        </div>
                      </div>
                      {isUnlocked && !isCurrent && <span style={{fontSize:'0.8rem',opacity:0.6}}>OK</span>}
                      {isCurrent && <span style={{fontSize:'0.8rem',color:r.color,fontWeight:600}}>{copy.rankCurrentLabel}</span>}
                      {!isUnlocked && <span style={{fontSize:'0.8rem',opacity:0.5}}>{formatVolume(remaining, settings.units)}</span>}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeSection === 'bodyweight' && <>
          <div className="dashboard-grid">
            <section className="glass-panel chart-panel fade-in-up" {...tourAttrs('bodyweight-tracker')}>
              <div className="panel-header"><h3>{copy.bwTitle}</h3>{helpButton('bodyweight')}</div>
              <div className="chart-container">{bwSorted.length ? <Line data={bodyWeightChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } }, y: { beginAtZero: false, grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } } } }} /> : <EmptyState title={copy.bwTitle} body={copy.bwNoData} actionLabel={copy.bwAdd} onAction={() => goToFeature('bodyweight', 'bodyweight-tracker')} />}</div>
            </section>
            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.bwAdd}</h3></div>
              <form className="premium-form" onSubmit={saveBodyWeight}>
                <div className="input-group"><label>{copy.bwDate}</label><input type="date" value={bwForm.date} onChange={(e) => setBwForm((c) => ({ ...c, date: e.target.value }))} /></div>
                <div className="input-group"><label>{copy.bwWeight}</label><input type="number" step="0.1" min="20" value={bwForm.weight} onChange={(e) => setBwForm((c) => ({ ...c, weight: e.target.value }))} placeholder="70.5" /></div>
                <button className="action-btn-primary full-width" type="submit">{copy.bwSave}</button>
              </form>
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="glass-panel action-panel fade-in-up" {...tourAttrs('water-tracker')}>
              <div className="panel-header"><h3>{copy.waterTitle}</h3>{helpButton('water')}</div>
              {(() => {
                const waterGoal = waterGoalMl;
                const pct = Math.min(100, Math.round(waterToday / waterGoal * 100));
                const ringPct = Math.min(100, Math.max(0, (waterToday / waterGoal) * 100));
                const remainingMl = Math.max(0, waterGoal - waterToday);
                return (
                  <div className="hydration-card-body">
                    <div className="hydration-hero">
                      <div className="hydration-ring" style={{'--pct': `${ringPct}%`}}>
                        <div>
                          <strong>{formatLiters(waterToday)} L</strong>
                          <span>{pct}%</span>
                        </div>
                      </div>
                      <div className="hydration-summary">
                        <span>{copy.waterDrank}</span>
                        <strong>{pct >= 100 ? (settings.language === 'sl' ? 'Cilj dosezen' : 'Goal reached') : `${Math.round(remainingMl)} ml ${settings.language === 'sl' ? 'preostalo' : 'left'}`}</strong>
                        <p>{copy.waterGoalLabel}: {(waterGoal / 1000).toFixed(1)} L</p>
                      </div>
                    </div>
                    <div className="hydration-mini-grid">
                      <div><span>{settings.language === 'sl' ? 'Danes' : 'Today'}</span><strong>{formatLiters(waterToday)} L</strong></div>
                      <div><span>{settings.language === 'sl' ? 'Cilj' : 'Goal'}</span><strong>{formatLiters(waterGoal, 1)} L</strong></div>
                      <div><span>{settings.language === 'sl' ? 'Preostanek' : 'Remaining'}</span><strong>{formatLiters(remainingMl)} L</strong></div>
                    </div>
                    <div className="water-quick-grid">
                      {[250, 500, 750, 1000].map(ml => (
                        <button key={ml} className="action-btn-outline" type="button" onClick={() => addWater(ml)}>+{ml} ml</button>
                      ))}
                    </div>
                    <div className="water-custom-row">
                      <input type="number" className="full-width" value={waterCustomMl} onChange={e => setWaterCustomMl(e.target.value)} placeholder="ml" min="50" step="50" />
                      <button className="action-btn-outline" type="button" onClick={() => { const ml = Number(waterCustomMl); if (ml > 0) { addWater(ml); setWaterCustomMl(''); } }}>+</button>
                    </div>
                    <button className="action-btn-outline danger-button full-width" type="button" onClick={resetWater}>{copy.waterReset}</button>
                    <p className="hydration-note">{tdeeResult ? (settings.language === 'sl' ? 'Cilj je posodobljen iz kalkulatorja kalorij.' : 'Goal updated from the calorie calculator.') : (settings.language === 'sl' ? 'Cilj nastavis v Settings ali ga posodobis s kalkulatorjem kalorij.' : 'Set this target in Settings or update it from the calorie calculator.')}</p>
                  </div>
                );
              })()}
            </section>
            <section className="glass-panel action-panel fade-in-up calorie-calculator-panel" {...tourAttrs('calorie-calculator')}>
              <div className="panel-header"><h3>{copy.tdeeTitle}</h3><div className="settings-button-row panel-help-row">{helpButton('tdee')}<span className="calc-method-pill">{settings.language === 'sl' ? 'MSJ + dinamicni model' : 'MSJ + dynamic model'}</span></div></div>
              <form className="premium-form calorie-calculator-form" onSubmit={calculateTDEE}>
                <div className="input-group"><label>{copy.tdeeGender}</label><select className="premium-select" value={tdeeForm.gender} onChange={(e) => setTdeeForm((c) => ({ ...c, gender: e.target.value }))}><option value="male">{copy.tdeeMale}</option><option value="female">{copy.tdeeFemale}</option></select></div>
                <div className="form-row triple">
                  <div className="input-group"><label>{copy.tdeeAge}</label><input type="number" min="10" max="100" value={tdeeForm.age} onChange={(e) => setTdeeForm((c) => ({ ...c, age: e.target.value }))} placeholder="25" /></div>
                  <div className="input-group"><label>{copy.tdeeHeight}</label><input type="number" min="100" max="250" value={tdeeForm.height} onChange={(e) => setTdeeForm((c) => ({ ...c, height: e.target.value }))} placeholder="180" /></div>
                  <div className="input-group"><label>{copy.tdeeWeeks}</label><input type="number" min="1" value={tdeeForm.weeks} onChange={(e) => setTdeeForm((c) => ({ ...c, weeks: e.target.value }))} placeholder="12" /></div>
                </div>
                <div className="input-group"><label>{copy.tdeeCurrentWeight}</label><input type="number" step="0.1" min="20" value={tdeeForm.currentWeight} onChange={(e) => setTdeeForm((c) => ({ ...c, currentWeight: e.target.value }))} placeholder="80" /></div>
                <div className="input-group"><label>{copy.tdeeGoalWeight}</label><input type="number" step="0.1" min="20" value={tdeeForm.goalWeight} onChange={(e) => setTdeeForm((c) => ({ ...c, goalWeight: e.target.value }))} placeholder="75" /></div>
                <div className="input-group"><label>{copy.tdeeActivity}</label><select className="premium-select" value={tdeeForm.activityLevel} onChange={(e) => setTdeeForm((c) => ({ ...c, activityLevel: e.target.value }))}><option value="sedentary">{copy.tdeeSedentary}</option><option value="light">{copy.tdeeLight}</option><option value="moderate">{copy.tdeeModerate}</option><option value="active">{copy.tdeeActive}</option><option value="veryactive">{copy.tdeeVeryActive}</option></select></div>
                <button className="action-btn-primary full-width" type="submit">{copy.tdeeCalculate}</button>
              </form>
              {tdeeResult && (
                <div className="calorie-result-card">
                  <div className="calorie-target-hero">
                    <span>{tdeeResult.capped ? (settings.language === 'sl' ? 'Varen dnevni cilj' : 'Safe daily target') : copy.tdeeTarget}</span>
                    <strong>{tdeeResult.target.toLocaleString()} kcal</strong>
                    <p>{settings.language === 'sl' ? 'Izbran rok' : 'Selected timeframe'}: {tdeeResult.requestedWeeks} {copy.reverseCalWeeks} · {settings.language === 'sl' ? 'Vzdrzevanje danes' : 'Current maintenance'}: {tdeeResult.tdee.toLocaleString()} kcal</p>
                  </div>
                  <div className="calorie-metric-grid">
                    <div><span>BMR</span><strong>{tdeeResult.bmr.toLocaleString()}</strong><small>kcal</small></div>
                    <div><span>{copy.tdeeTDEE}</span><strong>{tdeeResult.tdee.toLocaleString()}</strong><small>kcal</small></div>
                    <div><span>{settings.language === 'sl' ? 'Ciljno vzdrz.' : 'Goal maint.'}</span><strong>{tdeeResult.goalMaintenance.toLocaleString()}</strong><small>kcal</small></div>
                    <div><span>{settings.language === 'sl' ? 'Sprememba' : 'Change'}</span><strong className={tdeeResult.dailyAdjustment > 0 ? 'negative' : tdeeResult.dailyAdjustment < 0 ? 'positive' : ''}>{tdeeResult.dailyAdjustment > 0 ? '-' : tdeeResult.dailyAdjustment < 0 ? '+' : ''}{Math.abs(tdeeResult.dailyAdjustment)}</strong><small>kcal/day</small></div>
                    <div><span>{settings.language === 'sl' ? 'Tempo' : 'Pace'}</span><strong>{Math.abs(tdeeResult.projectedWeeklyChange).toFixed(2)}</strong><small>kg/week</small></div>
                    <div><span>{settings.language === 'sl' ? 'Po izbranem roku' : 'After selected time'}</span><strong>{tdeeResult.predictedWeight.toFixed(1)}</strong><small>kg</small></div>
                  </div>
                  <div className={`timeframe-check-card ${tdeeResult.capped || !tdeeResult.requestedFeasible ? 'warning' : 'ok'}`}>
                    <div className="timeframe-check-head">
                      <span>{settings.language === 'sl' ? 'Tvoj izbran rok' : 'Your selected timeframe'}</span>
                      <strong>{tdeeResult.requestedWeeks} {copy.reverseCalWeeks}</strong>
                    </div>
                    <div className="timeframe-check-grid">
                      <div>
                        <span>{settings.language === 'sl' ? 'Za ta rok bi bilo treba' : 'Needed for that date'}</span>
                        <strong>{tdeeResult.requestedFeasible && tdeeResult.requestedTarget !== null ? `${tdeeResult.requestedTarget.toLocaleString()} kcal` : (settings.language === 'sl' ? 'Ni izvedljivo' : 'Not feasible')}</strong>
                        <small>{tdeeResult.requestedDailyAdjustment > 0 ? '-' : tdeeResult.requestedDailyAdjustment < 0 ? '+' : ''}{Math.abs(tdeeResult.requestedDailyAdjustment).toLocaleString()} kcal/day</small>
                      </div>
                      <div>
                        <span>{settings.language === 'sl' ? 'App priporoca' : 'App recommends'}</span>
                        <strong>{tdeeResult.target.toLocaleString()} kcal</strong>
                        <small>{tdeeResult.capped ? (settings.language === 'sl' ? 'varnostna omejitev' : 'safety cap applied') : (settings.language === 'sl' ? 'rok je upostevan' : 'timeframe matched')}</small>
                      </div>
                      <div>
                        <span>{settings.language === 'sl' ? 'Varen cas' : 'Safe time'}</span>
                        <strong>{tdeeResult.recommendedWeeks ? `${tdeeResult.recommendedWeeks} ${copy.reverseCalWeeks}` : '-'}</strong>
                        <small>{settings.language === 'sl' ? 'pri tem cilju' : 'at this target'}</small>
                      </div>
                    </div>
                    <p>{tdeeResult.requestedFeasible
                      ? (tdeeResult.capped
                        ? (settings.language === 'sl' ? 'Rok je bil upostevan pri izracunu, ampak zahteva bolj agresiven vnos od varnega razpona, zato je prikazan varen cilj.' : 'The timeframe was calculated, but it requires a more aggressive intake than the safe range, so the safe target is shown.')
                        : (settings.language === 'sl' ? 'Ta vnos uporablja tvoj izbran rok in naj bi dosegel cilj v tem casu.' : 'This intake uses your selected timeframe and is projected to hit the goal in that time.'))
                      : (settings.language === 'sl' ? `Tega cilja ni mogoce doseci v izbranem roku brez ekstremnega vnosa. Prikazan je varen cilj; tudi pri 0 kcal bi bila napoved približno ${tdeeResult.requestedBoundaryWeight} kg.` : `This goal cannot be reached in the selected timeframe without an extreme intake. The safe target is shown; even at 0 kcal, the projection is about ${tdeeResult.requestedBoundaryWeight} kg.`)}</p>
                  </div>
                  <div className="macro-result-grid">
                    {[
                      [copy.macrosProtein, tdeeResult.protein, '#60a5fa', tdeeResult.protein * 4],
                      [copy.macrosCarbs, tdeeResult.carbs, '#fb923c', tdeeResult.carbs * 4],
                      [copy.macrosFat, tdeeResult.fat, '#34d399', tdeeResult.fat * 9],
                    ].map(([label, grams, color, kcal]) => (
                      <div key={label} className="macro-result-item" style={{'--macro-color': color, '--macro-width': `${Math.min(100, Math.round((kcal / Math.max(1, tdeeResult.target)) * 100))}%`}}>
                        <span>{label}</span>
                        <strong>{grams} g</strong>
                        <i />
                      </div>
                    ))}
                  </div>
                  <div className="calorie-support-grid">
                    <div><span>{copy.macrosWater}</span><strong>{(tdeeResult.waterMl/1000).toFixed(1)} L</strong></div>
                    <div><span>{settings.language === 'sl' ? 'Izbran rok' : 'Selected time'}</span><strong>{tdeeResult.requestedWeeks} {copy.reverseCalWeeks}</strong></div>
                    <div><span>{settings.language === 'sl' ? 'Varen cas' : 'Safe time'}</span><strong>{tdeeResult.recommendedWeeks ? `${tdeeResult.recommendedWeeks} ${copy.reverseCalWeeks}` : '-'}</strong></div>
                  </div>
                  {tdeeResult.isTeen && <p className="settings-copy calorie-warning">{settings.language === 'sl' ? 'Ker je starost pod 18, je kalkulator omejil agresivne spremembe. Za hujsanje ali vecji surplus pri mladoletnih osebah naj cilj potrdi zdravnik ali dietetik.' : 'Because age is under 18, aggressive changes are capped. For weight loss or a large surplus in minors, confirm the target with a clinician or registered dietitian.'}</p>}
                  {tdeeResult.capped && <p className="settings-copy calorie-warning">{settings.language === 'sl' ? 'Izbran rok je bil bolj agresiven od varnega razpona, zato je cilj omejen in napovedana teza lahko ne doseze cilja v tem roku.' : 'The selected timeframe was more aggressive than the safe range, so the target was capped and the predicted weight may not fully reach the goal by then.'}</p>}
                  <button className="action-btn-outline full-width set-goal-btn" type="button" onClick={() => { setSettings(c => ({...c, calorieGoal: tdeeResult.target})); alert(copy.goalSet); }}>
                    {copy.setAsGoal}
                  </button>
                </div>
              )}
              {/* Reverse calorie calculator */}
              <div className="reverse-calorie-card">
                <h4>{copy.reverseCalTitle}</h4>
                <form className="premium-form" onSubmit={calculateReverseCal}>
                  <div className="input-group">
                    <label>{copy.reverseCalDailyKcal}</label>
                    <input type="number" min="500" value={reverseCalDailyKcal} onChange={e => setReverseCalDailyKcal(e.target.value)} placeholder="2000" />
                  </div>
                  <button className="action-btn-outline full-width" type="submit">{copy.reverseCalCalc}</button>
                </form>
                {reverseCalResult && !reverseCalResult.error && (
                  <div className="reverse-result">
                    <p>{copy.reverseCalResult}</p>
                    <strong>{reverseCalResult.weeks} {copy.reverseCalWeeks}</strong>
                    <span>{reverseCalResult.gaining ? copy.reverseCalGaining : copy.reverseCalLosing} / {reverseCalResult.dailyDiff > 0 ? '+' : ''}{Math.round(reverseCalResult.dailyDiff)} kcal</span>
                  </div>
                )}
                {reverseCalResult?.error && <p className="settings-copy" style={{marginTop:'0.75rem'}}>{settings.language === 'sl' ? 'Ta vnos kalorij ne vodi proti izbranemu cilju. Za izgubo mora biti pod TDEE, za pridobivanje nad TDEE.' : 'That calorie intake does not move toward the selected goal. For loss it must be below TDEE; for gain it must be above TDEE.'}</p>}
              </div>
            </section>
            <section className="glass-panel history-section fade-in-up">
              <div className="panel-header"><h3>{copy.bwTitle}</h3><span className="history-count">{bodyWeightEntries.length}</span></div>
              <div className="history-list">{bodyWeightEntries.length ? [...bodyWeightEntries].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,20).map((e) => (
                <article className="history-item" key={e.id}>
                  <div><h3>{e.weight} kg</h3><p>{formatDateValue(e.date, settings.dateFormat)}</p></div>
                  <button className="action-btn-outline danger-button" type="button" onClick={() => deleteBodyWeightEntry(e.id)}>{copy.delete}</button>
                </article>
              )) : <EmptyState body={copy.bwNoData} actionLabel={copy.bwAdd} onAction={() => goToFeature('bodyweight', 'bodyweight-tracker')} />}</div>
            </section>
          </div>
        </>}

        {activeSection === 'admin' && currentUser === ADMIN_EMAIL && (() => {
          const isSl = settings.language === 'sl';
          const t = {
            title: isSl ? 'Admin Command Center' : 'Admin Command Center',
            subtitle: isSl ? 'Upravljaj aplikacijo, uporabnike, feedback, varnost in lokalne podatke iz enega mesta.' : 'Control the app, users, feedback, security and local data from one place.',
            appControls: isSl ? 'App controls' : 'App controls',
            userOps: isSl ? 'User operations' : 'User operations',
            selectedUser: isSl ? 'Izbran uporabnik' : 'Selected user',
            feedback: isSl ? 'Feedback inbox' : 'Feedback inbox',
            activity: isSl ? 'Activity stream' : 'Activity stream',
            audit: isSl ? 'Admin audit' : 'Admin audit',
            dataTools: isSl ? 'Data tools' : 'Data tools',
            save: isSl ? 'Shrani kontrole' : 'Save controls',
            reset: isSl ? 'Reset controls' : 'Reset controls',
            applyMe: isSl ? 'Uporabi na meni' : 'Apply to me',
            applyAll: isSl ? 'Uporabi na vseh' : 'Apply to all',
            exportSnapshot: isSl ? 'Export admin snapshot' : 'Export admin snapshot',
            maintenance: isSl ? 'Maintenance mode' : 'Maintenance mode',
            signups: isSl ? 'Registracije' : 'Signups',
            feedbackBtn: isSl ? 'Feedback gumb' : 'Feedback button',
            backups: isSl ? 'Backup banner' : 'Backup banner',
            announcement: isSl ? 'Obvestilo v appu' : 'In-app announcement',
            defaults: isSl ? 'Privzete nastavitve za nove profile' : 'Defaults for new profiles',
            searchUsers: isSl ? 'Isci email, rang ali status' : 'Search email, rank or status',
            noUser: isSl ? 'Ni uporabnikov za ta filter.' : 'No users match this filter.',
            exportUser: isSl ? 'Export user' : 'Export user',
            resetUser: isSl ? 'Reset data' : 'Reset data',
            deleteUser: isSl ? 'Delete user' : 'Delete user',
            clearFeedback: isSl ? 'Clear feedback' : 'Clear feedback',
            clearAudit: isSl ? 'Clear audit' : 'Clear audit',
            online: isSl ? 'Online' : 'Online',
            offline: isSl ? 'Offline' : 'Offline',
          };
          const allUsers = loadUsers();
          const now = Date.now();
          const presenceByEmail = adminPresence.reduce((map, item) => ({ ...map, [item.email]: item }), {});
          const userStats = allUsers.map((u) => {
            const wList = loadWorkouts(u.email);
            const cList = loadCalories(u.email);
            const bwList = loadBodyWeight(u.email);
            const rDays = loadRestDays(u.email);
            const cDays = loadCheatDays(u.email);
            const sett = loadSettings(u.email);
            const custom = loadCustomExercises(u.email);
            const bonus = loadAdminBonus(u.email);
            const basePts = calculatePoints(wList, cList, bwList, rDays, cDays, sett.calorieGoal);
            const totalPts = basePts + bonus;
            const userRank = getRank(totalPts, settings.language);
            const lastW = wList.length ? [...wList].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date : null;
            const presence = presenceByEmail[u.email];
            const isOnline = presence && now - new Date(presence.ts).getTime() < 3 * 60000;
            const isBanned = bannedUsers.includes(u.email);
            const isMod = modUsers.includes(u.email);
            return { email: u.email, createdAt: u.createdAt, workouts: wList.length, meals: cList.length, bw: bwList.length, custom: custom.length, lastWorkout: lastW, rank: userRank, pts: totalPts, bonus, settings: sett, isOnline, isBanned, isMod, presence };
          }).sort((a, b) => b.pts - a.pts);
          const query = adminSearch.trim().toLowerCase();
          const filteredUsers = userStats.filter((u) => !query || [u.email, u.rank.displayName, u.isOnline ? 'online' : 'offline', u.isBanned ? 'banned' : '', u.isMod ? 'moderator' : ''].join(' ').toLowerCase().includes(query));
          const selectedUser = userStats.find((u) => u.email === adminSelectedEmail) || filteredUsers[0] || userStats[0] || null;
          const totalWorkouts = userStats.reduce((s, u) => s + u.workouts, 0);
          const totalMeals = userStats.reduce((s, u) => s + u.meals, 0);
          const activeNow = userStats.filter((u) => u.isOnline);
          const allRatings = ratings;
          const recentLogins = [...(adminLogs || loadLoginLogs())].reverse().slice(0, 12);
          const recentAudit = adminAudit.slice(0, 12);
          return (
            <>
              <section className="glass-panel admin-hero-panel fade-in-up" {...tourAttrs('admin-command-center')}>
                <div>
                  <p className="exercise-category">ADMIN ONLY</p>
                  <h2>{t.title}</h2>
                  <p>{t.subtitle}</p>
                </div>
                <div className="admin-hero-actions">
                  {helpButton('admin')}
                  <button className="action-btn-primary" type="button" onClick={saveAdminPanelConfig}>{t.save}</button>
                  <button className="action-btn-outline" type="button" onClick={exportAdminSnapshot}>{t.exportSnapshot}</button>
                </div>
              </section>

              <div className="admin-metric-grid">
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">U</div><div><p className="stat-title">{copy.adminTotalUsers}</p><h3 className="stat-value">{allUsers.length}</h3></div></article>
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">W</div><div><p className="stat-title">{copy.adminTotalWorkouts}</p><h3 className="stat-value">{totalWorkouts}</h3></div></article>
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow">M</div><div><p className="stat-title">{copy.adminMeals}</p><h3 className="stat-value">{totalMeals}</h3></div></article>
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon orange-glow">ON</div><div><p className="stat-title">{copy.adminActiveUsers}</p><h3 className="stat-value">{activeNow.length}</h3></div></article>
              </div>

              <section className="glass-panel admin-panel fade-in-up">
                <div className="panel-header"><h3>{t.appControls}</h3><span className="history-count">{adminConfig.maintenanceMode ? 'maintenance on' : 'live'}</span></div>
                <div className="admin-control-grid">
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminAppName">App name</label>
                    <input id="adminAppName" value={adminConfigDraft.appName} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, appName: e.target.value }))} />
                  </article>
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminDefaultLang">{t.defaults}</label>
                    <select id="adminDefaultLang" className="premium-select full-width" value={adminConfigDraft.defaultLanguage} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, defaultLanguage: e.target.value }))}>{LANGUAGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
                  </article>
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminDefaultAccent">Default accent</label>
                    <select id="adminDefaultAccent" className="premium-select full-width" value={adminConfigDraft.defaultAccent} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, defaultAccent: e.target.value }))}>{BACKGROUND_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{getLocalizedLabel(preset.label, settings.language)}</option>)}</select>
                  </article>
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminDefaultUnits">Default units</label>
                    <select id="adminDefaultUnits" className="premium-select full-width" value={adminConfigDraft.defaultUnits} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, defaultUnits: e.target.value }))}><option value="kg">kg</option><option value="lbs">lbs</option></select>
                  </article>
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminDefaultCalories">Default calories</label>
                    <input id="adminDefaultCalories" type="number" min="1000" max="10000" step="50" value={adminConfigDraft.defaultCalorieGoal} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, defaultCalorieGoal: Number(e.target.value) || defaultAdminConfig.defaultCalorieGoal }))} />
                  </article>
                  <article className="settings-card">
                    <label className="settings-label" htmlFor="adminDefaultWater">Default water ml</label>
                    <input id="adminDefaultWater" type="number" min="1000" max="8000" step="100" value={adminConfigDraft.defaultWaterGoalMl} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, defaultWaterGoalMl: Number(e.target.value) || defaultAdminConfig.defaultWaterGoalMl }))} />
                  </article>
                  <article className="settings-card settings-card-wide">
                    <span className="settings-label">{t.appControls}</span>
                    <div className="admin-toggle-grid">
                      {[['maintenanceMode', t.maintenance], ['signupEnabled', t.signups], ['feedbackEnabled', t.feedbackBtn], ['backupBannerEnabled', t.backups], ['announcementEnabled', t.announcement]].map(([key, label]) => (
                        <button key={key} className={`admin-toggle ${adminConfigDraft[key] ? 'active' : ''}`} type="button" onClick={() => setAdminConfigDraft((c) => ({ ...c, [key]: !c[key] }))}>
                          <span>{label}</span><strong>{adminConfigDraft[key] ? 'ON' : 'OFF'}</strong>
                        </button>
                      ))}
                    </div>
                  </article>
                  <article className="settings-card settings-card-wide">
                    <label className="settings-label" htmlFor="adminAnnouncement">{t.announcement}</label>
                    <textarea id="adminAnnouncement" className="admin-textarea" value={adminConfigDraft.announcementText} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, announcementText: e.target.value }))} placeholder={isSl ? 'Kratek tekst, ki se prikaze uporabnikom.' : 'Short text shown inside the app.'} />
                  </article>
                  <article className="settings-card settings-card-wide">
                    <label className="settings-label" htmlFor="adminNote">Private admin note</label>
                    <textarea id="adminNote" className="admin-textarea" value={adminConfigDraft.adminNote} onChange={(e) => setAdminConfigDraft((c) => ({ ...c, adminNote: e.target.value }))} placeholder={isSl ? 'Opombe zate, roadmap, naslednji fixi...' : 'Private notes, roadmap, next fixes...'} />
                  </article>
                </div>
                <div className="admin-action-row">
                  <button className="action-btn-primary" type="button" onClick={saveAdminPanelConfig}>{t.save}</button>
                  <button className="action-btn-outline" type="button" onClick={applyAdminDefaultsToMe}>{t.applyMe}</button>
                  <button className="action-btn-outline" type="button" onClick={applyAdminDefaultsToAllUsers}>{t.applyAll}</button>
                  <button className="action-btn-outline danger-button" type="button" onClick={resetAdminPanelConfig}>{t.reset}</button>
                </div>
              </section>

              <section className="glass-panel admin-panel fade-in-up">
                <div className="panel-header"><h3>{t.userOps}</h3><input className="history-search-input" type="search" placeholder={t.searchUsers} value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /></div>
                <div className="admin-user-grid">
                  {filteredUsers.length === 0 && <div className="empty-state"><p>{t.noUser}</p></div>}
                  {filteredUsers.map((u) => (
                    <button className={`admin-user-card ${selectedUser?.email === u.email ? 'active' : ''}`} key={u.email} type="button" onClick={() => setAdminSelectedEmail(u.email)}>
                      <span className={`admin-status-dot ${u.isOnline ? 'online' : ''}`} />
                      <strong>{u.email}</strong>
                      <small>{u.rank.displayName} · {u.pts} pts · {u.workouts} workouts</small>
                      <span>{u.isBanned ? copy.adminBanned : u.isMod ? copy.adminMod : u.isOnline ? t.online : t.offline}</span>
                    </button>
                  ))}
                </div>
              </section>

              {selectedUser && <section className="glass-panel admin-panel fade-in-up">
                <div className="panel-header"><h3>{t.selectedUser}</h3><span className="history-count">{selectedUser.email}</span></div>
                <div className="admin-user-detail">
                  <div className="admin-user-summary">
                    <div className="stat-icon blue-glow">{getUserBadge(selectedUser.email)}</div>
                    <div>
                      <h3>{selectedUser.email}</h3>
                      <p>{copy.adminRegistered}: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : copy.adminNever}</p>
                    </div>
                  </div>
                  <div className="admin-detail-grid">
                    <div><span>{copy.rankTitle}</span><strong>{selectedUser.rank.displayName}</strong></div>
                    <div><span>{copy.rankPoints}</span><strong>{selectedUser.pts}</strong></div>
                    <div><span>{copy.adminWorkouts}</span><strong>{selectedUser.workouts}</strong></div>
                    <div><span>{copy.adminMeals}</span><strong>{selectedUser.meals}</strong></div>
                    <div><span>{copy.adminBodyWeight}</span><strong>{selectedUser.bw}</strong></div>
                    <div><span>Bonus</span><strong>{selectedUser.bonus}</strong></div>
                    <div><span>Language</span><strong>{selectedUser.settings.language}</strong></div>
                    <div><span>Accent</span><strong>{selectedUser.settings.backgroundAccent}</strong></div>
                  </div>
                  <div className="admin-action-row">
                    <button className="action-btn-outline" type="button" onClick={() => adminChangeRank(selectedUser.email, 'up')}>{copy.adminRankUp}</button>
                    <button className="action-btn-outline" type="button" onClick={() => adminChangeRank(selectedUser.email, 'down')}>{copy.adminDemote}</button>
                    <button className="action-btn-outline" type="button" onClick={() => adminExportUser(selectedUser.email)}>{t.exportUser}</button>
                    {selectedUser.email !== ADMIN_EMAIL && (selectedUser.isBanned ? <button className="action-btn-outline" type="button" onClick={() => unbanUser(selectedUser.email)}>{copy.adminUnban}</button> : <button className="action-btn-outline danger-button" type="button" onClick={() => banUser(selectedUser.email)}>{copy.adminBan}</button>)}
                    {selectedUser.email !== ADMIN_EMAIL && (selectedUser.isMod ? <button className="action-btn-outline" type="button" onClick={() => toggleMod(selectedUser.email)}>{copy.adminRemoveMod}</button> : <button className="action-btn-primary" type="button" onClick={() => toggleMod(selectedUser.email)}>{copy.adminSetMod}</button>)}
                    <button className="action-btn-outline danger-button" type="button" onClick={() => adminResetUserData(selectedUser.email)}>{t.resetUser}</button>
                    {selectedUser.email !== ADMIN_EMAIL && <button className="action-btn-outline danger-button" type="button" onClick={() => adminDeleteUser(selectedUser.email)}>{t.deleteUser}</button>}
                  </div>
                </div>
              </section>}

              <div className="admin-two-column">
                <section className="glass-panel admin-panel fade-in-up">
                  <div className="panel-header"><h3>{t.feedback}</h3><span className="history-count">{allRatings.length}</span></div>
                  <div className="admin-feed-list">
                    {allRatings.length === 0 && <div className="empty-state"><p>{copy.adminNoComments}</p></div>}
                    {[...allRatings].reverse().slice(0, 8).map((r) => (
                      <article className="admin-feed-item" key={r.id}>
                        <strong>{r.email || '-'}</strong>
                        <span>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)} · {new Date(r.date).toLocaleDateString()}</span>
                        {r.comment && <p>{r.comment}</p>}
                        {r.privateComment && <p className="admin-private-note">{r.privateComment}</p>}
                      </article>
                    ))}
                  </div>
                  <div className="admin-action-row"><button className="action-btn-outline danger-button" type="button" onClick={clearAllFeedback}>{t.clearFeedback}</button></div>
                </section>
                <section className="glass-panel admin-panel fade-in-up">
                  <div className="panel-header"><h3>{t.activity}</h3><span className="history-count">{adminLogs === null ? copy.loading : recentLogins.length}</span></div>
                  <div className="admin-feed-list">
                    {recentLogins.length === 0 && <div className="empty-state"><p>{copy.adminNoLogins}</p></div>}
                    {recentLogins.map((entry, i) => (
                      <article className="admin-feed-item" key={`${entry.email}-${entry.ts}-${i}`}>
                        <strong>{entry.email}</strong>
                        <span>{entry.type === 'signup' ? copy.adminSignupEvent : copy.adminLoginEvent} · {new Date(entry.ts).toLocaleString()}</span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <section className="glass-panel admin-panel fade-in-up">
                <div className="panel-header"><h3>{t.audit}</h3><span className="history-count">{adminAudit.length}</span></div>
                <div className="admin-audit-list">
                  {recentAudit.length === 0 && <div className="empty-state"><p>{isSl ? 'Ni admin akcij.' : 'No admin actions yet.'}</p></div>}
                  {recentAudit.map((entry) => (
                    <article className="admin-audit-item" key={entry.id}>
                      <strong>{entry.action}</strong>
                      <span>{entry.detail || '-'}</span>
                      <small>{new Date(entry.ts).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
                <div className="admin-action-row">
                  <button className="action-btn-outline" type="button" onClick={adminShowRecap}>{copy.adminShowRecap}</button>
                  <button className="action-btn-outline" type="button" onClick={exportAdminSnapshot}>{t.exportSnapshot}</button>
                  <button className="action-btn-outline danger-button" type="button" onClick={clearAdminAuditLog}>{t.clearAudit}</button>
                </div>
              </section>
            </>
          );
        })()}

        {activeSection === 'settings' && (
          <section className="glass-panel settings-guide-panel fade-in-up" {...tourAttrs('settings-main')}>
            <div className="panel-header">
              <h3>{settings.language === 'sl' ? 'Vodic po nastavitvah' : 'Settings guide'}</h3>
              {helpButton('settings')}
            </div>
            <div className="settings-guide-grid">
              <button className="settings-guide-card" type="button" onClick={scrollToSettingsLanguage} {...tourAttrs('settings-appearance')}>
                <span>{settings.language === 'sl' ? 'Izgled in jezik' : 'Appearance and language'}</span>
                <small>{settings.language === 'sl' ? 'Barva, enote, jezik in format datuma.' : 'Color, units, language, and date format.'}</small>
              </button>
              <button className="settings-guide-card" type="button" onClick={() => setHelpTopic('data')} {...tourAttrs('settings-data')}>
                <span>{settings.language === 'sl' ? 'Backup in podatki' : 'Backup and data'}</span>
                <small>{settings.language === 'sl' ? 'Export, import, install, clear in varnostne kopije.' : 'Export, import, install, clear, and backups.'}</small>
              </button>
              <button className="settings-guide-card" type="button" onClick={() => { setTutorialStep(0); setShowTutorial(true); }} {...tourAttrs('settings-help')}>
                <span>{copy.tutorialOpen}</span>
                <small>{settings.language === 'sl' ? 'Ponovno odpri celoten vodeni tutorial.' : 'Open the full guided tutorial again.'}</small>
              </button>
            </div>
          </section>
        )}

        {activeSection === 'settings' && <section className="glass-panel settings-section fade-in-up"><div className="panel-header"><h3>{copy.settings}</h3></div><div className="settings-grid"><article className="settings-card"><label className="settings-label" htmlFor="units">{copy.units}</label><select id="units" className="premium-select full-width" value={settings.units} onChange={(e) => setSettings((c) => ({ ...c, units: e.target.value }))}><option value="kg">kg</option><option value="lbs">lbs</option></select></article><article id="settings-language-card" className="settings-card"><label className="settings-label" htmlFor="lang">{copy.language}</label><select id="lang" className="premium-select full-width" value={settings.language} onChange={(e) => { setHelpTopic(null); setSettings((c) => ({ ...c, language: e.target.value })); }}><option value="en">English</option>{LANGUAGE_OPTIONS.filter((option) => option.id !== 'en').map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article><article className="settings-card settings-card-wide"><div className="settings-actions settings-actions-stacked"><div><span className="settings-title">{copy.backgroundAccent}</span><p className="settings-copy">{copy.backgroundAccentDesc}</p></div><div className="accent-picker" role="radiogroup" aria-label={copy.backgroundAccent}>{BACKGROUND_PRESETS.map((preset) => <button key={preset.id} className={`accent-choice ${settings.backgroundAccent === preset.id ? 'active' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, backgroundAccent: preset.id }))} aria-pressed={settings.backgroundAccent === preset.id}><span className="accent-swatch" style={{ background: preset.color }} />{getLocalizedLabel(preset.label, settings.language)}</button>)}</div></div></article><article className="settings-card"><label className="settings-label" htmlFor="dateFormat">{copy.dateFormat}</label><select id="dateFormat" className="premium-select full-width" value={settings.dateFormat} onChange={(e) => setSettings((c) => ({ ...c, dateFormat: e.target.value }))}><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="backup">{copy.backupReminder}</label><select id="backup" className="premium-select full-width" value={settings.backupReminderDays} onChange={(e) => setSettings((c) => ({ ...c, backupReminderDays: Number(e.target.value) }))}><option value={3}>3 {copy.days}</option><option value={7}>7 {copy.days}</option><option value={14}>14 {copy.days}</option><option value={30}>30 {copy.days}</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="calorieGoal">{copy.calorieGoal}</label><input id="calorieGoal" type="number" min="1000" step="50" value={settings.calorieGoal} onChange={(e) => setSettings((c) => ({ ...c, calorieGoal: Number(e.target.value) || 2200 }))} /></article><article className="settings-card"><label className="settings-label" htmlFor="trackerMode">{copy.trackerMode}</label><select id="trackerMode" className="premium-select full-width" value={settings.calorieTrackerMode} onChange={(e) => setSettings((c) => ({ ...c, calorieTrackerMode: e.target.value }))}><option value="simple">{copy.simpleTracker}</option><option value="advanced">{copy.advancedTracker}</option></select></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.lastBackup}</span><p className="settings-copy">{settings.lastBackupAt ? formatDateValue(settings.lastBackupAt.slice(0, 10), settings.dateFormat) : copy.never}</p></div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={exportData}>{copy.export}</button><button className="action-btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>{copy.import}</button></div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.installApp}</span><p className="settings-copy">{copy.installAppDesc}</p></div><div>{isInStandaloneMode ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installDone}</span> : isIos ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installIos}</span> : <button className="action-btn-outline" type="button" onClick={triggerInstall} disabled={!installPrompt}>{copy.installBtn}</button>}</div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.showFeedbackBtn}</span><p className="settings-copy">{copy.showFeedbackBtnDesc}</p></div><button className="action-btn-outline" type="button" onClick={() => setSettings(c => ({...c, showFeedbackBtn: !c.showFeedbackBtn}))}>{settings.showFeedbackBtn ? '✓ On' : 'Off'}</button></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.tutorialOpen}</span><p className="settings-copy">{copy.tutorialOpenDesc}</p></div><button className="action-btn-outline" type="button" onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>{copy.tutorialOpen}</button></div></article><article className="settings-card settings-card-wide danger-card"><div className="settings-actions"><div><span className="settings-title">{copy.clear}</span><p className="settings-copy">{copy.backupText}</p></div><button className="action-btn-outline danger-button" type="button" onClick={clearData}>{copy.clear}</button></div></article></div><input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importData} /></section>}
        {activeSection === 'settings' && (
          <section className="glass-panel settings-section fade-in-up data-privacy-panel">
            <div className="panel-header"><h3>{copy.dataPrivacy}</h3>{helpButton('data')}</div>
            <p className="settings-copy">{copy.dataPrivacyDesc}</p>
            <div className="settings-card demo-data-card">
              <span className="settings-title">{copy.demoDataTitle}</span>
              <p className="settings-copy">{copy.demoDataDesc}</p>
              <div className="settings-button-row">
                <button className="action-btn-outline" type="button" onClick={addDemoData}>{copy.demoDataAdd}</button>
                <button className="action-btn-outline" type="button" onClick={clearDemoData}>{copy.demoDataClear}</button>
              </div>
            </div>
            <div className="settings-button-row privacy-actions-row">
              <button className="action-btn-outline" type="button" onClick={exportData}>{copy.export}</button>
              <button className="action-btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>{copy.import}</button>
              <a className="action-btn-outline privacy-link-btn" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{copy.privacyPolicy}</a>
              <button className="action-btn-outline danger-button" type="button" onClick={clearData}>{copy.clear}</button>
            </div>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="glass-panel settings-section fade-in-up" {...tourAttrs('personal-targets')}>
            <div className="panel-header"><h3>{settings.language === 'sl' ? 'Osebni cilji' : 'Personal targets'}</h3>{helpButton('personalTargets')}</div>
            <div className="settings-grid">
              <article className="settings-card">
                <label className="settings-label" htmlFor="waterGoal">{copy.macrosWater}</label>
                <input id="waterGoal" type="number" min="1000" max="8000" step="100" value={settings.waterGoalMl || defaultSettings.waterGoalMl} onChange={(e) => setSettings((c) => ({ ...c, waterGoalMl: Number(e.target.value) || defaultSettings.waterGoalMl }))} />
                <p className="settings-copy" style={{marginTop:'0.5rem'}}>{settings.language === 'sl' ? 'Uporabi svoj cilj ali ga posodobi iz TDEE kalkulatorja.' : 'Use your own target or update it from the TDEE calculator.'}</p>
              </article>
              <article className="settings-card">
                <span className="settings-label">{settings.language === 'sl' ? 'Shranjena prehrana' : 'Saved nutrition'}</span>
                <div className="stats-list">
                  <div className="stats-row"><span>{copy.calorieGoal}</span><strong>{Math.round(settings.calorieGoal)} kcal</strong></div>
                  <div className="stats-row"><span>{copy.macrosWater}</span><strong>{((settings.waterGoalMl || defaultSettings.waterGoalMl) / 1000).toFixed(1)} L</strong></div>
                </div>
              </article>
            </div>
          </section>
        )}
      </main>

      {currentUser && (
        <>
          {showScrollTop && (
          <button
            className="scroll-top-fab"
            type="button"
            onClick={() => {
              mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label={slUi ? 'Nazaj na vrh' : 'Back to top'}
            title={slUi ? 'Nazaj na vrh' : 'Back to top'}
          >
            ↑
          </button>
          )}

          {quickActionsOpen && (
            <QuickActions
              actions={quickActions}
              title={slUi ? 'Akcije' : 'Actions'}
              closeLabel={slUi ? 'Zapri' : 'Close'}
              searchLabel={slUi ? 'Odpri iskanje' : 'Open search'}
              onClose={() => setQuickActionsOpen(false)}
              onSearch={() => { setCommandOpen(true); setQuickActionsOpen(false); }}
              onRun={runCommandAction}
            />
          )}
        </>
      )}

      {commandOpen && (
        <div className="command-overlay" onClick={() => setCommandOpen(false)}>
          <section className="command-panel glass-panel" role="dialog" aria-label={slUi ? 'Iskanje' : 'Search'} onClick={(event) => event.stopPropagation()}>
            <div className="command-head">
              <div>
                <p className="exercise-category">{slUi ? 'Iskanje' : 'Search'}</p>
                <h3>{slUi ? 'Kam zelis?' : 'Where to?'}</h3>
              </div>
              <button className="context-help-btn" type="button" onClick={() => setCommandOpen(false)} aria-label={slUi ? 'Zapri' : 'Close'}>x</button>
            </div>
            <div className="command-input-wrap">
              <Search size={17} strokeWidth={2.3} />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && commandMatches[0]) {
                    event.preventDefault();
                    runCommandAction(commandMatches[0]);
                  }
                }}
                placeholder={slUi ? 'Isci funkcijo, vnos, kalkulator...' : 'Search feature, log, calculator...'}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="command-results">
              {commandMatches.length ? commandMatches.map((action) => (
                <button key={action.id} className="command-item" type="button" onClick={() => runCommandAction(action)}>
                  <span className="command-icon">{action.icon}</span>
                  <span className="command-copy">
                    <strong>{action.label}</strong>
                    <small>{action.description}</small>
                  </span>
                </button>
              )) : (
                <div className="command-empty">
                  <strong>{slUi ? 'Ni rezultatov' : 'No results'}</strong>
                  <p>{slUi ? 'Poskusi drug izraz ali odpri enega izmed glavnih zavihkov.' : 'Try another word or open one of the main tabs.'}</p>
                </div>
              )}
            </div>
            <div className="command-foot">
              <span>{slUi ? 'Tipka' : 'Shortcut'} <kbd>Ctrl</kbd> + <kbd>K</kbd></span>
              <span>{slUi ? 'Tudi' : 'Also'} <kbd>/</kbd></span>
            </div>
          </section>
        </div>
      )}

      {currentUser && settings.showFeedbackBtn !== false && adminConfig.feedbackEnabled && (
        <div className="feedback-widget">
          {feedbackOpen && (
            <div className="feedback-popup glass-panel">
              {feedbackSent ? (
                <p className="feedback-sent">{copy.ratingDone}</p>
              ) : (<>
                <div className="feedback-popup-header">
                  <span>{copy.ratingsTitle}</span>
                  <button className="feedback-close-btn" type="button" onClick={() => setFeedbackOpen(false)}>✕</button>
                </div>
                <div className="feedback-stars">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" className={`feedback-star${ratingForm.stars >= n ? ' active' : ''}`} onClick={() => setRatingForm(c => ({...c, stars: n}))}>★</button>
                  ))}
                </div>
                <textarea className="feedback-textarea" rows={3} placeholder={copy.ratingCommentPlaceholder} value={ratingForm.comment} onChange={e => setRatingForm(c => ({...c, comment: e.target.value}))} />
                <textarea className="feedback-textarea" rows={2} placeholder={copy.ratingPrivatePlaceholder} value={ratingForm.privateComment} onChange={e => setRatingForm(c => ({...c, privateComment: e.target.value}))} />
                <button className="action-btn-primary" type="button" onClick={submitRating}>{copy.ratingSubmit}</button>
              </>)}
            </div>
          )}
          <button className="feedback-fab" type="button" title={copy.ratingsTitle} onClick={() => setFeedbackOpen(v => !v)}>💬</button>
        </div>
      )}
      {swUpdatePending && (
        <UpdateBanner
          message={settings.language === 'sl' ? 'Nova verzija je na voljo' : 'New version available'}
          actionLabel={settings.language === 'sl' ? 'Posodobi zdaj' : 'Update now'}
          dismissLabel={settings.language === 'sl' ? 'Zapri' : 'Dismiss'}
          onUpdate={applyServiceWorkerUpdate}
          onDismiss={() => setSwUpdatePending(false)}
        />
      )}
      {toast ? <div className="toast-container"><div className="toast">{toast}</div></div> : null}
      {timerDone && (
        <div className="recap-overlay" onClick={() => setTimerDone(false)}>
          <div className="timer-done-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div style={{fontSize:'4rem',marginBottom:'0.5rem',animation:'timerDonePulse 0.6s ease-in-out infinite alternate'}}>⏰</div>
            <h2 style={{margin:'0 0 0.5rem',fontSize:'1.6rem'}}>{copy.timerDoneTitle}</h2>
            <p style={{opacity:0.7,marginBottom:'1.5rem'}}>{copy.timerAlarmBody}</p>
            <button className="action-btn-primary" type="button" style={{minWidth:'10rem',fontSize:'1rem'}} onClick={() => { setTimerDone(false); resetTimer(); }}>{copy.timerDoneContinue}</button>
          </div>
        </div>
      )}
      {showTutorial && activeTutorialStep && (() => {
        const isLast = tutorialStep >= guidedTutorialSteps.length - 1;
        const progress = Math.round(((tutorialStep + 1) / guidedTutorialSteps.length) * 100);
        const tutorialSectionLabel = nav.find(([id]) => id === activeTutorialStep.section)?.[1] || activeTutorialStep.section;
        return (
          <>
            <div className="tutorial-soft-scrim" aria-hidden="true" />
            <aside className="guided-tutorial-card glass-panel" role="dialog" aria-live="polite" aria-label={activeTutorialStep.title}>
              <div className="tutorial-card-top">
                <span>{tutorialStep + 1} / {guidedTutorialSteps.length}</span>
                <strong className="tutorial-section-pill">{tutorialSectionLabel}</strong>
                <button className="context-help-btn" type="button" onClick={() => setShowTutorial(false)} aria-label={settings.language === 'sl' ? 'Zapri vodic' : 'Close guide'}>x</button>
              </div>
              <h2>{activeTutorialStep.title}</h2>
              <p>{activeTutorialStep.body}</p>
              {activeTutorialStep.bullets?.length ? (
                <ul className="tutorial-bullet-list">
                  {activeTutorialStep.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              <div className="tutorial-progress-track" aria-label={`${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="tutorial-control-row">
                <button className="action-btn-outline" type="button" disabled={tutorialStep === 0} onClick={() => setTutorialStep((step) => Math.max(0, step - 1))}>{copy.tutorialBack}</button>
                <button className="action-btn-outline" type="button" onClick={() => setShowTutorial(false)}>{settings.language === 'sl' ? 'Preskoci' : 'Skip'}</button>
                {isLast
                  ? <button className="action-btn-primary" type="button" onClick={() => setShowTutorial(false)}>{copy.tutorialClose}</button>
                  : <button className="action-btn-primary" type="button" onClick={() => setTutorialStep((step) => Math.min(guidedTutorialSteps.length - 1, step + 1))}>{copy.tutorialNext}</button>
                }
              </div>
              <div className="tutorial-jump-row">
                {guidedTutorialSteps.map((step, index) => (
                  <button
                    key={`${step.target}-${index}`}
                    type="button"
                    className={index === tutorialStep ? 'active' : ''}
                    aria-label={`${index + 1}. ${step.title}`}
                    onClick={() => setTutorialStep(index)}
                  />
                ))}
              </div>
            </aside>
          </>
        );
      })()}
      {helpTopic && (() => {
        const topic = getHelpTopic(helpTopic);
        return (
          <div className="help-popover-overlay" onClick={() => setHelpTopic(null)}>
            <section className="help-popover-card glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={topic.title}>
              <div className="panel-header">
                <h3>{topic.title}</h3>
                <button className="context-help-btn" type="button" onClick={() => setHelpTopic(null)} aria-label={settings.language === 'sl' ? 'Zapri pomoc' : 'Close help'}>x</button>
              </div>
              <p>{topic.body}</p>
              <div className="settings-button-row help-action-row">
                {helpTopic === 'tutorial' && (
                  <button className="action-btn-outline" type="button" onClick={() => { setHelpTopic(null); setTutorialStep(0); setShowTutorial(true); }}>{copy.tutorialOpen}</button>
                )}
                <button className="action-btn-primary" type="button" onClick={() => setHelpTopic(null)}>{settings.language === 'sl' ? 'Razumem' : 'Got it'}</button>
              </div>
            </section>
          </div>
        );
      })()}
      {showRecap && recapData && (
        <div className="recap-overlay" onClick={() => setShowRecap(false)}>
          <div className="recap-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="recap-header">
              <div className="recap-icon">🏆</div>
              <h2>{copy.recapTitle}</h2>
              <p className="settings-copy">{recapData.month}</p>
            </div>
            <p className="recap-motivation">{copy.recapMotivation}</p>
            <div className="stats-list" style={{marginBottom:'1rem'}}>
              <div className="stats-row"><span>{copy.recapWorkouts}</span><strong style={{fontSize:'1.2rem'}}>{recapData.workoutCount}</strong></div>
              <div className="stats-row"><span>{copy.recapPRs}</span><strong style={{fontSize:'1.2rem'}}>{recapData.broken.length}</strong></div>
              <div className="stats-row"><span>{copy.recapRank}</span><strong style={{fontSize:'1.2rem'}}>{overallMuscleRankData.rank.displayName}</strong></div>
              <div className="stats-row"><span>{settings.language === 'sl' ? 'Povprecni volumen' : 'Average volume'}</span><strong style={{fontSize:'1.2rem'}}>{formatVolume(overallMuscleRankData.averageVolume, settings.units)}</strong></div>
            </div>
            {recapData.broken.length > 0 ? (
              <div className="pr-list">
                {recapData.broken.map((pr) => (
                  <div className="pr-row" key={pr.exercise}>
                    <span>{getExerciseName(pr.exercise, settings.language)}</span>
                    <strong className="pr-value">
                      {formatWeight(pr.weight, settings.units)}
                      {pr.prev > 0 ? <span style={{fontSize:'0.8rem',opacity:.7,marginLeft:'0.4rem'}}>↑{formatWeight(pr.weight - pr.prev, settings.units)}</span> : null}
                      <span className="pr-badge">{copy.prBadge}</span>
                    </strong>
                  </div>
                ))}
              </div>
            ) : <p className="settings-copy">{copy.recapNoPRs}</p>}
            <button className="action-btn-primary full-width" style={{marginTop:'1.5rem'}} type="button" onClick={() => setShowRecap(false)}>{copy.recapClose}</button>
          </div>
        </div>
      )}
    </div>
  );
}
