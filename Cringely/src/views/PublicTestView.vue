<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { Doughnut, Bar } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const route = useRoute()
const accessCode = route.params.code
const auth = useAuthStore()

const test = ref(null)
const loading = ref(true)
const error = ref(null)
const guestName = ref('')
const isStarted = ref(false)
const answers = ref({}) 
const isSubmitting = ref(false)
const submissionResult = ref(null)
const leaderboard = ref([]) 

onMounted(async () => {
  try {
    const { data } = await api.get(`/tests/public/${accessCode}`)
    test.value = data
    
    // Inicjalizacja pustych tablic dla checkboxów
    if (test.value && test.value.Questions) {
        test.value.Questions.forEach(q => {
            if (q.is_multiple_choice) {
                answers.value[q.id] = []
            }
        });
    }

  } catch (e) {
    error.value = 'Nie znaleziono testu lub jest on prywatny.'
  } finally {
    loading.value = false
  }
})

onMounted(() => {
  if (auth.isAuthenticated && auth.user) {
    guestName.value = auth.user.name || auth.user.email
  }
})

const startTest = async () => {
  // 1. Logika dla NIEZALOGOWANYCH (Gości)
  if (!auth.isAuthenticated) {
    if (!guestName.value) {
      alert('Podaj swoje imię!')
      return
    }
    // Goście nie mają limitu, więc od razu startujemy
    isStarted.value = true
    return
  }

  // 2. Logika dla ZALOGOWANYCH (Sprawdzamy limit)
  try {
    // Dodajemy pusty obiekt {} jako drugi parametr
    await api.post(`/tests/check-access/${route.params.code}`, {})
    // Jeśli nie ma błędu (200 OK), startujemy
    isStarted.value = true
  } catch (e) {
    if (e.response && e.response.data && e.response.data.error) {
      alert(e.response.data.error) // Np. "Wykorzystano limit podejść"
    } else {
      alert("Wystąpił błąd podczas weryfikacji dostępu.")
    }
  }
}

const submitTest = async () => {
  if (!confirm('Czy na pewno chcesz zakończyć test?')) return

  isSubmitting.value = true
  try {
    const payload = {
      guest_name: guestName.value,
      answers: answers.value,
    }

    const { data } = await api.post(`/tests/solve/${accessCode}`, payload)
    submissionResult.value = data 
    await fetchLeaderboard()
  } catch (e) {
    if (e.response && e.response.status === 403) {
        alert(e.response.data.error || "Wyczerpano limit podejść.")
    } else {
        alert('Wystąpił błąd podczas wysyłania odpowiedzi.')
    }
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

const fetchLeaderboard = async () => {
  try {
    const { data } = await api.get(`/tests/public/leaderboard/${accessCode}`)
    leaderboard.value = data
  } catch (e) {
    console.error('Błąd pobierania rankingu', e)
  }
}

// --- WYKRESY ---
const efficiencyChartData = computed(() => {
    if (!submissionResult.value || !submissionResult.value.stats) return null;
    const s = submissionResult.value.stats;
    return {
        labels: ['Poprawne', 'Błędne', 'Do oceny'],
        datasets: [{
            backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12'],
            data: [s.correct, s.incorrect, s.pending]
        }]
    }
})

const comparisonChartData = computed(() => {
    if (!submissionResult.value) return null;
    const myScore = submissionResult.value.score;
    const avg = submissionResult.value.stats?.averageScore || 0;
    const max = submissionResult.value.maxPoints;
    return {
        labels: ['Twój Wynik', 'Średnia', 'Max możliwy'],
        datasets: [{
            label: 'Punkty',
            backgroundColor: ['#3498db', '#95a5a6', '#2c3e50'],
            data: [myScore, avg, max],
            borderRadius: 5
        }]
    }
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
}

const getResultForQuestion = (qId) => {
    if (!submissionResult.value?.resultsDetails) return null;
    return submissionResult.value.resultsDetails[qId];
}

const isOptionSelected = (qId, optId) => {
    const res = getResultForQuestion(qId);
    if (!res) return false;
    
    if (Array.isArray(res.userAnswer)) {
        return res.userAnswer.map(String).includes(String(optId));
    }
    return String(res.userAnswer) === String(optId);
}

// --- POPRAWKA BŁĘDU ---
const isOptionCorrect = (qId, optId) => {
    const res = getResultForQuestion(qId);
    if (!res) return false;

    // Checkbox (wiele poprawnych) - sprawdzamy tylko gdy tablica NIE jest pusta
    if (res.correctOptionIds && Array.isArray(res.correctOptionIds) && res.correctOptionIds.length > 0) {
        return res.correctOptionIds.map(String).includes(String(optId));
    }
    // Fallback dla Radio (jednokrotny)
    return String(res.correctOptionId) === String(optId);
}
</script>

<template>
  <div class="public-page">
    <div v-if="loading" class="center">Ładowanie testu...</div>
    <div v-else-if="error" class="center err">{{ error }}</div>

    <div v-else class="test-container">
      
      <div v-if="!isStarted && !submissionResult" class="public-start">
        <div class="public-card start-card">
          <h1 class="public-title">{{ test.title }}</h1>
          <p class="public-author">Autor: {{ test.User?.name || 'Nieznany' }}</p>
          <p class="desc">{{ test.description }}</p>

          <div v-if="test.attempts_limit > 0" class="limit-info">
             ⚠️ Ten test ma limit podejść: <strong>{{ test.attempts_limit }}</strong>
          </div>

          <div class="guest-form">
            <template v-if="!auth.isAuthenticated">
              <label>Twoje imię / nick</label>
              <input v-model="guestName" placeholder="Jan Kowalski" />
            </template>
            <template v-else>
              <p class="logged-user">
                Rozwiązujesz jako: <strong>{{ auth.user.name || auth.user.email }}</strong>
              </p>
            </template>
            <button class="btn-green start-btn" @click="startTest">Rozpocznij test</button>
          </div>
        </div>
      </div>

      <div v-else-if="submissionResult" class="result-card">
        <h1>🏁 Wyniki Testu</h1>

        <div v-if="submissionResult.requiresGrading" class="pending-box">
          <p class="pending-msg">⚠️ Czekaj na ocenę zadań otwartych.</p>
        </div>

        <div class="score-header">
            <div class="score-circle" :class="{ partial: submissionResult.requiresGrading }">
                <span>{{ submissionResult.score }}</span>
                <span class="total">/ {{ submissionResult.maxPoints }}</span>
            </div>
            <div class="score-text">
                <h3>Dobra robota, {{ guestName }}!</h3>
                <p>Oto Twoje statystyki:</p>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-box" v-if="efficiencyChartData">
                <h4>Twoja skuteczność</h4>
                <div class="chart-wrapper">
                    <Doughnut :data="efficiencyChartData" :options="chartOptions" />
                </div>
            </div>
            <div class="chart-box" v-if="comparisonChartData">
                <h4>Porównanie z innymi</h4>
                <div class="chart-wrapper">
                    <Bar :data="comparisonChartData" :options="chartOptions" />
                </div>
            </div>
        </div>

        <div v-if="submissionResult.resultsDetails" class="review-section">
            <h3>🔎 Przegląd Odpowiedzi</h3>
            <div v-for="(q, index) in test.Questions" :key="q.id" class="review-item">
                
                <div class="review-header">
                    <span class="q-idx">#{{ index + 1 }}</span>
                    <span class="q-text">{{ q.text }}</span>
                    
                    <span v-if="getResultForQuestion(q.id)?.isCorrect === true" class="status-badge ok">✅ Dobrze</span>
                    <span v-else-if="getResultForQuestion(q.id)?.isCorrect === false" class="status-badge bad">❌ Źle</span>
                    <span v-else class="status-badge wait">⏳ Do oceny</span>
                </div>

                <div class="review-body">
                    <div v-if="q.question_type === 'ABC'">
                        <div v-for="opt in q.QuestionOptions" :key="opt.id" 
                             class="review-opt"
                             :class="{
                                'user-selected': isOptionSelected(q.id, opt.id),
                                'correct-answer': isOptionCorrect(q.id, opt.id)
                             }">
                             
                             <span v-if="isOptionSelected(q.id, opt.id) && isOptionCorrect(q.id, opt.id)">👏 Twoja poprawna: </span>
                             <span v-else-if="isOptionSelected(q.id, opt.id)">❌ Twoja błędna: </span>
                             <span v-else-if="isOptionCorrect(q.id, opt.id)">✅ Poprawna: </span>
                             
                             {{ opt.text }}
                        </div>
                    </div>

                    <div v-else-if="q.question_type === 'FILL'">
                        <p>Twoja odpowiedź: <strong>{{ getResultForQuestion(q.id)?.userAnswer || '(Brak)' }}</strong></p>
                        <p v-if="getResultForQuestion(q.id)?.isCorrect === false" class="correction-text">
                            Poprawna: <strong>{{ getResultForQuestion(q.id)?.correctText }}</strong>
                        </p>
                    </div>

                    <div v-else>
                        <p class="user-open-ans">{{ getResultForQuestion(q.id)?.userAnswer }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="leaderboard-box">
          <h3>🏆 Top 10 Najlepszych</h3>
          <ul v-if="leaderboard.length">
            <li v-for="(entry, idx) in leaderboard" :key="idx" :class="{ me: entry.guest_name === guestName }">
              <span class="rank">#{{ idx + 1 }}</span>
              <span class="name">{{ entry.guest_name }}</span>
              <span class="points">{{ entry.score }} pkt</span>
            </li>
          </ul>
          <p v-else class="empty-list">Bądź pierwszy na liście!</p>
        </div>
        
        <button class="btn-back" @click="$router.push('/')">Wróć na stronę główną</button>
      </div>

      <div v-else class="questions-view">
        <div class="header">
          <h2>{{ test.title }}</h2>
          <span>Uczeń: <strong>{{ guestName }}</strong></span>
        </div>

        <div v-for="(q, index) in test.Questions" :key="q.id" class="q-item">
          <div class="q-head">
            <span class="q-idx">{{ index + 1 }}.</span>
            <span class="q-text">{{ q.text }}</span>
            <span class="q-pts">({{ q.points }} pkt)</span>
            <span v-if="q.is_multiple_choice" class="multi-badge">(Wielokrotny wybór)</span>
          </div>

          <div v-if="q.question_type === 'ABC'" class="opts-group">
            <template v-if="q.is_multiple_choice">
                <label v-for="opt in q.QuestionOptions" :key="opt.id" class="opt-label" :class="{ selected: answers[q.id]?.includes(opt.id) }">
                    <input type="checkbox" :value="opt.id" v-model="answers[q.id]" />
                    {{ opt.text }}
                </label>
            </template>
            <template v-else>
                <label v-for="opt in q.QuestionOptions" :key="opt.id" class="opt-label" :class="{ selected: answers[q.id] === opt.id }">
                    <input type="radio" :name="'q' + q.id" :value="opt.id" v-model="answers[q.id]" />
                    {{ opt.text }}
                </label>
            </template>
          </div>

          <div v-else-if="q.question_type === 'FILL'" class="fill-group">
            <input type="text" v-model="answers[q.id]" placeholder="Wpisz odpowiedź..." />
          </div>

          <div v-else-if="q.question_type === 'OPEN'" class="open-group">
            <textarea v-model="answers[q.id]" placeholder="Twoja odpowiedź..."></textarea>
          </div>
        </div>

        <button class="finish-btn" @click="submitTest" :disabled="isSubmitting">
          {{ isSubmitting ? 'Wysyłanie...' : '🏁 Zakończ i wyślij' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.public-page { max-width: 800px; margin: 2rem auto; padding: 1rem; color: var(--color-text); }
.center { text-align: center; margin-top: 50px; font-size: 1.2rem; }
.err { color: #e74c3c; }

.public-card { background: var(--color-background-soft); padding: 40px; border-radius: 16px; text-align: center; border: 1px solid var(--color-border); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
.public-title { font-size: 2.5rem; color: #2ecc71; margin-bottom: 0.5rem; }
.public-author { color: var(--color-text-light-2); margin-bottom: 2rem; }
.desc { margin-bottom: 2rem; font-style: italic; }

.limit-info { background: #fff3cd; color: #856404; padding: 10px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ffeeba; }

.guest-form { display: flex; flex-direction: column; gap: 15px; max-width: 400px; margin: 0 auto; }
.guest-form input { padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-text); font-size: 1rem; }
.start-btn { padding: 12px; font-size: 1.2rem; background: #2ecc71; border: none; border-radius: 8px; color: white; cursor: pointer; transition: 0.2s; font-weight: bold; }
.start-btn:hover { background: #27ae60; transform: scale(1.02); }

/* WYNIKI */
.result-card { text-align: center; background: var(--color-background-soft); padding: 30px; border-radius: 16px; border: 1px solid var(--color-border); }
.score-header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 30px; }
.score-circle { width: 120px; height: 120px; background: #2ecc71; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 2.5rem; box-shadow: 0 5px 15px rgba(46, 204, 113, 0.4); }
.score-circle.partial { background: #f39c12; box-shadow: 0 5px 15px rgba(243, 156, 18, 0.4); }
.score-circle .total { font-size: 1rem; opacity: 0.8; }
.score-text h3 { margin: 0; font-size: 1.5rem; }
.pending-box { background: rgba(243, 156, 18, 0.1); color: #f39c12; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; }

/* WYKRESY */
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
@media(max-width: 600px) { .charts-row { grid-template-columns: 1fr; } }
.chart-box { background: var(--color-background); padding: 15px; border-radius: 12px; border: 1px solid var(--color-border); }
.chart-box h4 { margin-bottom: 10px; font-size: 1rem; color: var(--color-text-light-2); }
.chart-wrapper { height: 200px; position: relative; }

/* REVIEW SECTION */
.review-section { margin-bottom: 30px; text-align: left; }
.review-section h3 { margin-bottom: 15px; text-align: center; }
.review-item { background: var(--color-background); border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 10px; padding: 15px; }
.review-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; font-weight: bold; }
.q-text { flex: 1; }
.status-badge { font-size: 0.8rem; padding: 3px 8px; border-radius: 5px; background: #eee; }
.status-badge.ok { background: #d1fae5; color: #065f46; }
.status-badge.bad { background: #fee2e2; color: #991b1b; }
.status-badge.wait { background: #fef3c7; color: #92400e; }

.review-opt { padding: 8px; border-radius: 6px; margin-bottom: 4px; border: 1px solid transparent; }
.review-opt.user-selected { border-color: #e74c3c; background: rgba(231, 76, 60, 0.1); }
.review-opt.correct-answer { border-color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
.review-opt.user-selected.correct-answer { border-color: #2ecc71; background: rgba(46, 204, 113, 0.2); }

.correction-text { color: #2ecc71; margin-top: 5px; }
.user-open-ans { font-style: italic; color: var(--color-text-light-1); border-left: 3px solid #ccc; padding-left: 10px; }

/* LEADERBOARD */
.leaderboard-box { margin-top: 30px; background: var(--color-background); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }
.leaderboard-box ul { list-style: none; padding: 0; }
.leaderboard-box li { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--color-border); }
.leaderboard-box li:last-child { border-bottom: none; }
.leaderboard-box li.me { background: rgba(46, 204, 113, 0.1); font-weight: bold; border-radius: 6px; }
.rank { width: 40px; font-weight: bold; color: #2ecc71; }
.name { flex: 1; text-align: left; }

.btn-back { margin-top: 20px; background: none; border: 1px solid var(--color-border); padding: 10px 20px; border-radius: 8px; color: var(--color-text-light-2); cursor: pointer; transition: 0.2s; }
.btn-back:hover { background: var(--color-background-mute); color: var(--color-heading); }

/* PYTANIA */
.questions-view { display: flex; flex-direction: column; gap: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; background: var(--color-background-soft); padding: 15px 20px; border-radius: 12px; border: 1px solid var(--color-border); }
.q-item { background: var(--color-background-soft); padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); }
.q-head { display: flex; gap: 10px; font-weight: bold; font-size: 1.1rem; margin-bottom: 15px; }
.q-text { flex: 1; }
.q-pts { color: var(--color-text-light-2); font-size: 0.9rem; }
.multi-badge { font-size: 0.8rem; color: #3498db; font-weight: normal; margin-left: 5px; }

.opts-group { display: flex; flex-direction: column; gap: 8px; }
.opt-label { padding: 10px; border: 2px solid var(--color-border); border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; gap: 10px; align-items: center; }
.opt-label:hover { background: var(--color-background-mute); }
.opt-label.selected { border-color: #3498db; background: rgba(52, 152, 219, 0.1); }
.finish-btn { padding: 15px; background: #3498db; color: white; border: none; border-radius: 12px; font-size: 1.2rem; font-weight: bold; cursor: pointer; margin-top: 20px; transition: 0.2s; }
.finish-btn:hover { background: #2980b9; }
.fill-group input, .open-group textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-text); }
</style>