import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import RegisterView from '../views/RegisterView.vue'
import LoginView from '../views/LoginView.vue' 
import MyTestsView from '../views/MytestsView.vue'
import CreateTestView from '../views/CreateTestView.vue'
import PublicTestView from '../views/PublicTestView.vue'
import UserView from '../views/UserView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',        name: 'home',      component: HomeView },
    { path: '/about',   name: 'about',     component: AboutView },
    { path: '/register',name: 'register',  component: RegisterView },
    { path: '/login',   name: 'login',     component: LoginView },
    { path: '/my-tests', name: 'my-tests', component: MyTestsView },
    { path: '/create-test', name: 'create-test', component: CreateTestView },
    { path: '/edit-test/:id', name: 'edit-test', component: CreateTestView },
    { path: '/t/:code', name: 'public-test', component: PublicTestView },
    { path: '/profile', name: 'profile', component: UserView },
  ],
})

export default router