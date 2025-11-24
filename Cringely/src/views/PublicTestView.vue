<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const accessCode = route.params.code

const test = ref(null)
const loading = ref(true)
const error = ref(null)

const guestName = ref('')
const isStarted = ref(false)

// pobieramy test 
onMounted(async () => {
    try {
        const { data } = await api.get(`/tests/public/${accessCode}`)
        test.value = data
    } catch (e) {
        error.value = "Nie znaleziono testu lub jest on prywatny."
    } finally {
        loading.value = false
    }
})

const startTest = () => {
    if (!guestName.value) return alert("Podaj swoje imię!")
    isStarted.value = true
}
</script>

<template>
    <div class="public-page">
        
        <div v-if="loading" class="center">Ładowanie testu...</div>
        <div v-else-if="error" class="center err">{{ error }}</div>

        <div v-else class="test-container">
            
            <div v-if="!isStarted" class="start-card">
                <h1>{{ test.title }}</h1>
                <p class="author">Autor: {{ test.User?.name || 'Nieznany' }}</p>
                <p class="desc">{{ test.description }}</p>
                
                <div class="guest-form">
                    <label>Twoje Imię / Nick:</label>
                    <input v-model="guestName" placeholder="Jan Kowalski" />
                    <button @click="startTest" class="start-btn">🚀 Rozpocznij Test</button>
                </div>
            </div>

            <div v-else class="questions-view">
                <div class="header">
                    <h2>{{ test.title }}</h2>
                    <span>Rozwiązuje: <strong>{{ guestName }}</strong></span>
                </div>

                <div v-for="(q, index) in test.Questions" :key="q.id" class="q-item">
                    <div class="q-head">
                        <span class="q-idx">{{ index + 1 }}.</span>
                        <span class="q-text">{{ q.text }}</span>
                        <span class="q-pts">({{ q.points }} pkt)</span>
                    </div>

                    <div v-if="q.question_type === 'ABC'" class="opts-group">
                        <label v-for="opt in q.QuestionOptions" :key="opt.id" class="opt-label">
                            <input type="radio" :name="'q'+q.id" :value="opt.id" />
                            {{ opt.text }}
                        </label>
                    </div>

                    <div v-else-if="q.question_type === 'FILL'" class="fill-group">
                        <input type="text" placeholder="Wpisz odpowiedź..." />
                    </div>

                    <div v-else-if="q.question_type === 'OPEN'" class="open-group">
                        <textarea placeholder="Twoja odpowiedź..."></textarea>
                    </div>

                </div>

                <button class="finish-btn" disabled title="Logika wysyłania wkrótce...">🏁 Zakończ Test (Wkrótce)</button>
            </div>

        </div>
    </div>
</template>

<style scoped>
.public-page { min-height: 100vh; display: flex; justify-content: center; padding: 2rem; background: #f0fdf4; }
.center { text-align: center; margin-top: 50px; font-size: 1.2rem; }
.err { color: red; }

.test-container { width: 100%; max-width: 700px; }

.start-card { background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; }
.start-card h1 { font-size: 2.5rem; color: #2c3e50; margin-bottom: 0.5rem; }
.author { color: #7f8c8d; margin-bottom: 1.5rem; }
.desc { font-size: 1.1rem; margin-bottom: 2rem; color: #34495e; }

.guest-form input { padding: 12px; font-size: 1.1rem; border: 2px solid #2ecc71; border-radius: 8px; width: 80%; margin-bottom: 15px; text-align: center; }
.start-btn { padding: 12px 30px; font-size: 1.2rem; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
.start-btn:hover { background: #27ae60; transform: scale(1.05); }

.questions-view { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
.header { border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
.q-item { margin-bottom: 2.5rem; }
.q-head { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; display: flex; gap: 10px; }
.q-idx { color: #2ecc71; }
.q-pts { font-size: 0.9rem; color: #95a5a6; font-weight: normal; margin-left: auto; }

.opts-group { display: flex; flex-direction: column; gap: 8px; }
.opt-label { padding: 10px; border: 1px solid #eee; border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
.opt-label:hover { background: #f9f9f9; border-color: #ddd; }

.fill-group input, .open-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.open-group textarea { min-height: 100px; }

.finish-btn { width: 100%; padding: 15px; background: #34495e; color: white; border: none; border-radius: 8px; font-size: 1.2rem; cursor: not-allowed; opacity: 0.7; margin-top: 2rem; }
</style>