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
  is_public: true
})

const questions = ref([])
const loading = ref(false)
const error = ref(null)

// Link do udostępnienia (widoczny tylko gdy test ma kod)
const shareLink = computed(() => {
    if (!testData.value.access_code) return ''
    return `${window.location.origin}/t/${testData.value.access_code}`
})

// Suma punktów
const totalPoints = computed(() => {
    return questions.value.reduce((sum, q) => sum + (parseInt(q.points) || 0), 0)
})

const generateAccessCode = () => {
    const cleanTitle = testData.value.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 15);
    const randomPart = Math.random().toString(36).substring(2, 7);
    return `${cleanTitle}-${randomPart}`
}

onMounted(async () => {
    // Jeśli nie jesteśmy zalogowani, nie pobieramy danych (przekierowanie zadziała wyżej)
    if (!auth.isAuthenticated) return

    if (isEditMode.value) {
        loading.value = true
        try {
            const { data } = await api.get(`/tests/${testId}`)
            testData.value = { ...data } // Kopiujemy dane
            
            questions.value = data.Questions.map(q => ({
                id: q.id,
                text: q.text,
                question_type: q.question_type || 'ABC',
                points: q.points,
                options: q.QuestionOptions.map(o => ({ text: o.text, is_correct: o.is_correct }))
            }))
        } catch (e) {
            // Jeśli błąd 401/403, też wyrzuć do logowania
            if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                router.push('/login')
            } else {
                error.value = "Nie udało się załadować testu."
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
    points: 1,
    options: [{ text: '', is_correct: false }, { text: '', is_correct: false }]
  })
}

// Zmiana typu pytania czyści stare opcje i ustawia odpowiednie domyślne
const changeQuestionType = (index) => {
    const q = questions.value[index];
    if (q.question_type === 'ABC') {
        q.options = [{ text: '', is_correct: false }, { text: '', is_correct: false }];
    } else if (q.question_type === 'FILL') {
        q.options = [{ text: '', is_correct: true }];
    } else {
        q.options = [];
    }
}

const removeQuestion = async (index) => {
    const q = questions.value[index]
    if (isEditMode.value && q.id) {
        if (!confirm("Usunąć pytanie z bazy?")) return;
        try { await api.delete(`/questions/${q.id}`) } catch (e) { return }
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
      if (!testData.value.title) { error.value = "Wpisz nazwę."; loading.value = false; return }
      testData.value.access_code = generateAccessCode()
  }

  try {
    let currentTestId = testId
    if (isEditMode.value) {
        await api.put(`/tests/${testId}`, testData.value)
    } else {
        const res = await api.post('/tests', testData.value)
        currentTestId = res.data.id
    }

    for (const q of questions.value) {
        if (!q.text.trim()) continue;
        if (q.question_type === 'FILL' && !q.options[0]?.text) continue;

        const payload = {
            test_id: currentTestId,
            text: q.text,
            question_type: q.question_type,
            points: q.points,
            options: q.question_type === 'OPEN' ? [] : q.options.filter(o => o.text.trim() !== '')
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
        <div v-if="testData.access_code" class="share-box">
            <p>🔗 Link do udostępnienia:</p>
            <code class="link-code">{{ shareLink }}</code>
        </div>
    </div>

    <div class="form-section">
      <h2>1. Dane ogólne</h2>
      <label>Nazwa testu</label>
      <input v-model="testData.title" placeholder="Np. Kolokwium nr 1" />
      
      <label>Kod dostępu</label>
      <input :value="testData.access_code || '(Auto-generowany)'" disabled class="disabled-input"/>
      
      <label>Opis</label>
      <textarea v-model="testData.description"></textarea>

      <div class="checkbox-wrapper">
        <input type="checkbox" id="isPublic" v-model="testData.is_public" />
        <label for="isPublic" class="inline-label">Test Publiczny (dostępny dla każdego, kto ma link)</label>
    </div>
    </div>

    <div class="form-section">
      <div class="flex-header">
          <h2>2. Pytania</h2>
          <span class="points-badge">Razem punktów: {{ totalPoints }}</span>
      </div>
      
      <div v-for="(question, qIndex) in questions" :key="qIndex" class="question-card">
        <div class="q-top-row">
            <span class="q-number">#{{ qIndex + 1 }}</span>
            
            <select v-model="question.question_type" @change="changeQuestionType(qIndex)" class="type-select">
                <option value="ABC">Wybór (A, B, C...)</option>
                <option value="FILL">Uzupełnianie luki</option>
                <option value="OPEN">Otwarte (Ręczna ocena)</option>
            </select>

            <div class="points-input-group">
                <label>Pkt:</label>
                <input type="number" v-model="question.points" min="1" class="points-input" />
            </div>

            <button class="btn-danger small" @click="removeQuestion(qIndex)">🗑️</button>
        </div>
        
        <input v-model="question.text" placeholder="Treść pytania..." class="q-input-text"/>

        <div v-if="question.question_type === 'ABC'" class="options-list">
            <p class="sub-label">Opcje odpowiedzi (zaznacz poprawną):</p>
            <div v-for="(opt, oIndex) in question.options" :key="oIndex" class="option-row">
                <input type="checkbox" v-model="opt.is_correct" class="checkbox-correct"/>
                <input v-model="opt.text" placeholder="Odpowiedź..." />
            </div>
            <button class="btn-text" @click="addOption(qIndex)">+ Dodaj kolejną opcję</button>
        </div>

        <div v-else-if="question.question_type === 'FILL'" class="fill-box">
            <p class="sub-label">Poprawna odpowiedź (do automatycznego sprawdzenia):</p>
            <input v-model="question.options[0].text" placeholder="Wpisz tutaj słowo, które uczeń ma wpisać..." class="correct-answer-input"/>
            <p class="hint">System sprawdzi dokładne dopasowanie (wielkość liter zazwyczaj jest ignorowana).</p>
        </div>

        <div v-else-if="question.question_type === 'OPEN'" class="open-box">
            <p class="info-text">ℹ️ To jest pytanie otwarte. Uczeń wpisze dłuższy tekst. Te pytania wymagają ręcznego sprawdzenia przez nauczyciela w panelu wyników.</p>
        </div>

      </div>

      <button class="nav-btn add-q-btn" @click="addQuestion">➕ Dodaj kolejne pytanie</button>
    </div>

    <div class="actions">
        <p v-if="error" class="err">{{ error }}</p>
        <button class="save-btn" @click="saveTest" :disabled="loading">
            {{ loading ? 'Zapisywanie...' : '💾 Zapisz Test' }}
        </button>
    </div>
  </div>
</template>

<style scoped>
.create-page { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
.header-box { margin-bottom: 2rem; }
.share-box { background: #d1fae5; padding: 10px; border-radius: 8px; margin-top: 10px; border: 1px solid #10b981; color: #065f46; }
.link-code { font-weight: bold; display: block; margin-top: 5px; word-break: break-all; background: white; padding: 5px; border-radius: 4px;}

.form-section { background: var(--color-background-soft); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid var(--color-border); }
label { display: block; margin-top: 12px; font-weight: 600; font-size: 0.9rem; color: var(--color-text); }
input, textarea, select { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background); color: var(--color-text); }
.disabled-input { opacity: 0.7; cursor: not-allowed; background: rgba(0,0,0,0.05); }

.flex-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.points-badge { background: var(--vt-c-indigo); color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; }

.question-card { background: rgba(255, 255, 255, 0.03); padding: 1.2rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #2ecc71; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.q-top-row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.q-number { font-weight: bold; font-size: 1.1rem; color: #2ecc71; }
.type-select { flex: 1; margin-top: 0; }
.points-input-group { display: flex; align-items: center; gap: 5px; }
.points-input-group label { margin: 0; font-size: 0.8rem;}
.points-input { width: 60px; margin: 0; text-align: center; }

.q-input-text { font-size: 1.1rem; font-weight: 500; margin-bottom: 15px; border-color: #2ecc71; }

.sub-label { font-size: 0.85rem; color: var(--color-text-light-2); margin-bottom: 8px; }
.option-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.checkbox-correct { width: 24px; height: 24px; margin: 0; cursor: pointer; accent-color: #2ecc71; }

.correct-answer-input { border: 2px dashed #2ecc71; }
.hint, .info-text { font-size: 0.85rem; color: var(--color-text-light-2); margin-top: 5px; font-style: italic; }

.nav-btn { padding: 10px 20px; background: var(--color-border); color: var(--color-text); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; width: 100%; }
.nav-btn:hover { background: var(--color-border-hover); }
.save-btn { width: 100%; font-size: 1.2rem; padding: 15px; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 20px; }
.save-btn:hover { background: #27ae60; }
.btn-danger { background: transparent; border: 1px solid #e74c3c; color: #e74c3c; padding: 6px 10px; border-radius: 4px; cursor: pointer; }
.btn-danger:hover { background: #e74c3c; color: white; }
.btn-text { background: none; border: none; color: #2ecc71; cursor: pointer; margin-top: 5px; font-size: 0.9rem; font-weight: 600; }
.err { color: #e74c3c; text-align: center; margin-top: 10px; }
.inline-label { display: inline; margin-left: 8px; cursor: pointer; }
.checkbox-wrapper { margin-top: 15px; display: flex; align-items: center; }
</style>