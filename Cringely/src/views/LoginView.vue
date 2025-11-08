<script setup>
import { ref } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref(null)
const error = ref(null)

const submit = async () => {
  error.value = null; message.value = null
  if (!email.value || !password.value) { error.value = 'Podaj e-mail i hasło.'; return }
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', {
      email: email.value.trim(),
      password: password.value
    })
    auth.setUser(data)              // ⬅️ USTAW USERA
    message.value = `Zalogowano jako ${data?.email || email.value}`
    password.value = ''
    router.push('/')                // ⬅️ OPCJONALNE PRZEJŚCIE
  } catch (e) {
    error.value = e?.response?.data?.error || 'Błąd logowania'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container">
    <h2>Logowanie</h2>
    <form @submit.prevent="submit">
      <label>Email</label>
      <input v-model="email" type="email" required />
      <label>Hasło</label>
      <input v-model="password" type="password" required />
      <button :disabled="loading">{{ loading ? 'Logowanie…' : 'Zaloguj' }}</button>
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
