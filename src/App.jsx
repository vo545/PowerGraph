import { useEffect, useMemo, useRef, useState } from 'react';
import { CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const WORKOUTS_KEY_PREFIX = 'powergraph_workouts_';
const CALORIES_KEY_PREFIX = 'powergraph_calories_';
const THEME_KEY = 'powergraph_theme';
const SETTINGS_KEY_PREFIX = 'powergraph_settings_';
const USERS_KEY = 'powergraph_users';
const SESSION_KEY = 'powergraph_session';

const defaultSettings = { units: 'kg', language: 'sl', dateFormat: 'DD.MM.YYYY', backupReminderDays: 7, lastBackupAt: '', calorieGoal: 2200, calorieTrackerMode: 'simple' };

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
    caloriesSubtitle: 'Bele\u017ei obroke, dnevni cilj in osnovne makrote.',
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
    backupDone: 'Backup created.',
    importDone: 'Data imported.',
    importFail: 'Import failed.',
    saved: 'Workout saved.',
    cleared: 'Data deleted.',
    advisorTitle: 'Daily workout suggestion',
    advisorText: 'The suggestion is based on what you trained recently and which area has been neglected the most.',
    focus: 'Today focus',
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
};

const seedWorkouts = [
  { id: 1, date: '2026-03-10', exercise: 'Bench Press', weight: 70, setDetails: [8, 8, 8, 8] },
  { id: 2, date: '2026-03-12', exercise: 'Squat', weight: 100, setDetails: [5, 5, 5, 5, 5] },
  { id: 3, date: '2026-03-14', exercise: 'Barbell Row', weight: 65, setDetails: [10, 10, 9, 8] },
  { id: 4, date: '2026-03-17', exercise: 'Bench Press', weight: 75, setDetails: [8, 8, 7, 6] },
  { id: 5, date: '2026-03-20', exercise: 'Overhead Press', weight: 42.5, setDetails: [8, 8, 7] },
  { id: 6, date: '2026-03-26', exercise: 'Squat', weight: 110, setDetails: [5, 5, 4, 4, 4] },
  { id: 7, date: '2026-04-02', exercise: 'Lat Pulldown', weight: 60, setDetails: [12, 12, 10, 10] },
];

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
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const [workouts, setWorkouts] = useState(() => loadWorkouts(localStorage.getItem(SESSION_KEY) || ''));
  const [calorieEntries, setCalorieEntries] = useState(() => loadCalories(localStorage.getItem(SESSION_KEY) || ''));
  const [settings, setSettings] = useState(() => loadSettings(localStorage.getItem(SESSION_KEY) || ''));
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [toast, setToast] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState('week');
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editingMealId, setEditingMealId] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [formData, setFormData] = useState({ date: new Date().toISOString().slice(0, 10), exercise: 'Bench Press', weight: '', setDetails: ['12', '10', '8'] });
  const [calorieForm, setCalorieForm] = useState({ date: new Date().toISOString().slice(0, 10), mealType: 'breakfast', name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [calQuery, setCalQuery] = useState('');
  const [calGrams, setCalGrams] = useState('');
  const [calResult, setCalResult] = useState(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState('');

  const copy = ui[settings.language];
  const sectionNames = { Chest: copy.chest, Legs: copy.legs, Triceps: copy.triceps, Biceps: copy.biceps, Forearms: copy.forearms, Shoulders: copy.shoulders, 'Stamina/Cardio': copy.cardio, Back: copy.back, Abs: copy.abs };
  const sectionDescriptions = {
    dashboard: settings.language === 'sl' ? 'Pregled napredka, statistike in hiter vnos novega treninga.' : 'A quick overview of progress, stats, and fast workout logging.',
    history: settings.language === 'sl' ? 'Preglej pretekle vnose in hitro preveri svoje zadnje treninge.' : 'Review past entries and quickly check your latest sessions.',
    exercises: settings.language === 'sl' ? 'Knjižnica vaj z opisi izvedbe, targeti in osnovnimi cue-ji.' : 'Exercise library with execution notes, targets, and key cues.',
    advisor: settings.language === 'sl' ? 'Pameten dnevni predlog na podlagi tvojih preteklih treningov.' : 'A smart daily suggestion based on your recent training history.',
    calories: settings.language === 'sl' ? 'Belezi obroke, kalorije in osnovne makrote po dnevih.' : 'Track meals, calories, and basic macros by day.',
    ocenjevalec: settings.language === 'sl' ? 'Vpisi jed in grame ter izvedi iskanje kalorij.' : 'Enter a food and grams to look up its calorie count.',
    settings: settings.language === 'sl' ? 'Uredi lokalne nastavitve, backup in prikaz podatkov.' : 'Adjust local preferences, backups, and data display.',
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

  const advisor = useMemo(() => {
    const latestSectionDate = {};
    const latestExerciseDate = {};
    workouts.forEach((w) => {
      const section = findSection(w.exercise);
      if (!latestSectionDate[section] || w.date > latestSectionDate[section]) latestSectionDate[section] = w.date;
      if (!latestExerciseDate[w.exercise] || w.date > latestExerciseDate[w.exercise]) latestExerciseDate[w.exercise] = w.date;
    });
    const today = new Date().toISOString().slice(0, 10);
    const ranked = Object.keys(sections)
      .map((section) => ({ section, last: latestSectionDate[section] ?? '', score: latestSectionDate[section] ? Math.floor((new Date(today) - new Date(latestSectionDate[section])) / 86400000) : 9999 }))
      .sort((a, b) => b.score - a.score);
    const chosen = ranked[0];
    return {
      section: chosen.section,
      last: chosen.last,
      reason: !chosen.last ? copy.reasonEmpty : chosen.score >= 4 ? copy.reasonCold : copy.reasonBalance,
      plan: chosen.section === 'Stamina/Cardio' ? copy.planCardio : copy.planStrength,
      exercises: sections[chosen.section].map((name) => ({ name, last: latestExerciseDate[name] ?? '' })).sort((a, b) => (a.last || '').localeCompare(b.last || '')).slice(0, 5),
    };
  }, [copy.planCardio, copy.planStrength, copy.reasonBalance, copy.reasonCold, copy.reasonEmpty, workouts]);

  const chartData = useMemo(() => ({ labels: selectedWorkouts.map((w, i) => `${formatDateValue(w.date, settings.dateFormat)} #${i + 1}`), datasets: [{ data: selectedWorkouts.map((w) => convertWeight(w.weight, settings.units)), borderColor: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.18)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4 }] }), [selectedWorkouts, settings.dateFormat, settings.units]);
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

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(SESSION_KEY, currentUser);
    setWorkouts(loadWorkouts(currentUser));
    setCalorieEntries(loadCalories(currentUser));
    setSettings(loadSettings(currentUser));
    setSelectedExercise('Bench Press');
    setActiveSection('dashboard');
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
  useEffect(() => { previousExerciseRef.current = selectedExercise; previousCountRef.current = selectedWorkouts.length; }, [selectedExercise, selectedWorkouts.length]);
  useEffect(() => { if (!toast) return undefined; const id = window.setTimeout(() => setToast(''), 2500); return () => window.clearTimeout(id); }, [toast]);

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
        localStorage.setItem(getWorkoutStorageKey(email), JSON.stringify(seedWorkouts));
        localStorage.setItem(getSettingsStorageKey(email), JSON.stringify(defaultSettings));
        setCurrentUser(email);
      } else {
        if (!existing) {
          setAuthError(copy.authNotFound);
          return;
        }
        if (existing.passwordHash !== passwordHash) {
          setAuthError(copy.authWrongPassword);
          return;
        }
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
    setSettings(defaultSettings);
    setAuthError('');
    setAuthForm({ email: '', password: '', confirmPassword: '' });
  }

  function changeSet(index, value) { setFormData((c) => ({ ...c, setDetails: c.setDetails.map((item, i) => (i === index ? value : item)) })); }
  function addSet() { setFormData((c) => ({ ...c, setDetails: [...c.setDetails, ''] })); }
  function removeSet(index) { setFormData((c) => ({ ...c, setDetails: c.setDetails.length === 1 ? c.setDetails : c.setDetails.filter((_, i) => i !== index) })); }
  function saveWorkout(event) {
    event.preventDefault();
    const cleanSets = formData.setDetails.map((v) => Number(v) || 0).filter((v) => v > 0);
    if (!formData.exercise || !formData.date || !formData.weight || !cleanSets.length) return;
    const next = normalizeWorkout({ id: Date.now(), date: formData.date, exercise: formData.exercise, weight: Number(formData.weight), setDetails: cleanSets });
    setWorkouts((c) => [...c, next]);
    setSelectedExercise(next.exercise);
    setFormData((c) => ({ ...c, weight: '', setDetails: [''] }));
    setToast(copy.saved);
  }
  function exportData() { downloadFile(`powergraph-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ workouts, calorieEntries, settings }, null, 2), 'application/json'); setSettings((c) => ({ ...c, lastBackupAt: new Date().toISOString() })); setToast(copy.backupDone); }
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
    reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); const imported = Array.isArray(parsed) ? parsed : parsed.workouts; if (!Array.isArray(imported)) throw new Error('invalid'); setWorkouts(imported.map(normalizeWorkout)); if (Array.isArray(parsed.calorieEntries)) setCalorieEntries(parsed.calorieEntries); if (parsed.settings) setSettings(sanitizeSettings(parsed.settings)); setToast(copy.importDone); } catch { setToast(copy.importFail); } finally { event.target.value = ''; } };
    reader.readAsText(file);
  }
  function clearData() { if (!window.confirm(copy.clearConfirm)) return; setWorkouts([]); setCalorieEntries([]); setToast(copy.cleared); }
  function deleteWorkout(id) { setWorkouts((current) => current.filter((item) => item.id !== id)); if (editingWorkoutId === id) setEditingWorkoutId(null); }
  function startEditWorkout(workout) { setEditingWorkoutId(workout.id); setFormData({ date: workout.date, exercise: workout.exercise, weight: String(workout.weight), setDetails: workout.setDetails.map(String) }); setActiveSection('dashboard'); }
  function saveWorkoutEdit() {
    const cleanSets = formData.setDetails.map((v) => Number(v) || 0).filter((v) => v > 0);
    if (!editingWorkoutId || !formData.exercise || !formData.date || !formData.weight || !cleanSets.length) return;
    setWorkouts((current) => current.map((item) => (item.id === editingWorkoutId ? { ...item, date: formData.date, exercise: formData.exercise, weight: Number(formData.weight), setDetails: cleanSets } : item)));
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
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(calQuery.trim())}&json=1&fields=product_name,nutriments&page_size=5&search_simple=1`;
      const res = await fetch(url);
      const data = await res.json();
      const product = data.products?.find(p => p.nutriments?.['energy-kcal_100g'] > 0);
      if (!product) { setCalError('noResult'); setCalLoading(false); return; }
      const kcalPer100 = product.nutriments['energy-kcal_100g'];
      const total = Math.round((kcalPer100 * Number(calGrams)) / 100);
      setCalResult({ name: product.product_name || calQuery, kcalPer100: Math.round(kcalPer100), total });
    } catch {
      setCalError('error');
    } finally {
      setCalLoading(false);
    }
  }

  const nav = [['dashboard', copy.dashboard], ['history', copy.history], ['exercises', copy.exercises], ['advisor', copy.advisor], ['calories', copy.calories], ['ocenjevalec', copy.ocenjevalec], ['settings', copy.settings]];

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
        <nav className="nav-menu">{nav.map(([id, label]) => <button key={id} className={`nav-btn ${activeSection === id ? 'active' : ''}`} type="button" onClick={() => setActiveSection(id)}>{label}</button>)}</nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="greeting">
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
          <div className="settings-button-row topbar-actions">
            <span className="user-chip">{getUserBadge(currentUser)}</span>
            <button className="theme-toggle" type="button" onClick={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? 'L' : 'D'}</button>
            <button className="action-btn-outline" type="button" onClick={logout}>{copy.logout}</button>
          </div>
        </header>
        <section className="glass-panel section-intro fade-in-up">
          <div>
            <p className="exercise-category">{nav.find(([id]) => id === activeSection)?.[1]}</p>
            <h3>{nav.find(([id]) => id === activeSection)?.[1]}</h3>
            <p>{sectionDescriptions[activeSection]}</p>
          </div>
        </section>
        {backupDue && <section className="glass-panel backup-banner fade-in-up"><div><h3>{copy.backupTitle}</h3><p>{copy.backupText}</p></div><button className="action-btn-primary" type="button" onClick={exportData}>{copy.export}</button></section>}

        {activeSection === 'dashboard' && <>
          <div className="dashboard-grid">
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">#</div><div><p className="stat-title">{copy.workouts}</p><h3 className="stat-value">{overall.workouts}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">S</div><div><p className="stat-title">{copy.totalSets}</p><h3 className="stat-value">{overall.sets}</h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow">V</div><div><p className="stat-title">{copy.totalVolume}</p><h3 className="stat-value">{formatVolume(overall.volumeKg, settings.units)}</h3></div></article>

            <section className="glass-panel chart-panel fade-in-up">
              <div className="panel-header"><h3>{copy.chart}</h3><select className="premium-select" value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>{exerciseOptions.map((name) => <option key={name} value={name}>{getExerciseName(name, settings.language)}</option>)}</select></div>
              <div className="chart-container">{selectedWorkouts.length ? <Line data={chartData} options={chartOptions} /> : <div className="empty-state"><h4>{copy.chart}</h4><p>{copy.noChart}</p></div>}</div>
            </section>

            <section className="glass-panel action-panel fade-in-up">
              <div className="panel-header"><h3>{copy.addWorkout}</h3></div>
              <form className="premium-form" onSubmit={editingWorkoutId ? (e) => { e.preventDefault(); saveWorkoutEdit(); } : saveWorkout}>
                <div className="input-group"><label htmlFor="date">{copy.date}</label><input id="date" type="date" value={formData.date} onChange={(e) => setFormData((c) => ({ ...c, date: e.target.value }))} /></div>
                <div className="input-group"><label htmlFor="exercise">{copy.exercise}</label><select id="exercise" className="premium-select" value={formData.exercise} onChange={(e) => setFormData((c) => ({ ...c, exercise: e.target.value }))}>{Object.values(sections).flat().map((name) => <option key={name} value={name}>{getExerciseName(name, settings.language)}</option>)}</select></div>
                <div className="helper-card">
                  <p><strong>{sectionNames[findSection(formData.exercise)]}</strong></p>
                  <p>{localize(selectedFormExerciseInfo.targets, settings.language)}</p>
                </div>
                <div className="input-group"><label htmlFor="weight">{copy.weight}</label><input id="weight" type="number" step="0.5" min="0" value={formData.weight} onChange={(e) => setFormData((c) => ({ ...c, weight: e.target.value }))} placeholder={`0 ${settings.units}`} /></div>
                <div className="input-group set-builder"><label>{copy.repsPerSet}</label><div className="set-list">{formData.setDetails.map((value, index) => <div className="set-row" key={`set-${index + 1}`}><span className="set-label">{copy.sets} {index + 1}</span><input type="number" min="1" step="1" value={value} onChange={(e) => changeSet(index, e.target.value)} /><button className="mini-btn" type="button" onClick={() => removeSet(index)}>-</button></div>)}</div><button className="action-btn-outline add-set-btn" type="button" onClick={addSet}>{copy.addSet}</button></div>
                <div className="settings-button-row">
                  <button className="action-btn-primary full-width" type="submit">{editingWorkoutId ? copy.saveChanges : copy.save}</button>
                  {editingWorkoutId ? <button className="action-btn-outline full-width" type="button" onClick={cancelWorkoutEdit}>{copy.cancel}</button> : null}
                </div>
              </form>
            </section>
          </div>

          <section className="glass-panel stats-section fade-in-up">
            <div className="panel-header"><h3>{copy.byExercise}</h3><div className="settings-button-row"><button className={`action-btn-outline ${analyticsRange === 'week' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('week')}>{copy.weekly}</button><button className={`action-btn-outline ${analyticsRange === 'month' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('month')}>{copy.monthly}</button></div></div>
            <div className="stats-split">
              <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.totalReps}</span><strong>{overall.reps}</strong></div><div className="stats-row"><span>{copy.bestWeight}</span><strong>{formatWeight(overall.bestKg, settings.units)}</strong></div><div className="stats-row"><span>{copy.streak}</span><strong>{calculateStreak(workouts)}</strong></div></div></div>
              <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.analytics}</span><strong>{analyticsRange === 'week' ? copy.weekly : copy.monthly}</strong></div><div className="stats-row"><span>{copy.trainingLoad}</span><strong>{formatVolume(analyticsTraining.volumeKg, settings.units)}</strong></div><div className="stats-row"><span>{copy.workouts}</span><strong>{analyticsTraining.workouts}</strong></div><div className="stats-row"><span>{copy.totalSets}</span><strong>{analyticsTraining.sets}</strong></div></div></div>
            </div>
            <div className="exercise-stats-grid">{perExercise.map((item) => <article className="exercise-stats-card" key={item.name}><div className="exercise-stats-top"><h4>{getExerciseName(item.name, settings.language)}</h4><span className="exercise-badge">{sectionNames[findSection(item.name)]}</span></div><div className="exercise-stats-body"><p><strong>{copy.workouts}:</strong> {item.workouts}</p><p><strong>{copy.totalSets}:</strong> {item.sets}</p><p><strong>{copy.totalReps}:</strong> {item.reps}</p><p><strong>{copy.bestWeight}:</strong> {formatWeight(item.bestKg, settings.units)}</p></div></article>)}</div>
          </section>
        </>}

        {activeSection === 'history' && <section className="glass-panel history-section fade-in-up"><div className="panel-header"><h3>{copy.recent}</h3><span className="history-count">{sortedWorkouts.length}</span></div><div className="history-list">{sortedWorkouts.length ? sortedWorkouts.map((w) => <article className="history-item" key={w.id}><div><h3>{getExerciseName(w.exercise, settings.language)}</h3><p>{formatDateValue(w.date, settings.dateFormat)}</p></div><div className="history-metrics"><span>{formatWeight(w.weight, settings.units)}</span><span>{getSetCount(w)} {copy.sets.toLowerCase()}</span><span>{formatSetDetails(w)}</span></div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={() => startEditWorkout(w)}>{copy.edit}</button><button className="action-btn-outline danger-button" type="button" onClick={() => deleteWorkout(w.id)}>{copy.delete}</button></div></article>) : <div className="empty-state"><h4>{copy.recent}</h4><p>{copy.noHistory}</p></div>}</div></section>}

        {activeSection === 'exercises' && <section className="glass-panel exercise-section fade-in-up"><div className="panel-header"><h3>{copy.exercises}</h3></div>{Object.entries(sections).map(([section, names]) => <div className="exercise-section-block" key={section}><div className="exercise-section-header"><h4>{sectionNames[section]}</h4><span className="exercise-badge">{names.length}</span></div><div className="exercise-grid">{names.map((name) => { const meta = getExerciseInfo(name); return <article className="exercise-card" key={name}><div className="exercise-top"><div><p className="exercise-category">{sectionNames[section]}</p><h4>{getExerciseName(name, settings.language)}</h4></div><span className="exercise-badge">{localize(meta.primary, settings.language)}</span></div><div className="exercise-copy"><p><strong>{copy.target}:</strong> {localize(meta.targets, settings.language)}</p><p><strong>{copy.primary}:</strong> {localize(meta.primary, settings.language)}</p><p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p><p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p><p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p></div></article>; })}</div></div>)}</section>}

        {activeSection === 'advisor' && <section className="glass-panel stats-section fade-in-up"><div className="panel-header"><h3>{copy.advisorTitle}</h3></div><div className="advisor-grid"><article className="advisor-card"><p className="exercise-category">{copy.focus}</p><h3>{sectionNames[advisor.section]}</h3><p className="settings-copy">{copy.advisorText}</p><div className="stats-list mt-1"><div className="stats-row"><span>{copy.lastWorked}</span><strong>{advisor.last ? formatDateValue(advisor.last, settings.dateFormat) : copy.neverWorked}</strong></div><div className="stats-row"><span>{copy.sets}</span><strong>{advisor.plan}</strong></div></div></article><article className="advisor-card"><p className="exercise-category">{copy.why}</p><p>{advisor.reason}</p></article></div><div className="panel-header mt-1"><h3>{copy.suggested}</h3></div><div className="exercise-grid">{advisor.exercises.map((item) => { const meta = getExerciseInfo(item.name); return <article className="exercise-card" key={item.name}><div className="exercise-top"><div><p className="exercise-category">{sectionNames[advisor.section]}</p><h4>{getExerciseName(item.name, settings.language)}</h4></div><span className="exercise-badge">{item.last ? formatDateValue(item.last, settings.dateFormat) : copy.neverWorked}</span></div><div className="exercise-copy"><p><strong>{copy.target}:</strong> {localize(meta.targets, settings.language)}</p><p><strong>{copy.equipment}:</strong> {localize(meta.equipment, settings.language)}</p><p><strong>{copy.howTo}:</strong> {localize(meta.howTo, settings.language)}</p><p><strong>{copy.cues}:</strong> {localize(meta.cues, settings.language)}</p></div></article>; })}</div></section>}

        {activeSection === 'calories' && <>
          <div className="dashboard-grid">
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon blue-glow">C</div><div><p className="stat-title">{copy.caloriesConsumed}</p><h3 className="stat-value">{Math.round(selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon green-glow">G</div><div><p className="stat-title">{copy.calorieGoal}</p><h3 className="stat-value">{Math.round(settings.calorieGoal)} <span className="unit">{copy.kcalShort}</span></h3></div></article>
            <article className="glass-panel stat-card fade-in-up"><div className="stat-icon purple-glow">R</div><div><p className="stat-title">{copy.caloriesRemaining}</p><h3 className="stat-value">{Math.round(settings.calorieGoal - selectedDayTotals.calories)} <span className="unit">{copy.kcalShort}</span></h3></div></article>

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

          <section className="glass-panel history-section fade-in-up">
            <div className="panel-header"><h3>{copy.mealsHistory}</h3><div className="settings-button-row"><button className={`action-btn-outline ${analyticsRange === 'week' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('week')}>{copy.weekly}</button><button className={`action-btn-outline ${analyticsRange === 'month' ? 'active-filter' : ''}`} type="button" onClick={() => setAnalyticsRange('month')}>{copy.monthly}</button><span className="history-count">{selectedDayEntries.length}</span></div></div>
            <div className="stats-split">
              <div className="stats-block"><div className="stats-list"><div className="stats-row"><span>{copy.analytics}</span><strong>{analyticsRange === 'week' ? copy.weekly : copy.monthly}</strong></div><div className="stats-row"><span>{copy.caloriesConsumed}</span><strong>{Math.round(analyticsFood.calories)} {copy.kcalShort}</strong></div><div className="stats-row"><span>{copy.mealCount}</span><strong>{analyticsFood.entries}</strong></div>{settings.calorieTrackerMode === 'advanced' ? <div className="stats-row"><span>{copy.protein}</span><strong>{Math.round(analyticsFood.protein)} g</strong></div> : null}</div></div>
            </div>
            <div className="history-list">
              {selectedDayEntries.length ? selectedDayEntries.map((entry) => <article className="history-item" key={entry.id}><div><h3>{entry.name}</h3><p>{({ breakfast: copy.breakfast, lunch: copy.lunch, dinner: copy.dinner, snack: copy.snack })[entry.mealType]}</p></div><div className="history-metrics"><span>{Math.round(entry.calories)} {copy.kcalShort}</span>{settings.calorieTrackerMode === 'advanced' ? <><span>P {Math.round(entry.protein)}g</span><span>C {Math.round(entry.carbs)}g</span><span>F {Math.round(entry.fat)}g</span></> : null}</div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={() => startEditMeal(entry)}>{copy.edit}</button><button className="action-btn-outline danger-button" type="button" onClick={() => deleteMeal(entry.id)}>{copy.delete}</button></div></article>) : <div className="empty-state"><h4>{copy.caloriesTitle}</h4><p>{copy.noMeals}</p></div>}
            </div>
          </section>
        </>}

        {activeSection === 'ocenjevalec' && (
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
              <div className="dashboard-grid" style={{marginTop:'1.5rem'}}>
                <article className="glass-panel stat-card fade-in-up">
                  <div className="stat-icon blue-glow">K</div>
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
            )}
          </section>
        )}

        {activeSection === 'settings' && <section className="glass-panel settings-section fade-in-up"><div className="panel-header"><h3>{copy.settings}</h3></div><div className="settings-grid"><article className="settings-card"><label className="settings-label" htmlFor="units">{copy.units}</label><select id="units" className="premium-select full-width" value={settings.units} onChange={(e) => setSettings((c) => ({ ...c, units: e.target.value }))}><option value="kg">kg</option><option value="lbs">lbs</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="lang">{copy.language}</label><select id="lang" className="premium-select full-width" value={settings.language} onChange={(e) => setSettings((c) => ({ ...c, language: e.target.value }))}><option value="sl">Slovenščina</option><option value="en">English</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="dateFormat">{copy.dateFormat}</label><select id="dateFormat" className="premium-select full-width" value={settings.dateFormat} onChange={(e) => setSettings((c) => ({ ...c, dateFormat: e.target.value }))}><option value="DD.MM.YYYY">DD.MM.YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="backup">{copy.backupReminder}</label><select id="backup" className="premium-select full-width" value={settings.backupReminderDays} onChange={(e) => setSettings((c) => ({ ...c, backupReminderDays: Number(e.target.value) }))}><option value={3}>3 {copy.days}</option><option value={7}>7 {copy.days}</option><option value={14}>14 {copy.days}</option><option value={30}>30 {copy.days}</option></select></article><article className="settings-card"><label className="settings-label" htmlFor="calorieGoal">{copy.calorieGoal}</label><input id="calorieGoal" type="number" min="1000" step="50" value={settings.calorieGoal} onChange={(e) => setSettings((c) => ({ ...c, calorieGoal: Number(e.target.value) || 2200 }))} /></article><article className="settings-card"><label className="settings-label" htmlFor="trackerMode">{copy.trackerMode}</label><select id="trackerMode" className="premium-select full-width" value={settings.calorieTrackerMode} onChange={(e) => setSettings((c) => ({ ...c, calorieTrackerMode: e.target.value }))}><option value="simple">{copy.simpleTracker}</option><option value="advanced">{copy.advancedTracker}</option></select></article><article className="settings-card settings-card-wide"><div className="settings-actions"><div><span className="settings-title">{copy.lastBackup}</span><p className="settings-copy">{settings.lastBackupAt ? formatDateValue(settings.lastBackupAt.slice(0, 10), settings.dateFormat) : copy.never}</p></div><div className="settings-button-row"><button className="action-btn-outline" type="button" onClick={exportData}>{copy.export}</button><button className="action-btn-outline" type="button" onClick={() => fileInputRef.current?.click()}>{copy.import}</button></div></div></article><article className="settings-card settings-card-wide danger-card"><div className="settings-actions"><div><span className="settings-title">{copy.clear}</span><p className="settings-copy">{copy.backupText}</p></div><button className="action-btn-outline danger-button" type="button" onClick={clearData}>{copy.clear}</button></div></article></div><input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importData} /></section>}
      </main>
      {toast ? <div className="toast-container"><div className="toast">{toast}</div></div> : null}
    </div>
  );
}







