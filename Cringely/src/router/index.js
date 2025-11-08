import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import RegisterView from '../views/RegisterView.vue'
import LoginView from '../views/LoginView.vue' 


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',        name: 'home',      component: HomeView },
    { path: '/about',   name: 'about',     component: AboutView },
    { path: '/register',name: 'register',  component: RegisterView },
    { path: '/login',   name: 'login',     component: LoginView }, // ⬅️ nowa trasa
  ],
})

export default router