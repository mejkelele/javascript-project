import { defineStore } from 'pinia'
import api from '../services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // Próbujemy wczytać użytkownika z localStorage na start, żeby nie "migało" logowanie
    user: JSON.parse(localStorage.getItem('user')) || null,
    loading: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.user,
  },
  actions: {
    // Ta funkcja sprawdza sesję po odświeżeniu strony
    async fetchMe() {
      try {
        this.loading = true
        // Backend (session) sprawdzi ciasteczko
        const { data } = await api.get('/auth/me')
        this.setUser(data)
      } catch (e) {
        // Jeśli błąd (np. 401), czyścimy użytkownika
        this.logout(false) // false = nie wołaj API, tylko wyczyść stan
      } finally {
        this.loading = false
      }
    },

    // TEJ FUNKCJI BRAKOWAŁO - ustawia użytkownika w stanie i localStorage
    setUser(u) { 
      this.user = u
      if (u) {
        localStorage.setItem('user', JSON.stringify(u))
      } else {
        localStorage.removeItem('user')
      }
    },

    // Wylogowanie
    async logout(callApi = true) {
      if (callApi) {
        try {
          await api.post('/auth/logout')
        } catch (e) {
          console.error('Błąd wylogowania API', e)
        }
      }
      this.user = null
      localStorage.removeItem('user')
    },
  },
})