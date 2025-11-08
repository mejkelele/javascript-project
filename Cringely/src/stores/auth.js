import { defineStore } from 'pinia'
import api from '../services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.user,
  },
  actions: {
    async fetchMe() {
      try {
        this.loading = true
        const { data } = await api.get('/auth/me')
        this.user = data
      } finally {
        this.loading = false
      }
    },
    setUser(u) { this.user = u },
    async logout() {
      await api.post('/auth/logout')
      this.user = null
    },
  },
})