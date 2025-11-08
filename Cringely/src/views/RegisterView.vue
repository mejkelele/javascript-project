<script setup>
import { ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'     // ⬅️ DODAJ
import { useRouter } from 'vue-router'            // ⬅️ DODAJ

const auth = useAuthStore()                       // ⬅️ DODAJ
const router = useRouter()                        // ⬅️ DODAJ

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
      name: name.value.trim() || null
    })
    auth.setUser(data)                             // ⬅️ USTAW USERA
    message.value = `Rejestracja OK. Zalogowano jako ${data?.email || ''}`
    password.value = ''
    router.push('/')                               // ⬅️ OPCJONALNE PRZEJŚCIE
  } catch (e) {
    const backendError =
      e?.response?.data?.error ||
      (Array.isArray(e?.response?.data?.errors)
        ? e.response.data.errors.map(x => x.msg || x.message).join('\n')
        : e?.message)
    error.value = backendError || 'Błąd rejestracji'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container">
    <h2>Rejestracja</h2>

    <form @submit.prevent="submit" novalidate>
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" autocomplete="email" required />

      <label for="password">Hasło (min 6)</label>
      <input id="password" v-model="password" type="password" minlength="6" autocomplete="new-password" required />

      <label for="name">Imię</label>
      <input id="name" v-model="name" type="text" autocomplete="given-name" />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Wysyłanie…' : 'Zarejestruj' }}
      </button>
    </form>

    <p v-if="message" class="ok">{{ message }}</p>
    <pre v-if="error" class="err">{{ error }}</pre>
  </div>
</template>

<style scoped>
.container{max-width:420px;margin:2rem auto;padding:0 8px}
label{display:block;margin-top:12px}
input{width:100%;padding:.6rem;margin-top:.25rem;border:1px solid #555;border-radius:6px;background:#111;color:#eee}
button{margin-top:1rem;padding:.6rem 1rem;border-radius:6px;border:1px solid #666;cursor:pointer}
button[disabled]{opacity:.6;cursor:not-allowed}
.ok{color:#16a34a;margin-top:.75rem;white-space:pre-wrap}
.err{color:#dc2626;margin-top:.75rem;white-space:pre-wrap}
</style>
