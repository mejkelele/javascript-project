<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter() 

if (!auth.isAuthenticated) {
    router.push('/login')
}

const activeTab = ref('profile') 

const formData = ref({
  name: '',
  description: '',
  birth_date: '',
  interests: '',
  avatar: ''
})
const saving = ref(false)
const message = ref('')

const history = ref([])
const loadingHistory = ref(false)

watch(() => auth.user, (newUser) => {
    if (newUser) {
        formData.value = { ...newUser }
    }
}, { immediate: true })

onMounted(() => {
    if (auth.isAuthenticated) {
        fetchHistory()
    }
})

const fetchHistory = async () => {
    loadingHistory.value = true
    try {
        const { data } = await api.get('/auth/history')
        history.value = data
    } catch (e) {
        console.error(e)
    } finally {
        loadingHistory.value = false
    }
}

// Obsługa wyboru pliku (Avatar -> Base64)
const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    // Ograniczenie wielkości (2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert("Plik jest za duży (max 2MB)")
        return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
        formData.value.avatar = e.target.result // String base64
    }
    reader.readAsDataURL(file)
}

const saveProfile = async () => {
    saving.value = true
    message.value = ''
    try {
        const { data } = await api.put('/auth/me', formData.value)
        auth.setUser(data) // Aktualizujemy Pinia
        message.value = 'Zapisano zmiany! ✅'
    } catch (e) {
        console.error(e)
        alert("Błąd zapisu. Upewnij się, że plik nie jest za duży.")
    } finally {
        saving.value = false
    }
}
</script>

<template>
  <div class="user-page">
    
    <div class="profile-header">
        <div class="avatar-circle">
            <img v-if="formData.avatar" :src="formData.avatar" alt="Avatar" class="avatar-img" />
            <span v-else class="avatar-placeholder">{{ formData.name?.charAt(0) || 'U' }}</span>
        </div>
        <div class="header-info">
            <h1>{{ auth.user?.name || 'Użytkownik' }}</h1>
            <p>{{ auth.user?.email }}</p>
        </div>
    </div>

    <div class="tabs">
        <button :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">Mój Profil</button>
        <button :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">Historia Testów</button>
    </div>

    <div v-if="activeTab === 'profile'" class="tab-content">
        <div class="form-card">
            <div class="form-group">
                <label>Imię / Nick</label>
                <input v-model="formData.name" type="text" />
            </div>

            <div class="form-group">
                <label>Data urodzenia</label>
                <input v-model="formData.birth_date" type="date" />
            </div>

            <div class="form-group">
                <label>O sobie</label>
                <textarea v-model="formData.description" placeholder="Napisz coś o sobie..."></textarea>
            </div>

            <div class="form-group">
                <label>Zainteresowania</label>
                <input v-model="formData.interests" placeholder="Np. Sport, Muzyka, IT..." />
            </div>

            <div class="form-group">
                <label>Zmień Avatar</label>
                <input type="file" accept="image/*" @change="handleFileUpload" />
            </div>

            <button class="save-btn" @click="saveProfile" :disabled="saving">
                {{ saving ? 'Zapisywanie...' : 'Zapisz zmiany' }}
            </button>
            <p v-if="message" class="success-msg">{{ message }}</p>
        </div>
    </div>

    <div v-else class="tab-content">
        <div v-if="loadingHistory" class="loading">Ładowanie...</div>
        <div v-else-if="history.length === 0" class="empty">Brak rozwiązanych testów.</div>
        
        <div v-else class="history-list">
            <div v-for="item in history" :key="item.id" class="history-item">
                <div class="h-info">
                    <h3>{{ item.Test?.title || 'Test usunięty' }}</h3>
                    <small>Rozwiązano: {{ new Date(item.started_at).toLocaleDateString() }}</small>
                </div>
                <div class="h-score">
                    {{ item.score }} pkt
                </div>
            </div>
        </div>
    </div>

  </div>
</template>

<style scoped>
.user-page { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }

/* Header */
.profile-header { display: flex; align-items: center; gap: 20px; margin-bottom: 2rem; background: var(--color-background-soft); padding: 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.avatar-circle { width: 80px; height: 80px; border-radius: 50%; overflow: hidden; background: #2ecc71; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 3px solid white; box-shadow: 0 0 10px rgba(46, 204, 113, 0.3); position: relative; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar-placeholder { color: white; font-size: 2.5rem; font-weight: bold; }
.header-info h1 { margin: 0; font-size: 1.8rem; color: var(--color-heading); }
.header-info p { margin: 0; color: var(--color-text-light-2); }

/* Tabs */
.tabs { display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 2px solid var(--color-border); }
.tabs button { background: none; border: none; padding: 10px 20px; font-size: 1rem; cursor: pointer; color: var(--color-text); border-bottom: 3px solid transparent; transition: 0.3s; }
.tabs button.active { border-bottom-color: #2ecc71; font-weight: bold; color: #2ecc71; }

/* Forms */
.form-card { background: var(--color-background-soft); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 5px; font-weight: 600; color: var(--color-text); }
.form-group input, .form-group textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-text); }
.form-group textarea { min-height: 80px; }

.save-btn { width: 100%; padding: 12px; background: #2ecc71; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
.save-btn:hover { background: #27ae60; }
.success-msg { color: #27ae60; text-align: center; margin-top: 10px; font-weight: bold; }

/* History */
.history-item { display: flex; justify-content: space-between; align-items: center; background: var(--color-background-soft); padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--color-border); }
.h-info h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
.h-info small { color: var(--color-text-light-2); }
.h-score { font-size: 1.2rem; font-weight: bold; color: #2ecc71; }
.empty { text-align: center; color: var(--color-text-light-2); margin-top: 20px; }
</style>