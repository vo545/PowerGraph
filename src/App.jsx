import { useEffect, useMemo, useRef, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

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
const CAL_HISTORY_KEY_PREFIX = 'powergraph_calhistory_';
const BODYWEIGHT_KEY_PREFIX = 'powergraph_bodyweight_';
const RECAP_KEY_PREFIX = 'powergraph_recap_';
const REST_KEY_PREFIX = 'powergraph_rest_';
const CHEAT_KEY_PREFIX = 'powergraph_cheat_';
const THEME_KEY = 'powergraph_theme';
const SETTINGS_KEY_PREFIX = 'powergraph_settings_';
const USERS_KEY = 'powergraph_users';
const SESSION_KEY = 'powergraph_session';
const ADMIN_EMAIL = 'vid.oreskovic@gmail.com';
const LOGINS_KEY = 'powergraph_logins';
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const GIST_ID = import.meta.env.VITE_GIST_ID || '';

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
function getRestKey(email) { return `${REST_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function getCheatKey(email) { return `${CHEAT_KEY_PREFIX}${(email || '').split('@')[0]}`; }
function loadRestDays(email) { if (!email) return []; try { return JSON.parse(localStorage.getItem(getRestKey(email)) || '[]'); } catch { return []; } }
function loadCheatDays(email) { if (!email) return []; try { return JSON.parse(localStorage.getItem(getCheatKey(email)) || '[]'); } catch { return []; } }
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

const defaultSettings = { units: 'kg', language: 'sl', dateFormat: 'DD.MM.YYYY', backupReminderDays: 7, lastBackupAt: '', calorieGoal: 2200, calorieTrackerMode: 'simple', weightDrop: false, gender: 'male', age: '', height: '', showFeedbackBtn: true };
const RATINGS_KEY = 'powergraph_ratings';
const BANNED_KEY = 'powergraph_banned';
const MODS_KEY = 'powergraph_mods';

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
    primary: 'Glavni target',
    howTo: 'Kako izvajamo',
    cues: 'Na kaj paziti',
    equipment: 'Oprema / naprave',
    units: 'Enote',
    language: 'Jezik',
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
    email: 'Gmail',
    password: 'Geslo',
    confirmPassword: 'Potrdi geslo',
    authTitle: 'Prijava v lokalni profil',
    authSubtitle: 'Ra\u010dun deluje samo v tem brskalniku. Vsak profil ima svoje treninge in nastavitve.',
    authSwitchLogin: '\u017de ima\u0161 ra\u010dun?',
    authSwitchSignup: '\u0160e nima\u0161 ra\u010duna?',
    authCreate: 'Ustvari ra\u010dun',
    authEnter: 'Prijavi se',
    authPasswordsNoMatch: 'Gesli se ne ujemata.',
    authInvalidEmail: 'Vpi\u0161i veljaven email.',
    authShortPassword: 'Geslo naj ima vsaj 6 znakov.',
    authExists: 'Uporabnik s tem emailom \u017ee obstaja.',
    authNotFound: 'Uporabnik ne obstaja.',
    authWrongPassword: 'Napa\u010dno geslo.',
    authLocalOnly: 'Lokalni ra\u010duni so shranjeni samo v tem brskalniku.',
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
    primary: 'Primary target',
    howTo: 'How to do it',
    cues: 'What to watch for',
    equipment: 'Equipment / machines',
    units: 'Units',
    language: 'Language',
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
    email: 'Gmail',
    password: 'Password',
    confirmPassword: 'Confirm password',
    authTitle: 'Sign in to your local profile',
    authSubtitle: 'This account works only in this browser. Each profile has separate workouts and settings.',
    authSwitchLogin: 'Already have an account?',
    authSwitchSignup: "Don't have an account yet?",
    authCreate: 'Create account',
    authEnter: 'Sign in',
    authPasswordsNoMatch: 'Passwords do not match.',
    authInvalidEmail: 'Enter a valid email address.',
    authShortPassword: 'Password must be at least 6 characters.',
    authExists: 'A user with this email already exists.',
    authNotFound: 'User not found.',
    authWrongPassword: 'Wrong password.',
    authLocalOnly: 'Local accounts are stored only in this browser.',
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
  },
};

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

const calisthenicsSections = {
  Chest: ['Push-Up', 'Wide Push-Up', 'Diamond Push-Up', 'Archer Push-Up', 'Pseudo-Planche Push-Up'],
  Back: ['Pull-Up', 'Chin-Up', 'Inverted Row', 'Australian Pull-Up', 'Muscle-Up'],
  Legs: ['Bodyweight Squat', 'Bulgarian Split Squat', 'Pistol Squat', 'Jump Squat', 'Wall Sit'],
  Triceps: ['Dip', 'Diamond Push-Up', 'Close Grip Push-Up', 'Bench Dip', 'Close Grip Bench Press'],
  Biceps: ['Chin-Up', 'Archer Pull-Up', 'Commando Pull-Up', 'Pull-Up'],
  Shoulders: ['Pike Push-Up', 'Handstand Push-Up', 'Shoulder Tap', 'Lateral Raise'],
  'Stamina/Cardio': ['Burpee', 'Mountain Climber', 'Jump Rope', 'Box Jump', 'Running'],
  Abs: ['Plank', 'L-Sit', 'Hollow Body Hold', 'Leg Raise', 'V-Up'],
  Forearms: ['Dead Hang', 'Farmer Carry', 'Plate Pinch Hold'],
};

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


const normalizeWorkout = (w, i = 0) => ({ id: w.id ?? Date.now() + i, date: w.date ?? new Date().toISOString().slice(0, 10), exercise: w.exercise ?? 'Bench Press', weight: Number(w.weight ?? 0), setDetails: (Array.isArray(w.setDetails) ? w.setDetails : []).map((v) => Number(v) || 0).filter((v) => v > 0).length ? (Array.isArray(w.setDetails) ? w.setDetails : []).map((v) => Number(v) || 0).filter((v) => v > 0) : [1] });
const getSetCount = (w) => w.setDetails.length;
const getTotalReps = (w) => w.setDetails.reduce((s, v) => s + v, 0);
const getVolume = (w) => w.weight * getTotalReps(w);
const formatSetDetails = (w) => w.setDetails.join(' / ');
const convertWeight = (kg, units) => (units === 'lbs' ? kg * 2.20462 : kg);
const formatWeight = (kg, units) => `${units === 'lbs' ? Math.round(convertWeight(kg, units)) : Number(convertWeight(kg, units).toFixed(1))} ${units}`;
const formatVolume = (kg, units) => `${Math.round(convertWeight(kg, units)).toLocaleString()} ${units}`;
const findSection = (exercise) => Object.entries(sections).find(([, items]) => items.includes(exercise))?.[0] ?? 'Chest';
const localize = (pair, lang) => pair[lang];
const getExerciseInfo = (exercise) => ({
  ...(exerciseInfo[exercise] ?? { sl: exercise, en: exercise, targets: { sl: '', en: '' }, primary: { sl: '', en: '' }, howTo: { sl: '', en: '' }, cues: { sl: '', en: '' } }),
  equipment: exerciseEquipment[exercise] ?? { sl: 'Osnovna gym oprema', en: 'Basic gym equipment' },
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
    if (input.language === 'sl' || input.language === 'en') safe.language = input.language;
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

function getRank(points, lang) {
  let rank = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i].min) { rank = RANKS[i]; break; }
  }
  return { ...rank, displayName: lang === 'en' ? rank.nameEn : rank.name };
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

async function fetchLoginLogs() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    try { return JSON.parse(localStorage.getItem(LOGINS_KEY) || '[]'); } catch { return []; }
  }
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    const data = await res.json();
    const content = data.files?.['logs.json']?.content || '[]';
    return JSON.parse(content);
  } catch { return []; }
}

async function pushLoginLog(email, type) {
  const entry = { email, type, ts: new Date().toISOString() };
  if (!GITHUB_TOKEN || !GIST_ID) { recordLogin(email, type); return; }
  try {
    const logs = await fetchLoginLogs();
    logs.push(entry);
    const trimmed = logs.slice(-500);
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'logs.json': { content: JSON.stringify(trimmed) } } })
    });
  } catch { recordLogin(email, type); }
}

function gistFileName(email) { return `data_${email.replace(/[^a-z0-9]/gi, '_')}.json`; }

async function gistPushData(email, payload) {
  if (!GITHUB_TOKEN || !GIST_ID) return;
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [gistFileName(email)]: { content: JSON.stringify(payload) } } })
    });
  } catch {}
}

async function gistPullData(email) {
  if (!GITHUB_TOKEN || !GIST_ID) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.files?.[gistFileName(email)]?.content;
    return content ? JSON.parse(content) : null;
  } catch { return null; }
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

async function applyGistData(email, gistData) {
  if (!gistData) return;
  const lw = loadWorkouts(email);
  const mw = mergeById(lw, (gistData.workouts || []).map(normalizeWorkout));
  if (mw.length > lw.length) localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify(mw));
  const lc = loadCalories(email);
  const mc = mergeById(lc, gistData.calorieEntries || []);
  if (mc.length > lc.length) localStorage.setItem(getCaloriesStorageKey(email), JSON.stringify(mc));
  const lb = loadBodyWeight(email);
  const mb = mergeById(lb, gistData.bodyWeightEntries || []);
  if (mb.length > lb.length) localStorage.setItem(getBodyWeightKey(email), JSON.stringify(mb));
  const lr = loadRestDays(email); const mr = mergeStrings(lr, gistData.restDays || []);
  if (mr.length > lr.length) localStorage.setItem(getRestKey(email), JSON.stringify(mr));
  const lch = loadCheatDays(email); const mch = mergeStrings(lch, gistData.cheatDays || []);
  if (mch.length > lch.length) localStorage.setItem(getCheatKey(email), JSON.stringify(mch));
  const lcalh = loadCalHistory(email);
  const mcalh = mergeById(lcalh, gistData.calHistory || []);
  if (mcalh.length > lcalh.length) localStorage.setItem(getCalHistoryKey(email), JSON.stringify(mcalh));
}

async function hashPassword(value) {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
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

export default function App() {
  const fileInputRef = useRef(null);
  const previousCountRef = useRef(0);
  const previousExerciseRef = useRef('Bench Press');
  const timerWorkerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const notifTimerRef = useRef(null);
  const timerEndAtRef = useRef(null);
  const timerAlarmFnRef = useRef(null);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(SESSION_KEY) || '');
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
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [formData, setFormData] = useState({ date: new Date().toISOString().slice(0, 10), exercise: 'Bench Press', weight: '', setDetails: ['12', '10', '8'], setWeights: ['', '', ''] });
  const [calorieForm, setCalorieForm] = useState({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [calQuery, setCalQuery] = useState('');
  const [calGrams, setCalGrams] = useState('');
  const [calResult, setCalResult] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');
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
  const [macroForm, setMacroForm] = useState({ weight: '', goal: 'maintain', activity: 'moderate' });
  const [macroResult, setMacroResult] = useState(null);
  const [bannedUsers, setBannedUsers] = useState(() => loadBanned());
  const [modUsers, setModUsers] = useState(() => loadMods());
  const [timerCustomInput, setTimerCustomInput] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const copy = ui[settings.language];
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
  const exerciseOptions = useMemo(() => [...new Set([...Object.values(sections).flat(), ...workouts.map((w) => w.exercise)])].sort(), [workouts]);
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
    const today = new Date().toISOString().slice(0, 10);
    const ranked = Object.keys(activeAdvisorSections)
      .map((section) => ({ section, last: latestSectionDate[section] ?? '', score: latestSectionDate[section] ? Math.floor((new Date(today) - new Date(latestSectionDate[section])) / 86400000) : 9999 }))
      .sort((a, b) => b.score - a.score);
    const chosen = ranked[0];
    return {
      section: chosen.section,
      last: chosen.last,
      reason: !chosen.last ? copy.reasonEmpty : chosen.score >= 4 ? copy.reasonCold : copy.reasonBalance,
      plan: chosen.section === 'Stamina/Cardio' ? copy.planCardio : copy.planStrength,
      exercises: (activeAdvisorSections[chosen.section] || sections[chosen.section] || []).map((name) => ({ name, last: latestExerciseDate[name] ?? '' })).sort((a, b) => (a.last || '').localeCompare(b.last || '')).slice(0, 5),
    };
  }, [copy.planCardio, copy.planStrength, copy.reasonBalance, copy.reasonCold, copy.reasonEmpty, workouts, advisorMode, activeAdvisorSections]);

  const rankData = useMemo(() => {
    const base = calculatePoints(workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, settings.calorieGoal);
    const pts = base + adminBonus;
    const rank = getRank(pts, settings.language);
    const nextRank = RANKS.find(r => r.min > pts);
    return { pts, rank, nextRank };
  }, [workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, settings.calorieGoal, settings.language, adminBonus]);

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
    if (API_URL && getJwt(currentUser)) {
      apiCall(currentUser, '/api/sync').then(serverData => {
        if (!serverData) return;
        const serverIds = new Set((serverData.workouts || []).map(w => w.id));
        workouts.forEach(w => {
          if (!serverIds.has(w.id)) {
            apiCall(currentUser, '/api/workouts', 'POST', { date: w.date, exercise: w.exercise, sets: w.setDetails.length, weight: w.weight, setDetails: w.setDetails, notes: w.comment || '' });
          }
        });
      });
    }
  }, [currentUser, workouts]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(getCaloriesStorageKey(currentUser), JSON.stringify(calorieEntries));
    if (API_URL && getJwt(currentUser)) {
      apiCall(currentUser, '/api/sync').then(serverData => {
        if (!serverData) return;
        const serverIds = new Set((serverData.calories || []).map(e => e.id));
        calorieEntries.forEach(e => {
          if (!serverIds.has(e.id)) {
            apiCall(currentUser, '/api/calories', 'POST', { date: e.date, mealType: e.mealType, name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat });
          }
        });
      });
    }
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
    fetchLoginLogs().then(setAdminLogs);
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (!GITHUB_TOKEN || !GIST_ID || !currentUser) return undefined;
    setSyncing(true);
    const id = setTimeout(async () => {
      try {
        await gistPushData(currentUser, { workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, calHistory });
      } finally { setSyncing(false); }
    }, 5000);
    return () => { clearTimeout(id); setSyncing(false); };
  }, [currentUser, workouts, calorieEntries, bodyWeightEntries, restDays, cheatDays, calHistory]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    setAuthError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError(copy.authInvalidEmail);
      return;
    }
    if (password.length < 6) {
      setAuthError(copy.authShortPassword);
      return;
    }
    if (authMode === 'signup' && password !== authForm.confirmPassword) {
      setAuthError(copy.authPasswordsNoMatch);
      return;
    }

    setAuthLoading(true);
    try {
      const users = loadUsers();
      const existing = users.find((user) => user.email === email);
      const passwordHash = await hashPassword(password);

      if (authMode === 'signup') {
        if (existing) {
          setAuthError(copy.authExists);
          return;
        }
        const nextUsers = [...users, { email, passwordHash, createdAt: new Date().toISOString() }];
        localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
        localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify([]));
        localStorage.setItem(getSettingsStorageKey(email), JSON.stringify(defaultSettings));
        await pushLoginLog(email, 'signup');
        await applyGistData(email, await gistPullData(email));
        backendLogin(email, password).then(token => {
          if (token) pullFromBackend(email).then(data => {
            if (data?.workouts?.length) localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify(data.workouts.map(normalizeWorkout)));
            if (data?.calories?.length) localStorage.setItem(getCaloriesStorageKey(email), JSON.stringify(data.calories));
            if (data?.bodyWeight?.length) localStorage.setItem(getBodyWeightKey(email), JSON.stringify(data.bodyWeight));
            if (data?.restDays?.length) localStorage.setItem(getRestKey(email), JSON.stringify(data.restDays));
            if (data?.cheatDays?.length) localStorage.setItem(getCheatKey(email), JSON.stringify(data.cheatDays));
          });
        });
        setCurrentUser(email);
      } else {
        const banned = loadBanned();
        if (banned.includes(email)) {
          setAuthError(settings.language === 'sl' ? 'Ta ra\u010dun je blokiran.' : 'This account has been banned.');
          return;
        }
        if (!existing) {
          setAuthError(copy.authNotFound);
          return;
        }
        if (existing.passwordHash !== passwordHash) {
          setAuthError(copy.authWrongPassword);
          return;
        }
        await pushLoginLog(email, 'login');
        await applyGistData(email, await gistPullData(email));
        backendLogin(email, password).then(token => {
          if (token) pullFromBackend(email).then(data => {
            if (data) {
              if (Array.isArray(data.workouts) && data.workouts.length) localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify(data.workouts.map(normalizeWorkout)));
              if (Array.isArray(data.calories) && data.calories.length) localStorage.setItem(getCaloriesStorageKey(email), JSON.stringify(data.calories));
              if (Array.isArray(data.bodyWeight) && data.bodyWeight.length) localStorage.setItem(getBodyWeightKey(email), JSON.stringify(data.bodyWeight));
              if (Array.isArray(data.restDays)) localStorage.setItem(getRestKey(email), JSON.stringify(data.restDays));
              if (Array.isArray(data.cheatDays)) localStorage.setItem(getCheatKey(email), JSON.stringify(data.cheatDays));
            }
          });
        });
        setCurrentUser(email);
      }
      setAuthForm({ email: '', password: '', confirmPassword: '' });
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
    setAuthForm({ email: '', password: '', confirmPassword: '' });
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
  function exportData() { downloadFile(`powergraph-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ workouts, calorieEntries, settings, calHistory, bodyWeightEntries }, null, 2), 'application/json'); setSettings((c) => ({ ...c, lastBackupAt: new Date().toISOString() })); setToast(copy.backupDone); }
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
    reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); const imported = Array.isArray(parsed) ? parsed : parsed.workouts; if (!Array.isArray(imported)) throw new Error('invalid'); setWorkouts(imported.map(normalizeWorkout)); if (Array.isArray(parsed.calorieEntries)) setCalorieEntries(parsed.calorieEntries); if (parsed.settings) setSettings(sanitizeSettings(parsed.settings)); if (Array.isArray(parsed.calHistory)) setCalHistory(parsed.calHistory); if (Array.isArray(parsed.bodyWeightEntries)) setBodyWeightEntries(parsed.bodyWeightEntries); setToast(copy.importDone); } catch { setToast(copy.importFail); } finally { event.target.value = ''; } };
    reader.readAsText(file);
  }
  function clearData() { if (!window.confirm(copy.clearConfirm)) return; setWorkouts([]); setCalorieEntries([]); setCalHistory([]); setBodyWeightEntries([]); setRestDays([]); setCheatDays([]); localStorage.removeItem(getRestKey(currentUser)); localStorage.removeItem(getCheatKey(currentUser)); setToast(copy.cleared); }
  function deleteWorkout(id) { setWorkouts((current) => current.filter((item) => item.id !== id)); if (editingWorkoutId === id) setEditingWorkoutId(null); }
  function saveComment(id) { setWorkouts(cur => cur.map(w => w.id === id ? { ...w, comment: commentText.trim() } : w)); setEditingCommentId(null); setCommentText(''); }
  function startEditComment(w) { setEditingCommentId(w.id); setCommentText(w.comment || ''); }

  async function triggerInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }


  function calculateMacros(e) {
    e.preventDefault();
    const w = Number(macroForm.weight);
    if (!w || w < 20) return;
    const activityMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryactive: 1.9 }[macroForm.activity] || 1.55;
    const bmr = settings.gender === 'female' ? 10 * w + 6.25 * Number(settings.height || 170) - 5 * Number(settings.age || 25) - 161 : 10 * w + 6.25 * Number(settings.height || 170) - 5 * Number(settings.age || 25) + 5;
    const tdee = Math.round(bmr * activityMult);
    const adj = macroForm.goal === 'bulk' ? 300 : macroForm.goal === 'cut' ? -500 : 0;
    const targetCal = tdee + adj;
    const protein = Math.round(w * 2.2);
    const fat = Math.round(targetCal * 0.25 / 9);
    const carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
    setMacroResult({ calories: targetCal, protein, carbs, fat });
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

    const effectiveKey = import.meta.env.VITE_GEMINI_KEY || '';
    const normalized = normalizeFoodQuery(calQuery);
    const local = LOCAL_FOODS[normalized];

    // 1. Gemini AI estimate (if key available)
    if (effectiveKey) {
      try {
        const prompt = `You are a nutritionist. The user ate: "${calQuery.trim()}", ${calGrams}g.
Give a realistic average calorie estimate for this food (not a branded product).
Briefly state what ingredients/preparation you assumed (1 sentence).
Then on a new line write exactly: KCAL_PER_100G: <number>
Then on a new line write exactly: TOTAL_KCAL: <number>
Be concise. Use average homemade/generic values, not brand values.`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const per100Match = text.match(/KCAL_PER_100G:\s*(\d+)/i);
          const totalMatch = text.match(/TOTAL_KCAL:\s*(\d+)/i);
          if (per100Match && totalMatch) {
            const kcalPer100 = Number(per100Match[1]);
            const total = Number(totalMatch[1]);
            const aiText = text.replace(/KCAL_PER_100G:\s*\d+/i, '').replace(/TOTAL_KCAL:\s*\d+/i, '').trim();
            const result = { name: calQuery.trim(), kcalPer100, total, aiText };
            setCalResult(result);
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
    const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryactive: 1.9 };
    const mult = activityMultipliers[tdeeForm.activityLevel] || 1.55;
    let bmr;
    if (age && height) {
      bmr = tdeeForm.gender === 'female'
        ? 10 * cw + 6.25 * height - 5 * age - 161
        : 10 * cw + 6.25 * height - 5 * age + 5;
    } else {
      const legacyFactors = { sedentary: 26, light: 30, moderate: 33, active: 37, veryactive: 40 };
      const tdeeSimple = cw * (legacyFactors[tdeeForm.activityLevel] || 33);
      bmr = tdeeSimple / mult;
    }
    const tdee = Math.round(bmr * mult);
    const totalKcal = (cw - gw) * 7700;
    const dailyAdjustment = Math.round(totalKcal / (weeks * 7));
    const target = tdee - dailyAdjustment;
    if (tdeeForm.age) setSettings(c => ({ ...c, gender: tdeeForm.gender, age: tdeeForm.age, height: tdeeForm.height }));
    setTdeeResult({ tdee, target, dailyAdjustment });
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

  const NAV_ICONS = { dashboard: '🏠', exercises: '💪', history: '📋', bodyweight: '⚖️', calories: '🥗', ocenjevalec: '🔍', rankings: '🏆', advisor: '💡', settings: '⚙️', admin: '🛡️' };
  const NAV_SHORT = settings.language === 'sl'
    ? { dashboard: 'Domov', exercises: 'Vaje', history: 'Arhiv', bodyweight: 'Teža', calories: 'Obroki', ocenjevalec: 'Išči', rankings: 'Rang', advisor: 'Nasvet', settings: 'Opcije', admin: 'Admin' }
    : { dashboard: 'Home', exercises: 'Workout', history: 'Log', bodyweight: 'Weight', calories: 'Meals', ocenjevalec: 'Search', rankings: 'Rank', advisor: 'Tips', settings: 'Options', admin: 'Admin' };
  const nav = [['dashboard', copy.dashboard], ['exercises', copy.exercises], ['history', copy.history], ['bodyweight', copy.bodyweight], ['calories', copy.calories], ['ocenjevalec', copy.ocenjevalec], ['rankings', copy.rankings], ['advisor', copy.advisor], ['settings', copy.settings], ...(currentUser === ADMIN_EMAIL ? [['admin', copy.admin]] : [])];

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <section className="glass-panel auth-card">
          <div className="brand"><div className="logo-icon">P</div><h2>{copy.app}</h2></div>
          <div className="auth-copy">
            <h2>{copy.authTitle}</h2>
            <p>{copy.authSubtitle}</p>
            <p className="settings-copy">{copy.authLocalOnly}</p>
          </div>
          <div className="auth-tabs">
            <button className={`nav-btn ${authMode === 'login' ? 'active' : ''}`} type="button" onClick={() => { setAuthMode('login'); setAuthError(''); }}>{copy.login}</button>
            <button className={`nav-btn ${authMode === 'signup' ? 'active' : ''}`} type="button" onClick={() => { setAuthMode('signup'); setAuthError(''); }}>{copy.signup}</button>
          </div>
          <form className="premium-form" onSubmit={handleAuthSubmit}>
            <div className="input-group"><label htmlFor="auth-email">{copy.email}</label><input id="auth-email" type="email" value={authForm.email} onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} /></div>
            <div className="input-group"><label htmlFor="auth-password">{copy.password}</label><input id="auth-password" type="password" value={authForm.password} onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))} /></div>
            {authMode === 'signup' ? <div className="input-group"><label htmlFor="auth-confirm">{copy.confirmPassword}</label><input id="auth-confirm" type="password" value={authForm.confirmPassword} onChange={(e) => setAuthForm((c) => ({ ...c, confirmPassword: e.target.value }))} /></div> : null}
            {authError ? <p className="auth-error">{authError}</p> : null}
            <button className="action-btn-primary full-width" type="submit" disabled={authLoading}>{authMode === 'signup' ? copy.authCreate : copy.authEnter}</button>
          </form>
          <p className="settings-copy">{authMode === 'signup' ? copy.authSwitchLogin : copy.authSwitchSignup}</p>
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
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">💪</div><div><p className="stat-title">{copy.workouts}</p><h3 className="stat-value">{overall.workouts}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">≡</div><div><p className="stat-title">{copy.totalSets}</p><h3 className="stat-value">{overall.sets}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow">▲</div><div><p className="stat-title">{copy.totalVolume}</p><h3 className="stat-value">{formatVolume(overall.volumeKg, settings.units)}</h3></div></article>
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
            if (filtered.length === 0) return <div className="empty-state"><p>{copy.noExerciseResults}</p></div>;
            return filtered.map(([section, names]) => (
              <div className="exercise-section-block" key={section}>
                <div className="exercise-section-header"><h4>{sectionNames[section]}</h4><span className="exercise-badge">{names.length}</span></div>
                <div className="exercise-grid">{names.map((name) => { const meta = getExerciseInfo(name); return <article className="exercise-card" key={name}><div className="exercise-top"><div><p className="exercise-category">{sectionNames[section]}</p><h4>{getExerciseName(name, settings.language)}</h4></div><span className="exercise-badge">{localize(meta.primary, settings.language)}</span></div><div className="exercise-copy"><p><strong>{copy.target}:</strong> {localize(meta.targets, settings.language)}</p><p><strong>{copy.primary}:</strong> {localize(meta.primary, settings.language)}</p><p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p><p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p><p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p></div></article>; })}</div>
              </div>
            ));
          })()}
        </section>}

        {activeSection === 'advisor' && <section className="glass-panel stats-section fade-in-up"><div className="panel-header"><h3>{copy.advisorTitle}</h3><div style={{display:'flex',gap:'0.4rem',marginLeft:'auto'}}><button className={`action-btn-${advisorMode === 'gym' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => setAdvisorMode('gym')}>🏋️ {copy.gymMode}</button><button className={`action-btn-${advisorMode === 'calisthenics' ? 'primary' : 'outline'}`} type="button" style={{fontSize:'0.75rem',padding:'0.2rem 0.55rem'}} onClick={() => setAdvisorMode('calisthenics')}>🤸 {copy.calisthenicsMode}</button></div></div><div className="advisor-grid"><article className="advisor-card"><p className="exercise-category">{copy.focus}</p><h3>{sectionNames[advisor.section]}</h3><p className="settings-copy">{copy.advisorText}</p><div className="stats-list mt-1"><div className="stats-row"><span>{copy.lastWorked}</span><strong>{advisor.last ? formatDateValue(advisor.last, settings.dateFormat) : copy.neverWorked}</strong></div><div className="stats-row"><span>{copy.sets}</span><strong>{advisor.plan}</strong></div></div></article><article className="advisor-card"><p className="exercise-category">{copy.why}</p><p>{advisor.reason}</p></article></div><div className="panel-header mt-1"><h3>{copy.suggested}</h3></div><div className="exercise-grid">{advisor.exercises.map((item) => { const meta = getExerciseInfo(item.name); return <article className="exercise-card" key={item.name}><div className="exercise-top"><div><p className="exercise-category">{sectionNames[advisor.section]}</p><h4>{getExerciseName(item.name, settings.language)}</h4></div><span className="exercise-badge">{item.last ? formatDateValue(item.last, settings.dateFormat) : copy.neverWorked}</span></div><div className="exercise-copy"><p><strong>{copy.target}:</strong> {localize(meta.targets, settings.language)}</p><p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p><p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p><p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p></div></article>; })}</div></section>}

        {activeSection === 'calories' && <>
          <div className="dashboard-grid">
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">🍽</div><div><p className="stat-title">{copy.caloriesConsumed}</p><h3 className="stat-value">{Math.round(selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">🎯</div><div><p className="stat-title">{copy.calorieGoal}</p><h3 className="stat-value">{Math.round(settings.calorieGoal)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow">⚡</div><div><p className="stat-title">{copy.caloriesRemaining}</p><h3 className="stat-value">{Math.round(settings.calorieGoal - selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>

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
          <section className="glass-panel action-panel fade-in-up">
            <div className="panel-header"><h3>{copy.calEstTitle}</h3></div>
            <form className="premium-form" onSubmit={searchCalories}>
              <div className="input-group">
                <label>{copy.calEstFood}</label>
                <input type="text" value={calQuery} onChange={e => setCalQuery(e.target.value)} placeholder={copy.calEstPlaceholder} />
              </div>
              <div className="input-group">
                <label>{copy.calEstGrams}</label>
                <input type="number" min="1" value={calGrams} onChange={e => setCalGrams(e.target.value)} placeholder="100" />
              </div>
              <button className="action-btn-primary" type="submit" disabled={calLoading}>
                {calLoading ? copy.calEstLoading : copy.calEstSearch}
              </button>
            </form>
            {calError === 'noResult' && <p className="auth-error">{copy.calEstNoResult}</p>}
            {calError === 'error' && <p className="auth-error">{copy.calEstError}</p>}
            {calResult && (
              <div style={{marginTop:'1.5rem'}}>
                <div className="dashboard-grid">
                  <article className="glass-panel stat-card fade-in-up">
                    <div className="stat-icon blue-glow">📊</div>
                    <div>
                      <p className="stat-title">{calResult.name}</p>
                      <h3 className="stat-value">{calResult.kcalPer100} <span style={{fontSize:'0.9rem',opacity:.7}}>{copy.calEstPer100}</span></h3>
                    </div>
                  </article>
                  <article className="glass-panel stat-card fade-in-up">
                    <div className="stat-icon green-glow">∑</div>
                    <div>
                      <p className="stat-title">{calGrams}g → {copy.calEstTotal}</p>
                      <h3 className="stat-value">{calResult.total} kcal</h3>
                    </div>
                  </article>
                </div>
                {calResult.aiText && (
                  <div className="glass-panel" style={{marginTop:'1rem',padding:'1rem'}}>
                    <p className="settings-label" style={{marginBottom:'0.4rem'}}>{copy.calEstAiResponse}</p>
                    <p style={{fontSize:'0.9rem',lineHeight:1.5,opacity:.85}}>{calResult.aiText}</p>
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="glass-panel history-section fade-in-up">
            <div className="panel-header"><h3>{copy.calEstHistory}</h3><span className="history-count">{calHistory.length}</span></div>
            <div className="history-list">
              {calHistory.length ? calHistory.map(entry => (
                <article className="history-item" key={entry.id}>
                  <div>
                    <h3>{entry.name}</h3>
                    <p>{entry.date} · {entry.grams} g</p>
                  </div>
                  <div className="history-metrics">
                    <span>{entry.kcalPer100} {copy.calEstPer100}</span>
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

            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon orange-glow">🔥</div><div><p className="stat-title">{copy.streak}</p><h3 className="stat-value">{calculateStreak(workouts)}</h3></div></article>

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
                  const rankName = settings.language === 'en' ? r.nameEn : r.name;
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
              <div className="panel-header"><h3>{copy.macrosTitle}</h3></div>
              <form className="premium-form" onSubmit={calculateMacros}>
                <div className="input-group"><label>{copy.macrosWeight}</label><input type="number" step="0.1" min="20" value={macroForm.weight} onChange={e => setMacroForm(c => ({...c, weight: e.target.value}))} placeholder="75" /></div>
                <div className="input-group"><label>{copy.macrosGoal}</label><select className="premium-select" value={macroForm.goal} onChange={e => setMacroForm(c => ({...c, goal: e.target.value}))}><option value="bulk">{copy.macrosBulk}</option><option value="maintain">{copy.macrosMaintain}</option><option value="cut">{copy.macrosCut}</option></select></div>
                <div className="input-group"><label>{copy.tdeeActivity}</label><select className="premium-select" value={macroForm.activity} onChange={e => setMacroForm(c => ({...c, activity: e.target.value}))}><option value="sedentary">{copy.tdeeSedentary}</option><option value="light">{copy.tdeeLight}</option><option value="moderate">{copy.tdeeModerate}</option><option value="active">{copy.tdeeActive}</option><option value="veryactive">{copy.tdeeVeryActive}</option></select></div>
                <button className="action-btn-primary full-width" type="submit">{copy.macrosCalculate}</button>
              </form>
              {macroResult && (
                <div className="stats-list" style={{marginTop:'1rem'}}>
                  <div className="stats-row"><span>{copy.macrosCalories}</span><strong style={{fontSize:'1.1rem'}}>{macroResult.calories} kcal</strong></div>
                  <div className="stats-row"><span>{copy.macrosProtein}</span><strong style={{color:'#60a5fa'}}>{macroResult.protein} g</strong></div>
                  <div className="stats-row"><span>{copy.macrosCarbs}</span><strong style={{color:'#fb923c'}}>{macroResult.carbs} g</strong></div>
                  <div className="stats-row"><span>{copy.macrosFat}</span><strong style={{color:'#34d399'}}>{macroResult.fat} g</strong></div>
                </div>
              )}
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
                <div className="stats-list" style={{marginTop:'1rem'}}>
                  <div className="stats-row"><span>{copy.tdeeTDEE}</span><strong>{tdeeResult.tdee} kcal</strong></div>
                  <div className="stats-row"><span>{copy.tdeeAdjustment}</span><strong style={{color: tdeeResult.dailyAdjustment > 0 ? 'var(--error)' : 'var(--secondary-glow)'}}>{tdeeResult.dailyAdjustment > 0 ? '-' : '+'}{Math.abs(tdeeResult.dailyAdjustment)} kcal</strong></div>
                  <div className="stats-row"><span>{copy.tdeeTarget}</span><strong style={{fontSize:'1.1rem'}}>{tdeeResult.target} kcal</strong></div>
                </div>
              )}
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
              </div>
              <section className="glass-panel history-section fade-in-up">
                <div className="panel-header"><h3>{copy.adminUsers}</h3><span className="history-count">{allUsers.length}</span></div>
                <div className="history-list">
                  {userStats.length === 0 && <div className="empty-state"><p>{copy.adminNoUsers}</p></div>}
                  {userStats.map((u) => (
                    <article className="history-item" key={u.email} style={{flexDirection:'column',alignItems:'flex-start',gap:'0.5rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',width:'100%'}}>
                        <div className="stat-icon blue-glow" style={{width:'2rem',height:'2rem',fontSize:'0.85rem',flexShrink:0}}>{u.email[0].toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <h3 style={{fontSize:'0.95rem',wordBreak:'break-all'}}>{u.email}</h3>
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
                        {u.email !== ADMIN_EMAIL && (modUsers.includes(u.email) ? <button className="action-btn-outline" type="button" style={{color:'#f59e0b',borderColor:'#f59e0b'}} onClick={() => toggleMod(u.email)}>{copy.adminRemoveMod}</button> : <button className="action-btn-outline" type="button" onClick={() => toggleMod(u.email)}>{copy.adminSetMod}</button>)}
                      </div>
                      {bannedUsers.includes(u.email) && <div style={{fontSize:'0.78rem',color:'var(--error)',fontWeight:600,padding:'0.2rem 0'}}>{copy.adminBanned}</div>}
                      {modUsers.includes(u.email) && !bannedUsers.includes(u.email) && <div style={{fontSize:'0.78rem',color:'#22c55e',fontWeight:600,padding:'0.2rem 0'}}>{copy.adminMod}</div>}
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

        {activeSection === 'settings' && <section className="glass-panel settings-section fade-in-up"><div className="panel-header"><h3>{copy.settings}</h3></div><div className="settings-grid"><article className="settings-card"><label className="settings-label" htmlFor="units">{copy.units}</label><select id="units" className="premium-select full-width" value={settings.units} onChange={(e) => setSettings((c) => ({ ...c, units: e.target.value }))}><option value="kg">kg</option><option value="lbs">lbs</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="lang">{copy.language}</label><select id="lang" className="premium-select full-width" value={settings.language} onChange={(e) => setSettings((c) => ({ ...c, language: e.target.value }))}><option value="sl">Slovenščina</option><option value="en">English</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="dateFormat">{copy.dateFormat}</label><select id="dateFormat" className="premium-select full-width" value={settings.dateFormat} onChange={(e) => setSettings((c) => ({ ...c, dateFormat: e.target.value }))}><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="backup">{copy.backupReminder}</label><select id="backup" className="premium-select full-width" value={settings.backupReminderDays} onChange={(e) => setSettings((c) => ({ ...c, backupReminderDays: Number(e.target.value) }))}><option value={3}>3 {copy.days}</option><option value={7}>7 {copy.days}</option><option value={14}>14 {copy.days}</option><option value={30}>30 {copy.days}</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="calorieGoal">{copy.calorieGoal}</label><input id="calorieGoal" type="number" min="1000" step="50" value={settings.calorieGoal} onChange={(e) => setSettings((c) => ({ ...c, calorieGoal: Number(e.target.value) || 2200 }))} /></article><article className="settings-card"><label className="settings-label" htmlFor="trackerMode">{copy.trackerMode}</label><select id="trackerMode" className="premium-select full-width" value={settings.calorieTrackerMode} onChange={(e) => setSettings((c) => ({ ...c, calorieTrackerMode: e.target.value }))}><option value="simple">{copy.simpleTracker}</option><option value="advanced">{copy.advancedTracker}</option></select></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.lastBackup}</span><p className="settings-copy">{settings.lastBackupAt ? formatDateValue(settings.lastBackupAt.slice(0, 10), settings.dateFormat) : copy.never}</p></div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={exportData}>{copy.export}</button><button className="action-btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>{copy.import}</button></div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.installApp}</span><p className="settings-copy">{copy.installAppDesc}</p></div><div>{isInStandaloneMode ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installDone}</span> : isIos ? <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>{copy.installIos}</span> : <button className="action-btn-outline" type="button" onClick={triggerInstall} disabled={!installPrompt}>{copy.installBtn}</button>}</div></div></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.showFeedbackBtn}</span><p className="settings-copy">{copy.showFeedbackBtnDesc}</p></div><button className="action-btn-outline" type="button" onClick={() => setSettings(c => ({...c, showFeedbackBtn: !c.showFeedbackBtn}))}>{settings.showFeedbackBtn ? '✓ On' : 'Off'}</button></div></article><article className="settings-card settings-card-wide danger-card"><div className="settings-actions"><div><span className="settings-title">{copy.clear}</span><p className="settings-copy">{copy.backupText}</p></div><button className="action-btn-outline danger-button" type="button" onClick={clearData}>{copy.clear}</button></div></article></div><input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importData} /></section>}
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







