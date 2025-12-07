<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import api from '../services/api'

const auth = useAuthStore()
const router = useRouter()

const tests = ref([])
const loading = ref(true)
const error = ref(null)

if (!auth.isAuthenticated) router.push('/login')

const fetchMyTests = async () => {
  loading.value = true
  try {
    const response = await api.get('/tests')
    tests.value = response.data
  } catch (e) {
    if (e.response?.status === 401) router.push('/login')
    error.value = 'Błąd pobierania testów.'
  } finally {
    loading.value = false
  }
}

const copyLink = async (link) => {
  try {
    await navigator.clipboard.writeText(link)
    alert('Skopiowano link do schowka!')
  } catch (e) {
    console.error('Błąd kopiowania:', e)
  }
}

onMounted(fetchMyTests)
</script>

<template>
  <div class="tests-page">
    <!-- Nagłówek całej strony -->
    <div class="tests-header fade-in">
      <h1 class="tests-title">Moje Testy</h1>
    </div>

    <!-- Przycisk dodania testu -->
    <div class="add-test-container fade-in">
      <button class="btn-add-test" @click="router.push('/create-test')">Utwórz nowy test</button>
    </div>

    <!-- Zawartość -->
    <div v-if="loading" class="info-text">Ładowanie…</div>
    <div v-else-if="error" class="err">{{ error }}</div>

    <!-- Lista testów -->
    <div v-else-if="tests.length" class="tests-grid fade-in">
      <div v-for="test in tests" :key="test.id" class="test-card">
        <div class="test-card-top">
          <h3 class="test-title">{{ test.title }}</h3>
        </div>

        <p class="test-desc">{{ test.description }}</p>

        <div class="test-footer">
          <div class="link-row">
            <span class="link-label">Link:</span>
            <div
              class="code-box clickable"
              @click="copyLink(`http://localhost:5173/t/${test.access_code}`)"
              title="Kliknij aby skopiować link"
            >
              <span>http://localhost:5173/t/{{ test.access_code }}</span>
            </div>
          </div>

          <div class="card-buttons">
            <button class="btn-blue" @click="router.push(`/test-stats/${test.id}`)">Wyniki</button>
            <button class="btn-outline" @click="router.push(`/edit-test/${test.id}`)">
              Edytuj
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="info-text fade-in">Nie masz jeszcze żadnych testów.</div>
  </div>
</template>
