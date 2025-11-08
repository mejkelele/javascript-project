<script setup>
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
</script>

<template>
  <nav style="display:flex; gap:1rem; padding:8px 12px;">
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>

    <template v-if="!auth.isAuthenticated">
      <RouterLink to="/login">Logowanie</RouterLink>
      <RouterLink to="/register">Rejestracja</RouterLink>
    </template>

    <template v-else>
      <span>Witaj, {{ auth.user?.name || auth.user?.email }}</span>
      <button @click="auth.logout()">Wyloguj</button>
    </template>
  </nav>

  <RouterView />
</template>
