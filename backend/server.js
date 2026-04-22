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

// JWT_SECRET je obvezen — brez njega se strežnik ne zažene
if (!process.env.JWT_SECRET) {
  console.error('NAPAKA: JWT_SECRET ni nastavljen v .env datoteki!');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_KEY = process.env.GEMINI_KEY || '';

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
app.use(express.json({ limit: '2mb' }));

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

// ── Prijava / Registracija ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  try {
    // bcrypt s 12 rundami — zaščita pred brute-force
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase().trim(), hash);
    db.prepare('INSERT INTO login_logs (email, type, ip) VALUES (?, ?, ?)').run(email, 'register', req.ip);
    const token = jwt.sign({ userId: result.lastInsertRowid, email: email.toLowerCase().trim() }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, email: email.toLowerCase().trim() });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'User already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Wrong password' });

  db.prepare('INSERT INTO login_logs (email, type, ip) VALUES (?, ?, ?)').run(email, 'login', req.ip);
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, email: user.email });
});

// ── Treningi ───────────────────────────────────────────────────────────────
app.get('/api/workouts', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC').all(req.user.userId);
  res.json(rows.map(w => ({ ...w, setDetails: JSON.parse(w.set_details), set_details: undefined })));
});

app.post('/api/workouts', requireAuth, (req, res) => {
  const { date, exercise, sets, weight, setDetails, notes } = req.body ?? {};
  if (!date || !exercise || sets == null || weight == null || !Array.isArray(setDetails)) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.prepare(
    'INSERT INTO workouts (user_id, date, exercise, sets, weight, set_details, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.userId, date, exercise, Number(sets), Number(weight), JSON.stringify(setDetails), notes || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/workouts/:id', requireAuth, (req, res) => {
  const { date, exercise, sets, weight, setDetails, notes } = req.body ?? {};
  if (!date || !exercise || sets == null || weight == null || !Array.isArray(setDetails)) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const result = db.prepare(
    'UPDATE workouts SET date=?, exercise=?, sets=?, weight=?, set_details=?, notes=? WHERE id=? AND user_id=?'
  ).run(date, exercise, Number(sets), Number(weight), JSON.stringify(setDetails), notes || '', req.params.id, req.user.userId);
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
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt required' });
  if (prompt.length > 2000) return res.status(400).json({ error: 'Prompt too long' });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
  if (!comment || !stars) return res.status(400).json({ error: 'Missing fields' });
  const result = db.prepare('INSERT INTO ratings (email, stars, comment, private_comment, date) VALUES (?, ?, ?, ?, ?)').run(req.user.email, Number(stars), comment, privateComment || '', date || new Date().toISOString().slice(0, 10));
  res.status(201).json({ id: result.lastInsertRowid });
});

// ── Bulk sync ──────────────────────────────────────────────────────────────
app.get('/api/sync', requireAuth, (req, res) => {
  const uid = req.user.userId;
  const workouts = db.prepare('SELECT id, date, exercise, sets, weight, set_details, notes FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC').all(uid)
    .map(w => ({ id: w.id, date: w.date, exercise: w.exercise, weight: w.weight, setDetails: JSON.parse(w.set_details || '[]'), comment: w.notes || '' }));
  const calories = db.prepare('SELECT id, date, meal_type, name, calories, protein, carbs, fat FROM calorie_entries WHERE user_id = ? ORDER BY date DESC, id DESC').all(uid)
    .map(e => ({ id: e.id, date: e.date, mealType: e.meal_type, name: e.name, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat }));
  const bodyWeight = db.prepare('SELECT id, date, weight FROM body_weight WHERE user_id = ? ORDER BY date ASC').all(uid);
  const restDays = db.prepare('SELECT date FROM rest_days WHERE user_id = ?').all(uid).map(r => r.date);
  const cheatDays = db.prepare('SELECT date FROM cheat_days WHERE user_id = ?').all(uid).map(r => r.date);
  const calHistory = db.prepare('SELECT id, date, name, grams, kcal_per_100, total FROM cal_history WHERE user_id = ? ORDER BY id DESC').all(uid)
    .map(h => ({ id: h.id, date: h.date, name: h.name, grams: h.grams, kcalPer100: h.kcal_per_100, total: h.total }));
  res.json({ workouts, calories, bodyWeight, restDays, cheatDays, calHistory });
});

// ── Admin endpointi ────────────────────────────────────────────────────────
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
