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
const name = ref('')
const loading = ref(false)
const message = ref(null)
const error = ref(null)

const submit = async () => {
  error.value = null
  message.value = null

  if (!email.value || !password.value || password.value.length < 6) {
    error.value = 'Podaj poprawny e-mail i hasło (min. 6 znaków).'
    return
  }

  loading.value = true

  try {
    const { data } = await api.post('/auth/register', {
      email: email.value.trim(),
      password: password.value,
      name: name.value.trim() || null,
    })

    auth.setUser(data)
    router.push('/')
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      (Array.isArray(e?.response?.data?.errors)
        ? e.response.data.errors.map((m) => m.msg || m.message).join('\n')
        : e?.message || 'Błąd rejestracji')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2>Rejestracja</h2>

      <form @submit.prevent="submit" novalidate>
        <label>Email</label>
        <input v-model="email" type="email" required />

        <label>Hasło (min 6)</label>
        <input v-model="password" type="password" minlength="6" required />

        <label>Imię</label>
        <input v-model="name" type="text" />

        <button :disabled="loading">
          {{ loading ? 'Rejestrowanie…' : 'Zarejestruj' }}
        </button>
      </form>

      <p v-if="message" class="ok">{{ message }}</p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </div>
</template>
