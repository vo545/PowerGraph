'use strict';

// node:sqlite je stabilen od Node.js 24 — brez zunanjih odvisnosti
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '14d';
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = Number(process.env.AUTH_MAX_ATTEMPTS || 8);
const authAttempts = new Map();
const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

// JWT_SECRET je obvezen — brez njega se strežnik ne zažene
if (!process.env.JWT_SECRET) {
  console.error('NAPAKA: JWT_SECRET ni nastavljen v .env datoteki!');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_KEY = process.env.GEMINI_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// ── Baza podatkov ──────────────────────────────────────────────────────────
const db = new DatabaseSync(process.env.DB_PATH || 'powergraph.db');
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    exercise TEXT NOT NULL,
    sets INTEGER NOT NULL,
    weight REAL NOT NULL,
    set_details TEXT NOT NULL,
    notes TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS body_weight (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS calorie_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT DEFAULT 'breakfast',
    name TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    grams REAL NOT NULL,
    kcal_per_100 REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rest_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cheat_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    ip TEXT
  );
`);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '6mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : '';
}

function rateLimitAuth(req, res, next) {
  const email = normalizeEmail(req.body?.email) || 'unknown';
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${ip}:${email}`;
  const now = Date.now();
  const current = authAttempts.get(key) || { count: 0, resetAt: now + AUTH_WINDOW_MS };
  if (current.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    next();
    return;
  }
  if (current.count >= AUTH_MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' });
    return;
  }
  current.count += 1;
  authAttempts.set(key, current);
  next();
}

function clearAuthLimit(req) {
  const email = normalizeEmail(req.body?.email) || 'unknown';
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  authAttempts.delete(`${ip}:${email}`);
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL || req.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function parseWorkoutSets(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return { setDetails: parsed };
    if (parsed && Array.isArray(parsed.reps)) {
      return {
        setDetails: parsed.reps,
        ...(Array.isArray(parsed.weights) ? { setWeights: parsed.weights } : {}),
      };
    }
  } catch {}
  return { setDetails: [] };
}

function serializeWorkoutSets(setDetails, setWeights) {
  const reps = Array.isArray(setDetails) ? setDetails.map(Number).filter(v => v > 0) : [];
  const weights = Array.isArray(setWeights) ? setWeights.map(Number).filter(v => v > 0) : [];
  return JSON.stringify(weights.length ? { reps, weights } : reps);
}

function asCleanDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asPositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function asBoundedNumber(value, min, max, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function insertWithOptionalId(stmtWithId, stmtWithoutId, id, values) {
  if (id) {
    try {
      stmtWithId.run(id, ...values);
      return;
    } catch {}
  }
  stmtWithoutId.run(...values);
}

function normalizeGeminiParts(body) {
  const incoming = Array.isArray(body?.parts)
    ? body.parts
    : (typeof body?.prompt === 'string' ? [{ text: body.prompt }] : null);
  if (!incoming || incoming.length === 0 || incoming.length > 10) return null;

  let textChars = 0;
  let imageChars = 0;
  const parts = [];
  for (const part of incoming) {
    if (typeof part?.text === 'string') {
      const text = part.text.trim();
      if (!text) continue;
      textChars += text.length;
      if (textChars > 10000) return null;
      parts.push({ text });
      continue;
    }

    const inline = part?.inlineData;
    if (inline && typeof inline.data === 'string' && typeof inline.mimeType === 'string') {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(inline.mimeType)) return null;
      if (!/^[A-Za-z0-9+/=]+$/.test(inline.data)) return null;
      imageChars += inline.data.length;
      if (imageChars > 5_500_000) return null;
      parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
    }
  }
  return parts.length ? parts : null;
}

function normalizeGenerationConfig(body) {
  const raw = body?.generationConfig;
  if (!raw || typeof raw !== 'object') return null;
  const config = {};
  const temperature = Number(raw.temperature);
  const maxOutputTokens = Number(raw.maxOutputTokens);
  if (Number.isFinite(temperature)) config.temperature = Math.min(1, Math.max(0, temperature));
  if (Number.isFinite(maxOutputTokens)) config.maxOutputTokens = Math.min(4096, Math.max(64, Math.round(maxOutputTokens)));
  if (raw.responseMimeType === 'application/json' || raw.responseMimeType === 'text/plain') {
    config.responseMimeType = raw.responseMimeType;
  }
  return Object.keys(config).length ? config : null;
}

// ── Prijava / Registracija ─────────────────────────────────────────────────
app.post('/api/auth/register', rateLimitAuth, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 10 || password.length > 256) return res.status(400).json({ error: 'Password does not meet policy' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  try {
    // bcrypt s 12 rundami — zaščita pred brute-force
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    db.prepare('INSERT INTO login_logs (email, type, ip) VALUES (?, ?, ?)').run(email, 'register', req.ip);
    clearAuthLimit(req);
    const token = jwt.sign({ userId: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, email });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Unable to create account' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', rateLimitAuth, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Email or password is incorrect' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Email or password is incorrect' });

  db.prepare('INSERT INTO login_logs (email, type, ip) VALUES (?, ?, ?)').run(email, 'login', req.ip);
  clearAuthLimit(req);
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, email: user.email });
});

// ── Treningi ───────────────────────────────────────────────────────────────
app.get('/api/workouts', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.userId);
  res.json(rows.map(w => ({ ...w, ...parseWorkoutSets(w.set_details), set_details: undefined })));
});

app.post('/api/workouts', requireAuth, (req, res) => {
  const { date, exercise, sets, weight, setDetails, setWeights, notes } = req.body ?? {};
  if (!date || !exercise || sets == null || weight == null || !Array.isArray(setDetails)) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.prepare(
    'INSERT INTO workouts (user_id, date, exercise, sets, weight, set_details, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.userId, date, exercise, Number(sets), Number(weight), serializeWorkoutSets(setDetails, setWeights), notes || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/workouts/:id', requireAuth, (req, res) => {
  const { date, exercise, sets, weight, setDetails, setWeights, notes } = req.body ?? {};
  if (!date || !exercise || sets == null || weight == null || !Array.isArray(setDetails)) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.prepare(
    'UPDATE workouts SET date=?, exercise=?, sets=?, weight=?, set_details=?, notes=? WHERE id=? AND user_id=?'
  ).run(date, exercise, Number(sets), Number(weight), serializeWorkoutSets(setDetails, setWeights), notes || '', req.params.id, req.user.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/workouts/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM workouts WHERE id=? AND user_id=?').run(req.params.id, req.user.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── Telesna teža ───────────────────────────────────────────────────────────
app.get('/api/body-weight', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id, date, weight FROM body_weight WHERE user_id = ? ORDER BY date ASC').all(req.user.userId));
});

app.post('/api/body-weight', requireAuth, (req, res) => {
  const { date, weight } = req.body ?? {};
  if (!date || weight == null) return res.status(400).json({ error: 'Missing fields' });
  const result = db.prepare('INSERT OR REPLACE INTO body_weight (user_id, date, weight) VALUES (?, ?, ?)').run(req.user.userId, date, Number(weight));
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/body-weight/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM body_weight WHERE id=? AND user_id=?').run(req.params.id, req.user.userId);
  res.json({ ok: true });
});

// ── Kalorije ───────────────────────────────────────────────────────────────
app.get('/api/calories', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM calorie_entries WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.userId);
  res.json(rows.map(e => ({ ...e, mealType: e.meal_type, meal_type: undefined })));
});

app.post('/api/calories', requireAuth, (req, res) => {
  const { date, mealType, name, calories, protein, carbs, fat } = req.body ?? {};
  if (!date || !name || calories == null) return res.status(400).json({ error: 'Missing fields' });
  const result = db.prepare(
    'INSERT INTO calorie_entries (user_id, date, meal_type, name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.userId, date, mealType || 'breakfast', name, Number(calories), Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/calories/:id', requireAuth, (req, res) => {
  const { date, mealType, name, calories, protein, carbs, fat } = req.body ?? {};
  if (!date || !name || calories == null) return res.status(400).json({ error: 'Missing fields' });
  const result = db.prepare(
    'UPDATE calorie_entries SET date=?, meal_type=?, name=?, calories=?, protein=?, carbs=?, fat=? WHERE id=? AND user_id=?'
  ).run(date, mealType || 'breakfast', name, Number(calories), Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0, req.params.id, req.user.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/calories/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM calorie_entries WHERE id=? AND user_id=?').run(req.params.id, req.user.userId);
  res.json({ ok: true });
});

// ── Kalorimeter – zgodovina iskanj ─────────────────────────────────────────
app.get('/api/cal-history', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM cal_history WHERE user_id = ? ORDER BY id DESC').all(req.user.userId));
});

app.post('/api/cal-history', requireAuth, (req, res) => {
  const { date, name, grams, kcalPer100, total } = req.body ?? {};
  if (!date || !name || grams == null || kcalPer100 == null || total == null) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.prepare(
    'INSERT INTO cal_history (user_id, date, name, grams, kcal_per_100, total) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.userId, date, name, Number(grams), Number(kcalPer100), Number(total));
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/cal-history', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cal_history WHERE user_id=?').run(req.user.userId);
  res.json({ ok: true });
});

// ── Počitniški dnevi ───────────────────────────────────────────────────────
app.get('/api/rest-days', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT date FROM rest_days WHERE user_id = ?').all(req.user.userId).map(r => r.date));
});

app.post('/api/rest-days', requireAuth, (req, res) => {
  const { date } = req.body ?? {};
  if (!date) return res.status(400).json({ error: 'Date required' });
  try { db.prepare('INSERT INTO rest_days (user_id, date) VALUES (?, ?)').run(req.user.userId, date); } catch {}
  res.status(201).json({ ok: true });
});

app.delete('/api/rest-days/:date', requireAuth, (req, res) => {
  db.prepare('DELETE FROM rest_days WHERE user_id=? AND date=?').run(req.user.userId, req.params.date);
  res.json({ ok: true });
});

// ── Goljufivi dnevi ────────────────────────────────────────────────────────
app.get('/api/cheat-days', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT date FROM cheat_days WHERE user_id = ?').all(req.user.userId).map(r => r.date));
});

app.post('/api/cheat-days', requireAuth, (req, res) => {
  const { date } = req.body ?? {};
  if (!date) return res.status(400).json({ error: 'Date required' });
  try { db.prepare('INSERT INTO cheat_days (user_id, date) VALUES (?, ?)').run(req.user.userId, date); } catch {}
  res.status(201).json({ ok: true });
});

app.delete('/api/cheat-days/:date', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cheat_days WHERE user_id=? AND date=?').run(req.user.userId, req.params.date);
  res.json({ ok: true });
});

// ── Gemini proxy (API ključ ostane na strežniku!) ──────────────────────────
app.post('/api/gemini', requireAuth, async (req, res) => {
  if (!GEMINI_KEY) return res.status(503).json({ error: 'Gemini not configured' });
  const parts = normalizeGeminiParts(req.body);
  if (!parts) return res.status(400).json({ error: 'Invalid Gemini payload' });
  const generationConfig = normalizeGenerationConfig(req.body);

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          ...(generationConfig ? { generationConfig } : {}),
        }),
      }
    );
    const data = await r.json();
    res.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' });
  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ error: 'Gemini error' });
  }
});

// ── Ratings ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    stars INTEGER NOT NULL,
    comment TEXT NOT NULL,
    private_comment TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

app.get('/api/ratings', requireAuth, (req, res) => {
  if (req.user.email.toLowerCase() === (ADMIN_EMAIL || '').toLowerCase()) {
    res.json(db.prepare('SELECT id, email, stars, comment, private_comment as privateComment, date FROM ratings ORDER BY id DESC').all());
  } else {
    res.json(db.prepare('SELECT id, email, stars, comment, date FROM ratings WHERE email=? ORDER BY id DESC').all(req.user.email));
  }
});

app.post('/api/ratings', requireAuth, (req, res) => {
  const { stars, comment, privateComment, date } = req.body ?? {};
  const cleanStars = Math.round(asBoundedNumber(stars, 1, 5, 0));
  const cleanComment = typeof comment === 'string' ? comment.trim().slice(0, 1200) : '';
  const cleanPrivate = typeof privateComment === 'string' ? privateComment.trim().slice(0, 1200) : '';
  const cleanDate = asCleanDate(date) || new Date().toISOString().slice(0, 10);
  if (!cleanComment || !cleanStars) return res.status(400).json({ error: 'Missing fields' });
  const result = db.prepare('INSERT INTO ratings (email, stars, comment, private_comment, date) VALUES (?, ?, ?, ?, ?)').run(req.user.email, cleanStars, cleanComment, cleanPrivate, cleanDate);
  res.status(201).json({ id: result.lastInsertRowid });
});

// ── Bulk sync ──────────────────────────────────────────────────────────────
app.get('/api/sync', requireAuth, (req, res) => {
  const uid = req.user.userId;
  const workouts = db.prepare('SELECT id, date, exercise, sets, weight, set_details, notes FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC').all(uid)
    .map(w => ({ id: w.id, date: w.date, exercise: w.exercise, weight: w.weight, ...parseWorkoutSets(w.set_details), comment: w.notes || '' }));
  const calories = db.prepare('SELECT id, date, meal_type, name, calories, protein, carbs, fat FROM calorie_entries WHERE user_id = ? ORDER BY date DESC, id DESC').all(uid)
    .map(e => ({ id: e.id, date: e.date, mealType: e.meal_type, name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat }));
  const bodyWeight = db.prepare('SELECT id, date, weight FROM body_weight WHERE user_id = ? ORDER BY date ASC').all(uid);
  const restDays = db.prepare('SELECT date FROM rest_days WHERE user_id = ?').all(uid).map(r => r.date);
  const cheatDays = db.prepare('SELECT date FROM cheat_days WHERE user_id = ?').all(uid).map(r => r.date);
  const calHistory = db.prepare('SELECT id, date, name, grams, kcal_per_100, total FROM cal_history WHERE user_id = ? ORDER BY id DESC').all(uid)
    .map(h => ({ id: h.id, date: h.date, name: h.name, grams: h.grams, kcalPer100: h.kcal_per_100, total: h.total }));
  res.json({ workouts, calories, bodyWeight, restDays, cheatDays, calHistory });
});

// Bulk sync write
app.post('/api/sync', requireAuth, (req, res) => {
  const uid = req.user.userId;
  const body = req.body ?? {};
  const workouts = Array.isArray(body.workouts) ? body.workouts : [];
  const calories = Array.isArray(body.calorieEntries) ? body.calorieEntries : (Array.isArray(body.calories) ? body.calories : []);
  const bodyWeight = Array.isArray(body.bodyWeightEntries) ? body.bodyWeightEntries : (Array.isArray(body.bodyWeight) ? body.bodyWeight : []);
  const restDays = Array.isArray(body.restDays) ? body.restDays : [];
  const cheatDays = Array.isArray(body.cheatDays) ? body.cheatDays : [];
  const calHistory = Array.isArray(body.calHistory) ? body.calHistory : [];
  const limits = { workouts: 5000, calories: 10000, bodyWeight: 5000, restDays: 5000, cheatDays: 5000, calHistory: 10000 };
  if (
    workouts.length > limits.workouts ||
    calories.length > limits.calories ||
    bodyWeight.length > limits.bodyWeight ||
    restDays.length > limits.restDays ||
    cheatDays.length > limits.cheatDays ||
    calHistory.length > limits.calHistory
  ) {
    return res.status(413).json({ error: 'Sync payload too large' });
  }

  const workoutWithId = db.prepare('INSERT INTO workouts (id, user_id, date, exercise, sets, weight, set_details, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const workoutWithoutId = db.prepare('INSERT INTO workouts (user_id, date, exercise, sets, weight, set_details, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const calorieWithId = db.prepare('INSERT INTO calorie_entries (id, user_id, date, meal_type, name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const calorieWithoutId = db.prepare('INSERT INTO calorie_entries (user_id, date, meal_type, name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const bodyWeightWithId = db.prepare('INSERT INTO body_weight (id, user_id, date, weight) VALUES (?, ?, ?, ?)');
  const bodyWeightWithoutId = db.prepare('INSERT INTO body_weight (user_id, date, weight) VALUES (?, ?, ?)');
  const calHistoryWithId = db.prepare('INSERT INTO cal_history (id, user_id, date, name, grams, kcal_per_100, total) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const calHistoryWithoutId = db.prepare('INSERT INTO cal_history (user_id, date, name, grams, kcal_per_100, total) VALUES (?, ?, ?, ?, ?, ?)');
  const insertRestDay = db.prepare('INSERT OR IGNORE INTO rest_days (user_id, date) VALUES (?, ?)');
  const insertCheatDay = db.prepare('INSERT OR IGNORE INTO cheat_days (user_id, date) VALUES (?, ?)');

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM workouts WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM calorie_entries WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM body_weight WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM rest_days WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM cheat_days WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM cal_history WHERE user_id=?').run(uid);

    workouts.forEach((w) => {
      const date = asCleanDate(w.date);
      const exercise = typeof w.exercise === 'string' ? w.exercise.trim().slice(0, 120) : '';
      const setDetails = Array.isArray(w.setDetails) ? w.setDetails.map(v => Math.round(asBoundedNumber(v, 1, 500, 0))).filter(v => v > 0).slice(0, 50) : [];
      if (!date || !exercise || !setDetails.length) return;
      const setWeights = Array.isArray(w.setWeights) ? w.setWeights.map(v => asBoundedNumber(v, 0, 1000, 0)).slice(0, 50) : null;
      const weight = asBoundedNumber(w.weight, 0, 1000, 0);
      const notes = String(w.comment ?? w.notes ?? '').slice(0, 1200);
      insertWithOptionalId(
        workoutWithId,
        workoutWithoutId,
        asPositiveId(w.id),
        [uid, date, exercise, setDetails.length, weight, serializeWorkoutSets(setDetails, setWeights), notes]
      );
    });

    calories.forEach((entry) => {
      const date = asCleanDate(entry.date);
      const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 160) : '';
      if (!date || !name) return;
      const mealType = String(entry.mealType || entry.meal_type || 'breakfast').slice(0, 40);
      insertWithOptionalId(
        calorieWithId,
        calorieWithoutId,
        asPositiveId(entry.id),
        [
          uid,
          date,
          VALID_MEAL_TYPES.has(mealType) ? mealType : 'snack',
          name,
          asBoundedNumber(entry.calories, 0, 20000, 0),
          asBoundedNumber(entry.protein, 0, 1000, 0),
          asBoundedNumber(entry.carbs, 0, 2000, 0),
          asBoundedNumber(entry.fat, 0, 1000, 0),
        ]
      );
    });

    const seenBodyDates = new Set();
    bodyWeight.forEach((entry) => {
      const date = asCleanDate(entry.date);
      const weight = asBoundedNumber(entry.weight, 20, 400, NaN);
      if (!Number.isFinite(weight)) return;
      if (!date || seenBodyDates.has(date)) return;
      seenBodyDates.add(date);
      insertWithOptionalId(
        bodyWeightWithId,
        bodyWeightWithoutId,
        asPositiveId(entry.id),
        [uid, date, weight]
      );
    });

    [...new Set(restDays)].forEach((date) => {
      if (asCleanDate(date)) insertRestDay.run(uid, date);
    });
    [...new Set(cheatDays)].forEach((date) => {
      if (asCleanDate(date)) insertCheatDay.run(uid, date);
    });

    calHistory.forEach((entry) => {
      const date = asCleanDate(entry.date);
      const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 160) : '';
      if (!date || !name) return;
      insertWithOptionalId(
        calHistoryWithId,
        calHistoryWithoutId,
        asPositiveId(entry.id),
        [
          uid,
          date,
          name,
          asBoundedNumber(entry.grams, 0, 20000, 0),
          asBoundedNumber(entry.kcalPer100 ?? entry.kcal_per_100, 0, 2000, 0),
          asBoundedNumber(entry.total, 0, 50000, 0),
        ]
      );
    });

    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Admin endpoints
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, created_at FROM users ORDER BY created_at DESC').all();
  const enriched = users.map(u => {
    const workouts = db.prepare('SELECT COUNT(*) as c FROM workouts WHERE user_id=?').get(u.id).c;
    const meals = db.prepare('SELECT COUNT(*) as c FROM calorie_entries WHERE user_id=?').get(u.id).c;
    const lastRow = db.prepare('SELECT date FROM workouts WHERE user_id=? ORDER BY date DESC LIMIT 1').get(u.id);
    const lastWorkout = lastRow ? lastRow.date : null;
    const daysSinceLast = lastWorkout ? Math.floor((Date.now() - new Date(lastWorkout)) / 86400000) : null;
    return { ...u, workouts, meals, lastWorkout, daysSinceLast };
  });
  res.json(enriched);
});

app.get('/api/admin/logs', requireAuth, requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 200').all());
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PowerGraph API teče na http://localhost:${PORT}`);
  console.log(`Admin: ${ADMIN_EMAIL || '(ni nastavljen)'}`);
});
