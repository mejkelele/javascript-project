<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
</script>

<template>
  <nav class="navbar">
    <div class="nav-left">
      <RouterLink to="/" class="nav-logo"> Cringely </RouterLink>

      <RouterLink to="/" class="nav-link">Home</RouterLink>
      <RouterLink to="/about" class="nav-link">About</RouterLink>
      <RouterLink v-if="auth.isAuthenticated" to="/my-tests" class="nav-link">Moje Testy</RouterLink>
      
    </div>

    <div class="nav-right">
      <template v-if="!auth.isAuthenticated">
        <RouterLink to="/login" class="nav-btn">Logowanie</RouterLink>
        <RouterLink to="/register" class="nav-btn">Rejestracja</RouterLink>
      </template>

      <template v-else>
        <RouterLink to="/profile" class="nav-user-link"><span class="nav-user">👤 {{ auth.user?.name || auth.user?.email }}</span>
        </RouterLink>
        <span class="nav-user">👋 {{ auth.user?.name || auth.user?.email }}</span>
        
        <button class="nav-btn" @click="auth.logout()">Wyloguj</button>

      </template>
    </div>
  </nav>
  <main>
    <RouterView />
  </main>
</template>



.nav-user-link { text-decoration: none; margin-right: 10px; display: flex; align-items: center; transition: 0.2s; }
.nav-user-link:hover { opacity: 0.8; }