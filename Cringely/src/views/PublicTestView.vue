<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const accessCode = route.params.code

const test = ref(null)
const loading = ref(true)
const error = ref(null)

const guestName = ref('')
const isStarted = ref(false)

// Zmienne do obsługi odpowiedzi i wyników
const answers = ref({}) // Obiekt: { id_pytania: 'odpowiedź' }
const isSubmitting = ref(false)
const submissionResult = ref(null) // Wynik bieżącego użytkownika
const leaderboard = ref([]) // Tablica wyników (Top 10)

const auth = useAuthStore()

// 1. Pobranie danych testu przy wejściu na stronę
onMounted(async () => {
  try {
    const { data } = await api.get(`/tests/public/${accessCode}`)
    test.value = data
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

// 2. Rozpoczęcie testu (przejście z ekranu powitalnego do pytań)
const startTest = () => {
  if (!guestName.value) return alert('Podaj swoje imię!')
  isStarted.value = true
}

// 3. Wysłanie odpowiedzi do backendu
const submitTest = async () => {
  if (!confirm('Czy na pewno chcesz zakończyć test?')) return

  isSubmitting.value = true
  try {
    const payload = {
      guest_name: guestName.value,
      answers: answers.value,
    }

    // Wysyłamy odpowiedzi
    const { data } = await api.post(`/tests/solve/${accessCode}`, payload)
    submissionResult.value = data // Zapisujemy wynik (punkty)

    // Po sukcesie pobieramy od razu ranking, żeby go wyświetlić
    await fetchLeaderboard()
  } catch (e) {
    alert('Wystąpił błąd podczas wysyłania odpowiedzi.')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

// 4. Pobranie rankingu (Top 10)
const fetchLeaderboard = async () => {
  try {
    const { data } = await api.get(`/tests/public/leaderboard/${accessCode}`)
    leaderboard.value = data
  } catch (e) {
    console.error('Błąd pobierania rankingu', e)
  }
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

          <div class="guest-form">
            <!-- niezalogowany -->
            <template v-if="!auth.isAuthenticated">
              <label>Twoje imię / nick</label>
              <input v-model="guestName" placeholder="Jan Kowalski" />
            </template>

            <!-- zalogowany -->
            <template v-else>
              <p class="logged-user">
                Rozwiązujesz jako:
                <strong>{{ auth.user.name || auth.user.email }}</strong>
              </p>
            </template>

            <button class="btn-green start-btn" @click="startTest">Rozpocznij test</button>
          </div>
        </div>
      </div>

      <div v-else-if="submissionResult" class="result-card">
        <h1>🏁 Test Zakończony!</h1>

        <div v-if="submissionResult.requiresGrading" class="pending-box">
          <p class="pending-msg">⚠️ Twój test zawiera pytania otwarte.</p>
          <p>
            Obecny wynik to punkty tylko za zadania zamknięte. Nauczyciel sprawdzi resztę wkrótce.
          </p>
        </div>

        <div class="score-circle" :class="{ partial: submissionResult.requiresGrading }">
          <span>{{ submissionResult.score }}</span>
          <span class="total">/ {{ submissionResult.maxPoints }} pkt</span>
        </div>

        <p class="msg">{{ submissionResult.message }}</p>

        <div class="leaderboard-box">
          <h3>🏆 Tablica Wyników (Top 10)</h3>
          <ul v-if="leaderboard.length">
            <li
              v-for="(entry, idx) in leaderboard"
              :key="idx"
              :class="{ me: entry.guest_name === guestName }"
            >
              <span class="rank">#{{ idx + 1 }}</span>
              <span class="name">{{ entry.guest_name }}</span>
              <span class="points">{{ entry.score }} pkt</span>
            </li>
          </ul>
          <p v-else class="empty-list">Bądź pierwszy na liście!</p>
        </div>
      </div>

      <div v-else class="questions-view">
        <div class="header">
          <h2>{{ test.title }}</h2>
          <span
            >Rozwiązuje: <strong>{{ guestName }}</strong></span
          >
        </div>

        <div v-for="(q, index) in test.Questions" :key="q.id" class="q-item">
          <div class="q-head">
            <span class="q-idx">{{ index + 1 }}.</span>
            <span class="q-text">{{ q.text }}</span>
            <span class="q-pts">({{ q.points }} pkt)</span>
          </div>

          <div v-if="q.question_type === 'ABC'" class="opts-group">
            <label
              v-for="opt in q.QuestionOptions"
              :key="opt.id"
              class="opt-label"
              :class="{ selected: answers[q.id] === opt.id }"
            >
              <input type="radio" :name="'q' + q.id" :value="opt.id" v-model="answers[q.id]" />
              {{ opt.text }}
            </label>
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
