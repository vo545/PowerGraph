import { dateOffsetKey } from './dates.js';

function isValidDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getRecentDateSet(days = 7) {
  return new Set(Array.from({ length: Math.max(1, days) }, (_, index) => dateOffsetKey(-index)));
}

export function getRecentWorkouts(workouts = [], days = 7) {
  const recentDates = getRecentDateSet(days);
  return workouts.filter((workout) => recentDates.has(workout.date));
}

export function calculateWeeklyWorkoutCount(workouts = []) {
  return getRecentWorkouts(workouts, 7).length;
}

export function calculateBodyWeightTrend(entries = []) {
  const sorted = [...entries]
    .filter((entry) => isValidDateKey(entry.date) && Number.isFinite(Number(entry.weight)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length < 2) return { delta: 0, direction: 'flat', label: '-' };
  const latest = sorted.at(-1);
  const previous = [...sorted].reverse().find((entry) => entry.date !== latest.date) || sorted.at(-2);
  const delta = Number((Number(latest.weight) - Number(previous.weight)).toFixed(1));
  return {
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    label: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`,
  };
}
