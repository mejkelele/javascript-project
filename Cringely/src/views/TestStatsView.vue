<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()
const stats = ref(null)
const loading = ref(true)
const expandedSessionId = ref(null) // ID rozwiniętej sesji

const calculateGrade = (currentScore) => {
    if (!stats.value || !stats.value.totalMaxPoints || stats.value.totalMaxPoints === 0) return '-';

    const max = stats.value.totalMaxPoints;
    const percentage = (currentScore / max) * 100;
    
    let thresholds = stats.value.scoreThresholds || [];

    if (thresholds.length === 0) return '?';

    thresholds = [...thresholds].sort((a, b) => b.min - a.min);

    for (const t of thresholds) {
        if (percentage >= t.min) {
            return t.grade;
        }
    }

    return '2.0';
}

const getGradeColorClass = (grade) => {
    if (grade === '2.0' || grade === '1') return 'grade-bad';
    if (grade.startsWith('5') || grade.startsWith('6')) return 'grade-excellent';
    return 'grade-good';
}

// Pobieranie danych
const fetchStats = async () => {
    try {
        const { data } = await api.get(`/tests/${route.params.id}/stats`)
        stats.value = data
    } catch (e) {
        // alert("Błąd pobierania statystyk") // Opcjonalnie odkomentuj
        console.error(e)
        // router.push('/my-tests') // Opcjonalnie przekieruj
    } finally {
        loading.value = false
    }
}

onMounted(fetchStats)

const toggleDetails = (sessionId) => {
    expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId
}

// Funkcja oceniania (Zalicz / Odrzuć)
const gradeAnswer = async (session, answerId, isCorrect) => {
    try {
        await api.post(`/tests/sessions/${session.id}/grade`, {
            grades: { [answerId]: isCorrect }
        })
        
        // Aktualizuj lokalnie, żeby nie przeładowywać całej strony
        const ans = session.Answers.find(a => a.id === answerId)
        if (ans) ans.is_correct = isCorrect
        
        // Zaktualizuj wynik sesji (odświeżamy dane)
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
                    <h3>Średni wynik</h3>
                    <p class="big-num">{{ stats.avgScore }}</p>
                </div>
                <div class="card">
                    <h3>Najlepszy wynik</h3>
                    <p class="big-num">{{ stats.maxScore }}</p>
                </div>
            </div>

            <div class="table-container">
                <h2>Lista rozwiązań (kliknij, aby sprawdzić)</h2>
                <div v-if="!stats.sessions.length" class="empty-msg">Brak rozwiązań.</div>
                
                <div v-for="s in stats.sessions" :key="s.id" class="session-row">
                    <div class="session-header" @click="toggleDetails(s.id)">
                        <div class="col name">{{ s.guest_name }}</div>
                        <div class="col score">
                        <span class="badge" :class="{'pending': s.Answers.some(a => a.is_correct === null)}">
                            {{ s.score }} / {{ stats.totalMaxPoints }} pkt
                        </span>
                        
                        <span class="grade-pill" :class="getGradeColorClass(calculateGrade(s.score))">
                            Ocena: {{ calculateGrade(s.score) }}
                        </span>
                    </div>
                        <div class="col date">{{ new Date(s.started_at).toLocaleString() }}</div>
                        <div class="col arrow">{{ expandedSessionId === s.id ? '▲' : '▼' }}</div>
                    </div>

                    <div v-if="expandedSessionId === s.id" class="session-details">
                        <table>
                            <thead>
                                <tr>
                                    <th>Pytanie</th>
                                    <th>Odpowiedź Ucznia</th>
                                    <th>Status</th>
                                    <th>Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="ans in s.Answers" :key="ans.id">
                                    <td class="q-text" :title="ans.Question.text">{{ ans.Question.text }}</td>
                                    <td class="ans-text">{{ ans.answer_text }}</td>
                                    <td>
                                        <span v-if="ans.is_correct === true" class="status ok">✅ Dobrze</span>
                                        <span v-else-if="ans.is_correct === false" class="status bad">❌ Źle</span>
                                        <span v-else class="status wait">⏳ Do oceny</span>
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
.stats-page { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
.back-btn { background: none; border: none; font-size: 1rem; color: #2ecc71; cursor: pointer; margin-bottom: 1rem; }
.center { text-align: center; margin-top: 50px; }
.empty-msg { padding: 20px; text-align: center; color: #7f8c8d; }

.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 3rem; }
.card { background: var(--color-background-soft); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid var(--color-border); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.card h3 { font-size: 1rem; color: var(--color-text-light-2); margin-bottom: 10px; }
.big-num { font-size: 2.5rem; font-weight: bold; color: #2ecc71; margin: 0; }

.table-container { background: var(--color-background-soft); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }

.grade-pill {
    display: inline-block;
    margin-left: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 0.9rem;
    border: 1px solid currentColor;
}
.grade-excellent { color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
.grade-good { color: #3498db; background: rgba(52, 152, 219, 0.1); }
.grade-bad { color: #e74c3c; background: rgba(231, 76, 60, 0.1); }


/* Lista sesji */
.session-row { border-bottom: 1px solid var(--color-border); }
.session-row:last-child { border-bottom: none; }

.session-header { display: flex; align-items: center; padding: 15px; cursor: pointer; transition: 0.2s; }
.session-header:hover { background: rgba(0,0,0,0.03); }
.col { flex: 1; }
.col.name { font-weight: bold; font-size: 1.1rem; }
.col.score { text-align: center; }
.col.date { text-align: right; color: var(--color-text-light-2); font-size: 0.9rem; }
.col.arrow { flex: 0 0 30px; text-align: center; }

.badge { background: #2ecc71; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; }
.badge.pending { background: #f39c12; } /* Pomarańczowy dla nieocenionych */

/* Szczegóły sesji */
.session-details { background: var(--color-background); padding: 15px; border-top: 1px solid var(--color-border); }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th { text-align: left; color: var(--color-text-light-2); padding: 8px; border-bottom: 2px solid var(--color-border); }
td { padding: 10px 8px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.q-text { max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ans-text { font-weight: 500; color: var(--color-heading); }

.status.ok { color: #2ecc71; }
.status.bad { color: #e74c3c; }
.status.wait { color: #f39c12; font-weight: bold; }

.grade-btns { display: flex; gap: 5px; }
.grade-btns button { width: 30px; height: 30px; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s; background: transparent; color: var(--color-text); }
.grade-btns .btn-ok:hover, .grade-btns .btn-ok.active { background: #2ecc71; color: white; border-color: #2ecc71; }
.grade-btns .btn-bad:hover, .grade-btns .btn-bad.active { background: #e74c3c; color: white; border-color: #e74c3c; }
</style>