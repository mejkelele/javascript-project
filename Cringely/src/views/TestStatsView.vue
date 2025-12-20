<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()
const stats = ref(null)
const loading = ref(true)
const expandedSessionId = ref(null) 

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

const fetchStats = async () => {
    try {
        // Dodatkowa flaga w zapytaniu, żeby backend wiedział, że chcemy wszystko
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

// Funkcja zapisu punktów
const savePoints = async (session, answerId, points) => {
    try {
        await api.post(`/tests/sessions/${session.id}/grade`, {
            grades: { [answerId]: points }
        })
        
        // Aktualizacja lokalna
        const ans = session.Answers.find(a => a.id === answerId)
        if (ans) {
            ans.points_earned = parseFloat(points);
            // Aktualizuj status wizualny
            if (ans.points_earned === ans.Question.points) ans.is_correct = true;
            else if (ans.points_earned === 0) ans.is_correct = false;
            else ans.is_correct = null; // Częściowe punkty
        }

        // Odśwież całość (żeby przeliczyć sumę i oceny)
        await fetchStats() 

    } catch (e) {
        alert("Błąd zapisu oceny")
    }
}
</script>

<template>
    <div class="stats-page">
        <button class="back-btn" @click="router.push('/my-tests')">← Wróć</button>
        
        <div v-if="loading" class="center">Ładowanie danych...</div>
        
        <div v-else-if="stats" class="content">
            <h1>📊 Statystyki: {{ stats.title }}</h1>

            <div class="summary-cards">
                <div class="card">
                    <h3>Liczba rozwiązań</h3>
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

            <div class="table-container">
                <h2>Rozwiązania</h2>
                <div v-if="!stats.sessions.length" class="empty-msg">Brak rozwiązań.</div>
                
                <div v-for="s in stats.sessions" :key="s.id" class="session-row">
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
                                            <input 
                                                type="number" 
                                                :value="ans.points_earned" 
                                                @input="ans.newPoints = $event.target.value"
                                                :placeholder="ans.points_earned"
                                                class="points-input"
                                                min="0"
                                                :max="ans.Question.points"
                                            />
                                            <span class="slash">/ {{ ans.Question.points }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button 
                                            class="save-grade-btn" 
                                            @click="savePoints(s, ans.id, ans.newPoints !== undefined ? ans.newPoints : ans.points_earned)"
                                        >
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
.stats-page { max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: var(--color-text); }
.back-btn { background: none; border: none; font-size: 1rem; color: #2ecc71; cursor: pointer; margin-bottom: 1rem; }
.center { text-align: center; margin-top: 50px; }
.empty-msg { padding: 20px; text-align: center; color: var(--color-text-light-2); }

.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 3rem; }
.card { background: var(--color-background-soft); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--color-border); }
.card h3 { font-size: 1rem; color: var(--color-text-light-2); margin-bottom: 10px; }
.big-num { font-size: 2.5rem; font-weight: bold; color: #2ecc71; margin: 0; }

.table-container { background: var(--color-background-soft); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }

.grade-pill { display: inline-block; margin-left: 10px; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem; border: 1px solid currentColor; }
.grade-excellent { color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
.grade-good { color: #3498db; background: rgba(52, 152, 219, 0.1); }
.grade-bad { color: #e74c3c; background: rgba(231, 76, 60, 0.1); }

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

/* INPUT STYLES */
.points-input-wrapper { display: flex; align-items: center; gap: 5px; }
.points-input { width: 60px; padding: 5px; border: 1px solid var(--color-border); border-radius: 4px; text-align: center; font-weight: bold; font-size: 1rem; background: var(--color-background); color: var(--color-text); }
.slash { color: var(--color-text-light-2); }

.save-grade-btn { background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.save-grade-btn:hover { background: #2980b9; }
</style>