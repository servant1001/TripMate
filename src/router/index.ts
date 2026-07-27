import { createRouter, createWebHistory } from 'vue-router'
import { firebaseEnabled, waitForAuthState } from '../services/firebase'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}

const AppRouteView = () => import('../views/AppRouteView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/trips' },
    { path: '/login', name: 'login', component: AppRouteView, meta: { public: true } },
    { path: '/register', name: 'register', component: AppRouteView, meta: { public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: AppRouteView, meta: { public: true } },
    { path: '/trips', name: 'trips', component: AppRouteView },
    { path: '/trips/create', name: 'trip-create', component: AppRouteView },
    { path: '/trips/:tripId/dashboard', redirect: (to) => ({ name: 'trip-tab', params: { tripId: to.params.tripId, tab: 'overview' }, query: to.query }) },
    { path: '/trips/:tripId/insurance', redirect: (to) => ({ name: 'trip-tab', params: { tripId: to.params.tripId, tab: 'insurance' }, query: to.query }) },
    { path: '/trips/:tripId/payment-tools', redirect: (to) => ({ name: 'trip-tab', params: { tripId: to.params.tripId, tab: 'payments' }, query: to.query }) },
    { path: '/trips/:tripId/:tab(overview|itinerary|expenses|todos|favorites|shopping|payments|packing|bookings|insurance|album|map|members)', name: 'trip-tab', component: AppRouteView },
    { path: '/profile', name: 'profile', component: AppRouteView },
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
