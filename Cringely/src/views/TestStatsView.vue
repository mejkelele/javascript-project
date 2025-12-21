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
const sortColumn = ref('started_at') // Domyślnie po dacie
const sortDirection = ref('desc') // Domyślnie od najnowszych

const calculateGrade = (currentScore) => {
  if (!stats.value || !stats.value.totalMaxPoints || stats.value.totalMaxPoints === 0) return '-'
  const max = stats.value.totalMaxPoints
  const percentage = (currentScore / max) * 100
  let thresholds = stats.value.scoreThresholds || []
  if (thresholds.length === 0) return '?'
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

// --- LOGIKA SORTOWANIA (COMPUTED) ---
const sortedSessions = computed(() => {
  if (!stats.value || !stats.value.sessions) return []

  // Tworzymy kopię tablicy, żeby nie psuć oryginału
  const list = [...stats.value.sessions]

  return list.sort((a, b) => {
    let valA = a[sortColumn.value]
    let valB = b[sortColumn.value]

    // Specjalna obsługa daty
    if (sortColumn.value === 'started_at') {
      valA = new Date(valA).getTime()
      valB = new Date(valB).getTime()
    }
    // Specjalna obsługa napisów (imion) - ignorujemy wielkość liter
    else if (typeof valA === 'string') {
      valA = valA.toLowerCase()
      valB = valB.toLowerCase()
    }

    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
})

// Funkcja zmieniająca sortowanie po kliknięciu w nagłówek
const sortBy = (column) => {
  if (sortColumn.value === column) {
    // Jeśli kliknięto w to samo -> odwróć kolejność
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Nowa kolumna -> ustaw domyślny kierunek
    sortColumn.value = column
    sortDirection.value = 'desc' // Dla liczb/dat zazwyczaj chcemy najpierw największe
    if (column === 'guest_name') sortDirection.value = 'asc' // Dla nazwisk A-Z
  }
}

// Helper do wyświetlania strzałki
const getSortArrow = (column) => {
  if (sortColumn.value !== column) return '' // Domyślna "nieaktywna" strzałka
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
  stats.value.scoreThresholds.forEach((t) => (counts[t.grade] = 0))
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

// const questionDifficultyData = computed(() => {
//   if (!stats.value || !stats.value.questions || !stats.value.sessions) return null
//   const data = stats.value.questions.map((q) => {
//     let earnedSum = 0
//     let maxPossible = 0
//     stats.value.sessions.forEach((s) => {
//       const ans = s.Answers.find((a) => a.Question && a.Question.id === q.id)
//       if (ans) earnedSum += ans.points_earned || 0
//       maxPossible += q.points
//     })
//     const percent = maxPossible > 0 ? Math.round((earnedSum / maxPossible) * 100) : 0
//     return { text: q.text, percent }
//   })
//   data.sort((a, b) => a.percent - b.percent)
//   return {
//     labels: data.map((d) => (d.text.length > 20 ? d.text.substring(0, 20) + '...' : d.text)),
//     datasets: [
//       {
//         label: 'Średni % punktów',
//         backgroundColor: data.map((d) =>
//           d.percent < 50 ? '#e74c3c' : d.percent < 80 ? '#f39c12' : '#2ecc71',
//         ),
//         data: data.map((d) => d.percent),
//         indexAxis: 'y',
//       },
//     ],
//   }
// })

const chartOptions = { responsive: true, maintainAspectRatio: false }
const horizontalOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false }

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

const savePoints = async (session, answerId, points) => {
  try {
    await api.post(`/tests/sessions/${session.id}/grade`, {
      grades: { [answerId]: points },
    })
    const ans = session.Answers.find((a) => a.id === answerId)
    if (ans) {
      ans.points_earned = parseFloat(points)
      if (ans.points_earned === ans.Question.points) ans.is_correct = true
      else if (ans.points_earned === 0) ans.is_correct = false
      else ans.is_correct = null
    }
    await fetchStats()
  } catch (e) {
    alert('Błąd zapisu oceny')
  }
}
</script>

<template>
  <div class="tstats-page">
    <!--   <button class="tstats-back-btn" @click="router.push('/my-tests')">← Wróć</button> -->

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

        <!--<div class="tstats-chart-card tstats-chart-card--full">
          <h3 class="tstats-chart-title">Ranking Trudności Pytań (Średni % pkt)</h3>
          <div class="tstats-chart-wrap">
            <Bar
              v-if="questionDifficultyData"
              :data="questionDifficultyData"
              :options="horizontalOptions"
            />
          </div>
        </div> -->
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
                  <th style="width: 20%">Punkty</th>
                  <th style="width: 20%">Akcja</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ans in s.Answers" :key="ans.id">
                  <td class="tstats-q-text">
                    <div class="tstats-q-title">{{ ans.Question.text }}</div>
                    <div class="tstats-q-meta">(Max: {{ ans.Question.points }} pkt)</div>
                  </td>

                  <td class="tstats-ans-text">
                    <span v-if="ans.answer_text">{{ ans.answer_text }}</span>
                    <span v-else class="tstats-ans-empty">(Brak odp.)</span>
                  </td>

                  <td>
                    <div class="tstats-points-wrap">
                      <input
                        type="number"
                        :value="ans.points_earned"
                        @input="ans.newPoints = $event.target.value"
                        :placeholder="ans.points_earned"
                        class="tstats-points-input"
                        min="0"
                        :max="ans.Question.points"
                      />
                      <span class="tstats-slash">/ {{ ans.Question.points }}</span>
                    </div>
                  </td>

                  <td>
                    <button
                      class="tstats-save-btn"
                      @click="
                        savePoints(
                          s,
                          ans.id,
                          ans.newPoints !== undefined ? ans.newPoints : ans.points_earned,
                        )
                      "
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
