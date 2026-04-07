// PowerGraph Main Application Logic
document.addEventListener('DOMContentLoaded', () => {

    // 1. Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const bodyBody = document.body;
    let isDark = true;

    themeToggleBtn.addEventListener('click', () => {
        isDark = !isDark;
        if (!isDark) {
            htmlElement.setAttribute('data-theme', 'light');
            themeToggleBtn.innerHTML = '<i class="ph ph-sun"></i>';
        } else {
            htmlElement.removeAttribute('data-theme');
            themeToggleBtn.innerHTML = '<i class="ph ph-moon"></i>';
        }
        updateChartTheme();
    });

    // Set today's date in form
    document.getElementById('date').valueAsDate = new Date();

    // 2. Mock Data & LocalStorage initialization
    const STORAGE_KEY = 'powergraph_workouts';
    
    // Seed some initial data if empty to show the premium chart
    if (!localStorage.getItem(STORAGE_KEY)) {
        const seedData = [
            { id: 1, date: '2023-10-01', machine: 'Bench Press', weight: 60, sets: 4, reps: 10 },
            { id: 2, date: '2023-10-08', machine: 'Bench Press', weight: 65, sets: 4, reps: 10 },
            { id: 3, date: '2023-10-15', machine: 'Bench Press', weight: 70, sets: 3, reps: 8 },
            { id: 4, date: '2023-10-22', machine: 'Bench Press', weight: 72.5, sets: 3, reps: 6 },
            { id: 5, date: '2023-11-01', machine: 'Bench Press', weight: 80, sets: 3, reps: 5 },
            
            { id: 6, date: '2023-10-01', machine: 'Squat', weight: 80, sets: 4, reps: 8 },
            { id: 7, date: '2023-10-10', machine: 'Squat', weight: 90, sets: 4, reps: 8 },
            { id: 8, date: '2023-10-25', machine: 'Squat', weight: 105, sets: 3, reps: 5 }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    }

    let workouts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    // 3. Update Dashboard Stats
    function updateStats() {
        // Calculate Total Volume
        const vol = workouts.reduce((sum, w) => sum + (w.weight * w.sets * w.reps), 0);
        
        // Very basic simple formatting for "Billion Dollar" look
        document.getElementById('stat-volume').innerHTML = `${vol.toLocaleString()} <span class="unit">kg</span>`;
        
        // Random PR count for visual effect demo
        const prs = Math.floor(Math.random() * 5) + 1;
        document.getElementById('stat-prs').innerHTML = `${prs} <span class="unit">ta mesec</span>`;
    }

    updateStats();

    // 4. Input Form Logic
    const form = document.getElementById('workout-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const machine = document.getElementById('machine').value;
        const date = document.getElementById('date').value;
        const weight = parseFloat(document.getElementById('weight').value);
        const sets = parseInt(document.getElementById('sets').value);
        const reps = parseInt(document.getElementById('reps').value);

        const newWorkout = { id: Date.now(), date, machine, weight, sets, reps };
        
        workouts.push(newWorkout);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
        
        // Refresh UI
        renderChart(machine);
        updateStats();

        // Check if machine needs to be added to select list
        const select = document.getElementById('chart-machine-select');
        let optionsArray = Array.from(select.options).map(o => o.value.toLowerCase());
        if (!optionsArray.includes(machine.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = machine;
            opt.textContent = machine;
            select.appendChild(opt);
        }
        select.value = machine; // switch to newly inputted machine

        // Reset inputs
        document.getElementById('weight').value = '';
        document.getElementById('sets').value = '';
        document.getElementById('reps').value = '';

        showToast(`Trening uspešno shranjen!`);
    });

    // 5. Chart.js Implementation
    const ctx = document.getElementById('progressChart').getContext('2d');
    let myChart = null;

    function renderChart(selectedMachine) {
        // Filter and sort workouts by date for the selected machine
        let filtered = workouts.filter(w => w.machine.toLowerCase() === selectedMachine.toLowerCase());
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get max weight per date
        const dateMap = {};
        filtered.forEach(w => {
            if (!dateMap[w.date] || w.weight > dateMap[w.date]) {
                dateMap[w.date] = w.weight;
            }
        });

        const labels = Object.keys(dateMap).sort((a,b) => new Date(a)-new Date(b));
        const dataPoints = labels.map(l => dateMap[l]);

        if (myChart) myChart.destroy();

        // Premium Gradient Fill
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // primary-glow blue
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        const textColor = isDark ? '#94A3B8' : '#64748B';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Ni podatkov'],
                datasets: [{
                    label: `Maksimalna teža (kg) - ${selectedMachine}`,
                    data: dataPoints.length ? dataPoints : [0],
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, // smooth curves (Billion dollar look)
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDark ? '#fff' : '#000',
                        bodyColor: isDark ? '#e2e8f0' : '#333',
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' kg';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: textColor, font: { family: "'Outfit', sans-serif" } }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { color: textColor, font: { family: "'Outfit', sans-serif" } },
                        beginAtZero: false
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
            }
        });
    }

    // Chart select interaction
    const selectMachine = document.getElementById('chart-machine-select');
    selectMachine.addEventListener('change', (e) => {
        renderChart(e.target.value);
    });

    // Initial render
    renderChart(selectMachine.value);

    function updateChartTheme() {
        if(myChart) renderChart(selectMachine.value);
    }

    // 6. Toast UI
    function showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="ph ph-check-circle" style="font-size:24px;"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
             toast.style.opacity = '0';
             toast.style.transform = 'translateX(50px)';
             toast.style.transition = 'all 0.4s ease';
             setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
});
