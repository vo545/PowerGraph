export const DATA_SCHEMA_VERSION = 5;

export function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function isLocalStorageAvailable() {
  try {
    const key = '__powergraph_storage_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageGet(key, fallback = '') {
  try {
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getDefaultSettings(overrides = {}) {
  return {
    units: 'kg',
    language: 'en',
    backgroundAccent: 'blue',
    appearanceVersion: 2,
    primaryColor: '#000000',
    secondaryColor: '#0b1f4d',
    secondaryColor2: '#123a7a',
    secondaryColorCount: 1,
    backgroundPattern: 'grid',
    dateFormat: 'DD.MM.YYYY',
    backupReminderDays: 7,
    lastBackupAt: '',
    calorieGoal: 2200,
    waterGoalMl: 2500,
    calorieTrackerMode: 'simple',
    weightDrop: false,
    gender: 'male',
    age: '',
    height: '',
    showFeedbackBtn: true,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    ...overrides,
  };
}

function cleanDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function cleanNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function migrateSettings(input = {}) {
  const previous = input && typeof input === 'object' ? input : {};
  return getDefaultSettings({
    ...previous,
    units: previous.units === 'lbs' ? 'lbs' : 'kg',
    language: typeof previous.language === 'string' ? previous.language : 'en',
    backupReminderDays: [3, 7, 14, 30].includes(Number(previous.backupReminderDays)) ? Number(previous.backupReminderDays) : 7,
    calorieGoal: cleanNumber(previous.calorieGoal, 1000, 10000, 2200),
    waterGoalMl: cleanNumber(previous.waterGoalMl, 1000, 8000, 2500),
    calorieTrackerMode: previous.calorieTrackerMode === 'advanced' ? 'advanced' : 'simple',
    weightDrop: Boolean(previous.weightDrop),
    showFeedbackBtn: previous.showFeedbackBtn !== false,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
  });
}

export function migrateWorkout(workout = {}, index = 0) {
  const setDetails = (Array.isArray(workout.setDetails) ? workout.setDetails : [])
    .map((value) => Math.round(cleanNumber(value, 1, 500, 0)))
    .filter(Boolean)
    .slice(0, 50);
  const setWeights = Array.isArray(workout.setWeights)
    ? workout.setWeights.map((value) => cleanNumber(value, 0, 1000, 0)).slice(0, setDetails.length)
    : undefined;
  return {
    ...workout,
    id: Number.isSafeInteger(Number(workout.id)) ? Number(workout.id) : Date.now() + index,
    date: cleanDate(workout.date),
    exercise: cleanText(workout.exercise, 120) || 'Workout',
    weight: cleanNumber(workout.weight, 0, 1000, 0),
    setDetails: setDetails.length ? setDetails : [1],
    ...(setWeights?.length ? { setWeights } : {}),
    ...(cleanText(workout.comment || workout.notes, 1200) ? { comment: cleanText(workout.comment || workout.notes, 1200) } : {}),
  };
}

export function migrateCalorieEntry(entry = {}, index = 0) {
  const mealTypes = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'other']);
  const mealType = mealTypes.has(entry.mealType) ? entry.mealType : 'snack';
  return {
    ...entry,
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date: cleanDate(entry.date),
    mealType,
    name: cleanText(entry.name, 160) || 'Meal',
    calories: cleanNumber(entry.calories, 0, 20000, 0),
    protein: cleanNumber(entry.protein, 0, 1000, 0),
    carbs: cleanNumber(entry.carbs, 0, 2000, 0),
    fat: cleanNumber(entry.fat, 0, 1000, 0),
  };
}

export function migrateBodyWeightEntry(entry = {}, index = 0) {
  return {
    ...entry,
    id: Number.isSafeInteger(Number(entry.id)) ? Number(entry.id) : Date.now() + index,
    date: cleanDate(entry.date),
    weight: cleanNumber(entry.weight, 20, 400, 75),
  };
}

export function migrateAllUserData(data = {}) {
  return {
    ...data,
    settings: migrateSettings(data.settings || {}),
    workouts: Array.isArray(data.workouts) ? data.workouts.map(migrateWorkout) : [],
    calorieEntries: Array.isArray(data.calorieEntries) ? data.calorieEntries.map(migrateCalorieEntry) : [],
    bodyWeightEntries: Array.isArray(data.bodyWeightEntries) ? data.bodyWeightEntries.map(migrateBodyWeightEntry) : [],
    restDays: Array.isArray(data.restDays) ? [...new Set(data.restDays.filter((date) => typeof date === 'string'))] : [],
    cheatDays: Array.isArray(data.cheatDays) ? [...new Set(data.cheatDays.filter((date) => typeof date === 'string'))] : [],
    dataSchemaVersion: DATA_SCHEMA_VERSION,
  };
}
