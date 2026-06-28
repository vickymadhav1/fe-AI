import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import HistoryView from '../views/HistoryView.vue'
import SessionView from '../views/SessionView.vue'
import CompanionView from '../views/CompanionView.vue'
import InvisibleSubscriptionView from '../views/InvisibleSubscriptionView.vue'
import DashboardView from '../views/DashboardView.vue'
import PaymentView from '../views/PaymentView.vue'
import SupportView from '../views/SupportView.vue'
import { useAuthStore } from '@/stores/auth.store'

const routes = [
  {
    path: '/',
    name: 'login',
    component: LoginView,
    meta: { title: 'Login' },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: DashboardView,
        meta: { title: 'Dashboard', requiresAuth: true },
      },
      {
        path: 'sessions/:id',
        name: 'session',
        component: SessionView,
        meta: { title: 'Live Session', requiresAuth: true },
      },
      {
        path: 'history',
        name: 'history',
        component: HistoryView,
        meta: { title: 'History', requiresAuth: true },
      },
      {
        path: 'invisible',
        name: 'invisible',
        component: InvisibleSubscriptionView,
        meta: { title: 'Invisible', requiresAuth: true },
      },
      {
        path: 'payment',
        name: 'payment',
        component: PaymentView,
        meta: { title: 'Payment', requiresAuth: true },
      },
      {
        path: 'support',
        name: 'support',
        component: SupportView,
        meta: { title: 'Support', requiresAuth: true },
      },
    ],
  },
  {
    path: '/companion',
    name: 'companion',
    component: CompanionView,
    meta: { title: 'Interview Mate AI Companion' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/sessions/new',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const hasStoredToken = Boolean(localStorage.getItem('interview-mate-token'))

  if (to.meta.requiresAuth && !hasStoredToken) {
    authStore.logout()
    return { name: 'login' }
  }

  if (to.meta.requiresAuth) {
    const valid = await authStore.validateStoredSession()
    if (!valid) return { name: 'login' }
  }

  if (to.name === 'login' && hasStoredToken) {
    const valid = await authStore.validateStoredSession()
    if (!valid) return true
    return { name: 'dashboard' }
  }
})

export default router
