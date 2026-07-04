import {
  migrateAllUserData,
  migrateBodyWeightEntry,
  migrateCalorieEntry,
  migrateSettings,
  migrateWorkout,
  safeJsonParse,
  safeLocalStorageGet,
  safeLocalStorageSet,
} from '../utils/migrations.js';

export function readJson(key, fallback) {
  const parsed = safeJsonParse(safeLocalStorageGet(key, ''), undefined);
  return parsed === undefined || parsed === null ? fallback : parsed;
}

export function writeJson(key, value) {
  return safeLocalStorageSet(key, JSON.stringify(value));
}

export function readNumber(key, fallback = 0) {
  const value = Number(safeLocalStorageGet(key, ''));
  return Number.isFinite(value) ? value : fallback;
}

export function writeNumber(key, value) {
  return safeLocalStorageSet(key, String(Number(value) || 0));
}

export const storageKeys = {
  workouts: (email) => `powergraph_workouts_${email}`,
  meals: (email) => `powergraph_calories_${email}`,
  settings: (email) => `powergraph_settings_${email}`,
  bodyWeight: (email) => `powergraph_bodyweight_${email}`,
  bodyFat: (email) => `powergraph_bodyfat_${email}`,
  water: (email) => `powergraph_water_${email}`,
  rest: (email) => `powergraph_rest_${email}`,
  cheat: (email) => `powergraph_cheat_${email}`,
  customExercises: (email) => `powergraph_custom_ex_${email}`,
};

export function getWorkouts(email) {
  return readJson(storageKeys.workouts(email), []).map(migrateWorkout);
}

export function saveWorkouts(email, workouts) {
  writeJson(storageKeys.workouts(email), Array.isArray(workouts) ? workouts.map(migrateWorkout) : []);
}

export function getMeals(email) {
  return readJson(storageKeys.meals(email), []).map(migrateCalorieEntry);
}

export function saveMeals(email, meals) {
  writeJson(storageKeys.meals(email), Array.isArray(meals) ? meals.map(migrateCalorieEntry) : []);
}

export function exportBackup(email) {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    email,
    workouts: getWorkouts(email),
    calorieEntries: getMeals(email),
    settings: migrateSettings(readJson(storageKeys.settings(email), {})),
    bodyWeightEntries: readJson(storageKeys.bodyWeight(email), []).map(migrateBodyWeightEntry),
    bodyFatHistory: readJson(storageKeys.bodyFat(email), []),
    waterToday: readNumber(storageKeys.water(email), 0),
    restDays: readJson(storageKeys.rest(email), []),
    cheatDays: readJson(storageKeys.cheat(email), []),
    customExercises: readJson(storageKeys.customExercises(email), []),
  };
}

export function importBackup(email, backup) {
  if (!backup || typeof backup !== 'object') return false;
  const migrated = migrateAllUserData(backup);
  if (Array.isArray(backup.workouts)) saveWorkouts(email, migrated.workouts);
  if (Array.isArray(backup.calorieEntries)) saveMeals(email, migrated.calorieEntries);
  if (backup.settings && typeof backup.settings === 'object') writeJson(storageKeys.settings(email), migrated.settings);
  if (Array.isArray(backup.bodyWeightEntries)) writeJson(storageKeys.bodyWeight(email), migrated.bodyWeightEntries);
  if (Array.isArray(backup.bodyFatHistory)) writeJson(storageKeys.bodyFat(email), backup.bodyFatHistory);
  if (Array.isArray(backup.restDays)) writeJson(storageKeys.rest(email), migrated.restDays);
  if (Array.isArray(backup.cheatDays)) writeJson(storageKeys.cheat(email), migrated.cheatDays);
  if (Array.isArray(backup.customExercises)) writeJson(storageKeys.customExercises(email), backup.customExercises);
  if (Number.isFinite(Number(backup.waterToday))) writeNumber(storageKeys.water(email), backup.waterToday);
  return true;
}
