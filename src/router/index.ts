import { createRouter, createWebHistory } from 'vue-router'
import { firebaseEnabled, waitForAuthState } from '../services/firebase'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/trips' },
    { path: '/login', name: 'login', component: () => import('../App.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('../App.vue'), meta: { public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('../App.vue'), meta: { public: true } },
    { path: '/trips', name: 'trips', component: () => import('../App.vue') },
    { path: '/trips/create', name: 'trip-create', component: () => import('../App.vue') },
    { path: '/trips/:tripId/dashboard', name: 'trip-dashboard', component: () => import('../App.vue') },
    { path: '/trips/:tripId/insurance', name: 'trip-insurance', component: () => import('../App.vue') },
    { path: '/profile', name: 'profile', component: () => import('../App.vue') },
  ],
})

router.beforeEach(async (to) => {
  if (!firebaseEnabled) return true
  const user = await waitForAuthState()
  if (!to.meta.public && !user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.public && user) return { name: 'trips' }
  return true
})

export default router
