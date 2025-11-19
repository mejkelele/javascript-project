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

onMounted(fetchMyTests)
</script>

<template>
  <div class="content-page">
    <div class="header-actions">
        <h1>Moje Testy</h1>
        <button class="nav-btn" @click="router.push('/create-test')">
            ➕ Utwórz nowy test
        </button>
    </div>

    <p v-if="loading">Ładowanie...</p>
    <p v-else-if="error" class="err">{{ error }}</p>

    <div v-else-if="tests.length" class="tests-grid">
      <div v-for="test in tests" :key="test.id" class="test-card">
        <div class="card-header">
        <h3>{{ test.title }}</h3>
        <button class="edit-btn" @click="router.push(`/edit-test/${test.id}`)">✏️ Edytuj</button>
        </div>
        <p class="desc">{{ test.description }}</p>
        <div class="code-box">
            <span>Kod dostępu:</span>
            <strong>{{ test.access_code }}</strong>
        </div>
      </div>
    </div>

    <p v-else>Nie masz jeszcze żadnych testów.</p>
  </div>
</template>

<style scoped>
.content-page { max-width: 1000px; margin: 2rem auto; padding: 0 20px; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.nav-btn { padding: 10px 20px; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; text-decoration: none; }
.nav-btn:hover { background: #27ae60; }
.test-card { border: 1px solid var(--color-border); padding: 20px; border-radius: 12px; background: var(--color-background-soft); margin-bottom: 15px; }
.code-box { margin-top: 10px; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 4px; display: inline-block; font-family: monospace; }
.err { color: #e74c3c; }
.card-header { display: flex; justify-content: space-between; align-items: start; }
.edit-btn { background: transparent; border: 1px solid var(--color-text); color: var(--color-text); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
.edit-btn:hover { background: var(--vt-c-divider-light-1); }
</style>