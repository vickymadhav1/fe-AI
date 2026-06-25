import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import HistoryView from '../views/HistoryView.vue'
import SettingsView from '../views/SettingsView.vue'
import SessionView from '../views/SessionView.vue'
import CompanionView from '../views/CompanionView.vue'
import InvisibleSubscriptionView from '../views/InvisibleSubscriptionView.vue'

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
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { title: 'Settings', requiresAuth: true },
      },
      {
        path: 'invisible',
        name: 'invisible',
        component: InvisibleSubscriptionView,
        meta: { title: 'Invisible', requiresAuth: true },
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

router.beforeEach((to) => {
  const hasSession = Boolean(localStorage.getItem('interview-mate-token'))

  if (to.meta.requiresAuth && !hasSession) {
    return { name: 'login' }
  }

  if (to.name === 'login' && hasSession) {
    return { name: 'session', params: { id: 'new' } }
  }
})

export default router
