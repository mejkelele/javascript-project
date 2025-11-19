<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import api from '../services/api' 

const auth = useAuthStore()
const router = useRouter()

// Stan dla listy testów
const tests = ref([]) 
const loading = ref(true)
const error = ref(null)

// Stan dla nowego formularza testu
const showNewTestForm = ref(false)
const newTest = ref({
  title: '',
  description: '',
  access_code: '',
  is_public: true,
})
const saving = ref(false)
const newTestError = ref(null)


// Ochrona trasy
if (!auth.isAuthenticated) {
  router.push('/login')
}

// Funkcja pobierania testów
const fetchMyTests = async () => {
  if (!auth.isAuthenticated) return

  loading.value = true
  error.value = null

  try {
    const response = await api.get('/tests') 
    tests.value = response.data
  } catch (e) {
    console.error(e)
    // Błąd 401 (Nieautoryzowany) oznacza brak sesji. Użytkownik powinien zostać przeniesiony.
    if (e.response?.status === 401) {
        router.push('/login');
        return;
    }
    error.value = 'Błąd pobierania testów. Upewnij się, że serwer backendu działa poprawnie.'
  } finally {
    loading.value = false
  }
}

// Funkcja: Tworzenie testu
const createTest = async () => {
    newTestError.value = null
    saving.value = true

    if (!newTest.value.title || !newTest.value.access_code) {
        newTestError.value = "Tytuł i Kod dostępu są wymagane."
        saving.value = false
        return
    }

    try {
        const response = await api.post('/tests', newTest.value)
        
        // Dodaj nowo utworzony test do listy lokalnej
        tests.value.push(response.data)
        
        // Zresetuj formularz i schowaj go
        newTest.value = { title: '', description: '', access_code: '', is_public: true }
        showNewTestForm.value = false
        
    } catch (e) {
        newTestError.value = 
            e?.response?.data?.error || 
            'Błąd tworzenia testu. Sprawdź, czy kod dostępu nie jest już używany.'
    } finally {
        saving.value = false
    }
}


onMounted(() => {
  fetchMyTests()
})

</script>

<template>
  <div class="content-page">
    <h1>Moje Testy</h1>
    <p v-if="auth.isAuthenticated">Witaj, {{ auth.user?.name || auth.user?.email }}! Zarządzaj swoimi testami.</p>
    
    <div class="test-list-actions">
        <button class="nav-btn" @click="showNewTestForm = !showNewTestForm">
            {{ showNewTestForm ? 'Anuluj' : '➕ Utwórz nowy test' }}
        </button>
    </div>

    <div v-if="showNewTestForm" class="new-test-form auth-card">
        <h2>Nowy Test</h2>
        <form @submit.prevent="createTest" novalidate>
            <label>Tytuł Testu</label>
            <input v-model="newTest.title" type="text" required />
            
            <label>Kod Dostępu (unikalny)</label>
            <input v-model="newTest.access_code" type="text" required />
            
            <label>Opis (opcjonalny)</label>
            <textarea v-model="newTest.description"></textarea>

            <div class="checkbox-group">
                <input id="is_public" type="checkbox" v-model="newTest.is_public" />
                <label for="is_public">Test publiczny</label>
            </div>


            <button :disabled="saving">
                {{ saving ? 'Zapisywanie…' : 'Utwórz Test' }}
            </button>
        </form>

        <p v-if="newTestError" class="err">{{ newTestError }}</p>
    </div>
    
    <hr v-if="showNewTestForm">

    <p v-if="loading">Ładowanie testów...</p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <div v-else-if="tests.length">
      <h2>Lista:</h2>
      <div v-for="test in tests" :key="test.id" class="test-card">
        <h3>{{ test.title }}</h3>
        <p>{{ test.description || 'Brak opisu.' }}</p>
        <p>Kod dostępu: <code>{{ test.access_code }}</code></p>
        <p class="meta">Status: {{ test.is_public ? 'Publiczny' : 'Prywatny' }} | Utworzono: {{ new Date(test.created_at).toLocaleDateString() }}</p>
      </div>
    </div>
    
    <p v-else>Nie masz jeszcze żadnych testów. Utwórz nowy, aby zacząć.</p>

  </div>
</template>

<style scoped>
/* Dodatkowe style dla formularza i listy */
.content-page {
  max-width: 1000px;
  margin: 2rem auto;
  padding: 0 20px;
}

h1, h2 {
  font-size: 2.2rem;
  font-weight: bold;
  color: var(--color-heading);
  margin-bottom: 0.5rem;
}

p {
  color: var(--color-text);
  margin-bottom: 1.5rem;
}

.test-list-actions {
    margin-bottom: 2rem;
}

.new-test-form {
    /* Używamy stylu karty autoryzacji z głównego CSS */
    background: var(--color-background-soft);
    padding: 2.5rem;
    border-radius: 18px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    margin-bottom: 2rem;
}

.new-test-form h2 {
    text-align: center;
    color: var(--color-heading);
}

.new-test-form input[type="text"],
.new-test-form textarea {
    width: 100%;
    padding: 0.75rem;
    margin-top: 6px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-background);
    color: var(--color-text);
    font-size: 1rem;
    transition: 0.2s;
}

.new-test-form textarea {
    min-height: 80px;
    resize: vertical;
}

.new-test-form input:focus,
.new-test-form textarea:focus {
  border-color: var(--vt-c-indigo);
  box-shadow: 0 0 5px rgba(44, 62, 80, 0.5);
  outline: none;
}

.test-card {
    border: 1px solid var(--color-border);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 10px;
    background: var(--color-background-soft);
}

.test-card h3 {
    margin-bottom: 5px;
    font-size: 1.5rem;
}

.test-card .meta {
    font-size: 0.85rem;
    color: var(--color-text-light-2);
}

.checkbox-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
}

.checkbox-group input[type="checkbox"] {
    width: auto;
    appearance: auto; 
    padding: 0;
    margin-top: 0;
}
</style>