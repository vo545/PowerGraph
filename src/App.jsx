import { useEffect, useMemo, useRef, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { ClipboardList, Dumbbell, Flame, Home, Lightbulb, Scale, Search, Settings, Shield, Target, Trophy, Utensils } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, BarElement);

const API_URL = import.meta.env.VITE_API_URL || '';
const JWT_KEY_PREFIX = 'powergraph_jwt_';
function getJwt(email) { return localStorage.getItem(`${JWT_KEY_PREFIX}${email}`) || ''; }
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
async function backendLogin(email, password) {
  if (!API_URL) return null;
  try {
    let res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) { const { token } = await res.json(); setJwt(email, token); return token; }
    if (res.status === 401) {
      res = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
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
const RECAP_KEY_PREFIX = 'powergraph_recap_';
const REST_KEY_PREFIX = 'powergraph_rest_';
const CHEAT_KEY_PREFIX = 'powergraph_cheat_';
const WATER_KEY_PREFIX = 'powergraph_water_';
const THEME_KEY = 'powergraph_theme';
const SETTINGS_KEY_PREFIX = 'powergraph_settings_';
const USERS_KEY = 'powergraph_users';
const SESSION_KEY = 'powergraph_session';
const ADMIN_EMAIL = 'vid.oreskovic@gmail.com';
const LOGINS_KEY = 'powergraph_logins';
const AUTH_THROTTLE_KEY_PREFIX = 'powergraph_auth_throttle_';
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;
const PBKDF2_ITERATIONS = 210000;

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

function getCalHistoryKey(email) { return `${CAL_HISTORY_KEY_PREFIX}${email}`; }
function getBodyWeightKey(email) { return `${BODYWEIGHT_KEY_PREFIX}${email}`; }
function getRecapKey(email) { return `${RECAP_KEY_PREFIX}${email}`; }
function getRestKey(email) { return `${REST_KEY_PREFIX}${email || ''}`; }
function getCheatKey(email) { return `${CHEAT_KEY_PREFIX}${email || ''}`; }
function getLegacyRestKey(email) { return `${REST_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function getLegacyCheatKey(email) { return `${CHEAT_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function loadDateList(primaryKey, legacyKey) {
  try {
    const primary = JSON.parse(localStorage.getItem(primaryKey) || '[]');
    if (Array.isArray(primary) && primary.length) return primary;
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
    return Array.isArray(legacy) ? legacy : [];
  } catch { return []; }
}
function loadRestDays(email) { return email ? loadDateList(getRestKey(email), getLegacyRestKey(email)) : []; }
function loadCheatDays(email) { return email ? loadDateList(getCheatKey(email), getLegacyCheatKey(email)) : []; }
function getCustomExKey(email) { return `${CUSTOM_EX_KEY_PREFIX}${email}`; }
function loadCustomExercises(email) { if (!email) return []; try { return JSON.parse(localStorage.getItem(getCustomExKey(email)) || '[]'); } catch { return []; } }
function getWaterKey(email) { return `${WATER_KEY_PREFIX}${email}_${new Date().toISOString().slice(0, 10)}`; }
function loadWaterMl(email) { if (!email) return 0; try { return Number(localStorage.getItem(getWaterKey(email)) || 0); } catch { return 0; } }
function saveWaterMl(email, ml) { if (email) localStorage.setItem(getWaterKey(email), String(ml)); }
function loadBodyWeight(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getBodyWeightKey(email)) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}
function loadCalHistory(email) {
  if (!email) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(getCalHistoryKey(email)) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'sl', label: 'Slovenscina' },
  { id: 'es', label: 'Espanol' },
  { id: 'pt', label: 'Portugues' },
  { id: 'fr', label: 'Francais' },
  { id: 'tr', label: 'Turkce' },
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
const defaultSettings = { units: 'kg', language: 'en', backgroundAccent: 'blue', dateFormat: 'DD.MM.YYYY', backupReminderDays: 7, lastBackupAt: '', calorieGoal: 2200, calorieTrackerMode: 'simple', weightDrop: false, gender: 'male', age: '', height: '', showFeedbackBtn: true };
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
    noHistory: 'Treningov \u0161e ni.',
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
    noMeals: 'Za izbrani datum \u0161e ni obrokov.',
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
    calPhotoTitle: 'Oceni s sliko 📷',
    calPhotoDesc: 'Slikaj jed – AI oceni kalorije za celoten obrok na sliki.',
    calPhotoBtn: 'Dodaj sliko / Fotografiraj',
    calPhotoChange: 'Zamenjaj sliko',
    calPhotoAnalyze: 'Oceni kalorije',
    calPhotoNoKey: 'AI backend ni nastavljen ali nisi povezan z njim.',
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
    bwNoData: 'Še ni meritev.',
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
    tutorialStep3: 'Pritisni "Dodaj trening", izberi vajo in vnesi serije ter ponovitve. Za vsak trening dobiš točke za lestvico rangov.',
    tutorialStep4Title: 'Vaje 🏋️',
    tutorialStep4: 'V zavihku Vaje najdeš podrobnosti o vsaki vaji: kako jo izvajamo, katera oprema je potrebna in kako zahtevna je.',
    tutorialStep5Title: 'Kalorije 🍎',
    tutorialStep5: 'Sledi dnevnemu vnosu kalorij in makrohranil. Dodaj obroke ali uporabi kalkulator, da ostaneš v okviru cilja.',
    tutorialStep6Title: 'Nasvetovalec 🧠',
    tutorialStep6: 'Vsak dan ti predlagamo vajo glede na to, kaj si nazadnje treniral. Predlog temelji na skupini, ki je bila najmanj trenirana.',
    tutorialStep7Title: 'Lestvica rangov 🏆',
    tutorialStep7: 'Za vsak trening, osebni rekord in dan počitka dobiš točke. Z njimi napreduj skozi range – od začetnika do legende!',
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
    noHistory: 'No workouts yet.',
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
    noMeals: 'There are no meals for the selected date.',
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
    calPhotoTitle: 'Estimate from photo 📷',
    calPhotoDesc: 'Take a photo – AI estimates the calories for the entire portion shown.',
    calPhotoBtn: 'Add photo / Take photo',
    calPhotoChange: 'Change photo',
    calPhotoAnalyze: 'Estimate calories',
    calPhotoNoKey: 'AI backend is not configured or connected.',
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
    bwNoData: 'No measurements yet.',
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
    tutorialStep3: 'Click "Add workout", pick an exercise and enter your sets and reps. Every workout earns you points on the leaderboard.',
    tutorialStep4Title: 'Exercises 🏋️',
    tutorialStep4: 'The Exercises tab has details for every exercise: how to perform it, what equipment you need, and the difficulty level.',
    tutorialStep5Title: 'Calories 🍎',
    tutorialStep5: 'Track your daily calorie and macro intake. Add meals or use the calorie estimator to stay within your goal.',
    tutorialStep6Title: 'Advisor 🧠',
    tutorialStep6: 'Every day the Advisor suggests a workout based on what you trained recently and which muscle group has been neglected the most.',
    tutorialStep7Title: 'Rankings 🏆',
    tutorialStep7: 'Earn points for every workout, personal record, and rest day. Climb through ranks — from Beginner all the way to Legend!',
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
  Chest: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Chest Fly', 'Push-Up'],
  Legs: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Walking Lunge', 'Leg Extension'],
  Triceps: ['Triceps Pushdown', 'Overhead Triceps Extension', 'Close Grip Bench Press', 'Bench Dip', 'Skull Crusher'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl'],
  Forearms: ['Wrist Curl', 'Reverse Wrist Curl', 'Farmer Carry', 'Plate Pinch Hold', 'Reverse Curl'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press'],
  'Stamina/Cardio': ['Running', 'Cycling', 'Rowing', 'Jump Rope', 'Burpee'],
  Back: ['Barbell Row', 'Lat Pulldown', 'Pull-Up', 'Seated Cable Row', 'Straight Arm Pulldown'],
  Abs: ['Crunch', 'Leg Raise', 'Plank', 'Russian Twist', 'Cable Crunch'],
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
  Chest: ['Push-Up', 'Wide Push-Up', 'Diamond Push-Up', 'Archer Push-Up', 'Pseudo-Planche Push-Up'],
  Back: ['Pull-Up', 'Inverted Row', 'Australian Pull-Up', 'Muscle-Up', 'Dead Hang'],
  Legs: ['Bodyweight Squat', 'Bulgarian Split Squat', 'Pistol Squat', 'Jump Squat', 'Wall Sit'],
  Triceps: ['Dip', 'Close Grip Push-Up', 'Bench Dip'],
  Biceps: ['Chin-Up', 'Archer Pull-Up', 'Commando Pull-Up'],
  Shoulders: ['Pike Push-Up', 'Handstand Push-Up', 'Shoulder Tap'],
  'Stamina/Cardio': ['Burpee', 'Mountain Climber', 'Jump Rope', 'Box Jump', 'Running'],
  Abs: ['Plank', 'L-Sit', 'Hollow Body Hold', 'Leg Raise', 'V-Up'],
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

const normalizeWorkout = (w, i = 0) => {
  const setDetails = (Array.isArray(w.setDetails) ? w.setDetails : [])
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0);
  const setWeights = Array.isArray(w.setWeights)
    ? w.setWeights.map((v) => Number(v) || 0).filter((v) => v > 0)
    : null;
  return {
    id: w.id ?? Date.now() + i,
    date: w.date ?? new Date().toISOString().slice(0, 10),
    exercise: w.exercise ?? 'Bench Press',
    weight: Number(w.weight ?? 0),
    setDetails: setDetails.length ? setDetails : [1],
    comment: w.comment ?? w.notes ?? '',
    ...(setWeights?.length ? { setWeights } : {}),
  };
};
const getSetCount = (w) => w.setDetails.length;
const getTotalReps = (w) => w.setDetails.reduce((s, v) => s + v, 0);
const getVolume = (w) => w.weight * getTotalReps(w);
const formatSetDetails = (w) => w.setDetails.join(' / ');
const convertWeight = (kg, units) => (units === 'lbs' ? kg * 2.20462 : kg);
const formatWeight = (kg, units) => `${units === 'lbs' ? Math.round(convertWeight(kg, units)) : Number(convertWeight(kg, units).toFixed(1))} ${units}`;
const formatVolume = (kg, units) => `${Math.round(convertWeight(kg, units)).toLocaleString()} ${units}`;
const findSection = (exercise) => Object.entries(sections).find(([, items]) => items.includes(exercise))?.[0] ?? 'Chest';
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
function getWorkoutStrengthVolume(workout, bodyWeightKg, customExercises = []) {
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

async function callGemini(email, parts) {
  const data = await apiCall(email, '/api/gemini', 'POST', { parts });
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
        male: ['M55 103 C63 89 78 88 88 103 C86 126 78 146 62 150 C52 142 48 119 55 103 Z', 'M185 103 C177 89 162 88 152 103 C154 126 162 146 178 150 C188 142 192 119 185 103 Z'],
        female: ['M61 105 C69 93 81 93 89 106 C87 125 80 142 66 146 C56 139 54 118 61 105 Z', 'M179 105 C171 93 159 93 151 106 C153 125 160 142 174 146 C184 139 186 118 179 105 Z'],
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
        male: ['M55 104 C63 90 79 90 88 105 C86 126 78 144 63 148 C53 141 49 119 55 104 Z', 'M185 104 C177 90 161 90 152 105 C154 126 162 144 177 148 C187 141 191 119 185 104 Z'],
        female: ['M61 106 C69 94 81 94 89 107 C87 125 80 141 66 145 C57 139 54 119 61 106 Z', 'M179 106 C171 94 159 94 151 107 C153 125 160 141 174 145 C183 139 186 119 179 106 Z'],
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
        ? 'M63 103 C76 84 100 85 120 91 C140 85 164 84 177 103 C164 126 160 174 154 224 C150 253 90 253 86 224 C80 174 76 126 63 103 Z'
        : 'M55 101 C72 78 99 84 120 90 C141 84 168 78 185 101 C169 127 162 176 154 225 C150 252 90 252 86 225 C78 176 71 127 55 101 Z'} />
      <path className="atlas-skin atlas-pelvis" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M91 229 C105 246 135 246 149 229 C161 251 169 275 167 298 C154 309 136 305 120 295 C104 305 86 309 73 298 C71 275 79 251 91 229 Z'
        : 'M90 229 C104 244 136 244 150 229 C158 250 164 271 162 292 C148 301 132 298 120 289 C108 298 92 301 78 292 C76 271 82 250 90 229 Z'} />
      <path className="atlas-skin atlas-arm-left" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M63 114 C47 137 40 179 42 224 C44 249 48 289 40 333 C58 329 65 293 68 256 C71 213 76 163 86 124 Z'
        : 'M56 115 C39 139 33 178 36 224 C38 251 43 293 36 342 C55 337 64 301 67 260 C70 215 77 164 88 123 Z'} />
      <path className="atlas-skin atlas-arm-right" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M177 114 C193 137 200 179 198 224 C196 249 192 289 200 333 C182 329 175 293 172 256 C169 213 164 163 154 124 Z'
        : 'M184 115 C201 139 207 178 204 224 C202 251 197 293 204 342 C185 337 176 301 173 260 C170 215 163 164 152 123 Z'} />
      <path className="atlas-skin atlas-leg-left" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M75 298 C90 304 107 301 120 291 C115 343 112 424 99 491 C87 497 76 489 76 464 C77 411 67 349 75 298 Z'
        : 'M78 292 C93 300 108 297 120 288 C116 342 112 426 99 491 C86 497 76 489 76 463 C78 410 69 344 78 292 Z'} />
      <path className="atlas-skin atlas-leg-right" style={{ fill: `url(#${gradientId})` }} d={female
        ? 'M165 298 C150 304 133 301 120 291 C125 343 128 424 141 491 C153 497 164 489 164 464 C163 411 173 349 165 298 Z'
        : 'M162 292 C147 300 132 297 120 288 C124 342 128 426 141 491 C154 497 164 489 164 463 C162 410 171 344 162 292 Z'} />
      <path className="atlas-skin atlas-foot-left" style={{ fill: `url(#${gradientId})` }} d={female ? 'M78 486 C86 497 98 498 105 490 C108 500 99 506 83 505 C72 504 70 496 78 486 Z' : 'M77 486 C86 498 99 499 106 490 C111 501 100 507 82 506 C70 505 68 495 77 486 Z'} />
      <path className="atlas-skin atlas-foot-right" style={{ fill: `url(#${gradientId})` }} d={female ? 'M135 490 C142 498 154 497 162 486 C170 496 168 504 157 505 C141 506 132 500 135 490 Z' : 'M134 490 C141 499 154 498 163 486 C172 495 170 505 158 506 C140 507 129 501 134 490 Z'} />
      <path className="atlas-hair" d={female
        ? (back ? 'M96 38 C99 14 141 14 144 38 C146 62 139 83 130 92 C131 70 109 70 110 92 C101 83 94 62 96 38 Z' : 'M98 36 C101 16 139 15 142 36 C133 28 107 28 98 36 Z M98 37 C90 51 93 73 105 85 C101 69 101 54 107 42 Z M142 37 C150 51 147 73 135 85 C139 69 139 54 133 42 Z')
        : (back
          ? 'M98 32 C101 17 111 12 120 13 C130 12 139 17 142 32 C136 26 128 25 120 27 C112 25 104 26 98 32 Z'
          : 'M95 35 C98 17 111 10 121 14 C130 9 142 19 145 35 C137 30 132 34 127 37 C123 29 115 29 111 38 C106 32 101 32 95 35 Z')} />
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
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const aiEnabled = Boolean(API_URL && currentUser && getJwt(currentUser));
  const [workouts, setWorkouts] = useState(() => loadWorkouts(localStorage.getItem(SESSION_KEY) || ''));
  const [calorieEntries, setCalorieEntries] = useState(() => loadCalories(localStorage.getItem(SESSION_KEY) || ''));
  const [settings, setSettings] = useState(() => loadSettings(localStorage.getItem(SESSION_KEY) || ''));
  const [activeSection, setActiveSection] = useState('dashboard');
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
  const [formData, setFormData] = useState({ date: new Date().toISOString().slice(0, 10), exercise: 'Bench Press', weight: '', setDetails: ['12', '10', '8'], setWeights: ['', '', ''] });
  const [calorieForm, setCalorieForm] = useState({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [calQuery, setCalQuery] = useState('');
  const [calGrams, setCalGrams] = useState('');
  const [calResult, setCalResult] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
  const [calImage, setCalImage] = useState(null);
  const [calImageLoading, setCalImageLoading] = useState(false);
  const [calPhotoResult, setCalPhotoResult] = useState(null);
  const [calPhotoError, setCalPhotoError] = useState('');
  const [calHistory, setCalHistory] = useState(() => loadCalHistory(localStorage.getItem(SESSION_KEY) || ''));
  const [bodyWeightEntries, setBodyWeightEntries] = useState(() => loadBodyWeight(localStorage.getItem(SESSION_KEY) || ''));
  const [bwForm, setBwForm] = useState({ date: new Date().toISOString().slice(0, 10), weight: '' });
  const [tdeeForm, setTdeeForm] = useState({ currentWeight: '', goalWeight: '', weeks: '12', activityLevel: 'moderate', gender: settings.gender || 'male', age: settings.age || '', height: settings.height || '' });
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
  const [adminBonus, setAdminBonus] = useState(() => loadAdminBonus(localStorage.getItem(SESSION_KEY) || ''));
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [restDays, setRestDays] = useState(() => loadRestDays(localStorage.getItem(SESSION_KEY) || ''));
  const [cheatDays, setCheatDays] = useState(() => loadCheatDays(localStorage.getItem(SESSION_KEY) || ''));
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [formExSearch, setFormExSearch] = useState('');
  const [chartSection, setChartSection] = useState(null);
  const [ratings, setRatings] = useState(() => loadRatings());
  const [ratingForm, setRatingForm] = useState({ stars: 5, comment: '', privateComment: '' });
  const [timerDone, setTimerDone] = useState(false);
  const [advisorMode, setAdvisorMode] = useState('gym');
  const [advisorSplitId, setAdvisorSplitId] = useState('auto');
  const [customSplitSections, setCustomSplitSections] = useState([]);
  const [waterToday, setWaterToday] = useState(() => loadWaterMl(localStorage.getItem(SESSION_KEY) || ''));
  const [waterCustomMl, setWaterCustomMl] = useState('');
  const [bannedUsers, setBannedUsers] = useState(() => loadBanned());
  const [modUsers, setModUsers] = useState(() => loadMods());
  const [timerCustomInput, setTimerCustomInput] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [customExercises, setCustomExercises] = useState(() => loadCustomExercises(localStorage.getItem(SESSION_KEY) || ''));
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addExForm, setAddExForm] = useState({ name: '', section: 'Back' });
  const [addExLoading, setAddExLoading] = useState(false);
  const [addExError, setAddExError] = useState('');
  const [selectedRankMuscle, setSelectedRankMuscle] = useState('Chest');
  const [ingredientMode, setIngredientMode] = useState('quick');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientItems, setIngredientItems] = useState([{ name: '', grams: '100' }]);
  const [ingredientResults, setIngredientResults] = useState(null);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [ingredientError, setIngredientError] = useState('');
  const [bodyFatImages, setBodyFatImages] = useState({ front: null, side: null, back: null });
  const [bodyFatResult, setBodyFatResult] = useState(null);
  const [bodyFatLoading, setBodyFatLoading] = useState(false);
  const [bodyFatError, setBodyFatError] = useState('');
  const [reverseCalDailyKcal, setReverseCalDailyKcal] = useState('');
  const [reverseCalResult, setReverseCalResult] = useState(null);

  const copy = getCopy(settings.language);
  const sectionNames = { Chest: copy.chest, Legs: copy.legs, Triceps: copy.triceps, Biceps: copy.biceps, Forearms: copy.forearms, Shoulders: copy.shoulders, 'Stamina/Cardio': copy.cardio, Back: copy.back, Abs: copy.abs };
  const sectionDescriptions = {
    dashboard: settings.language === 'sl' ? 'Pregled napredka, statistike in hiter vnos novega treninga.' : 'A quick overview of progress, stats, and fast workout logging.',
    history: settings.language === 'sl' ? 'Preglej pretekle vnose in hitro preveri svoje zadnje treninge.' : 'Review past entries and quickly check your latest sessions.',
    exercises: settings.language === 'sl' ? 'Knjižnica vaj z opisi izvedbe, targeti in osnovnimi cue-ji.' : 'Exercise library with execution notes, targets, and key cues.',
    advisor: settings.language === 'sl' ? 'Pameten dnevni predlog na podlagi tvojih preteklih treningov.' : 'A smart daily suggestion based on your recent training history.',
    calories: settings.language === 'sl' ? 'Beleži obroke, kalorije in osnovne makrote po dnevih.' : 'Track meals, calories, and basic macros by day.',
    ocenjevalec: settings.language === 'sl' ? 'Vpiši jed in grame ter izvedi iskanje kalorij.' : 'Enter a food and grams to look up its calorie count.',
    rankings: settings.language === 'sl' ? 'Preglej svoj rang, točke in napredek skozi vse stopnje.' : 'View your rank, points, and progression through all tiers.',
    bodyweight: settings.language === 'sl' ? 'Sledi telesni teži in izračunaj dnevne kalorijske potrebe.' : 'Track your body weight and calculate your daily calorie needs.',
    settings: settings.language === 'sl' ? 'Uredi lokalne nastavitve, backup in prikaz podatkov.' : 'Adjust local preferences, backups, and data display.',
    ratings: settings.language === 'sl' ? 'Oceni aplikacijo z zvezdami in napiši predlog za izboljšavo.' : 'Rate the app with stars and write a suggestion for improvement.',
    admin: settings.language === 'sl' ? 'Pregled vseh registriranih uporabnikov in njihovih podatkov.' : 'Overview of all registered users and their data.',
  };
  const exerciseOptions = useMemo(() => [...new Set([...Object.values(sections).flat(), ...workouts.map((w) => w.exercise), ...customExercises.map(e => e.name)])].sort(), [workouts, customExercises]);
  const selectedWorkouts = useMemo(() => workouts.filter((w) => w.exercise === selectedExercise).sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id), [selectedExercise, workouts]);
  const sortedWorkouts = useMemo(() => [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id), [workouts]);
  const overall = useMemo(() => workouts.reduce((a, w) => ({ workouts: a.workouts + 1, sets: a.sets + getSetCount(w), reps: a.reps + getTotalReps(w), volumeKg: a.volumeKg + getVolume(w), bestKg: Math.max(a.bestKg, w.weight) }), { workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }), [workouts]);
  const selectedStats = useMemo(() => selectedWorkouts.reduce((a, w) => ({ workouts: a.workouts + 1, sets: a.sets + getSetCount(w), reps: a.reps + getTotalReps(w), volumeKg: a.volumeKg + getVolume(w), bestKg: Math.max(a.bestKg, w.weight) }), { workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }), [selectedWorkouts]);
  const perExercise = useMemo(() => Object.values(workouts.reduce((map, w) => { const item = map[w.exercise] ?? { name: w.exercise, workouts: 0, sets: 0, reps: 0, volumeKg: 0, bestKg: 0 }; item.workouts += 1; item.sets += getSetCount(w); item.reps += getTotalReps(w); item.volumeKg += getVolume(w); item.bestKg = Math.max(item.bestKg, w.weight); map[w.exercise] = item; return map; }, {})).sort((a, b) => b.volumeKg - a.volumeKg), [workouts]);
  const backupDue = useMemo(() => !settings.lastBackupAt || Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000) >= Number(settings.backupReminderDays), [settings.backupReminderDays, settings.lastBackupAt]);
  const selectedFormExerciseInfo = getExerciseInfo(formData.exercise);
  const calorieEntriesSorted = useMemo(() => [...calorieEntries].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id), [calorieEntries]);
  const selectedDayEntries = useMemo(() => calorieEntries.filter((entry) => entry.date === calorieForm.date), [calorieEntries, calorieForm.date]);
  const selectedDayTotals = useMemo(() => selectedDayEntries.reduce((acc, entry) => ({ calories: acc.calories + Number(entry.calories || 0), protein: acc.protein + Number(entry.protein || 0), carbs: acc.carbs + Number(entry.carbs || 0), fat: acc.fat + Number(entry.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [selectedDayEntries]);
  const analyticsDays = analyticsRange === 'week' ? 7 : 30;
  const analyticsCutoff = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (analyticsDays - 1));
    return date;
  }, [analyticsDays]);
  const analyticsWorkouts = useMemo(() => workouts.filter((workout) => new Date(workout.date) >= analyticsCutoff), [analyticsCutoff, workouts]);
  const analyticsCalories = useMemo(() => calorieEntries.filter((entry) => new Date(entry.date) >= analyticsCutoff), [analyticsCutoff, calorieEntries]);
  const analyticsTraining = useMemo(() => analyticsWorkouts.reduce((acc, workout) => ({ workouts: acc.workouts + 1, sets: acc.sets + getSetCount(workout), volumeKg: acc.volumeKg + getVolume(workout) }), { workouts: 0, sets: 0, volumeKg: 0 }), [analyticsWorkouts]);
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

  const rankData = useMemo(() => {
    const base = calculatePoints(workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, settings.calorieGoal);
    const pts = base + adminBonus;
    const rank = getRank(pts, settings.language);
    const nextRank = RANKS.find(r => r.min > pts);
    return { pts, rank, nextRank };
  }, [workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, settings.calorieGoal, settings.language, adminBonus]);
  const muscleStats = useMemo(() => getAllMuscleVolumeData(workouts, bodyWeightEntries, settings, customExercises), [workouts, bodyWeightEntries, settings, customExercises]);

  const chartData = useMemo(() => ({ labels: selectedWorkouts.map((w, i) => `${formatDateValue(w.date, settings.dateFormat)} #${i + 1}`), datasets: [{ data: selectedWorkouts.map((w) => Math.round(convertWeight(getVolume(w), settings.units))), borderColor: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.18)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4 }] }), [selectedWorkouts, settings.dateFormat, settings.units]);
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
    if (!currentUser) return;
    localStorage.setItem(SESSION_KEY, currentUser);
    setWorkouts(loadWorkouts(currentUser));
    setCalorieEntries(loadCalories(currentUser));
    setSettings(loadSettings(currentUser));
    setCalHistory(loadCalHistory(currentUser));
    setBodyWeightEntries(loadBodyWeight(currentUser));
    setRestDays(loadRestDays(currentUser));
    setCheatDays(loadCheatDays(currentUser));
    setAdminBonus(loadAdminBonus(currentUser));
    setCustomExercises(loadCustomExercises(currentUser));
    setSelectedExercise('Bench Press');
    setActiveSection('dashboard');
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

  async function hydrateFromBackend(email, password) {
    const token = await backendLogin(email, password);
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
        localStorage.setItem(getSettingsStorageKey(email), JSON.stringify({ ...defaultSettings, gender: authForm.gender }));
        clearAuthThrottle(email);
        await pushLoginLog(email, 'signup');
        await hydrateFromBackend(email, password);
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
        await hydrateFromBackend(email, password);
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
  function exportData() {
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      workouts,
      calorieEntries,
      settings,
      calHistory,
      bodyWeightEntries,
      restDays,
      cheatDays,
      customExercises,
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
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = Array.isArray(parsed) ? parsed : parsed.workouts;
        if (!Array.isArray(imported)) throw new Error('invalid');
        setWorkouts(imported.map(normalizeWorkout));
        if (Array.isArray(parsed.calorieEntries)) setCalorieEntries(parsed.calorieEntries);
        if (parsed.settings) setSettings(sanitizeSettings(parsed.settings));
        if (Array.isArray(parsed.calHistory)) setCalHistory(parsed.calHistory);
        if (Array.isArray(parsed.bodyWeightEntries)) setBodyWeightEntries(parsed.bodyWeightEntries);
        if (Array.isArray(parsed.restDays)) setRestDays(parsed.restDays);
        if (Array.isArray(parsed.cheatDays)) setCheatDays(parsed.cheatDays);
        if (Array.isArray(parsed.customExercises)) setCustomExercises(parsed.customExercises);
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
    setBodyWeightEntries([]);
    setRestDays([]);
    setCheatDays([]);
    setCustomExercises([]);
    localStorage.removeItem(getRestKey(currentUser));
    localStorage.removeItem(getCheatKey(currentUser));
    localStorage.removeItem(getCustomExKey(currentUser));
    setToast(copy.cleared);
  }
  function deleteWorkout(id) { setWorkouts((current) => current.filter((item) => item.id !== id)); if (editingWorkoutId === id) setEditingWorkoutId(null); }
  function saveComment(id) { setWorkouts(cur => cur.map(w => w.id === id ? { ...w, comment: commentText.trim() } : w)); setEditingCommentId(null); setCommentText(''); }
  function startEditComment(w) { setEditingCommentId(w.id); setCommentText(w.comment || ''); }

  async function triggerInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }


  function addWater(ml) {
    const user = localStorage.getItem(SESSION_KEY) || '';
    const next = waterToday + ml;
    setWaterToday(next);
    saveWaterMl(user, next);
  }
  function resetWater() {
    const user = localStorage.getItem(SESSION_KEY) || '';
    setWaterToday(0);
    saveWaterMl(user, 0);
  }

  function banUser(email) {
    if (!window.confirm(copy.adminBanConfirm)) return;
    const list = loadBanned();
    if (!list.includes(email)) { list.push(email); saveBanned(list); setBannedUsers([...list]); }
    setToast(`${copy.adminBan}: ${email}`);
  }
  function unbanUser(email) {
    const list = loadBanned().filter(e => e !== email);
    saveBanned(list); setBannedUsers([...list]);
    setToast(`${copy.adminUnban}: ${email}`);
  }
  function toggleMod(email) {
    const list = loadMods();
    const isMod = list.includes(email);
    const next = isMod ? list.filter(e => e !== email) : [...list, email];
    saveMods(next); setModUsers([...next]);
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
      setToast(`${copy.adminRankUpDone}: ${email}`);
    } else {
      const rankIdx = RANKS.findIndex(r => r.min > totalPts) - 1;
      const currentRankIdx = rankIdx < 0 ? RANKS.length - 1 : rankIdx;
      if (currentRankIdx <= 0) { setToast(copy.adminMinRank); return; }
      const prevRankMin = RANKS[currentRankIdx - 1].min;
      const newBonus = currentBonus - (totalPts - prevRankMin) - 1;
      saveAdminBonus(email, newBonus);
      if (email === currentUser) setAdminBonus(newBonus);
      setToast(`${copy.adminDemoteDone}: ${email}`);
    }
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
  function cancelWorkoutEdit() { setEditingWorkoutId(null); setFormData({ date: new Date().toISOString().slice(0, 10), exercise: 'Bench Press', weight: '', setDetails: ['12', '10', '8'] }); }
  function deleteMeal(id) { setCalorieEntries((current) => current.filter((item) => item.id !== id)); if (editingMealId === id) setEditingMealId(null); }
  function startEditMeal(entry) { setEditingMealId(entry.id); setCalorieForm({ date: entry.date, mealType: entry.mealType, name: entry.name, calories: String(entry.calories), protein: String(entry.protein), carbs: String(entry.carbs), fat: String(entry.fat) }); setActiveSection('calories'); }
  function saveMealEdit() {
    if (!editingMealId || !calorieForm.name || !calorieForm.calories || !calorieForm.date) return;
    setCalorieEntries((current) => current.map((item) => (item.id === editingMealId ? { ...item, date: calorieForm.date, mealType: calorieForm.mealType, name: calorieForm.name.trim(), calories: Number(calorieForm.calories) || 0, protein: Number(calorieForm.protein) || 0, carbs: Number(calorieForm.carbs) || 0, fat: Number(calorieForm.fat) || 0 } : item)));
    setEditingMealId(null);
    setCalorieForm({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' });
  }
  function cancelMealEdit() { setEditingMealId(null); setCalorieForm({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' }); }

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
  function deleteCalHistoryEntry(id) { setCalHistory(prev => prev.filter(e => e.id !== id)); }

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
    try {
      const prompt = `You are a nutritionist. Analyze this food photo carefully.
Identify the food and estimate the total calories for the entire portion shown.
Briefly describe what you see (1 sentence).
Then on a new line write exactly: FOOD_NAME: <name of the main food or meal>
Then on a new line write exactly: KCAL_PER_100G: <average kcal per 100g>
Then on a new line write exactly: TOTAL_KCAL: <estimated total kcal for the portion shown>
Be concise. Use average homemade/generic values, not brand values.`;
      const text = await callGemini(currentUser, [
        { inlineData: { mimeType: calImage.mimeType, data: calImage.base64 } },
        { text: prompt },
      ]);
      if (text) {
        const foodMatch = text.match(/FOOD_NAME:\s*(.+)/i);
        const per100Match = text.match(/KCAL_PER_100G:\s*(\d+)/i);
        const totalMatch = text.match(/TOTAL_KCAL:\s*(\d+)/i);
        if (per100Match && totalMatch) {
          const foodName = foodMatch ? foodMatch[1].trim() : 'Food';
          const kcalPer100 = Number(per100Match[1]);
          const total = Number(totalMatch[1]);
          const aiText = text.replace(/FOOD_NAME:\s*.+/i, '').replace(/KCAL_PER_100G:\s*\d+/i, '').replace(/TOTAL_KCAL:\s*\d+/i, '').trim();
          const estimatedGrams = kcalPer100 > 0 ? Math.round(total / kcalPer100 * 100) : 100;
          setCalPhotoResult({ name: foodName, kcalPer100, total, aiText });
          setCalHistory(prev => [{ id: Date.now(), name: foodName, grams: estimatedGrams, kcalPer100, total, date: new Date().toISOString().slice(0, 10) }, ...prev]);
          setToast(copy.calEstSaved);
        } else {
          setCalPhotoError('error');
        }
      } else {
        setCalPhotoError('error');
      }
    } catch { setCalPhotoError('error'); }
    finally { setCalImageLoading(false); }
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
    const updated = customExercises.filter(e => e.id !== id);
    setCustomExercises(updated);
    localStorage.setItem(getCustomExKey(currentUser), JSON.stringify(updated));
  }

  async function analyzeIngredients(e) {
    e.preventDefault();
    if (!aiEnabled) { setIngredientError('noKey'); return; }
    setIngredientLoading(true);
    setIngredientError('');
    setIngredientResults(null);
    try {
      let prompt;
      if (ingredientMode === 'quick') {
        if (!ingredientQuery.trim()) { setIngredientLoading(false); return; }
        prompt = `You are a nutritionist. Analyze these foods and estimate typical portions:\n"${ingredientQuery.trim()}"\n\nFor each item, estimate a reasonable typical serving and compute nutrition values.\nReturn ONLY this JSON object (no markdown, no extra text):\n{"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"...","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}]}\nAll values are numbers. Protein/carbs/fat/fiber/sugar are grams for the estimated portion. Use average generic values.`;
      } else {
        const valid = ingredientItems.filter(i => i.name.trim() && Number(i.grams) > 0);
        if (!valid.length) { setIngredientLoading(false); return; }
        const list = valid.map(i => `- ${i.name.trim()} (${i.grams}g)`).join('\n');
        prompt = `You are a nutritionist. Calculate exact nutrition for these ingredients:\n${list}\n\nReturn ONLY this JSON object (no markdown, no extra text):\n{"total":{"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"items":[{"name":"...","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}]}\nAll values are numbers. Use average generic values per given grams.`;
      }
      const text = await callGemini(currentUser, [{ text: prompt }]);
      if (text) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed.total && Array.isArray(parsed.items)) {
            setIngredientResults(parsed);
            const totalKcal = Math.round(parsed.total.kcal);
            const label = ingredientMode === 'quick' ? ingredientQuery.trim() : ingredientItems.filter(i => i.name.trim()).map(i => i.name.trim()).join(', ');
            setCalHistory(prev => [{ id: Date.now(), name: label, grams: ingredientMode === 'quick' ? 0 : ingredientItems.reduce((s, i) => s + Number(i.grams || 0), 0), kcalPer100: 0, total: totalKcal, date: new Date().toISOString().slice(0, 10) }, ...prev]);
            setToast(copy.calEstSaved);
          } else { setIngredientError('error'); }
        } else { setIngredientError('error'); }
      } else { setIngredientError('error'); }
    } catch { setIngredientError('error'); }
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
    if (!photos.length) return;
    if (!aiEnabled) { setBodyFatError('noKey'); return; }
    setBodyFatLoading(true); setBodyFatError(''); setBodyFatResult(null);
    try {
      const parts = [];
      photos.forEach(([pose, img]) => {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        parts.push({ text: `This is the ${pose} view.` });
      });
      const lang = settings.language;
      parts.push({ text: `You are a body composition expert. Estimate body fat percentage from the photo(s).\nReturn ONLY this JSON (no markdown):\n{"bodyFatPercent":15.5,"confidence":"moderate","category":"Fitness","description":"..."}\n"confidence" is "low", "moderate", or "high". "category" is one of: "Essential fat (<5%)", "Athletes (6-13%)", "Fitness (14-17%)", "Average (18-24%)", "Obese (25%+)" for males, or "Essential fat (<12%)", "Athletes (14-20%)", "Fitness (21-24%)", "Average (25-31%)", "Obese (32%+)" for females.\n"description" is 1-2 sentences in ${lang === 'sl' ? 'Slovenian' : 'English'}.` });
      const text = await callGemini(currentUser, parts);
      if (text) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (typeof parsed.bodyFatPercent === 'number') setBodyFatResult(parsed);
          else setBodyFatError('error');
        } else setBodyFatError('error');
      } else setBodyFatError('error');
    } catch { setBodyFatError('error'); }
    finally { setBodyFatLoading(false); }
  }

  function calculateReverseCal(e) {
    e.preventDefault();
    const dailyKcal = Number(reverseCalDailyKcal);
    const goalWeight = Number(tdeeForm.goalWeight);
    const currentWeight = Number(tdeeForm.currentWeight);
    const age = Number(tdeeForm.age || settings.age);
    const height = Number(tdeeForm.height || settings.height);
    const gender = tdeeForm.gender || settings.gender || 'male';
    const activity = tdeeForm.activityLevel;
    if (!dailyKcal || !goalWeight || !currentWeight) return;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryactive: 1.9 }[activity] || 1.55;
    const bmr = (age && height)
      ? (gender === 'female' ? 10 * currentWeight + 6.25 * height - 5 * age - 161 : 10 * currentWeight + 6.25 * height - 5 * age + 5)
      : (gender === 'female' ? 10 * currentWeight + 6.25 * 168 - 5 * 28 - 161 : 10 * currentWeight + 6.25 * 176 - 5 * 28 + 5);
    const tdee = Math.round(bmr * mult);
    const dailyDiff = tdee - dailyKcal;
    const totalKcalNeeded = (currentWeight - goalWeight) * 7700;
    if (Math.abs(dailyDiff) < 10) { setReverseCalResult({ error: 'noDiff' }); return; }
    const days = totalKcalNeeded / dailyDiff;
    const weeks = Math.round(Math.abs(days) / 7);
    setReverseCalResult({ weeks, tdee, dailyDiff, gaining: totalKcalNeeded < 0 });
  }

  function saveBodyWeight(event) {
    event.preventDefault();
    if (!bwForm.weight || !bwForm.date) return;
    const entry = { id: Date.now(), date: bwForm.date, weight: Number(bwForm.weight) };
    setBodyWeightEntries((c) => [...c, entry].sort((a, b) => new Date(b.date) - new Date(a.date)));
    setBwForm((c) => ({ ...c, weight: '' }));
  }
  function deleteBodyWeightEntry(id) { setBodyWeightEntries((c) => c.filter((e) => e.id !== id)); }
  function calculateTDEE(event) {
    event.preventDefault();
    const cw = Number(tdeeForm.currentWeight);
    const gw = Number(tdeeForm.goalWeight);
    const weeks = Number(tdeeForm.weeks);
    const age = Number(tdeeForm.age);
    const height = Number(tdeeForm.height);
    if (!cw || !gw || !weeks) return;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryactive: 1.9 }[tdeeForm.activityLevel] || 1.55;
    let bmr;
    if (age && height) {
      bmr = tdeeForm.gender === 'female'
        ? 10 * cw + 6.25 * height - 5 * age - 161
        : 10 * cw + 6.25 * height - 5 * age + 5;
    } else {
      const legacyFactors = { sedentary: 26, light: 30, moderate: 33, active: 37, veryactive: 40 };
      bmr = cw * (legacyFactors[tdeeForm.activityLevel] || 33) / mult;
    }
    const tdee = Math.round(bmr * mult);
    const totalKcal = (cw - gw) * 7700;
    const dailyAdjustment = Math.round(totalKcal / (weeks * 7));
    const target = tdee - dailyAdjustment;
    // Macros based on goal
    const goalType = gw < cw ? 'cut' : gw > cw ? 'bulk' : 'maintain';
    const proteinG = Math.round(cw * (goalType === 'bulk' ? 2.2 : goalType === 'cut' ? 2.5 : 2.0));
    const fatG = Math.round(target * 0.25 / 9);
    const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));
    // Water (ml) — Mifflin formula adjusted for activity & gender
    const waterBase = cw * 33;
    const waterActivity = { sedentary: 0, light: 250, moderate: 500, active: 750, veryactive: 1000 }[tdeeForm.activityLevel] || 500;
    const waterGender = tdeeForm.gender === 'male' ? 350 : 0;
    const waterAge = age > 55 ? 200 : 0;
    const waterMl = Math.round((waterBase + waterActivity + waterGender + waterAge) / 100) * 100;
    if (tdeeForm.age) setSettings(c => ({ ...c, gender: tdeeForm.gender, age: tdeeForm.age, height: tdeeForm.height }));
    setTdeeResult({ tdee, target, dailyAdjustment, protein: proteinG, carbs: carbsG, fat: fatG, waterMl, goalType });
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
    setFormData(c => ({ ...c, exercise: w.exercise, weight: w.weight, setDetails: w.setDetails.map(String), setWeights: w.setWeights ? w.setWeights.map(String) : undefined }));
    setActiveSection('dashboard');
  }

  function reuseMeal(entry) {
    setCalorieForm({ date: new Date().toISOString().slice(0, 10), mealType: entry.mealType, name: entry.name, calories: String(entry.calories), protein: String(entry.protein || ''), carbs: String(entry.carbs || ''), fat: String(entry.fat || '') });
    setActiveSection('calories');
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
                <h1>{copy.app}</h1>
              </div>
            </div>
            <div className="auth-hero-copy">
              <h2>{copy.authTitle}</h2>
              <p>{copy.authSubtitle}</p>
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
              <button className={`auth-mode-btn ${authMode === 'signup' ? 'active' : ''}`} type="button" role="tab" aria-selected={authMode === 'signup'} onClick={() => { setAuthMode('signup'); setAuthError(''); }}>
                {copy.signup}
              </button>
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

            <div className="auth-card-footer">
              <span>{authMode === 'signup' ? copy.authSwitchLogin : copy.authSwitchSignup}</span>
              <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }}>{authMode === 'signup' ? copy.login : copy.signup}</button>
            </div>
            <p className="auth-local-note">{copy.authLocalOnly}</p>
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="glass-panel sidebar">
        <div className="brand"><div className="logo-icon">P</div><h2>{copy.app}</h2></div>
        <nav className="nav-menu">{nav.map(([id, label]) => <button key={id} className={`nav-btn ${activeSection === id ? 'active' : ''}`} type="button" onClick={() => setActiveSection(id)}><span className="nav-icon">{NAV_ICONS[id]}</span><span className="nav-label-full">{label}</span><span className="nav-label-short">{NAV_SHORT[id]}</span></button>)}</nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="greeting">
            <h2>{copy.title}</h2>
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
            <span className="user-chip">{getUserBadge(currentUser)}</span>
            <button className="theme-toggle" type="button" onClick={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? 'L' : 'D'}</button>
            <button className="action-btn-outline" type="button" onClick={logout}>{copy.logout}</button>
          </div>
        </header>
        <section className="glass-panel section-intro fade-in-up">
          <div>
            <p className="exercise-category"><span className="nav-icon" style={{marginRight:'0.4rem'}}>{NAV_ICONS[activeSection]}</span>{nav.find(([id]) => id === activeSection)?.[1]}</p>
            <p>{sectionDescriptions[activeSection]}</p>
          </div>
        </section>
        {backupDue && <section className="glass-panel backup-banner fade-in-up"><div><h3>{copy.backupTitle}</h3><p>{copy.backupText}</p></div><button className="action-btn-primary" type="button" onClick={exportData}>{copy.export}</button></section>}

        {activeSection === 'dashboard' && <>
          <div className="dashboard-grid">
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow"><Dumbbell size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.workouts}</p><h3 className="stat-value">{overall.workouts}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow"><ClipboardList size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.totalSets}</p><h3 className="stat-value">{overall.sets}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow"><Trophy size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.totalVolume}</p><h3 className="stat-value">{formatVolume(overall.volumeKg, settings.units)}</h3></div></article>
            <section className="glass-panel chart-panel fade-in-up">
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
              <div className="chart-container">{selectedWorkouts.length ? <Line data={chartData} options={chartOptions} /> : <div className="empty-state"><h4>{copy.chart}</h4><p>{copy.noChart}</p></div>}</div>
            </section>

            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.addWorkout}</h3></div>
              <form className="premium-form" onSubmit={editingWorkoutId ? (e) => { e.preventDefault(); saveWorkoutEdit(); } : saveWorkout}>
                <div className="input-group"><label htmlFor="date">{copy.date}</label><input id="date" type="date" value={formData.date} onChange={(e) => setFormData((c) => ({ ...c, date: e.target.value }))} /></div>
                <div className="input-group"><label>{copy.exercise}</label><div className="ex-search-wrap"><input type="text" className="ex-search-input" placeholder={`${getExerciseName(formData.exercise, settings.language)} — ${copy.searchExercise}`} value={formExSearch} onChange={(e) => setFormExSearch(e.target.value)} />{formExSearch && (<div className="ex-search-results">{(() => { const hits = Object.values(sections).flat().filter(n => getExerciseName(n, settings.language).toLowerCase().includes(formExSearch.toLowerCase())); return hits.length ? hits.slice(0, 10).map(n => (<button key={n} type="button" className={`ex-search-item${formData.exercise === n ? ' selected' : ''}`} onClick={() => { setFormData(c => ({...c, exercise: n})); setFormExSearch(''); }}><span className="ex-search-section">{sectionNames[findSection(n)]}</span>{getExerciseName(n, settings.language)}</button>)) : <div className="ex-search-empty">{copy.noExerciseResults}</div>; })()}</div>)}</div></div>
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
                <section className="glass-panel action-panel fade-in-up">
                  <div className="panel-header"><h3>{copy.timerTitle}</h3></div>
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
            <div className="exercise-stats-grid">{perExercise.map((item) => <article className="exercise-stats-card" key={item.name}><div className="exercise-stats-top"><h4>{getExerciseName(item.name, settings.language)}</h4><span className="exercise-badge">{sectionNames[findSection(item.name)]}</span></div><div className="exercise-stats-body"><p><strong>{copy.workouts}:</strong> {item.workouts}</p><p><strong>{copy.totalSets}:</strong> {item.sets}</p><p><strong>{copy.totalReps}:</strong> {item.reps}</p><p><strong>{copy.bestWeight}:</strong> {formatWeight(item.bestKg, settings.units)}</p></div></article>)}</div>
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
          <section className="glass-panel history-section fade-in-up">
            <div className="panel-header">
              <h3>{copy.recent}</h3>
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
                  <div className="history-metrics"><span>{formatWeight(w.weight, settings.units)}</span><span>{getSetCount(w)} {copy.sets.toLowerCase()}</span><span>{formatSetDetails(w)}</span></div>
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
              )) : <div className="empty-state"><p style={{fontSize:'2rem',marginBottom:'0.5rem'}}>≡</p><h4>{historySearch ? (settings.language === 'sl' ? 'Ni rezultatov' : 'No results') : copy.recent}</h4><p>{historySearch ? (settings.language === 'sl' ? 'Poskusi z drugim iskanjem.' : 'Try a different search.') : copy.noHistory}</p></div>}
            </div>
          </section>
        )}

        {activeSection === 'exercises' && <section className="glass-panel exercise-section fade-in-up">
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

        {activeSection === 'advisor' && <section className="glass-panel stats-section fade-in-up">
          <div className="panel-header">
            <h3>{copy.advisorTitle}</h3>
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
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow"><Utensils size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.caloriesConsumed}</p><h3 className="stat-value">{Math.round(selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow"><Target size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.calorieGoal}</p><h3 className="stat-value">{Math.round(settings.calorieGoal)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow"><Flame size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.caloriesRemaining}</p><h3 className="stat-value">{Math.round(settings.calorieGoal - selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>

            <section className="glass-panel chart-panel fade-in-up">
              <div className="panel-header"><h3>{copy.caloriesProgress}</h3><div className="settings-button-row"><button className={`action-btn-outline ${settings.calorieTrackerMode === 'simple' ? 'active-filter' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, calorieTrackerMode: 'simple' }))}>{copy.simpleTracker}</button><button className={`action-btn-outline ${settings.calorieTrackerMode === 'advanced' ? 'active-filter' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, calorieTrackerMode: 'advanced' }))}>{copy.advancedTracker}</button><input type="date" value={calorieForm.date} onChange={(e) => setCalorieForm((c) => ({ ...c, date: e.target.value }))} /></div></div>
              <div className="calorie-progress-card">
                <div className="progress-rail"><div className="progress-fill" style={{ width: `${Math.min((selectedDayTotals.calories / Math.max(settings.calorieGoal, 1)) * 100, 100)}%` }} /></div>
                {settings.calorieTrackerMode === 'advanced' ? <div className="stats-list mt-1">
                  <div className="stats-row"><span>{copy.protein}</span><strong>{Math.round(selectedDayTotals.protein)} g</strong></div>
                  <div className="stats-row"><span>{copy.carbs}</span><strong>{Math.round(selectedDayTotals.carbs)} g</strong></div>
                  <div className="stats-row"><span>{copy.fat}</span><strong>{Math.round(selectedDayTotals.fat)} g</strong></div>
                </div> : null}
              </div>
            </section>

            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.addMeal}</h3></div>
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
                {selectedDayEntries.length ? selectedDayEntries.map((entry) => <article className="history-item" key={entry.id}><div><h3>{entry.name}</h3><p>{({ breakfast: copy.breakfast, lunch: copy.lunch, dinner: copy.dinner, snack: copy.snack })[entry.mealType]}</p></div><div className="history-metrics"><span>{Math.round(entry.calories)} {copy.kcalShort}</span>{settings.calorieTrackerMode === 'advanced' ? <><span>P {Math.round(entry.protein)}g</span><span>C {Math.round(entry.carbs)}g</span><span>F {Math.round(entry.fat)}g</span></> : null}</div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={() => reuseMeal(entry)}>🔁 {copy.reuseMeal}</button><button className="action-btn-outline" type="button" onClick={() => startEditMeal(entry)}>{copy.edit}</button><button className="action-btn-outline danger-button" type="button" onClick={() => deleteMeal(entry.id)}>{copy.delete}</button></div></article>) : <div className="empty-state"><h4>{copy.caloriesTitle}</h4><p>{copy.noMeals}</p></div>}
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
          <section className="glass-panel action-panel fade-in-up">
            <div className="panel-header"><h3>{copy.ingredientTracker}</h3>
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
                {ingredientLoading ? copy.ingredientAnalyzing : copy.ingredientAnalyze}
              </button>
            </form>
            {ingredientError === 'noKey' && <p className="auth-error">{copy.ingredientNoKey}</p>}
            {ingredientError === 'error' && <p className="auth-error">{copy.ingredientError}</p>}
            {ingredientResults && (
              <div style={{marginTop:'1.5rem'}}>
                {/* Total summary */}
                <div style={{padding:'1rem',borderRadius:'12px',background:'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))',marginBottom:'1rem'}}>
                  <h3 style={{margin:'0 0 0.6rem',fontSize:'1rem'}}>{copy.ingredientTotal}</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:'0.5rem'}}>
                    {[['kcal','🔥','#f59e0b'],['protein','💪','#60a5fa'],['carbs','🌾','#fb923c'],['fat','🫙','#34d399'],['fiber','🌿','#86efac'],['sugar','🍬','#f472b6']].map(([key,icon,color]) => (
                      <div key={key} style={{textAlign:'center',padding:'0.4rem',borderRadius:'8px',background:'rgba(148,163,184,0.08)'}}>
                        <div style={{fontSize:'1.1rem'}}>{icon}</div>
                        <div style={{fontSize:'0.85rem',fontWeight:700,color}}>{ingredientResults.total[key]}{key==='kcal'?'':' g'}</div>
                        <div style={{fontSize:'0.68rem',opacity:0.6}}>{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Per-ingredient breakdown */}
                {ingredientResults.items?.map((item, i) => (
                  <div key={i} style={{padding:'0.75rem 1rem',borderRadius:'10px',background:'rgba(148,163,184,0.05)',marginBottom:'0.5rem',borderLeft:`3px solid var(--primary-glow)`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.35rem'}}>
                      <strong style={{fontSize:'0.9rem'}}>{item.name}</strong>
                      <span style={{fontSize:'0.8rem',opacity:0.6}}>{item.grams}g</span>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                      {[['kcal','#f59e0b'],['protein','#60a5fa'],['carbs','#fb923c'],['fat','#34d399'],['fiber','#86efac'],['sugar','#f472b6']].map(([key,color]) => (
                        item[key] !== undefined && <span key={key} style={{fontSize:'0.75rem',padding:'0.15rem 0.45rem',borderRadius:'999px',background:'rgba(148,163,184,0.1)',color}}>{key}: {item[key]}{key==='kcal'?'':' g'}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Body Fat Estimation */}
          <section className="glass-panel action-panel fade-in-up">
            <div className="panel-header"><h3>{copy.bodyFatTitle}</h3></div>
            <p className="settings-copy" style={{marginBottom:'1rem'}}>{copy.bodyFatDesc}</p>
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
            <button className="action-btn-primary full-width" type="button" disabled={bodyFatLoading || Object.values(bodyFatImages).every(v => v === null)} onClick={estimateBodyFat}>
              {bodyFatLoading ? copy.bodyFatAnalyzing : copy.bodyFatAnalyze}
            </button>
            {bodyFatError === 'noKey' && <p className="auth-error">{copy.bodyFatNoKey}</p>}
            {bodyFatError === 'error' && <p className="auth-error">{copy.bodyFatError}</p>}
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
                {bodyFatResult.description && <p style={{fontSize:'0.85rem',lineHeight:1.55,opacity:0.8,margin:0}}>{bodyFatResult.description}</p>}
              </div>
            )}
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
                    <button className="action-btn-outline" type="button" onClick={() => reuseMeal({ mealType: 'snack', name: entry.name, calories: String(entry.total), protein: '', carbs: '', fat: '' })}>🔁 {copy.reuseMeal}</button>
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
            <section className="glass-panel chart-panel fade-in-up muscle-rank-section" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{copy.muscleRankTitle}</h3></div>
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
            <section className="glass-panel chart-panel fade-in-up" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{copy.rankCurrentLabel}</h3></div>
              <div style={{padding:'1rem 0'}}>
                <div style={{display:'flex',alignItems:'center',gap:'1.2rem',marginBottom:'1.5rem'}}>
                  <div style={{background:'linear-gradient(135deg,#f59e0b,#ef4444)',borderRadius:'50%',width:'3.5rem',height:'3.5rem',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem',flexShrink:0}}>{rankData.rank.icon}</div>
                  <div>
                    <h2 style={{fontSize:'1.8rem',fontWeight:700,margin:0}}>{rankData.rank.displayName}</h2>
                    <p style={{opacity:0.7,margin:0}}>{rankData.pts} {copy.rankPoints}</p>
                  </div>
                </div>
                {rankData.nextRank ? (<>
                  <p style={{fontSize:'0.85rem',opacity:0.7,marginBottom:'0.5rem'}}>{copy.rankProgress}: {rankData.nextRank.min - rankData.pts} {copy.rankPoints}</p>
                  <div style={{background:'rgba(148,163,184,0.15)',borderRadius:'999px',height:'0.6rem',overflow:'hidden'}}>
                    <div style={{
                      background:'linear-gradient(90deg,#f59e0b,#ef4444)',
                      height:'100%',
                      borderRadius:'999px',
                      width:`${Math.min(100,Math.round(((rankData.pts - rankData.rank.min) / (rankData.nextRank.min - rankData.rank.min)) * 100))}%`,
                      transition:'width 0.6s ease'
                    }} />
                  </div>
                  <p style={{fontSize:'0.78rem',opacity:0.5,marginTop:'0.4rem',textAlign:'right'}}>{rankData.nextRank.min - rankData.pts} / {rankData.nextRank.min - rankData.rank.min} {copy.rankPoints}</p>
                </>) : (
                  <p style={{fontSize:'0.9rem',opacity:0.7}}>{copy.rankMax}</p>
                )}
              </div>
            </section>

            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon orange-glow"><Flame size={22} strokeWidth={2.2} /></div><div><p className="stat-title">{copy.streak}</p><h3 className="stat-value">{calculateStreak(workouts)}</h3></div></article>

            <section className="glass-panel history-section fade-in-up" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{copy.rankHowTitle}</h3></div>
              <div className="history-list">
                {[
                  {text: copy.rankHowWorkout, color: 'var(--primary-glow)', icon: '💪'},
                  {text: copy.rankHowPR, color: '#f59e0b', icon: '🏆'},
                  {text: copy.rankHowRest, color: 'var(--secondary-glow)', icon: '😴'},
                  {text: copy.rankHowBodyweight, color: '#a78bfa', icon: '⚖️'},
                  {text: copy.rankHowCalories, color: '#fb923c', icon: '🍽'},
                  {text: copy.rankHowCaloriesBonus, color: '#34d399', icon: '🎯'},
                  {text: copy.rankHowCaloriesMinus, color: 'var(--error)', icon: '⚠️'},
                  {text: copy.rankHowInactive, color: 'var(--error)', icon: '📉'},
                ].map((item, i) => (
                  <article className="history-item" key={i} style={{gap:'0.6rem'}}>
                    <span style={{fontSize:'1.2rem',flexShrink:0}}>{item.icon}</span>
                    <strong style={{color: item.color, fontFamily:'monospace',fontSize:'0.9rem'}}>{item.text}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel history-section fade-in-up" style={{gridColumn:'span 2'}}>
              <div className="panel-header"><h3>{copy.rankAllRanks}</h3></div>
              <div className="history-list">
                {RANKS.map((r, i) => {
                  const isCurrent = rankData.rank.name === r.name;
                  const isUnlocked = rankData.pts >= r.min;
                  const rankName = settings.language === 'sl' ? r.name : r.nameEn;
                  return (
                    <article key={r.name} className="history-item" style={{opacity: isUnlocked ? 1 : 0.4, background: isCurrent ? 'rgba(245,158,11,0.08)' : undefined, borderLeft: isCurrent ? '3px solid #f59e0b' : '3px solid transparent'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.8rem'}}>
                        <span style={{fontSize:'1.5rem',minWidth:'2rem',textAlign:'center'}}>{r.icon}</span>
                        <div>
                          <h3 style={{margin:0,fontWeight: isCurrent ? 700 : 500}}>{rankName}{isCurrent ? ' ←' : ''}</h3>
                          <p style={{margin:0,fontSize:'0.8rem',opacity:0.6}}>{r.min} {copy.rankPoints}</p>
                        </div>
                      </div>
                      {isUnlocked && !isCurrent && <span style={{fontSize:'0.8rem',opacity:0.6}}>✓</span>}
                      {isCurrent && <span style={{fontSize:'0.8rem',color:'#f59e0b',fontWeight:600}}>{copy.rankCurrentLabel}</span>}
                      {!isUnlocked && <span style={{fontSize:'0.8rem',opacity:0.5}}>{r.min - rankData.pts} {copy.rankPoints}</span>}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeSection === 'bodyweight' && <>
          <div className="dashboard-grid">
            <section className="glass-panel chart-panel fade-in-up">
              <div className="panel-header"><h3>{copy.bwTitle}</h3></div>
              <div className="chart-container">{bwSorted.length ? <Line data={bodyWeightChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } }, y: { beginAtZero: false, grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#94a3b8' } } } }} /> : <div className="empty-state"><p>{copy.bwNoData}</p></div>}</div>
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
            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.waterTitle}</h3></div>
              {(() => {
                const waterGoal = tdeeResult?.waterMl || 2500;
                const pct = Math.min(100, Math.round(waterToday / waterGoal * 100));
                return (
                  <>
                    <div style={{textAlign:'center', margin:'0.75rem 0 1rem'}}>
                      <div style={{fontSize:'2.2rem', fontWeight:700, color:'#38bdf8', lineHeight:1}}>{(waterToday / 1000).toFixed(2).replace(/\.?0+$/, v => v === '' ? '' : v)} L</div>
                      <div style={{fontSize:'0.78rem', opacity:0.55, marginTop:'0.2rem'}}>{copy.waterDrank}</div>
                      <div style={{height:'8px', borderRadius:'4px', background:'rgba(148,163,184,0.15)', margin:'0.7rem 0 0.3rem', overflow:'hidden'}}>
                        <div style={{height:'100%', borderRadius:'4px', background: pct >= 100 ? '#34d399' : '#38bdf8', width:`${pct}%`, transition:'width 0.3s'}} />
                      </div>
                      <div style={{fontSize:'0.75rem', opacity:0.45}}>{copy.waterGoalLabel}: {(waterGoal / 1000).toFixed(1)} L {pct >= 100 ? '✓' : `(${pct}%)`}</div>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.45rem', marginBottom:'0.6rem'}}>
                      {[250, 500, 750, 1000].map(ml => (
                        <button key={ml} className="action-btn-outline" type="button" onClick={() => addWater(ml)}>+{ml} ml</button>
                      ))}
                    </div>
                    <div style={{display:'flex', gap:'0.4rem', marginBottom:'0.6rem'}}>
                      <input type="number" className="full-width" style={{flex:1}} value={waterCustomMl} onChange={e => setWaterCustomMl(e.target.value)} placeholder="ml" min="50" step="50" />
                      <button className="action-btn-outline" type="button" style={{flexShrink:0}} onClick={() => { const ml = Number(waterCustomMl); if (ml > 0) { addWater(ml); setWaterCustomMl(''); } }}>+</button>
                    </div>
                    <button className="action-btn-outline danger-button full-width" type="button" onClick={resetWater}>{copy.waterReset}</button>
                    {!tdeeResult && <p style={{fontSize:'0.72rem', opacity:0.45, marginTop:'0.6rem', textAlign:'center'}}>{copy.waterNoGoal}</p>}
                  </>
                );
              })()}
            </section>
            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.tdeeTitle}</h3></div>
              <form className="premium-form" onSubmit={calculateTDEE}>
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
                <div style={{marginTop:'1rem'}}>
                  <div className="stats-list">
                    <div className="stats-row"><span>{copy.tdeeTDEE}</span><strong>{tdeeResult.tdee} kcal</strong></div>
                    <div className="stats-row"><span>{copy.tdeeAdjustment}</span><strong style={{color: tdeeResult.dailyAdjustment > 0 ? 'var(--error)' : 'var(--secondary-glow)'}}>{tdeeResult.dailyAdjustment > 0 ? '-' : '+'}{Math.abs(tdeeResult.dailyAdjustment)} kcal</strong></div>
                    <div className="stats-row"><span>{copy.tdeeTarget}</span><strong style={{fontSize:'1.1rem'}}>{tdeeResult.target} kcal</strong></div>
                    {tdeeResult.protein && <div className="stats-row"><span>{copy.macrosProtein}</span><strong style={{color:'#60a5fa'}}>{tdeeResult.protein} g</strong></div>}
                    {tdeeResult.carbs && <div className="stats-row"><span>{copy.macrosCarbs}</span><strong style={{color:'#fb923c'}}>{tdeeResult.carbs} g</strong></div>}
                    {tdeeResult.fat && <div className="stats-row"><span>{copy.macrosFat}</span><strong style={{color:'#34d399'}}>{tdeeResult.fat} g</strong></div>}
                    {tdeeResult.waterMl && <div className="stats-row"><span>{copy.macrosWater}</span><strong style={{color:'#38bdf8'}}>{(tdeeResult.waterMl/1000).toFixed(1)} L</strong></div>}
                  </div>
                  <button className="action-btn-outline full-width" style={{marginTop:'0.75rem',color:'var(--secondary-glow)',borderColor:'var(--secondary-glow)'}} type="button" onClick={() => { setSettings(c => ({...c, calorieGoal: String(tdeeResult.target)})); alert(copy.goalSet); }}>
                    {copy.setAsGoal}
                  </button>
                </div>
              )}
              {/* Reverse calorie calculator */}
              <div style={{marginTop:'1.5rem',paddingTop:'1.2rem',borderTop:'1px solid rgba(148,163,184,0.15)'}}>
                <h4 style={{margin:'0 0 0.75rem',fontSize:'0.95rem'}}>{copy.reverseCalTitle}</h4>
                <form className="premium-form" onSubmit={calculateReverseCal}>
                  <div className="input-group">
                    <label>{copy.reverseCalDailyKcal}</label>
                    <input type="number" min="500" value={reverseCalDailyKcal} onChange={e => setReverseCalDailyKcal(e.target.value)} placeholder="2000" />
                  </div>
                  <button className="action-btn-outline full-width" type="submit">{copy.reverseCalCalc}</button>
                </form>
                {reverseCalResult && !reverseCalResult.error && (
                  <div style={{marginTop:'0.75rem',padding:'0.9rem',borderRadius:'10px',background:'rgba(99,102,241,0.1)'}}>
                    <p style={{margin:'0 0 0.3rem',fontSize:'0.85rem',opacity:0.7}}>{copy.reverseCalResult}</p>
                    <p style={{margin:0,fontSize:'1.1rem',fontWeight:700}}>{reverseCalResult.weeks} {copy.reverseCalWeeks} <span style={{fontSize:'0.85rem',fontWeight:400,opacity:0.7}}>({reverseCalResult.gaining ? copy.reverseCalGaining : copy.reverseCalLosing})</span></p>
                  </div>
                )}
              </div>
            </section>
            <section className="glass-panel history-section fade-in-up">
              <div className="panel-header"><h3>{copy.bwTitle}</h3><span className="history-count">{bodyWeightEntries.length}</span></div>
              <div className="history-list">{bodyWeightEntries.length ? [...bodyWeightEntries].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,20).map((e) => (
                <article className="history-item" key={e.id}>
                  <div><h3>{e.weight} kg</h3><p>{formatDateValue(e.date, settings.dateFormat)}</p></div>
                  <button className="action-btn-outline danger-button" type="button" onClick={() => deleteBodyWeightEntry(e.id)}>{copy.delete}</button>
                </article>
              )) : <div className="empty-state"><p>{copy.bwNoData}</p></div>}</div>
            </section>
          </div>
        </>}

        {activeSection === 'admin' && currentUser === ADMIN_EMAIL && (() => {
          const allUsers = loadUsers();
          const userStats = allUsers.map((u) => {
            const wList = loadWorkouts(u.email);
            const cList = loadCalories(u.email);
            const bwList = loadBodyWeight(u.email);
            const rDays = loadRestDays(u.email);
            const cDays = loadCheatDays(u.email);
            const sett = loadSettings(u.email);
            const bonus = loadAdminBonus(u.email);
            const basePts = calculatePoints(wList, cList, bwList, rDays, cDays, sett.calorieGoal);
            const totalPts = basePts + bonus;
            const userRank = getRank(totalPts, settings.language);
            const lastW = wList.length ? [...wList].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date : null;
            return { email: u.email, createdAt: u.createdAt, workouts: wList.length, meals: cList.length, bw: bwList.length, lastWorkout: lastW, rank: userRank, pts: totalPts, bonus };
          });
          const totalWorkouts = userStats.reduce((s, u) => s + u.workouts, 0);
          const loginLogs = adminLogs || [];
          const recentLogins = [...loginLogs].reverse().slice(0, 100);
          const now = Date.now();
          const allPresence = [...adminPresence].sort((a, b) => new Date(b.ts) - new Date(a.ts));
          const activeNow = allPresence.filter(p => now - new Date(p.ts).getTime() < 3 * 60000);
          const allRatings = loadRatings();
          return (
            <>
              <section className="glass-panel action-panel fade-in-up">
                <div className="panel-header"><h3>{copy.adminCommands}</h3></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.75rem',padding:'0.5rem 0'}}>
                  <button className="action-btn-outline" type="button" onClick={adminShowRecap}>{copy.adminShowRecap}</button>
                </div>
              </section>
              <div className="dashboard-grid">
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">U</div><div><p className="stat-title">{copy.adminTotalUsers}</p><h3 className="stat-value">{allUsers.length}</h3></div></article>
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">T</div><div><p className="stat-title">{copy.adminTotalWorkouts}</p><h3 className="stat-value">{totalWorkouts}</h3></div></article>
                <article className="glass-panel stat-card fade-in-up"><div className="stat-icon" style={{background:'#22c55e',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#000'}}>●</div><div><p className="stat-title">{copy.adminActiveUsers}</p><h3 className="stat-value">{activeNow.length}</h3></div></article>
              </div>
              <section className="glass-panel history-section fade-in-up">
                <div className="panel-header"><h3>{copy.adminActiveUsers}</h3><span className="history-count">{activeNow.length}</span></div>
                {allPresence.length === 0
                  ? <div className="empty-state"><p>{copy.adminNoActive}</p></div>
                  : <div className="exercise-grid" style={{padding:'0.5rem 0'}}>
                      {allPresence.map(p => {
                        const diffMs = now - new Date(p.ts).getTime();
                        const mins = Math.floor(diffMs / 60000);
                        const status = mins < 2 ? copy.adminOnlineNow : mins < 5 ? copy.adminRecentlyActive : copy.adminOffline;
                        const isMod = modUsers.includes(p.email);
                        return (
                          <article className="glass-panel" key={p.email} style={{padding:'0.85rem 1rem',display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                              <div className="stat-icon blue-glow" style={{width:'1.8rem',height:'1.8rem',fontSize:'0.8rem',flexShrink:0}}>{p.email[0].toUpperCase()}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <h4 style={{fontSize:'0.85rem',wordBreak:'break-all',margin:0}}>{p.email}</h4>
                                {isMod && <span style={{fontSize:'0.72rem',color:'#f59e0b',fontWeight:600}}>Moderator</span>}
                              </div>
                            </div>
                            <p style={{fontSize:'0.78rem',margin:0}}>{status}</p>
                            <p style={{fontSize:'0.72rem',opacity:0.5,margin:0}}>{copy.adminLastSeen}: {new Date(p.ts).toLocaleTimeString()}</p>
                            <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap',marginTop:'0.25rem'}}>
                              <button className="action-btn-outline" style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem'}} type="button" onClick={() => adminChangeRank(p.email, 'up')}>{copy.adminRankUp}</button>
                              {p.email !== ADMIN_EMAIL && (isMod
                                ? <button className="action-btn-outline" style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem',color:'#f59e0b',borderColor:'#f59e0b'}} type="button" onClick={() => toggleMod(p.email)}>{copy.adminRemoveMod}</button>
                                : <button className="action-btn-primary" style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem'}} type="button" onClick={() => toggleMod(p.email)}>{copy.adminSetMod}</button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                }
              </section>
              <section className="glass-panel history-section fade-in-up">
                <div className="panel-header"><h3>{copy.adminUsers}</h3><span className="history-count">{allUsers.length}</span></div>
                <div className="history-list">
                  {userStats.length === 0 && <div className="empty-state"><p>{copy.adminNoUsers}</p></div>}
                  {userStats.map((u) => {
                    const presenceEntry = adminPresence.find(p => p.email === u.email);
                    const isOnline = presenceEntry && (now - new Date(presenceEntry.ts).getTime()) < 3 * 60000;
                    return (
                      <article className="history-item" key={u.email} style={{flexDirection:'column',alignItems:'flex-start',gap:'0.5rem'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',width:'100%'}}>
                          <div className="stat-icon blue-glow" style={{width:'2rem',height:'2rem',fontSize:'0.85rem',flexShrink:0}}>{u.email[0].toUpperCase()}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <h3 style={{fontSize:'0.95rem',wordBreak:'break-all'}}>{u.email}{isOnline && <span style={{marginLeft:'0.5rem',fontSize:'0.75rem',color:'#22c55e',fontWeight:600}}>● online</span>}</h3>
                            <p style={{fontSize:'0.78rem',opacity:0.6}}>{copy.adminRegistered}: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</p>
                          </div>
                        </div>
                        <div className="stats-list" style={{width:'100%',marginTop:'0.25rem'}}>
                          <div className="stats-row"><span>{copy.adminWorkouts}</span><strong>{u.workouts}</strong></div>
                          <div className="stats-row"><span>{copy.adminMeals}</span><strong>{u.meals}</strong></div>
                          <div className="stats-row"><span>{copy.adminBodyWeight}</span><strong>{u.bw}</strong></div>
                          <div className="stats-row"><span>{copy.adminLastWorkout}</span><strong>{u.lastWorkout ? formatDateValue(u.lastWorkout, settings.dateFormat) : copy.adminNever}</strong></div>
                          <div className="stats-row"><span>{copy.rankTitle}</span><strong>{u.rank.displayName} ({u.pts} {copy.rankPoints})</strong></div>
                        </div>
                        <div style={{display:'flex',gap:'0.5rem',marginTop:'0.25rem',flexWrap:'wrap'}}>
                          <button className="action-btn-outline" type="button" onClick={() => adminChangeRank(u.email, 'up')}>{copy.adminRankUp}</button>
                          <button className="action-btn-outline" type="button" onClick={() => adminChangeRank(u.email, 'down')}>{copy.adminDemote}</button>
                          {u.email !== ADMIN_EMAIL && (bannedUsers.includes(u.email) ? <button className="action-btn-outline" type="button" style={{color:'var(--secondary-glow)',borderColor:'var(--secondary-glow)'}} onClick={() => unbanUser(u.email)}>{copy.adminUnban}</button> : <button className="action-btn-outline danger-button" type="button" onClick={() => banUser(u.email)}>{copy.adminBan}</button>)}
                          {u.email !== ADMIN_EMAIL && (modUsers.includes(u.email) ? <button className="action-btn-outline" type="button" style={{color:'#f59e0b',borderColor:'#f59e0b'}} onClick={() => toggleMod(u.email)}>{copy.adminRemoveMod}</button> : <button className="action-btn-primary" type="button" onClick={() => toggleMod(u.email)}>{copy.adminSetMod}</button>)}
                        </div>
                        {bannedUsers.includes(u.email) && <div style={{fontSize:'0.78rem',color:'var(--error)',fontWeight:600,padding:'0.2rem 0'}}>{copy.adminBanned}</div>}
                        {modUsers.includes(u.email) && !bannedUsers.includes(u.email) && <div style={{fontSize:'0.78rem',color:'#22c55e',fontWeight:600,padding:'0.2rem 0'}}>{copy.adminMod}</div>}
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className="glass-panel history-section fade-in-up">
                <div className="panel-header"><h3>{copy.adminComments}</h3><span className="history-count">{allRatings.length}</span></div>
                <div className="history-list">
                  {allRatings.length === 0 && <div className="empty-state"><p>{copy.adminNoComments}</p></div>}
                  {[...allRatings].reverse().map((r) => (
                    <article className="history-item" key={r.id} style={{flexDirection:'column',alignItems:'flex-start',gap:'0.35rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.6rem',width:'100%'}}>
                        <div className="stat-icon" style={{width:'2rem',height:'2rem',fontSize:'0.8rem',flexShrink:0,background:'var(--primary-glow)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{(r.email || '?')[0].toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <h3 style={{fontSize:'0.9rem',wordBreak:'break-all'}}>{r.email || '—'}</h3>
                          <p style={{fontSize:'0.75rem',opacity:0.55}}>{new Date(r.date).toLocaleString()} · {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</p>
                        </div>
                      </div>
                      {r.comment && <p style={{fontSize:'0.85rem',margin:0,paddingLeft:'0.25rem'}}>{r.comment}</p>}
                      {r.privateComment && <p style={{fontSize:'0.82rem',margin:0,paddingLeft:'0.25rem',color:'#f59e0b',fontStyle:'italic'}}><strong>{copy.adminPrivateNote}:</strong> {r.privateComment}</p>}
                    </article>
                  ))}
                </div>
              </section>
              <section className="glass-panel history-section fade-in-up">
                <div className="panel-header"><h3>{copy.adminLoginHistory}</h3><span className="history-count">{adminLogs === null ? '…' : loginLogs.length}</span></div>
                <div className="history-list">
                  {adminLogs === null && <div className="empty-state"><p>{copy.loading}</p></div>}
                  {adminLogs !== null && recentLogins.length === 0 && <div className="empty-state"><p>{copy.adminNoLogins}</p></div>}
                  {recentLogins.map((entry, i) => (
                    <article className="history-item" key={i}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                        <div className="stat-icon" style={{width:'2rem',height:'2rem',fontSize:'0.75rem',flexShrink:0,background: entry.type === 'signup' ? 'var(--secondary-glow)' : 'var(--primary-glow)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{entry.type === 'signup' ? 'R' : 'P'}</div>
                        <div>
                          <h3 style={{fontSize:'0.9rem'}}>{entry.email}</h3>
                          <p style={{fontSize:'0.78rem',opacity:0.6}}>{entry.type === 'signup' ? copy.adminSignupEvent : copy.adminLoginEvent} · {new Date(entry.ts).toLocaleString()}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          );
        })()}

        {activeSection === 'settings' && <section className="glass-panel settings-section fade-in-up"><div className="panel-header"><h3>{copy.settings}</h3></div><div className="settings-grid"><article className="settings-card"><label className="settings-label" htmlFor="units">{copy.units}</label><select id="units" className="premium-select full-width" value={settings.units} onChange={(e) => setSettings((c) => ({ ...c, units: e.target.value }))}><option value="kg">kg</option><option value="lbs">lbs</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="lang">{copy.language}</label><select id="lang" className="premium-select full-width" value={settings.language} onChange={(e) => setSettings((c) => ({ ...c, language: e.target.value }))}>{LANGUAGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article><article className="settings-card settings-card-wide"><div className="settings-actions settings-actions-stacked"><div><span className="settings-title">{copy.backgroundAccent}</span><p className="settings-copy">{copy.backgroundAccentDesc}</p></div><div className="accent-picker" role="radiogroup" aria-label={copy.backgroundAccent}>{BACKGROUND_PRESETS.map((preset) => <button key={preset.id} className={`accent-choice ${settings.backgroundAccent === preset.id ? 'active' : ''}`} type="button" onClick={() => setSettings((c) => ({ ...c, backgroundAccent: preset.id }))} aria-pressed={settings.backgroundAccent === preset.id}><span className="accent-swatch" style={{ background: preset.color }} />{getLocalizedLabel(preset.label, settings.language)}</button>)}</div></div></article><article className="settings-card"><label className="settings-label" htmlFor="dateFormat">{copy.dateFormat}</label><select id="dateFormat" className="premium-select full-width" value={settings.dateFormat} onChange={(e) => setSettings((c) => ({ ...c, dateFormat: e.target.value }))}><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="backup">{copy.backupReminder}</label><select id="backup" className="premium-select full-width" value={settings.backupReminderDays} onChange={(e) => setSettings((c) => ({ ...c, backupReminderDays: Number(e.target.value) }))}><option value={3}>3 {copy.days}</option><option value={7}>7 {copy.days}</option><option value={14}>14 {copy.days}</option><option value={30}>30 {copy.days}</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="calorieGoal">{copy.calorieGoal}</label><input id="calorieGoal" type="number" min="1000" step="50" value={settings.calorieGoal} onChange={(e) => setSettings((c) => ({ ...c, calorieGoal: Number(e.target.value) || 2200 }))} /></article><article className="settings-card"><label className="settings-label" htmlFor="trackerMode">{copy.trackerMode}</label><select id="trackerMode" className="premium-select full-width" value={settings.calorieTrackerMode} onChange={(e) => setSettings((c) => ({ ...c, calorieTrackerMode: e.target.value }))}><option value="simple">{copy.simpleTracker}</option><option value="advanced">{copy.advancedTracker}</option></select></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.lastBackup}</span><p className="settings-copy">{settings.lastBackupAt ? formatDateValue(settings.lastBackupAt.slice(0, 10), settings.dateFormat) : copy.never}</p></div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={exportData}>{copy.export}</button><button className="action-btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>{copy.import}</button></div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.installApp}</span><p className="settings-copy">{copy.installAppDesc}</p></div><div>{isInStandaloneMode ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installDone}</span> : isIos ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installIos}</span> : <button className="action-btn-outline" type="button" onClick={triggerInstall} disabled={!installPrompt}>{copy.installBtn}</button>}</div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.showFeedbackBtn}</span><p className="settings-copy">{copy.showFeedbackBtnDesc}</p></div><button className="action-btn-outline" type="button" onClick={() => setSettings(c => ({...c, showFeedbackBtn: !c.showFeedbackBtn}))}>{settings.showFeedbackBtn ? '✓ On' : 'Off'}</button></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.tutorialOpen}</span><p className="settings-copy">{copy.tutorialOpenDesc}</p></div><button className="action-btn-outline" type="button" onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>{copy.tutorialOpen}</button></div></article><article className="settings-card settings-card-wide danger-card"><div className="settings-actions"><div><span className="settings-title">{copy.clear}</span><p className="settings-copy">{copy.backupText}</p></div><button className="action-btn-outline danger-button" type="button" onClick={clearData}>{copy.clear}</button></div></article></div><input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importData} /></section>}
      </main>
      {currentUser && settings.showFeedbackBtn !== false && (
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
        <div className="sw-update-banner">
          <span>{settings.language === 'sl' ? '🆕 Nova verzija je na voljo!' : '🆕 New version available!'}</span>
          <div className="sw-update-actions">
            <button className="action-btn-primary" style={{padding:'0.35rem 1rem',fontSize:'0.85rem'}} type="button" onClick={() => window.location.reload()}>
              {settings.language === 'sl' ? 'Osveži' : 'Reload'}
            </button>
            <button className="action-btn-outline" style={{padding:'0.35rem 0.6rem',fontSize:'0.85rem'}} type="button" onClick={() => setSwUpdatePending(false)}>✕</button>
          </div>
        </div>
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
      {showTutorial && (() => {
        const steps = [
          { title: copy.tutorialStep1Title, desc: copy.tutorialStep1 },
          { title: copy.tutorialStep2Title, desc: copy.tutorialStep2 },
          { title: copy.tutorialStep3Title, desc: copy.tutorialStep3 },
          { title: copy.tutorialStep4Title, desc: copy.tutorialStep4 },
          { title: copy.tutorialStep5Title, desc: copy.tutorialStep5 },
          { title: copy.tutorialStep6Title, desc: copy.tutorialStep6 },
          { title: copy.tutorialStep7Title, desc: copy.tutorialStep7 },
          { title: copy.tutorialStep8Title, desc: copy.tutorialStep8 },
        ];
        const step = steps[tutorialStep];
        const isLast = tutorialStep === steps.length - 1;
        return (
          <div className="recap-overlay" onClick={() => setShowTutorial(false)}>
            <div className="recap-modal glass-panel" style={{maxWidth:'28rem',textAlign:'center'}} onClick={e => e.stopPropagation()}>
              <h2 style={{fontSize:'1.3rem',marginBottom:'0.75rem',lineHeight:1.3}}>{step.title}</h2>
              <p style={{opacity:0.8,marginBottom:'1.5rem',lineHeight:1.6,fontSize:'0.95rem'}}>{step.desc}</p>
              <div style={{display:'flex',justifyContent:'center',gap:'0.4rem',marginBottom:'1.5rem'}}>
                {steps.map((_, i) => (
                  <button key={i} type="button" onClick={() => setTutorialStep(i)} style={{width:'0.55rem',height:'0.55rem',borderRadius:'50%',border:'none',padding:0,cursor:'pointer',background: i === tutorialStep ? 'var(--accent)' : 'var(--border-color)',transition:'background 0.2s'}} />
                ))}
              </div>
              <div style={{display:'flex',gap:'0.75rem',justifyContent:'center'}}>
                {tutorialStep > 0 && <button className="action-btn-outline" type="button" style={{minWidth:'7rem'}} onClick={() => setTutorialStep(s => s - 1)}>{copy.tutorialBack}</button>}
                {isLast
                  ? <button className="action-btn-primary" type="button" style={{minWidth:'10rem'}} onClick={() => setShowTutorial(false)}>{copy.tutorialClose}</button>
                  : <button className="action-btn-primary" type="button" style={{minWidth:'7rem'}} onClick={() => setTutorialStep(s => s + 1)}>{copy.tutorialNext}</button>
                }
              </div>
            </div>
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
              <div className="stats-row"><span>{copy.recapRank}</span><strong style={{fontSize:'1.2rem'}}>{rankData.rank.displayName}</strong></div>
              <div className="stats-row"><span>{copy.recapPoints}</span><strong style={{fontSize:'1.2rem'}}>{rankData.pts}</strong></div>
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
