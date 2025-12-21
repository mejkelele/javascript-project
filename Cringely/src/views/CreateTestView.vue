<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

if (!auth.isAuthenticated) {
  router.push('/login')
}

const isEditMode = computed(() => !!route.params.id)
const testId = route.params.id

const testData = ref({
  title: '',
  description: '',
  access_code: '',
  is_public: true,
  show_answers: true,
  attempts_limit: 0,
})

const defaultThresholds = [
  { grade: '5.0', min: 90 },
  { grade: '4.5', min: 80 },
  { grade: '4.0', min: 70 },
  { grade: '3.5', min: 60 },
  { grade: '3.0', min: 50 },
  { grade: '2.0', min: 0 },
]

const scoringMethod = ref('standard')
const scoreThresholds = ref(JSON.parse(JSON.stringify(defaultThresholds)))
const questions = ref([])
const loading = ref(false)
const error = ref(null)

const shareLink = computed(() => {
  if (!testData.value.access_code) return ''
  return `${window.location.origin}/t/${testData.value.access_code}`
})

const totalPoints = computed(() => {
  return questions.value.reduce((sum, q) => sum + (parseInt(q.points) || 0), 0)
})

const generateAccessCode = () => {
  const cleanTitle = testData.value.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 15)
  const randomPart = Math.random().toString(36).substring(2, 7)
  return `${cleanTitle}-${randomPart}`
}

const addThreshold = () => {
  scoreThresholds.value.push({ grade: '', min: 0 })
}
const removeThreshold = (index) => {
  scoreThresholds.value.splice(index, 1)
}

onMounted(async () => {
  if (!auth.isAuthenticated) return

  if (isEditMode.value) {
    loading.value = true
    try {
      const { data } = await api.get(`/tests/${testId}`)
      testData.value = { ...data }
      if (testData.value.show_answers === undefined) testData.value.show_answers = true
      scoringMethod.value = data.scoringMethod || 'standard'

      if (
        data.scoreThresholds &&
        Array.isArray(data.scoreThresholds) &&
        data.scoreThresholds.length > 0
      ) {
        scoreThresholds.value = data.scoreThresholds
      } else {
        scoreThresholds.value = JSON.parse(JSON.stringify(defaultThresholds))
      }

      questions.value = data.Questions.map((q) => ({
        id: q.id,
        text: q.text,
        question_type: q.question_type || 'ABC',
        // Wczytujemy czy wielokrotny
        is_multiple_choice: q.is_multiple_choice || false,
        points: q.points,
        options: q.QuestionOptions.map((o) => ({ text: o.text, is_correct: o.is_correct })),
      }))
    } catch (e) {
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        router.push('/login')
      } else {
        error.value = 'Nie udało się załadować testu.'
      }
    } finally {
      loading.value = false
    }
  } else {
    addQuestion()
  }
})

const addQuestion = () => {
  questions.value.push({
    id: null,
    text: '',
    question_type: 'ABC',
    is_multiple_choice: false, // domyślnie false
    points: 1,
    options: [
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
  })
}

const changeQuestionType = (index) => {
  const q = questions.value[index]
  if (q.question_type === 'ABC') {
    q.options = [
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ]
  } else if (q.question_type === 'FILL') {
    q.options = [{ text: '', is_correct: true }]
  } else {
    q.options = []
  }
}

const removeQuestion = async (index) => {
  const q = questions.value[index]
  if (isEditMode.value && q.id) {
    if (!confirm('Usunąć pytanie z bazy?')) return
    try {
      await api.delete(`/questions/${q.id}`)
    } catch (e) {
      return
    }
  }
  questions.value.splice(index, 1)
}

const addOption = (qIndex) => {
  questions.value[qIndex].options.push({ text: '', is_correct: false })
}

const saveTest = async () => {
  loading.value = true
  error.value = null

  if (!isEditMode.value) {
    if (!testData.value.title) {
      error.value = 'Wpisz nazwę.'
      loading.value = false
      return
    }
    testData.value.access_code = generateAccessCode()
  }

  try {
    let currentTestId = testId
    testData.value.scoringMethod = scoringMethod.value
    testData.value.scoreThresholds = scoreThresholds.value

    if (isEditMode.value) {
      await api.put(`/tests/${testId}`, testData.value)
    } else {
      const res = await api.post('/tests', testData.value)
      currentTestId = res.data.id
    }

    for (const q of questions.value) {
      if (!q.text.trim()) continue
      if (q.question_type === 'FILL' && !q.options[0]?.text) continue

      const payload = {
        test_id: currentTestId,
        text: q.text,
        question_type: q.question_type,
        // Wysyłamy is_multiple_choice
        is_multiple_choice: q.is_multiple_choice,
        points: q.points,
        options: q.question_type === 'OPEN' ? [] : q.options.filter((o) => o.text.trim() !== ''),
      }

      if (q.id) await api.put(`/questions/${q.id}`, payload)
      else await api.post('/questions', payload)
    }

    router.push('/my-tests')
  } catch (e) {
    error.value = e.response?.data?.error || 'Błąd zapisu.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-page">
    <div class="header-box">
      <h1>{{ isEditMode ? 'Edycja Testu' : 'Kreator Testu' }}</h1>
    </div>

    <div class="form-section">
      <h2>1. Dane ogólne</h2>
      <label>Nazwa testu</label>
      <input v-model="testData.title" placeholder="Np. Kolokwium nr 1" />

      <!--      <label>Kod dostępu</label>
      <input :value="testData.access_code || '(Auto-generowany)'" disabled class="disabled-input" />
-->
      <label>Opis</label>
      <textarea v-model="testData.description"></textarea>
      <label>Limit podejść (0 = brak limitu)</label>
      <input 
        type="number" 
        v-model.number="testData.attempts_limit" 
        min="0" 
        placeholder="0"
      />

      <div class="settings-grid">
        <div class="checkbox-wrapper">
          <input type="checkbox" id="isPublic" v-model="testData.is_public" />
          <label for="isPublic" class="inline-label">
            Test Publiczny <small>(widoczny na liście)</small>
          </label>
        </div>
        <div class="checkbox-wrapper">
          <input type="checkbox" id="showAnswers" v-model="testData.show_answers" />
          <label for="showAnswers" class="inline-label">
            Pokaż odpowiedzi <small>(po rozwiązaniu)</small>
          </label>
        </div>
      </div>

      <section class="scoring-section">
        <h3>Sposób punktowania</h3>
        <label class="inline-label">Wybierz sposób:</label>
        <select v-model="scoringMethod">
          <option value="standard">Domyślna (2.0 → 5.0, nieedytowalna)</option>
          <option value="custom">Własna (edytowalna)</option>
        </select>

        <div class="mt-4">
          <h4>Progi ocen</h4>
          <ul v-if="scoringMethod === 'standard'">
            <li v-for="(thr, idx) in scoreThresholds" :key="thr.grade + '-' + idx">
              Ocena {{ thr.grade }} — ≥ {{ thr.min }} %
            </li>
          </ul>
          <div v-else>
            <div v-for="(thr, idx) in scoreThresholds" :key="idx" class="threshold-row">
              <input type="text" v-model="thr.grade" placeholder="np. 5.0" />
              <input type="number" v-model.number="thr.min" min="0" max="100" /> %
              <button type="button" @click="removeThreshold(idx)">Usuń</button>
            </div>
            <button type="button" @click="addThreshold()">Dodaj próg</button>
          </div>
        </div>
      </section>
    </div>

    <div class="form-section">
      <div class="flex-header">
        <h2>2. Pytania</h2>
        <span class="points-badge">Razem punktów: {{ totalPoints }}</span>
      </div>

      <div v-for="(question, qIndex) in questions" :key="qIndex" class="question-card">
        <div class="q-top-row">
          <span class="q-number">{{ qIndex + 1 }}</span>

          <select
            v-model="question.question_type"
            @change="changeQuestionType(qIndex)"
            class="type-select"
          >
            <option value="ABC">Wybór (A, B, C...)</option>
            <option value="FILL">Uzupełnianie luki</option>
            <option value="OPEN">Otwarte (Ręczna ocena)</option>
          </select>

          <div class="points-input-group">
            <label>Pkt:</label>
            <input type="number" v-model="question.points" min="1" class="points-input" />
          </div>

          <button class="btn-danger" @click="removeQuestion(qIndex)" aria-label="Usuń pytanie">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon-trash"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M4 7l16 0" />
              <path d="M10 11l0 6" />
              <path d="M14 11l0 6" />
              <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
              <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
            </svg>
          </button>
        </div>

        <input v-model="question.text" placeholder="Treść pytania..." class="q-input-text" />

        <div v-if="question.question_type === 'ABC'" class="options-list">
          <div class="checkbox-wrapper">
            <input type="checkbox" v-model="question.is_multiple_choice" />
            <label class="inline-label"> Wielokrotny wybór </label>
          </div>
          <p class="sub-label">Opcje odpowiedzi (zaznacz poprawne):</p>
          <div v-for="(opt, oIndex) in question.options" :key="oIndex" class="option-row">
            <input type="checkbox" v-model="opt.is_correct" class="checkbox-correct" />
            <input v-model="opt.text" placeholder="Odpowiedź..." />
          </div>
          <button class="add-ans-btn" @click="addOption(qIndex)">Dodaj kolejną opcję</button>
        </div>

        <div v-else-if="question.question_type === 'FILL'" class="fill-box">
          <p class="sub-label">Poprawna odpowiedź (do automatycznego sprawdzenia):</p>
          <input
            v-model="question.options[0].text"
            placeholder="Wpisz tutaj słowo, które uczeń ma wpisać..."
            class="correct-answer-input"
          />
          <p class="hint">System sprawdzi dokładne dopasowanie (wielkość liter jest ignorowana).</p>
        </div>

        <div v-else-if="question.question_type === 'OPEN'" class="open-box">
          <p class="info-text">
            Pytania otwarte wymagają ręcznego sprawdzenia przez nauczyciela w panelu wyników.
          </p>
        </div>
      </div>

      <div class="btn-div">
        <button class="nav-btn add-q-btn" @click="addQuestion">Dodaj kolejne pytanie</button>
      </div>
    </div>

    <div class="actions">
      <p v-if="error" class="err">{{ error }}</p>
      <button class="save-btn" @click="saveTest" :disabled="loading">
        {{ loading ? 'Zapisywanie...' : 'Zapisz Test' }}
      </button>
    </div>
  </div>
</template>
