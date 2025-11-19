<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const accessCode = route.params.code

// Stan
const test = ref(null)
const loading = ref(true)
const error = ref(null)

const guestName = ref('')
const isStarted = ref(false)
const isFinished = ref(false)
const submitting = ref(false)

// Wyniki
const result = ref({ score: 0, maxPoints: 0 })

// Odpowiedzi użytkownika: { question_id: wartość }
const userAnswers = ref({})

// Pobieranie testu
onMounted(async () => {
    try {
        const { data } = await api.get(`/tests/public/${accessCode}`)
        test.value = data
    } catch (e) {
        error.value = "Nie znaleziono testu, kod jest błędny lub test jest prywatny."
    } finally {
        loading.value = false
    }
})

const startTest = () => {
    if (!guestName.value.trim()) return alert("Podaj swoje imię!")
    isStarted.value = true
}

const submitTest = async () => {
    if (!confirm("Czy na pewno chcesz zakończyć test?")) return;
    
    submitting.value = true;
    try {
        const { data } = await api.post(`/tests/solve/${accessCode}`, {
            guest_name: guestName.value,
            answers: userAnswers.value
        });
        
        result.value = data;
        isFinished.value = true;
    } catch (e) {
        alert("Błąd wysyłania odpowiedzi: " + (e.response?.data?.error || "Nieznany błąd"));
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="public-page">
        
        <div v-if="loading" class="center">Ładowanie testu...</div>
        <div v-else-if="error" class="center err-card">
            <h2>⚠️ Błąd</h2>
            <p>{{ error }}</p>
        </div>

        <div v-else class="test-container">
            
            <div v-if="!isStarted" class="start-card">
                <h1>{{ test.title }}</h1>
                <div class="meta">
                    <span>Autor: {{ test.User?.name || 'Anonim' }}</span>
                </div>
                <p class="desc">{{ test.description || 'Brak opisu.' }}</p>
                
                <div class="guest-form">
                    <label>Wpisz swoje imię i nazwisko:</label>
                    <input v-model="guestName" placeholder="Jan Kowalski" @keyup.enter="startTest"/>
                    <button @click="startTest" class="start-btn">🚀 Rozpocznij Test</button>
                </div>
            </div>

            <div v-else-if="isFinished" class="result-card">
                <h2>🏁 Test Zakończony!</h2>
                <div class="score-circle">
                    <span class="score-val">{{ result.score }}</span>
                    <span class="score-max">/ {{ result.maxPoints }}</span>
                </div>
                <p class="score-msg" v-if="result.score === result.maxPoints">Perfekcyjnie! 🏆</p>
                <p class="score-msg" v-else-if="result.score / result.maxPoints > 0.5">Dobra robota! 👍</p>
                <p class="score-msg" v-else>Następnym razem będzie lepiej! 💪</p>

                <p class="info">Dziękujemy, <b>{{ guestName }}</b>. Twój wynik został zapisany.</p>
            </div>

            <div v-else class="questions-view">
                <div class="header">
                    <div>
                        <h2>{{ test.title }}</h2>
                        <small class="sub-h">Rozwiązuje: <b>{{ guestName }}</b></small>
                    </div>
                </div>

                <div v-for="(q, index) in test.Questions" :key="q.id" class="q-item">
                    <div class="q-head">
                        <span class="q-idx">{{ index + 1 }}.</span>
                        <span class="q-text">{{ q.text }}</span>
                        <span class="q-pts">({{ q.points }} pkt)</span>
                    </div>

                    <div v-if="q.question_type === 'ABC'" class="opts-group">
                        <label v-for="opt in q.QuestionOptions" :key="opt.id" 
                               class="opt-label" 
                               :class="{ selected: userAnswers[q.id] === opt.id }">
                            <input type="radio" :name="'q'+q.id" :value="opt.id" v-model="userAnswers[q.id]" />
                            <span class="opt-text">{{ opt.text }}</span>
                        </label>
                    </div>

                    <div v-else-if="q.question_type === 'FILL'" class="fill-group">
                        <input type="text" v-model="userAnswers[q.id]" placeholder="Wpisz brakujące słowo..." />
                    </div>

                    <div v-else-if="q.question_type === 'OPEN'" class="open-group">
                        <textarea v-model="userAnswers[q.id]" placeholder="Napisz swoją odpowiedź..."></textarea>
                    </div>
                </div>

                <div class="footer-actions">
                    <button class="finish-btn" @click="submitTest" :disabled="submitting">
                        {{ submitting ? 'Wysyłanie...' : '🏁 Zakończ i wyślij' }}
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.public-page { min-height: 100vh; display: flex; justify-content: center; padding: 2rem; background: linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 100%); }
.center { text-align: center; margin-top: 100px; font-size: 1.5rem; color: #555; }
.err-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); color: #e74c3c; }

.test-container { width: 100%; max-width: 750px; }

/* Karta startowa */
.start-card { background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; animation: fadeIn 0.5s ease; }
.start-card h1 { font-size: 2.2rem; color: #2c3e50; margin-bottom: 0.5rem; }
.meta { color: #7f8c8d; font-size: 0.95rem; margin-bottom: 1.5rem; }
.desc { font-size: 1.1rem; color: #34495e; margin-bottom: 2.5rem; line-height: 1.6; }
.guest-form { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.guest-form input { padding: 12px; font-size: 1.1rem; border: 2px solid #bdc3c7; border-radius: 8px; width: 100%; max-width: 300px; text-align: center; transition: 0.3s; }
.guest-form input:focus { border-color: #2ecc71; outline: none; }
.start-btn { padding: 12px 40px; font-size: 1.2rem; background: #2ecc71; color: white; border: none; border-radius: 50px; cursor: pointer; font-weight: bold; transition: 0.3s; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4); }
.start-btn:hover { background: #27ae60; transform: translateY(-2px); }

/* Karta pytań */
.questions-view { background: white; padding: 2.5rem; border-radius: 15px; box-shadow: 0 5px 25px rgba(0,0,0,0.05); }
.header { padding-bottom: 1.5rem; border-bottom: 2px solid #f0f0f0; margin-bottom: 2rem; text-align: center; }
.header h2 { font-size: 1.8rem; margin-bottom: 0.2rem; color: #2c3e50; }
.sub-h { color: #7f8c8d; font-size: 1rem; }

.q-item { margin-bottom: 3rem; }
.q-head { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; display: flex; gap: 10px; line-height: 1.4; }
.q-idx { color: #2ecc71; font-weight: 800; min-width: 25px; }
.q-pts { font-size: 0.85rem; color: #95a5a6; font-weight: normal; margin-left: auto; white-space: nowrap; }

/* Opcje ABC */
.opts-group { display: flex; flex-direction: column; gap: 10px; }
.opt-label { padding: 12px 15px; border: 2px solid #eee; border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 12px; }
.opt-label:hover { background: #f9f9f9; border-color: #ccc; }
.opt-label.selected { border-color: #2ecc71; background: #f0fdf4; }
.opt-label input { accent-color: #2ecc71; width: 18px; height: 18px; }

/* Inputy */
.fill-group input, .open-group textarea { width: 100%; padding: 12px; border: 2px solid #eee; border-radius: 8px; font-size: 1rem; transition: 0.3s; }
.fill-group input:focus, .open-group textarea:focus { border-color: #2ecc71; outline: none; }
.open-group textarea { min-height: 100px; resize: vertical; }

.footer-actions { text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #f0f0f0; }
.finish-btn { width: 100%; max-width: 300px; padding: 15px; background: #2c3e50; color: white; border: none; border-radius: 50px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(44, 62, 80, 0.3); }
.finish-btn:hover:not(:disabled) { background: #34495e; transform: translateY(-2px); }
.finish-btn:disabled { opacity: 0.7; cursor: not-allowed; }

/* Wynik */
.result-card { background: white; padding: 3rem; border-radius: 20px; text-align: center; animation: zoomIn 0.5s ease; max-width: 500px; margin: 0 auto; }
.score-circle { width: 150px; height: 150px; background: #2ecc71; color: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 2rem auto; box-shadow: 0 10px 20px rgba(46, 204, 113, 0.4); }
.score-val { font-size: 3.5rem; font-weight: 800; line-height: 1; }
.score-max { font-size: 1.2rem; opacity: 0.9; }
.score-msg { font-size: 1.4rem; font-weight: bold; color: #2c3e50; margin-bottom: 1rem; }
.info { color: #7f8c8d; margin-top: 2rem; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
</style>