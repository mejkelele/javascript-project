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

// Zmienne do obsługi odpowiedzi i wyników
const answers = ref({}) // Obiekt: { id_pytania: 'odpowiedź' }
const isSubmitting = ref(false)
const submissionResult = ref(null) // Wynik bieżącego użytkownika
const leaderboard = ref([]) // Tablica wyników (Top 10)

// 1. Pobranie danych testu przy wejściu na stronę
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

// 2. Rozpoczęcie testu (przejście z ekranu powitalnego do pytań)
const startTest = () => {
    if (!guestName.value) return alert("Podaj swoje imię!")
    isStarted.value = true
}

// 3. Wysłanie odpowiedzi do backendu
const submitTest = async () => {
    if (!confirm("Czy na pewno chcesz zakończyć test?")) return

    isSubmitting.value = true
    try {
        const payload = {
            guest_name: guestName.value,
            answers: answers.value
        }
        
        // Wysyłamy odpowiedzi
        const { data } = await api.post(`/tests/solve/${accessCode}`, payload)
        submissionResult.value = data // Zapisujemy wynik (punkty)
        
        // Po sukcesie pobieramy od razu ranking, żeby go wyświetlić
        await fetchLeaderboard()
        
    } catch (e) {
        alert("Wystąpił błąd podczas wysyłania odpowiedzi.")
        console.error(e)
    } finally {
        isSubmitting.value = false
    }
}

// 4. Pobranie rankingu (Top 10)
const fetchLeaderboard = async () => {
    try {
        const { data } = await api.get(`/tests/public/leaderboard/${accessCode}`)
        leaderboard.value = data
    } catch (e) {
        console.error("Błąd pobierania rankingu", e)
    }
}
</script>

<template>
    <div class="public-page">
        
        <div v-if="loading" class="center">Ładowanie testu...</div>
        <div v-else-if="error" class="center err">{{ error }}</div>

        <div v-else class="test-container">
            
            <div v-if="!isStarted && !submissionResult" class="start-card">
                <h1>{{ test.title }}</h1>
                <p class="author">Autor: {{ test.User?.name || 'Nieznany' }}</p>
                <p class="desc">{{ test.description }}</p>
                
                <div class="guest-form">
                    <label>Twoje Imię / Nick:</label>
                    <input v-model="guestName" placeholder="Jan Kowalski" />
                    <button @click="startTest" class="start-btn">🚀 Rozpocznij Test</button>
                </div>
            </div>

            <div v-else-if="submissionResult" class="result-card">
                <h1>🏁 Test Zakończony!</h1>
                
                <div v-if="submissionResult.requiresGrading" class="pending-box">
                    <p class="pending-msg">⚠️ Twój test zawiera pytania otwarte.</p>
                    <p>Obecny wynik to punkty tylko za zadania zamknięte. Nauczyciel sprawdzi resztę wkrótce.</p>
                </div>

                <div class="score-circle" :class="{ partial: submissionResult.requiresGrading }">
                    <span>{{ submissionResult.score }}</span>
                    <span class="total">/ {{ submissionResult.maxPoints }} pkt</span>
                </div>
                
                <p class="msg">{{ submissionResult.message }}</p>
                
                <div class="leaderboard-box">
                    <h3>🏆 Tablica Wyników (Top 10)</h3>
                    <ul v-if="leaderboard.length">
                        <li v-for="(entry, idx) in leaderboard" :key="idx" :class="{ 'me': entry.guest_name === guestName }">
                            <span class="rank">#{{ idx + 1 }}</span>
                            <span class="name">{{ entry.guest_name }}</span>
                            <span class="points">{{ entry.score }} pkt</span>
                        </li>
                    </ul>
                    <p v-else class="empty-list">Bądź pierwszy na liście!</p>
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
                        <label v-for="opt in q.QuestionOptions" :key="opt.id" class="opt-label" 
                               :class="{ selected: answers[q.id] === opt.id }">
                            <input 
                                type="radio" 
                                :name="'q'+q.id" 
                                :value="opt.id" 
                                v-model="answers[q.id]" 
                            />
                            {{ opt.text }}
                        </label>
                    </div>

                    <div v-else-if="q.question_type === 'FILL'" class="fill-group">
                        <input type="text" v-model="answers[q.id]" placeholder="Wpisz odpowiedź..." />
                    </div>

                    <div v-else-if="q.question_type === 'OPEN'" class="open-group">
                        <textarea v-model="answers[q.id]" placeholder="Twoja odpowiedź..."></textarea>
                    </div>

                </div>

                <button class="finish-btn" @click="submitTest" :disabled="isSubmitting">
                    {{ isSubmitting ? 'Wysyłanie...' : '🏁 Zakończ i wyślij' }}
                </button>
            </div>

        </div>
    </div>
</template>

<style scoped>
.public-page { min-height: 100vh; display: flex; justify-content: center; padding: 2rem; background: #f0fdf4; }
.center { text-align: center; margin-top: 50px; font-size: 1.2rem; }
.err { color: red; }

.test-container { width: 100%; max-width: 700px; }

/* Karta startowa i wynikowa */
.start-card, .result-card { background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; }
.start-card h1, .result-card h1 { font-size: 2.5rem; color: #2c3e50; margin-bottom: 0.5rem; }
.author { color: #7f8c8d; margin-bottom: 1.5rem; }
.desc { font-size: 1.1rem; margin-bottom: 2rem; color: #34495e; }

.guest-form input { padding: 12px; font-size: 1.1rem; border: 2px solid #2ecc71; border-radius: 8px; width: 80%; margin-bottom: 15px; text-align: center; }
.start-btn { padding: 12px 30px; font-size: 1.2rem; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
.start-btn:hover { background: #27ae60; transform: scale(1.05); }

/* Pending Info */
.pending-box { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
.pending-msg { font-weight: bold; margin-bottom: 5px; font-size: 1.1rem; }

/* Kółko z wynikiem */
.score-circle { width: 150px; height: 150px; background: #2ecc71; color: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 2rem auto; box-shadow: 0 10px 20px rgba(46, 204, 113, 0.4); }
.score-circle.partial { border: 4px dashed #f39c12; background: #f39c12; }
.score-circle span { font-size: 3rem; font-weight: bold; line-height: 1; }
.score-circle .total { font-size: 1rem; opacity: 0.9; font-weight: normal; }
.msg { font-size: 1.2rem; margin-bottom: 2rem; color: #27ae60; font-weight: bold; }

/* Leaderboard */
.leaderboard-box { margin-top: 2rem; text-align: left; background: #f8f9fa; padding: 1.5rem; border-radius: 10px; border: 1px solid #eee; }
.leaderboard-box h3 { text-align: center; color: #2c3e50; margin-bottom: 1rem; font-size: 1.3rem; }
.leaderboard-box ul { list-style: none; padding: 0; margin: 0; }
.leaderboard-box li { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; font-size: 1rem; align-items: center; }
.leaderboard-box li:last-child { border-bottom: none; }
.leaderboard-box li.me { background: rgba(46, 204, 113, 0.15); border-radius: 6px; font-weight: bold; border-bottom: none; margin: 2px 0; color: #27ae60; }
.rank { font-weight: bold; color: #bdc3c7; width: 35px; }
.name { flex: 1; }
.points { font-weight: bold; color: #2c3e50; }
.empty-list { text-align: center; color: #7f8c8d; font-style: italic; }

/* Widok pytań */
.questions-view { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
.header { border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
.q-item { margin-bottom: 2.5rem; }
.q-head { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; display: flex; gap: 10px; }
.q-idx { color: #2ecc71; }
.q-pts { font-size: 0.9rem; color: #95a5a6; font-weight: normal; margin-left: auto; }

.opts-group { display: flex; flex-direction: column; gap: 8px; }
.opt-label { padding: 10px; border: 1px solid #eee; border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; }
.opt-label:hover { background: #f9f9f9; border-color: #ddd; }
.opt-label.selected { background: #e8f8f5; border-color: #2ecc71; font-weight: 500; }
.opt-label input { accent-color: #2ecc71; width: 18px; height: 18px; }

.fill-group input, .open-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; transition: 0.2s; }
.fill-group input:focus, .open-group textarea:focus { border-color: #2ecc71; outline: none; box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.1); }
.open-group textarea { min-height: 100px; resize: vertical; }

.finish-btn { width: 100%; padding: 15px; background: #34495e; color: white; border: none; border-radius: 8px; font-size: 1.2rem; cursor: pointer; transition: 0.3s; margin-top: 2rem; font-weight: bold; }
.finish-btn:hover:not(:disabled) { background: #2c3e50; transform: translateY(-2px); }
.finish-btn:disabled { opacity: 0.7; cursor: wait; }
</style>