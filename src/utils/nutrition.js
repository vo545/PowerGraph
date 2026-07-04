function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function sumNutritionTotals(entries = []) {
  return entries.reduce((acc, entry) => ({
    calories: acc.calories + Number(entry.calories || 0),
    protein: acc.protein + Number(entry.protein || 0),
    carbs: acc.carbs + Number(entry.carbs || 0),
    fat: acc.fat + Number(entry.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function calculateMacroTargets(calories, bodyWeightKg = 75) {
  const targetCalories = Math.max(1200, Number(calories) || 2200);
  const weightKg = clampNumber(bodyWeightKg || 75, 35, 250);
  const proteinCeiling = Math.max(70, (targetCalories * 0.35) / 4);
  const protein = Math.round(Math.min(Math.max(weightKg * 1.8, 80), proteinCeiling));
  const fatFloor = Math.max(45, weightKg * 0.6);
  const fatCeiling = Math.max(fatFloor, (targetCalories * 0.35) / 9);
  const fat = Math.round(clampNumber((targetCalories * 0.25) / 9, fatFloor, fatCeiling));
  const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4));
  return { calories: Math.round(targetCalories), protein, carbs, fat };
}

export function createDailyControlSummary({
  sortedWorkouts = [],
  todayKey = '',
  todayWorkouts = [],
  restDays = [],
  calorieGoal = 2200,
  todayTotals = {},
  waterToday = 0,
  waterGoalMl = 2500,
  language = 'en',
  bodyWeightKg = 75,
}) {
  const lastWorkoutDate = sortedWorkouts[0]?.date || '';
  const daysSinceWorkout = lastWorkoutDate ? Math.max(0, Math.floor((new Date(todayKey) - new Date(lastWorkoutDate)) / 86400000)) : null;
  const trainedToday = todayWorkouts.length > 0;
  const restToday = restDays.includes(todayKey);
  const targetCalories = Math.max(1, Number(calorieGoal) || 2200);
  const calorieDelta = Math.round(targetCalories - Number(todayTotals.calories || 0));
  const caloriePct = Math.min(120, Math.round((Number(todayTotals.calories || 0) / targetCalories) * 100));
  const calorieAccuracy = Number(todayTotals.calories || 0) > 0
    ? Math.max(0, 100 - Math.min(100, Math.abs(calorieDelta) / targetCalories * 100))
    : 35;
  const hydrationPct = Math.min(120, Math.round((Number(waterToday || 0) / Math.max(1, waterGoalMl)) * 100));
  const macroTargets = calculateMacroTargets(targetCalories, bodyWeightKg);
  const proteinPct = Math.min(120, Math.round((Number(todayTotals.protein || 0) / Math.max(1, macroTargets.protein)) * 100));
  const carbsPct = Math.min(120, Math.round((Number(todayTotals.carbs || 0) / Math.max(1, macroTargets.carbs)) * 100));
  const fatPct = Math.min(120, Math.round((Number(todayTotals.fat || 0) / Math.max(1, macroTargets.fat)) * 100));
  const macroScore = Number(todayTotals.protein || 0) > 0 ? Math.min(100, proteinPct) : 60;
  const trainingScore = trainedToday ? 100 : restToday ? 82 : daysSinceWorkout === null ? 45 : daysSinceWorkout <= 1 ? 70 : daysSinceWorkout <= 3 ? 55 : 35;
  const score = Math.round(clampNumber(trainingScore * 0.35 + Math.min(100, hydrationPct) * 0.25 + calorieAccuracy * 0.25 + macroScore * 0.15, 0, 100));
  const label = score >= 85 ? 'locked in' : score >= 65 ? 'on track' : score >= 45 ? 'needs attention' : 'reset day';
  const isSl = language === 'sl';
  const trainingText = trainedToday
    ? isSl
      ? `${todayWorkouts.length} ${todayWorkouts.length === 1 ? 'trening' : 'treningov'} danes`
      : `${todayWorkouts.length} ${todayWorkouts.length === 1 ? 'session' : 'sessions'} logged`
    : restToday
      ? (isSl ? 'pocitek oznacen' : 'rest day marked')
      : daysSinceWorkout === null
        ? (isSl ? 'se brez treningov' : 'no sessions yet')
        : (isSl ? `${daysSinceWorkout} dni od treninga` : `${daysSinceWorkout}d since training`);
  let coachingMessage = isSl
    ? 'Najprej dodaj majhen zanesljiv vnos: trening, obrok ali vodo.'
    : 'Start with one reliable input: training, a meal, or water.';
  if (restToday) coachingMessage = isSl ? 'Dober dan za regeneracijo. Voda in beljakovine naj ostanejo stabilne.' : 'Good day to recover. Keep water and protein steady.';
  else if (trainedToday && hydrationPct < 70) coachingMessage = isSl ? 'Trening je vpisan. Zdaj dvigni hidracijo proti cilju.' : 'Training is logged. Bring hydration closer to target next.';
  else if (proteinPct < 55 && Number(todayTotals.calories || 0) > 400) coachingMessage = isSl ? 'Beljakovine so danes nizke. Naslednji obrok naj bo bolj beljakovinski.' : 'Protein is low today. Make the next meal protein-led.';
  else if (!trainedToday) coachingMessage = isSl ? 'Ce danes treniras, vpisi prvo vajo. Ce je pocitek, ga oznaci.' : 'If you train today, log the first exercise. If it is recovery, mark rest day.';
  else if (Math.abs(calorieDelta) <= 150 && hydrationPct >= 85) coachingMessage = isSl ? 'Dan je dobro poravnan: kalorije in voda sta blizu cilja.' : 'You are on track today.';
  else if (calorieDelta < -250) coachingMessage = isSl ? 'Kalorije so nad ciljem. Naslednji obrok naj bo lahek in beljakovinski.' : 'Calories are above target. Make the next meal lighter and protein-led.';
  else if (calorieDelta > 500) coachingMessage = isSl ? 'Imas se precej prostora za kakovosten obrok.' : 'You still have room for a solid quality meal.';

  return {
    score,
    label,
    hydrationPct,
    calorieDelta,
    caloriePct,
    proteinPct,
    carbsPct,
    fatPct,
    trainingText,
    coachingMessage,
    macroTargets,
    waterGoalMl,
  };
}
