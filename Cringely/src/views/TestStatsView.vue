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

// Rejestracja komponentów Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const route = useRoute()
const router = useRouter()
const stats = ref(null)
const loading = ref(true)
const expandedSessionId = ref(null)

// --- LOGIKA OCEN ---
const calculateGrade = (score, maxPoints, thresholds) => {
    if (!maxPoints) return '-';
    const percentage = (score / maxPoints) * 100;
    if (!thresholds || thresholds.length === 0) return '?';

    // Sortujemy progi malejąco
    const sorted = [...thresholds].sort((a, b) => b.min - a.min);
    for (const t of sorted) {
        if (percentage >= t.min) return t.grade;
    }
    return '2.0'; // Domyślna ocena poniżej progów
}

const getGradeColorClass = (grade) => {
    if (grade === '2.0' || grade === '1') return 'grade-bad';
    if (grade.startsWith('5') || grade.startsWith('6')) return 'grade-excellent';
    return 'grade-good';
}

// --- DANE DO WYKRESÓW (COMPUTED) ---

// 1. Rozkład Ocen (Bar Chart)
const gradesDistributionData = computed(() => {
    if (!stats.value || !stats.value.sessions) return null;

    const distribution = {};
    // Inicjalizacja możliwych ocen (opcjonalne, ale ładniej wygląda)
    stats.value.scoreThresholds.forEach(t => distribution[t.grade] = 0);
    distribution['2.0'] = 0;

    stats.value.sessions.forEach(session => {
        const grade = calculateGrade(session.score, stats.value.totalMaxPoints, stats.value.scoreThresholds);
        distribution[grade] = (distribution[grade] || 0) + 1;
    });

    // Sortowanie kluczy ocen (od 2.0 do 6.0)
    const labels = Object.keys(distribution).sort();
    
    return {
        labels,
        datasets: [{
            label: 'Liczba studentów',
            data: labels.map(l => distribution[l]),
            backgroundColor: labels.map(l => 
                (l === '2.0' || l === '1') ? '#e74c3c' : 
                (l.startsWith('5') ? '#2ecc71' : '#3498db')
            ),
            borderRadius: 6
        }]
    }
})

// 2. Trudność Pytań (Horizontal Bar Chart)
const questionsStatsData = computed(() => {
    if (!stats.value || !stats.value.questions) return null;

    const questionStats = stats.value.questions.map(q => {
        let correctCount = 0;
        let totalCount = 0;

        stats.value.sessions.forEach(session => {
            // Szukamy odpowiedzi na to konkretne pytanie
            const ans = session.Answers.find(a => a.Question && a.Question.id === q.id);
            if (ans) {
                totalCount++;
                if (ans.is_correct) correctCount++;
            }
        });

        const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        return { text: q.text, percentage };
    });

    // Sortujemy od najtrudniejszych (najniższy %)
    questionStats.sort((a, b) => a.percentage - b.percentage);

    return {
        labels: questionStats.map(q => q.text.length > 30 ? q.text.substring(0, 30) + '...' : q.text),
        datasets: [{
            label: 'Poprawność (%)',
            data: questionStats.map(q => q.percentage),
            backgroundColor: questionStats.map(q => {
                if (q.percentage < 40) return '#e74c3c'; // Trudne - czerwone
                if (q.percentage < 75) return '#f39c12'; // Średnie - pomarańczowe
                return '#2ecc71'; // Łatwe - zielone
            }),
            borderRadius: 4,
            indexAxis: 'y' // Wykres poziomy
        }]
    }
})

const chartOptions = {
    responsive: true,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: { beginAtZero: true }
    }
}
const horizontalOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { max: 100 } }
}

// --- API ---
const fetchStats = async () => {
    try {
        const { data } = await api.get(`/tests/${route.params.id}/stats`)
        stats.value = data
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
}

onMounted(fetchStats)

const toggleDetails = (sessionId) => {
    expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId
}

const gradeAnswer = async (session, answerId, isCorrect) => {
    try {
        await api.post(`/tests/sessions/${session.id}/grade`, { grades: { [answerId]: isCorrect } })
        const ans = session.Answers.find(a => a.id === answerId)
        if (ans) ans.is_correct = isCorrect
        
        // Ponowne przeliczenie statystyk wymagałoby odświeżenia całej listy, 
        // ale dla płynności UI zmieniamy lokalnie status. 
        // W idealnym świecie wołamy fetchStats() ponownie, żeby odświeżyć wykresy.
        fetchStats(); 
    } catch (e) {
        alert("Błąd zapisu oceny")
    }
}
</script>

<template>
    <div class="stats-page">
        <button class="back-btn" @click="router.push('/my-tests')">← Wróć do listy</button>
        
        <div v-if="loading" class="center">
            <div class="loader"></div>
            <p>Analizowanie danych...</p>
        </div>
        
        <div v-else-if="stats" class="content">
            <header class="stats-header">
                <h1>📊 Raport: {{ stats.title }}</h1>
                <p class="subtitle">Szczegółowa analiza wyników Twoich uczniów</p>
            </header>

            <div class="summary-cards">
                <div class="card">
                    <h3>📝 Rozwiązania</h3>
                    <p class="big-num">{{ stats.count }}</p>
                </div>
                <div class="card">
                    <h3>📈 Średnia pkt</h3>
                    <p class="big-num">{{ stats.avgScore }} <span class="small">/ {{ stats.totalMaxPoints }}</span></p>
                </div>
                <div class="card">
                    <h3>🏆 Najlepszy wynik</h3>
                    <p class="big-num">{{ stats.maxScore }}</p>
                </div>
                <div class="card highlight">
                    <h3>🎓 Zaliczyło</h3>
                    <p class="big-num">
                        {{ stats.sessions.filter(s => calculateGrade(s.score, stats.totalMaxPoints, stats.scoreThresholds) !== '2.0').length }}
                        <span class="small">/ {{ stats.count }}</span>
                    </p>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <h3>📊 Rozkład Ocen</h3>
                    <div class="chart-container">
                        <Bar v-if="gradesDistributionData" :data="gradesDistributionData" :options="chartOptions" />
                        <p v-else>Brak danych do wykresu</p>
                    </div>
                </div>

                <div class="chart-box">
                    <h3>🔥 Najtrudniejsze Pytania (% poprawnych)</h3>
                    <div class="chart-container">
                        <Bar v-if="questionsStatsData" :data="questionsStatsData" :options="horizontalOptions" />
                        <p v-else>Brak danych do wykresu</p>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <h2>👤 Indywidualne wyniki</h2>
                <div v-if="!stats.sessions.length" class="empty-msg">Nikt jeszcze nie rozwiązał tego testu.</div>
                
                <div v-for="s in stats.sessions" :key="s.id" class="session-row">
                    <div class="session-header" @click="toggleDetails(s.id)">
                        <div class="col name">{{ s.guest_name }}</div>
                        <div class="col score">
                            <span class="score-text">{{ s.score }} pkt</span>
                            <span class="grade-badge" :class="getGradeColorClass(calculateGrade(s.score, stats.totalMaxPoints, stats.scoreThresholds))">
                                {{ calculateGrade(s.score, stats.totalMaxPoints, stats.scoreThresholds) }}
                            </span>
                        </div>
                        <div class="col date">{{ new Date(s.started_at).toLocaleDateString() }} {{ new Date(s.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</div>
                        <div class="col arrow">
                            <span v-if="s.Answers.some(a => a.is_correct === null)" class="dot-warning" title="Wymaga oceny">●</span>
                            {{ expandedSessionId === s.id ? '▲' : '▼' }}
                        </div>
                    </div>

                    <div v-if="expandedSessionId === s.id" class="session-details">
                        <table>
                            <thead>
                                <tr>
                                    <th>Pytanie</th>
                                    <th>Odpowiedź</th>
                                    <th style="width: 120px">Ocena</th>
                                    <th style="width: 100px">Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="ans in s.Answers" :key="ans.id">
                                    <td class="q-text" :title="ans.Question?.text">{{ ans.Question?.text || '(Usunięte pytanie)' }}</td>
                                    <td class="ans-text">{{ ans.answer_text }}</td>
                                    <td>
                                        <span v-if="ans.is_correct === true" class="status ok">Dobrze (+{{ans.Question?.points}})</span>
                                        <span v-else-if="ans.is_correct === false" class="status bad">Źle (0)</span>
                                        <span v-else class="status wait">Czeka</span>
                                    </td>
                                    <td>
                                        <div class="grade-btns">
                                            <button @click="gradeAnswer(s, ans.id, true)" class="btn-ok" :class="{active: ans.is_correct === true}">✓</button>
                                            <button @click="gradeAnswer(s, ans.id, false)" class="btn-bad" :class="{active: ans.is_correct === false}">✗</button>
                                        </div>
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
.stats-page { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem; color: var(--color-text); }
.back-btn { background: none; border: none; font-size: 1rem; color: var(--color-text-light-2); cursor: pointer; margin-bottom: 1.5rem; transition: 0.2s; }
.back-btn:hover { color: var(--color-heading); }

.stats-header { margin-bottom: 2rem; }
.stats-header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--color-text-light-2); }

/* KAFELKI */
.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 2rem; }
.card { background: var(--color-background-soft); padding: 25px; border-radius: 16px; text-align: center; border: 1px solid var(--color-border); transition: transform 0.2s; }
.card:hover { transform: translateY(-2px); }
.card.highlight { background: rgba(46, 204, 113, 0.05); border-color: #2ecc71; }
.card h3 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-light-2); margin-bottom: 10px; }
.big-num { font-size: 2.5rem; font-weight: 800; color: var(--color-heading); margin: 0; }
.big-num .small { font-size: 1rem; color: var(--color-text-light-2); font-weight: normal; }

/* WYKRESY */
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 2rem; }
@media (max-width: 768px) { .charts-grid { grid-template-columns: 1fr; } }

.chart-box { background: var(--color-background-soft); padding: 20px; border-radius: 16px; border: 1px solid var(--color-border); }
.chart-box h3 { margin-bottom: 15px; font-size: 1.1rem; text-align: center; }
.chart-container { height: 250px; position: relative; }

/* TABELA */
.table-container { background: var(--color-background-soft); border-radius: 16px; border: 1px solid var(--color-border); overflow: hidden; }
.table-container h2 { padding: 20px; margin: 0; font-size: 1.2rem; border-bottom: 1px solid var(--color-border); background: var(--color-background-mute); }

.session-row { border-bottom: 1px solid var(--color-border); }
.session-row:last-child { border-bottom: none; }

.session-header { display: flex; align-items: center; padding: 15px 20px; cursor: pointer; transition: 0.2s; }
.session-header:hover { background: var(--color-background-mute); }
.col.name { flex: 2; font-weight: 600; font-size: 1.05rem; }
.col.score { flex: 1; display: flex; gap: 10px; align-items: center; justify-content: center; }
.col.date { flex: 1.5; text-align: right; color: var(--color-text-light-2); font-size: 0.9rem; }
.col.arrow { flex: 0 0 40px; text-align: right; color: var(--color-text-light-2); display: flex; align-items: center; justify-content: flex-end; gap: 10px; }

.score-text { font-weight: bold; }
.grade-badge { padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.85rem; }
.grade-excellent { color: #2ecc71; background: rgba(46, 204, 113, 0.15); }
.grade-good { color: #3498db; background: rgba(52, 152, 219, 0.15); }
.grade-bad { color: #e74c3c; background: rgba(231, 76, 60, 0.15); }

.dot-warning { color: #f39c12; font-size: 1.2rem; animation: pulse 2s infinite; }

/* SZCZEGÓŁY */
.session-details { background: var(--color-background); padding: 20px; border-top: 1px solid var(--color-border); box-shadow: inset 0 0 10px rgba(0,0,0,0.02); }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { text-align: left; color: var(--color-text-light-2); padding: 10px; border-bottom: 2px solid var(--color-border); }
td { padding: 12px 10px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.q-text { max-width: 300px; color: var(--color-text-light-1); }
.ans-text { font-weight: 500; color: var(--color-heading); }
.status { font-weight: 600; font-size: 0.85rem; }
.status.ok { color: #2ecc71; }
.status.bad { color: #e74c3c; }
.status.wait { color: #f39c12; }

.grade-btns { display: flex; gap: 6px; }
.grade-btns button { width: 32px; height: 32px; border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: 0.2s; background: var(--color-background); color: var(--color-text-light-2); }
.grade-btns .btn-ok:hover, .grade-btns .btn-ok.active { background: #2ecc71; color: white; border-color: #2ecc71; }
.grade-btns .btn-bad:hover, .grade-btns .btn-bad.active { background: #e74c3c; color: white; border-color: #e74c3c; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
.loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>