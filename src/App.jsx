import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const STORAGE_KEY = 'powergraph_workouts';
const THEME_KEY = 'powergraph_theme';
const SETTINGS_KEY = 'powergraph_settings';

const seedWorkouts = [
  { id: 1, date: '2026-03-10', exercise: 'Bench Press', weight: 70, sets: 4, reps: 8 },
  { id: 2, date: '2026-03-17', exercise: 'Bench Press', weight: 75, sets: 4, reps: 8 },
  { id: 3, date: '2026-03-24', exercise: 'Bench Press', weight: 80, sets: 4, reps: 6 },
  { id: 4, date: '2026-03-12', exercise: 'Squat', weight: 100, sets: 5, reps: 5 },
  { id: 5, date: '2026-03-26', exercise: 'Squat', weight: 110, sets: 5, reps: 5 },
  { id: 6, date: '2026-04-02', exercise: 'Deadlift', weight: 130, sets: 3, reps: 5 },
];

const defaultSettings = {
  units: 'kg',
  language: 'sl',
  dateFormat: 'DD.MM.YYYY',
  backupReminderDays: 7,
  lastBackupAt: '',
};

function loadWorkouts() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedWorkouts));
    return seedWorkouts;
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : seedWorkouts;
  } catch {
    return seedWorkouts;
  }
}

function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function calculateStreak(workouts) {
  const uniqueDates = [...new Set(workouts.map((workout) => workout.date))].sort().reverse();
  if (!uniqueDates.length) return 0;

  let streak = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(uniqueDates[index - 1]);
    const current = new Date(uniqueDates[index]);
    const difference = Math.round((previous - current) / (1000 * 60 * 60 * 24));

    if (difference === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function formatDateValue(dateString, format) {
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;

  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  return `${day}.${month}.${year}`;
}

function convertWeight(weightInKg, units) {
  if (units === 'lbs') {
    return weightInKg * 2.20462;
  }
  return weightInKg;
}

function formatWeight(weightInKg, units) {
  const value = convertWeight(weightInKg, units);
  const rounded = units === 'lbs' ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units}`;
}

function formatVolume(weightValue, units) {
  const rounded = units === 'lbs' ? Math.round(weightValue) : Math.round(weightValue);
  return `${rounded.toLocaleString()} ${units}`;
}

function App() {
  const fileInputRef = useRef(null);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark');
  const [workouts, setWorkouts] = useState(() => loadWorkouts());
  const [settings, setSettings] = useState(() => loadSettings());
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    exercise: '',
    weight: '',
    sets: '',
    reps: '',
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const exercises = useMemo(() => {
    const values = [...new Set(workouts.map((workout) => workout.exercise))];
    return values.length ? values.sort((a, b) => a.localeCompare(b)) : ['Bench Press'];
  }, [workouts]);

  useEffect(() => {
    if (!exercises.includes(selectedExercise)) {
      setSelectedExercise(exercises[0]);
    }
  }, [exercises, selectedExercise]);

  const stats = useMemo(() => {
    const totalVolumeKg = workouts.reduce(
      (sum, workout) => sum + workout.weight * workout.sets * workout.reps,
      0,
    );

    const personalRecords = workouts.reduce((map, workout) => {
      const currentBest = map[workout.exercise] ?? 0;
      map[workout.exercise] = Math.max(currentBest, workout.weight);
      return map;
    }, {});

    const totalVolume = settings.units === 'lbs' ? totalVolumeKg * 2.20462 : totalVolumeKg;

    return {
      totalVolume,
      recordCount: Object.keys(personalRecords).length,
      streak: calculateStreak(workouts),
    };
  }, [settings.units, workouts]);

  const chartData = useMemo(() => {
    const filtered = workouts
      .filter((workout) => workout.exercise === selectedExercise)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const maxPerDay = filtered.reduce((accumulator, workout) => {
      const weight = convertWeight(workout.weight, settings.units);
      accumulator[workout.date] = Math.max(accumulator[workout.date] ?? 0, weight);
      return accumulator;
    }, {});

    const labels = Object.keys(maxPerDay).sort((a, b) => new Date(a) - new Date(b));
    const data = labels.map((label) => maxPerDay[label]);

    return {
      labels: labels.length ? labels.map((label) => formatDateValue(label, settings.dateFormat)) : ['Ni podatkov'],
      datasets: [
        {
          data: data.length ? data : [0],
          borderColor: '#3b82f6',
          borderWidth: 3,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    };
  }, [selectedExercise, settings.dateFormat, settings.units, workouts]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: theme === 'dark' ? '#ffffff' : '#0f172a',
          bodyColor: theme === 'dark' ? '#e2e8f0' : '#334155',
          borderColor: 'rgba(59, 130, 246, 0.25)',
          borderWidth: 1,
          displayColors: false,
          padding: 12,
          callbacks: {
            label(context) {
              return `${context.parsed.y} ${settings.units}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
        },
        y: {
          grid: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            drawBorder: false,
          },
          ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
          beginAtZero: false,
        },
      },
    }),
    [settings.units, theme],
  );

  const recentWorkouts = useMemo(
    () => [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8),
    [workouts],
  );

  const backupReminder = useMemo(() => {
    if (!settings.backupReminderDays) return null;
    if (!settings.lastBackupAt) {
      return 'Backup se se ni bil narejen. Priporocen je prvi izvoz podatkov.';
    }

    const now = new Date();
    const lastBackup = new Date(settings.lastBackupAt);
    const diffDays = Math.floor((now - lastBackup) / (1000 * 60 * 60 * 24));

    if (diffDays >= Number(settings.backupReminderDays)) {
      return `Od zadnjega backupa je minilo ${diffDays} dni. Cas je za nov izvoz podatkov.`;
    }

    return null;
  }, [settings.backupReminderDays, settings.lastBackupAt]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function handleSettingChange(event) {
    const { name, value } = event.target;
    setSettings((current) => ({
      ...current,
      [name]: name === 'backupReminderDays' ? Number(value) : value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const workout = {
      id: Date.now(),
      date: formData.date,
      exercise: formData.exercise.trim(),
      weight: Number(formData.weight),
      sets: Number(formData.sets),
      reps: Number(formData.reps),
    };

    if (!workout.exercise || !workout.date || !workout.weight || !workout.sets || !workout.reps) {
      setToast('Izpolni vsa polja za trening.');
      return;
    }

    setWorkouts((current) => [...current, workout]);
    setSelectedExercise(workout.exercise);
    setFormData((current) => ({
      ...current,
      exercise: '',
      weight: '',
      sets: '',
      reps: '',
    }));
    setToast('Trening je uspesno shranjen v brskalnik.');
  }

  function registerBackup() {
    setSettings((current) => ({
      ...current,
      lastBackupAt: new Date().toISOString(),
    }));
  }

  function handleExport() {
    downloadFile(
      `powergraph-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(workouts, null, 2),
      'application/json',
    );
    registerBackup();
    setToast('JSON izvoz je pripravljen.');
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          throw new Error('Invalid format');
        }

        const normalized = parsed.map((item, index) => ({
          id: item.id ?? Date.now() + index,
          date: item.date ?? new Date().toISOString().slice(0, 10),
          exercise: item.exercise ?? item.machine ?? 'Exercise',
          weight: Number(item.weight ?? 0),
          sets: Number(item.sets ?? 0),
          reps: Number(item.reps ?? 0),
        }));

        setWorkouts(normalized);
        setToast('Podatki so bili uspesno uvozeni.');
      } catch {
        setToast('Uvoz ni uspel. Preveri JSON datoteko.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function handleClearData() {
    if (!window.confirm('Ali res zelis izbrisati vse lokalno shranjene podatke? Tega ni mogoce razveljaviti.')) {
      return;
    }

    setWorkouts([]);
    setToast('Vsi lokalni podatki so izbrisani.');
  }

  return (
    <>
      <div className="app-container">
        <aside className="sidebar glass-panel">
          <div className="brand">
            <div className="logo-icon" aria-hidden="true">{'->'}</div>
            <h1>
              Power<span className="highlight">Graph</span>
            </h1>
          </div>

          <nav className="nav-menu">
            <button
              className={`nav-btn ${activeSection === 'dashboard' ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveSection('dashboard')}
            >
              <span aria-hidden="true">[]</span> Nadzorna plosca
            </button>
            <button
              className={`nav-btn ${activeSection === 'history' ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveSection('history')}
            >
              <span aria-hidden="true">::</span> Zgodovina
            </button>
            <button
              className={`nav-btn ${activeSection === 'settings' ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveSection('settings')}
            >
              <span aria-hidden="true">##</span> Nastavitve
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="action-btn-outline" type="button" onClick={handleExport}>
              <span aria-hidden="true">v</span> Izvozi podatke
            </button>
            <button className="action-btn-outline" type="button" onClick={handleImportClick}>
              <span aria-hidden="true">^</span> Uvozi podatke
            </button>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="greeting">
              <h2>Dobrodosli nazaj, Trdozivec!</h2>
              <p>Browser-only aplikacija z lokalnimi podatki, nastavitvami in backup opomnikom.</p>
            </div>

            <div className="user-actions">
              <button
                className="theme-toggle"
                type="button"
                title="Preklopi temo"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? 'L' : 'D'}
              </button>
              <div className="avatar">
                <img
                  src="https://ui-avatars.com/api/?name=Power+Graph&background=1976d2&color=fff&rounded=true"
                  alt="PowerGraph avatar"
                />
              </div>
            </div>
          </header>

          {backupReminder ? (
            <section className="backup-banner glass-panel">
              <div>
                <strong>Backup opomnik</strong>
                <p>{backupReminder}</p>
              </div>
              <button className="action-btn-primary" type="button" onClick={handleExport}>
                Ustvari backup
              </button>
            </section>
          ) : null}

          {activeSection === 'dashboard' ? (
            <>
              <div className="dashboard-grid">
                <div className="stat-card glass-panel fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="stat-icon blue-glow" aria-hidden="true">W</div>
                  <div className="stat-details">
                    <p className="stat-title">Skupni volumen</p>
                    <h3 className="stat-value">
                      {formatVolume(stats.totalVolume, settings.units)}
                    </h3>
                  </div>
                </div>

                <div className="stat-card glass-panel fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="stat-icon green-glow" aria-hidden="true">R</div>
                  <div className="stat-details">
                    <p className="stat-title">Osebni rekordi</p>
                    <h3 className="stat-value">
                      {stats.recordCount} <span className="unit">vaj</span>
                    </h3>
                  </div>
                </div>

                <div className="stat-card glass-panel fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="stat-icon purple-glow" aria-hidden="true">S</div>
                  <div className="stat-details">
                    <p className="stat-title">Niz treningov</p>
                    <h3 className="stat-value">
                      {stats.streak} <span className="unit">dni</span>
                    </h3>
                  </div>
                </div>

                <div className="chart-panel glass-panel fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <div className="panel-header">
                    <h3>Napredek</h3>
                    <select
                      className="premium-select"
                      value={selectedExercise}
                      onChange={(event) => setSelectedExercise(event.target.value)}
                    >
                      {exercises.map((exercise) => (
                        <option key={exercise} value={exercise}>
                          {exercise}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="chart-container">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </div>

                <div className="action-panel glass-panel fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <div className="panel-header">
                    <h3>Hitri vnos treninga</h3>
                  </div>

                  <form className="premium-form" onSubmit={handleSubmit}>
                    <div className="form-row">
                      <div className="input-group">
                        <label htmlFor="exercise">Vaja</label>
                        <input
                          id="exercise"
                          name="exercise"
                          value={formData.exercise}
                          onChange={handleInputChange}
                          placeholder="Npr. Bench Press"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="date">Datum</label>
                        <input
                          id="date"
                          name="date"
                          type="date"
                          value={formData.date}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row triple">
                      <div className="input-group">
                        <label htmlFor="weight">Teza ({settings.units})</label>
                        <input
                          id="weight"
                          name="weight"
                          type="number"
                          step="0.5"
                          value={formData.weight}
                          onChange={handleInputChange}
                          placeholder="80"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="sets">Serije</label>
                        <input
                          id="sets"
                          name="sets"
                          type="number"
                          value={formData.sets}
                          onChange={handleInputChange}
                          placeholder="4"
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="reps">Ponovitve</label>
                        <input
                          id="reps"
                          name="reps"
                          type="number"
                          value={formData.reps}
                          onChange={handleInputChange}
                          placeholder="10"
                          required
                        />
                      </div>
                    </div>

                    <button type="submit" className="action-btn-primary full-width mt-1">
                      Shrani trening
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'history' ? (
            <section className="history-section glass-panel fade-in-up">
              <div className="panel-header">
                <h3>Zgodovina treningov</h3>
                <span className="history-count">{recentWorkouts.length} zadnjih vnosov</span>
              </div>

              <div className="history-list">
                {recentWorkouts.map((workout) => (
                  <article className="history-item" key={workout.id}>
                    <div>
                      <strong>{workout.exercise}</strong>
                      <p>{formatDateValue(workout.date, settings.dateFormat)}</p>
                    </div>
                    <div className="history-metrics">
                      <span>{formatWeight(workout.weight, settings.units)}</span>
                      <span>{workout.sets} x {workout.reps}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === 'settings' ? (
            <section className="settings-section glass-panel fade-in-up">
              <div className="panel-header">
                <h3>Nastavitve</h3>
                <span className="history-count">Shranjene lokalno v brskalnik</span>
              </div>

              <div className="settings-grid">
                <div className="settings-card">
                  <label className="settings-label" htmlFor="units">Enote</label>
                  <select id="units" name="units" className="premium-select" value={settings.units} onChange={handleSettingChange}>
                    <option value="kg">Kilogrami (kg)</option>
                    <option value="lbs">Pounds (lbs)</option>
                  </select>
                </div>

                <div className="settings-card">
                  <label className="settings-label" htmlFor="language">Jezik</label>
                  <select id="language" name="language" className="premium-select" value={settings.language} onChange={handleSettingChange}>
                    <option value="sl">Slovenscina</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="settings-card">
                  <label className="settings-label" htmlFor="dateFormat">Nacin zapisa datuma</label>
                  <select id="dateFormat" name="dateFormat" className="premium-select" value={settings.dateFormat} onChange={handleSettingChange}>
                    <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>

                <div className="settings-card">
                  <label className="settings-label" htmlFor="backupReminderDays">Backup opomnik</label>
                  <select
                    id="backupReminderDays"
                    name="backupReminderDays"
                    className="premium-select"
                    value={settings.backupReminderDays}
                    onChange={handleSettingChange}
                  >
                    <option value={3}>Na 3 dni</option>
                    <option value={7}>Na 7 dni</option>
                    <option value={14}>Na 14 dni</option>
                    <option value={30}>Na 30 dni</option>
                  </select>
                </div>

                <div className="settings-card settings-card-wide">
                  <div className="settings-actions">
                    <div>
                      <p className="settings-title">Izvoz in uvoz podatkov</p>
                      <p className="settings-copy">
                        Podatke lahko izvozis v JSON ali jih uvozis nazaj v aplikacijo.
                      </p>
                    </div>
                    <div className="settings-button-row">
                      <button className="action-btn-primary" type="button" onClick={handleExport}>
                        Izvozi JSON
                      </button>
                      <button className="action-btn-outline" type="button" onClick={handleImportClick}>
                        Uvozi JSON
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-card settings-card-wide danger-card">
                  <div className="settings-actions">
                    <div>
                      <p className="settings-title">Izbris vseh podatkov</p>
                      <p className="settings-copy">
                        Pred izbrisom te aplikacija vedno vprasa, ce to res zelis.
                      </p>
                    </div>
                    <button className="action-btn-outline danger-button" type="button" onClick={handleClearData}>
                      Izbrisi vse podatke
                    </button>
                  </div>
                </div>

                <div className="settings-card settings-card-wide">
                  <p className="settings-title">Zadnji backup</p>
                  <p className="settings-copy">
                    {settings.lastBackupAt
                      ? formatDateValue(settings.lastBackupAt.slice(0, 10), settings.dateFormat)
                      : 'Backup se ni bil ustvarjen.'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={handleImport}
      />

      <div className="toast-container">
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </>
  );
}

export default App;
