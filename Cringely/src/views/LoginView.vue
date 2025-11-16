<script setup>
import { ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import '../assets/main.css'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref(null)
const error = ref(null)

const submit = async () => {
  error.value = null
  message.value = null

  if (!email.value || !password.value) {
    error.value = 'Podaj e-mail i hasło.'
    return
  }

  loading.value = true

  try {
    const { data } = await api.post('/auth/login', {
      email: email.value.trim(),
      password: password.value
    })

    auth.setUser(data)
    router.push('/')
  } catch (e) {
    error.value = e?.response?.data?.error || 'Błąd logowania'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2>Logowanie</h2>

      <form @submit.prevent="submit">
        <label>Email</label>
        <input v-model="email" type="email" required />

        <label>Hasło</label>
        <input v-model="password" type="password" required />

        <button :disabled="loading">
          {{ loading ? 'Logowanie…' : 'Zaloguj' }}
        </button>
      </form>

      <p v-if="message" class="ok">{{ message }}</p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>

  </div>
</template>
