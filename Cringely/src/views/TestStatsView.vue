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
  ArcElement,
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const route = useRoute()
const router = useRouter()
const stats = ref(null)
const loading = ref(true)
const expandedSessionId = ref(null)

// --- ZMIENNE DO SORTOWANIA ---
const sortColumn = ref('started_at')
const sortDirection = ref('desc')

// --- LOGIKA OCEN ---
const calculateGrade = (currentScore) => {
  if (!stats.value || !stats.value.totalMaxPoints || stats.value.totalMaxPoints === 0) return '-'
  const max = stats.value.totalMaxPoints
  const percentage = (currentScore / max) * 100
  let thresholds = stats.value.scoreThresholds || []
  if (thresholds.length === 0) return '?'
  
  // Kopiujemy tablicę przed sortowaniem, by nie modyfikować oryginału (Vue warning fix)
  thresholds = [...thresholds].sort((a, b) => b.min - a.min)
  
  for (const t of thresholds) {
    if (percentage >= t.min) return t.grade
  }
  return '2.0'
}

const getGradeColorClass = (grade) => {
  if (grade === '2.0' || grade === '1') return 'grade-bad'
  if (grade.startsWith('5') || grade.startsWith('6')) return 'grade-excellent'
  return 'grade-good'
}

// --- SORTOWANIE ---
const sortedSessions = computed(() => {
  if (!stats.value || !stats.value.sessions) return []
  const list = [...stats.value.sessions]
  return list.sort((a, b) => {
    let valA = a[sortColumn.value]
    let valB = b[sortColumn.value]

    if (sortColumn.value === 'started_at') {
      valA = new Date(valA).getTime()
      valB = new Date(valB).getTime()
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase()
      valB = valB.toLowerCase()
    }

    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
})

const sortBy = (column) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'desc'
    if (column === 'guest_name') sortDirection.value = 'asc'
  }
}

const getSortArrow = (column) => {
  if (sortColumn.value !== column) return ''
  return sortDirection.value === 'asc' ? '▲' : '▼'
}

// --- WYKRESY ---
const passFailData = computed(() => {
  if (!stats.value || !stats.value.sessions) return null
  let passed = 0
  let failed = 0
  stats.value.sessions.forEach((s) => {
    const grade = calculateGrade(s.score)
    if (grade === '2.0' || grade === '1') failed++
    else passed++
  })
  return {
    labels: ['Zdało', 'Nie zdało'],
    datasets: [{ backgroundColor: ['#2ecc71', '#e74c3c'], data: [passed, failed] }],
  }
})

const gradeDistributionData = computed(() => {
  if (!stats.value || !stats.value.sessions) return null
  const counts = {}
  if (stats.value.scoreThresholds) {
    stats.value.scoreThresholds.forEach((t) => (counts[t.grade] = 0))
  }
  counts['2.0'] = 0
  stats.value.sessions.forEach((s) => {
    const g = calculateGrade(s.score)
    counts[g] = (counts[g] || 0) + 1
  })
  const labels = Object.keys(counts).sort()
  return {
    labels,
    datasets: [
      { label: 'Liczba ocen', backgroundColor: '#3498db', data: labels.map((l) => counts[l]) },
    ],
  }
})

const chartOptions = { responsive: true, maintainAspectRatio: false }

// --- API ---
const fetchStats = async () => {
  loading.value = true
  try {
    const { data } = await api.get(`/tests/${route.params.id}/stats`)
    stats.value = data
    
    // NAPRAWA REAKTYWNOŚCI: Inicjalizujemy pole 'newPoints' dla każdej odpowiedzi
    if (stats.value.sessions) {
      stats.value.sessions.forEach(session => {
        if (session.Answers) {
          session.Answers.forEach(ans => {
            // Domyślnie pole edycji ma aktualną liczbę punktów
            ans.newPoints = ans.points_earned !== null ? ans.points_earned : 0;
          })
        }
      })
    }
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

const savePoints = async (session, answerId, points) => {
  try {
    const parsedPoints = parseFloat(points);
    if (isNaN(parsedPoints)) {
        alert("Wpisz poprawną liczbę punktów");
        return;
    }

    await api.post(`/tests/sessions/${session.id}/grade`, {
      grades: { [answerId]: parsedPoints },
    })

    // Aktualizujemy stan lokalny po sukcesie
    const ans = session.Answers.find((a) => a.id === answerId)
    if (ans) {
      ans.points_earned = parsedPoints
      if (ans.points_earned === ans.Question.points) ans.is_correct = true
      else if (ans.points_earned === 0) ans.is_correct = false
      else ans.is_correct = null // Częściowe punkty
    }
    
    // Opcjonalnie: odśwież całość, żeby przeliczyć średnie/wykresy
    // await fetchStats() 
    
    // Ale szybciej zaktualizować wynik sesji lokalnie:
    let newTotal = 0;
    session.Answers.forEach(a => newTotal += (a.points_earned || 0));
    session.score = newTotal;

    alert("Zapisano!");
  } catch (e) {
    alert('Błąd zapisu oceny')
    console.error(e);
  }
}

// Funkcja pomocnicza do wyświetlania treści odpowiedzi zamiast ID
const formatAnswer = (question, rawAnswer) => {
    if (!rawAnswer) return '(Brak)';
    
    // Jeśli backend nie przesłał definicji pytań z opcjami, zwracamy oryginał
    if (!stats.value.questions) return rawAnswer;

    // Znajdź pełną definicję pytania w stats (tam powinny być opcje, o ile backend je wysyła)
    const fullQuestion = stats.value.questions.find(q => q.id === question.id);
    
    // Jeśli pytanie zamknięte i mamy opcje
    if (fullQuestion && fullQuestion.question_type === 'ABC') {
        // Logika dla checkboxów/radio
        let ids = [];
        try {
            ids = Array.isArray(rawAnswer) ? rawAnswer : JSON.parse(rawAnswer);
        } catch {
            ids = [rawAnswer];
        }
        if (!Array.isArray(ids)) ids = [ids]; // Upewnienie się

        // Tutaj potrzebujemy 'QuestionOptions'. Jeśli backend ich nie wysyła w /stats,
        // to ta funkcja zwróci po prostu ID.
        // Żeby to działało idealnie, w backendzie w /stats trzeba dodać include: [QuestionOption]
        if (fullQuestion.QuestionOptions) {
             const labels = ids.map(id => {
                const opt = fullQuestion.QuestionOptions.find(o => o.id == id);
                return opt ? opt.text : id;
            });
            return labels.join(', ');
        }
    }
    
    return rawAnswer;
}
</script>

<template>
  <div class="tstats-page">
    <div v-if="loading" class="tstats-center">Ładowanie danych...</div>

    <div v-else-if="stats" class="tstats-content">
      <div class="tstats-header">
        <h1 class="tstats-title">Statystyki: {{ stats.title }}</h1>
      </div>

      <div class="tstats-summary">
        <div class="tstats-card">
          <h3 class="tstats-card-title">Rozwiązania</h3>
          <p class="tstats-big-num">{{ stats.count }}</p>
        </div>
        <div class="tstats-card">
          <h3 class="tstats-card-title">Średnia pkt</h3>
          <p class="tstats-big-num">{{ stats.avgScore }}</p>
        </div>
        <div class="tstats-card">
          <h3 class="tstats-card-title">Max wynik pkt</h3>
          <p class="tstats-big-num">{{ stats.maxScore }}</p>
        </div>
      </div>

      <div class="tstats-charts" v-if="stats.count > 0">
        <div class="tstats-chart-card">
          <h3 class="tstats-chart-title">Zdawalność</h3>
          <div class="tstats-chart-wrap">
            <Doughnut v-if="passFailData" :data="passFailData" :options="chartOptions" />
          </div>
        </div>

        <div class="tstats-chart-card">
          <h3 class="tstats-chart-title">Rozkład Ocen</h3>
          <div class="tstats-chart-wrap">
            <Bar
              v-if="gradeDistributionData"
              :data="gradeDistributionData"
              :options="chartOptions"
            />
          </div>
        </div>
      </div>

      <div class="tstats-table">
        <h2 class="tstats-table-title">Indywidualne Rozwiązania</h2>

        <div v-if="!stats.sessions.length" class="tstats-empty">Brak rozwiązań.</div>

        <div v-if="stats.sessions.length" class="tstats-list-header">
          <div class="tstats-col tstats-col--name tstats-sortable" @click="sortBy('guest_name')">
            Uczeń {{ getSortArrow('guest_name') }}
          </div>
          <div class="tstats-col tstats-col--score tstats-sortable" @click="sortBy('score')">
            Wynik {{ getSortArrow('score') }}
          </div>
          <div class="tstats-col tstats-col--date tstats-sortable" @click="sortBy('started_at')">
            Data {{ getSortArrow('started_at') }}
          </div>
          <div class="tstats-col tstats-col--arrow"></div>
        </div>

        <div v-for="s in sortedSessions" :key="s.id" class="tstats-session">
          <div class="tstats-session-header" @click="toggleDetails(s.id)">
            <div class="tstats-col tstats-col--name tstats-name">{{ s.guest_name }}</div>

            <div class="tstats-col tstats-col--score">
              <span
                class="tstats-badge"
                :class="{
                  'tstats-badge--pending': s.Answers.some((a) => a.points_earned === null),
                }"
              >
                {{ s.score }} / {{ stats.totalMaxPoints }} pkt
              </span>

              <span class="tstats-grade-pill" :class="getGradeColorClass(calculateGrade(s.score))">
                {{ calculateGrade(s.score) }}
              </span>
            </div>

            <div class="tstats-col tstats-col--date">
              {{ new Date(s.started_at).toLocaleString() }}
            </div>

            <div class="tstats-col tstats-col--arrow">
              {{ expandedSessionId === s.id ? '▲' : '▼' }}
            </div>
          </div>

          <div v-if="expandedSessionId === s.id" class="tstats-details">
            <table class="tstats-details-table">
              <thead>
                <tr>
                  <th style="width: 30%">Pytanie</th>
                  <th style="width: 30%">Odpowiedź</th>
                  <th style="width: 25%">Punkty (Edycja)</th>
                  <th style="width: 15%">Akcja</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ans in s.Answers" :key="ans.id">
                  <td class="tstats-q-text">
                    <div class="tstats-q-title">{{ ans.Question.text }}</div>
                    <div class="tstats-q-meta">(Max: {{ ans.Question.points }} pkt)</div>
                  </td>

                  <td class="tstats-ans-text">
                    {{ formatAnswer(ans.Question, ans.answer_text) }}
                  </td>

                  <td>
                    <div class="tstats-points-wrap">
                      <input
                        type="number"
                        v-model.number="ans.newPoints"
                        class="tstats-points-input"
                        min="0"
                        :max="ans.Question.points"
                        step="0.5"
                      />
                      <span class="tstats-slash">/ {{ ans.Question.points }}</span>
                    </div>
                  </td>

                  <td>
                    <button
                      class="tstats-save-btn"
                      @click.stop="savePoints(s, ans.id, ans.newPoints)"
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
/* Te style powinny być dopasowane do Twojego projektu */
.tstats-points-input {
    width: 60px;
    padding: 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
}
.tstats-save-btn {
    background: #3498db;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
}
.tstats-save-btn:hover {
    background: #2980b9;
}
</style>