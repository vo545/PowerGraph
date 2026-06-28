export function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readNumber(key, fallback = 0) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

export function writeNumber(key, value) {
  localStorage.setItem(key, String(Number(value) || 0));
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
  return readJson(storageKeys.workouts(email), []);
}

export function saveWorkouts(email, workouts) {
  writeJson(storageKeys.workouts(email), Array.isArray(workouts) ? workouts : []);
}

export function getMeals(email) {
  return readJson(storageKeys.meals(email), []);
}

export function saveMeals(email, meals) {
  writeJson(storageKeys.meals(email), Array.isArray(meals) ? meals : []);
}

export function exportBackup(email) {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    email,
    workouts: getWorkouts(email),
    calorieEntries: getMeals(email),
    settings: readJson(storageKeys.settings(email), {}),
    bodyWeightEntries: readJson(storageKeys.bodyWeight(email), []),
    bodyFatHistory: readJson(storageKeys.bodyFat(email), []),
    waterToday: readNumber(storageKeys.water(email), 0),
    restDays: readJson(storageKeys.rest(email), []),
    cheatDays: readJson(storageKeys.cheat(email), []),
    customExercises: readJson(storageKeys.customExercises(email), []),
  };
}

export function importBackup(email, backup) {
  if (!backup || typeof backup !== 'object') return false;
  if (Array.isArray(backup.workouts)) saveWorkouts(email, backup.workouts);
  if (Array.isArray(backup.calorieEntries)) saveMeals(email, backup.calorieEntries);
  if (backup.settings && typeof backup.settings === 'object') writeJson(storageKeys.settings(email), backup.settings);
  if (Array.isArray(backup.bodyWeightEntries)) writeJson(storageKeys.bodyWeight(email), backup.bodyWeightEntries);
  if (Array.isArray(backup.bodyFatHistory)) writeJson(storageKeys.bodyFat(email), backup.bodyFatHistory);
  if (Array.isArray(backup.restDays)) writeJson(storageKeys.rest(email), backup.restDays);
  if (Array.isArray(backup.cheatDays)) writeJson(storageKeys.cheat(email), backup.cheatDays);
  if (Array.isArray(backup.customExercises)) writeJson(storageKeys.customExercises(email), backup.customExercises);
  if (Number.isFinite(Number(backup.waterToday))) writeNumber(storageKeys.water(email), backup.waterToday);
  return true;
}
