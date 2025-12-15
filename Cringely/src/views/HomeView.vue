<script setup>
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const auth = useAuthStore()
const recentTests = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get('/tests/recent')
    recentTests.value = data
  } catch (error) {
    console.error('Nie udało się pobrać najnowszych testów:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="home-container">
    <header class="home-header">
      <h1 v-if="auth.isAuthenticated">Witaj, {{ auth.user?.name || 'użytkowniku' }}</h1>
      <h1 v-else>Witaj w Cringely!</h1>
      <p>Ucz się mordko mordeczko.</p>
    </header>

    <section class="latest-tests">
      <h2>Ostatnio dodane testy</h2>
      <div v-if="loading" class="loading">Ładowanie testów...</div>
      <div v-else-if="recentTests.length === 0" class="no-tests">
        Brak publicznych testów do wyświetlenia.
      </div>
      <div v-else class="test-list">
        <RouterLink
          v-for="test in recentTests"
          :key="test.access_code"
          :to="`/tests/${test.access_code}`"
          class="test-card"
        >
          <h3>{{ test.title }}</h3>
          <p>{{ test.description }}</p>
        </RouterLink>
      </div>
    </section>

    <section class="actions">
      <h2>Zacznij teraz</h2>
      <div class="action-buttons">
        <RouterLink to="/create-test" class="btn btn-primary"> Stwórz Nowy Test </RouterLink>
        <RouterLink to="/public-tests" class="btn btn-secondary">
          Przeglądaj Wszystkie Testy
        </RouterLink>
      </div>
    </section>

    <section v-if="auth.isAuthenticated" class="user-actions">
      <h2>Twoje konto</h2>
      <div class="action-buttons">
        <RouterLink to="/my-tests" class="btn btn-secondary"> Moje Testy </RouterLink>
        <RouterLink to="/profile" class="btn btn-secondary"> Mój Profil </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  text-align: center;
}

.home-header h1 {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: var(--color-heading);
}

.home-header p {
  font-size: 1.2rem;
  color: var(--color-text-soft);
  margin-bottom: 3rem;
}

.actions,
.user-actions,
.latest-tests {
  margin-bottom: 3rem;
}

.actions h2,
.user-actions h2,
.latest-tests h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text);
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s ease-in-out;
  border: 1px solid transparent;
}

.btn-primary {
  background-color: hsla(160, 100%, 37%, 1);
  color: white;
}

.btn-primary:hover {
  background-color: hsla(160, 100%, 30%, 1);
  transform: translateY(-2px);
}

.btn-secondary {
  background-color: var(--color-background-soft);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-background-mute);
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
}

.test-list {
  display: grid;
  gap: 1rem;
  text-align: left;
}

.test-card {
  display: block;
  padding: 1rem 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background-soft);
  transition: all 0.2s ease-in-out;
  color: var(--color-text);
  text-decoration: none;
}

.test-card:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.test-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 0.25rem;
}

.test-card p {
  font-size: 1rem;
  color: var(--color-text-soft);
  margin: 0;
}

.loading,
.no-tests {
  padding: 2rem;
  color: var(--color-text-soft);
}
</style>
