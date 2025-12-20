<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const route = useRoute()
const router = useRouter()
const stats = ref(null)
const loading = ref(true)
const expandedSessionId = ref(null) 

// --- ZMIENNE DO SORTOWANIA ---
const sortColumn = ref('started_at') // Domyślnie po dacie
const sortDirection = ref('desc')    // Domyślnie od najnowszych

const calculateGrade = (currentScore) => {
    if (!stats.value || !stats.value.totalMaxPoints || stats.value.totalMaxPoints === 0) return '-';
    const max = stats.value.totalMaxPoints;
    const percentage = (currentScore / max) * 100;
    let thresholds = stats.value.scoreThresholds || [];
    if (thresholds.length === 0) return '?';
    thresholds = [...thresholds].sort((a, b) => b.min - a.min);
    for (const t of thresholds) {
        if (percentage >= t.min) return t.grade;
    }
    return '2.0';
}

const getGradeColorClass = (grade) => {
    if (grade === '2.0' || grade === '1') return 'grade-bad';
    if (grade.startsWith('5') || grade.startsWith('6')) return 'grade-excellent';
    return 'grade-good';
}

// --- LOGIKA SORTOWANIA (COMPUTED) ---
const sortedSessions = computed(() => {
    if (!stats.value || !stats.value.sessions) return [];
    
    // Tworzymy kopię tablicy, żeby nie psuć oryginału
    const list = [...stats.value.sessions];

    return list.sort((a, b) => {
        let valA = a[sortColumn.value];
        let valB = b[sortColumn.value];

        // Specjalna obsługa daty
        if (sortColumn.value === 'started_at') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }
        // Specjalna obsługa napisów (imion) - ignorujemy wielkość liter
        else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1;
        return 0;
    });
});

// Funkcja zmieniająca sortowanie po kliknięciu w nagłówek
const sortBy = (column) => {
    if (sortColumn.value === column) {
        // Jeśli kliknięto w to samo -> odwróć kolejność
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        // Nowa kolumna -> ustaw domyślny kierunek
        sortColumn.value = column;
        sortDirection.value = 'desc'; // Dla liczb/dat zazwyczaj chcemy najpierw największe
        if (column === 'guest_name') sortDirection.value = 'asc'; // Dla nazwisk A-Z
    }
}

// Helper do wyświetlania strzałki
const getSortArrow = (column) => {
    if (sortColumn.value !== column) return '↕'; // Domyślna "nieaktywna" strzałka
    return sortDirection.value === 'asc' ? '▲' : '▼';
}

// --- WYKRESY ---
const passFailData = computed(() => {
    if (!stats.value || !stats.value.sessions) return null;
    let passed = 0;
    let failed = 0;
    stats.value.sessions.forEach(s => {
        const grade = calculateGrade(s.score);
        if (grade === '2.0' || grade === '1') failed++;
        else passed++;
    });
    return {
        labels: ['Zdało', 'Nie zdało'],
        datasets: [{ backgroundColor: ['#2ecc71', '#e74c3c'], data: [passed, failed] }]
    };
});

const gradeDistributionData = computed(() => {
    if (!stats.value || !stats.value.sessions) return null;
    const counts = {};
    stats.value.scoreThresholds.forEach(t => counts[t.grade] = 0);
    counts['2.0'] = 0;
    stats.value.sessions.forEach(s => {
        const g = calculateGrade(s.score);
        counts[g] = (counts[g] || 0) + 1;
    });
    const labels = Object.keys(counts).sort();
    return {
        labels,
        datasets: [{ label: 'Liczba ocen', backgroundColor: '#3498db', data: labels.map(l => counts[l]) }]
    };
});

const questionDifficultyData = computed(() => {
    if (!stats.value || !stats.value.questions || !stats.value.sessions) return null;
    const data = stats.value.questions.map(q => {
        let earnedSum = 0;
        let maxPossible = 0;
        stats.value.sessions.forEach(s => {
            const ans = s.Answers.find(a => a.Question && a.Question.id === q.id);
            if (ans) earnedSum += (ans.points_earned || 0);
            maxPossible += q.points;
        });
        const percent = maxPossible > 0 ? Math.round((earnedSum / maxPossible) * 100) : 0;
        return { text: q.text, percent };
    });
    data.sort((a, b) => a.percent - b.percent);
    return {
        labels: data.map(d => d.text.length > 20 ? d.text.substring(0, 20) + '...' : d.text),
        datasets: [{
            label: 'Średni % punktów',
            backgroundColor: data.map(d => d.percent < 50 ? '#e74c3c' : (d.percent < 80 ? '#f39c12' : '#2ecc71')),
            data: data.map(d => d.percent),
            indexAxis: 'y'
        }]
    };
});

const chartOptions = { responsive: true, maintainAspectRatio: false };
const horizontalOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false };

const fetchStats = async () => {
    try {
        const { data } = await api.get(`/tests/${route.params.id}/stats`)
        stats.value = data
    } catch (e) { console.error(e) } finally { loading.value = false }
}

onMounted(fetchStats)

const toggleDetails = (sessionId) => {
    expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId
}

const savePoints = async (session, answerId, points) => {
    try {
        await api.post(`/tests/sessions/${session.id}/grade`, {
            grades: { [answerId]: points }
        })
        const ans = session.Answers.find(a => a.id === answerId)
        if (ans) {
            ans.points_earned = parseFloat(points);
            if (ans.points_earned === ans.Question.points) ans.is_correct = true;
            else if (ans.points_earned === 0) ans.is_correct = false;
            else ans.is_correct = null; 
        }
        await fetchStats() 
    } catch (e) { alert("Błąd zapisu oceny") }
}
</script>

<template>
    <div class="stats-page">
        <button class="back-btn" @click="router.push('/my-tests')">← Wróć</button>
        
        <div v-if="loading" class="center">Ładowanie danych...</div>
        
        <div v-else-if="stats" class="content">
            <header>
                <h1>📊 Statystyki: {{ stats.title }}</h1>
                <p>Szczegółowa analiza wyników</p>
            </header>

            <div class="summary-cards">
                <div class="card">
                    <h3>Rozwiązania</h3>
                    <p class="big-num">{{ stats.count }}</p>
                </div>
                <div class="card">
                    <h3>Średnia</h3>
                    <p class="big-num">{{ stats.avgScore }}</p>
                </div>
                <div class="card">
                    <h3>Max wynik</h3>
                    <p class="big-num">{{ stats.maxScore }}</p>
                </div>
            </div>

            <div class="charts-section" v-if="stats.count > 0">
                <div class="chart-card">
                    <h3>Zdawalność</h3>
                    <div class="chart-wrapper"><Doughnut v-if="passFailData" :data="passFailData" :options="chartOptions" /></div>
                </div>
                <div class="chart-card">
                    <h3>Rozkład Ocen</h3>
                    <div class="chart-wrapper"><Bar v-if="gradeDistributionData" :data="gradeDistributionData" :options="chartOptions" /></div>
                </div>
                <div class="chart-card full-width">
                    <h3>Ranking Trudności Pytań (Średni % pkt)</h3>
                    <div class="chart-wrapper"><Bar v-if="questionDifficultyData" :data="questionDifficultyData" :options="horizontalOptions" /></div>
                </div>
            </div>

            <div class="table-container">
                <h2>📝 Indywidualne Rozwiązania</h2>
                <div v-if="!stats.sessions.length" class="empty-msg">Brak rozwiązań.</div>
                
                <div v-if="stats.sessions.length" class="list-header">
                    <div class="col name sortable" @click="sortBy('guest_name')">
                        Uczeń {{ getSortArrow('guest_name') }}
                    </div>
                    <div class="col score sortable" @click="sortBy('score')">
                        Wynik {{ getSortArrow('score') }}
                    </div>
                    <div class="col date sortable" @click="sortBy('started_at')">
                        Data {{ getSortArrow('started_at') }}
                    </div>
                    <div class="col arrow"></div>
                </div>
                
                <div v-for="s in sortedSessions" :key="s.id" class="session-row">
                    <div class="session-header" @click="toggleDetails(s.id)">
                        <div class="col name">{{ s.guest_name }}</div>
                        <div class="col score">
                        <span class="badge" :class="{'pending': s.Answers.some(a => a.points_earned === null)}">
                            {{ s.score }} / {{ stats.totalMaxPoints }} pkt
                        </span>
                        
                        <span class="grade-pill" :class="getGradeColorClass(calculateGrade(s.score))">
                            {{ calculateGrade(s.score) }}
                        </span>
                    </div>
                        <div class="col date">{{ new Date(s.started_at).toLocaleString() }}</div>
                        <div class="col arrow">{{ expandedSessionId === s.id ? '▲' : '▼' }}</div>
                    </div>

                    <div v-if="expandedSessionId === s.id" class="session-details">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30%">Pytanie</th>
                                    <th style="width: 30%">Odpowiedź</th>
                                    <th style="width: 20%">Punkty</th>
                                    <th style="width: 20%">Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="ans in s.Answers" :key="ans.id">
                                    <td class="q-text">
                                        <div class="q-title">{{ ans.Question.text }}</div>
                                        <div class="q-meta">(Max: {{ ans.Question.points }} pkt)</div>
                                    </td>
                                    <td class="ans-text">
                                        <span v-if="ans.answer_text">{{ ans.answer_text }}</span>
                                        <span v-else style="color:#999; font-style:italic;">(Brak odp.)</span>
                                    </td>
                                    <td>
                                        <div class="points-input-wrapper">
                                            <input type="number" :value="ans.points_earned" 
                                                @input="ans.newPoints = $event.target.value"
                                                :placeholder="ans.points_earned" class="points-input"
                                                min="0" :max="ans.Question.points" />
                                            <span class="slash">/ {{ ans.Question.points }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button class="save-grade-btn" 
                                            @click="savePoints(s, ans.id, ans.newPoints !== undefined ? ans.newPoints : ans.points_earned)">
                                            Zapisz
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.stats-page { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; color: var(--color-text); }
.back-btn { background: none; border: none; font-size: 1rem; color: #2ecc71; cursor: pointer; margin-bottom: 1rem; }
.center { text-align: center; margin-top: 50px; }
.empty-msg { padding: 20px; text-align: center; color: var(--color-text-light-2); }

.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 2rem; }
.card { background: var(--color-background-soft); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--color-border); }
.card h3 { font-size: 1rem; color: var(--color-text-light-2); margin-bottom: 10px; }
.big-num { font-size: 2.5rem; font-weight: bold; color: #2ecc71; margin: 0; }

.charts-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 3rem; }
.chart-card { background: var(--color-background-soft); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }
.chart-card.full-width { grid-column: 1 / -1; }
.chart-card h3 { text-align: center; margin-bottom: 15px; font-size: 1rem; color: var(--color-text-light-2); }
.chart-wrapper { height: 250px; position: relative; }
@media(max-width: 768px) { .charts-section { grid-template-columns: 1fr; } }

.table-container { background: var(--color-background-soft); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }
.table-container h2 { margin-bottom: 1rem; font-size: 1.2rem; }

.grade-pill { display: inline-block; margin-left: 10px; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem; border: 1px solid currentColor; }
.grade-excellent { color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
.grade-good { color: #3498db; background: rgba(52, 152, 219, 0.1); }
.grade-bad { color: #e74c3c; background: rgba(231, 76, 60, 0.1); }

/* STYLE DLA NAGŁÓWKA SORTOWANIA */
.list-header {
    display: flex;
    padding: 15px;
    background: var(--color-background-mute);
    border-bottom: 2px solid var(--color-border);
    font-weight: bold;
    color: var(--color-text-light-2);
    font-size: 0.9rem;
    text-transform: uppercase;
}
.sortable { cursor: pointer; user-select: none; transition: 0.2s; display: flex; align-items: center; gap: 5px; }
.sortable:hover { color: var(--color-heading); }

.session-row { border-bottom: 1px solid var(--color-border); }
.session-row:last-child { border-bottom: none; }
.session-header { display: flex; align-items: center; padding: 15px; cursor: pointer; transition: 0.2s; }
.session-header:hover { background: var(--color-background-mute); }

.col { flex: 1; }
.col.name { font-weight: bold; font-size: 1.1rem; }
.col.score { text-align: center; }
.col.date { text-align: right; color: var(--color-text-light-2); font-size: 0.9rem; }
.col.arrow { flex: 0 0 30px; text-align: center; }

.badge { background: #2ecc71; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; }
.badge.pending { background: #f39c12; }

.session-details { background: var(--color-background); padding: 15px; border-top: 1px solid var(--color-border); }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th { text-align: left; color: var(--color-text-light-2); padding: 8px; border-bottom: 2px solid var(--color-border); }
td { padding: 10px 8px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }

.q-title { font-weight: 500; }
.q-meta { font-size: 0.8rem; color: var(--color-text-light-2); }
.ans-text { font-weight: bold; color: var(--color-heading); }

.points-input-wrapper { display: flex; align-items: center; gap: 5px; }
.points-input { width: 60px; padding: 5px; border: 1px solid var(--color-border); border-radius: 4px; text-align: center; font-weight: bold; font-size: 1rem; background: var(--color-background); color: var(--color-text); }
.slash { color: var(--color-text-light-2); }

.save-grade-btn { background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.save-grade-btn:hover { background: #2980b9; }
</style>