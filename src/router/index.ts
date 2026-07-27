import { createRouter, createWebHistory } from 'vue-router'
import { firebaseEnabled, waitForAuthState } from '../services/firebase'
import { tripTabRouteNames } from './tripWorkspaceTabs'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}

const AuthRouteView = () => import('../views/AuthRouteView.vue')
const TripsRouteView = () => import('../views/TripsRouteView.vue')
const ProfileRouteView = () => import('../views/ProfileRouteView.vue')
const TripWorkspaceRouteView = () => import('../views/TripWorkspaceRouteView.vue')
const TripOverviewTabRoute = () => import('../views/TripOverviewTabRoute.vue')
const TripItineraryTabRoute = () => import('../views/TripItineraryTabRoute.vue')
const TripMapTabRoute = () => import('../views/TripMapTabRoute.vue')
const TripExpensesTabRoute = () => import('../views/TripExpensesTabRoute.vue')
const TripTodosTabRoute = () => import('../views/TripTodosTabRoute.vue')
const TripPackingTabRoute = () => import('../views/TripPackingTabRoute.vue')
const TripBookingsTabRoute = () => import('../views/TripBookingsTabRoute.vue')
const TripFavoritesTabRoute = () => import('../views/TripFavoritesTabRoute.vue')
const TripAlbumTabRoute = () => import('../views/TripAlbumTabRoute.vue')
const TripShoppingTabRoute = () => import('../views/TripShoppingTabRoute.vue')
const TripInsuranceTabRoute = () => import('../views/TripInsuranceTabRoute.vue')
const TripPaymentsTabRoute = () => import('../views/TripPaymentsTabRoute.vue')
const TripMembersTabRoute = () => import('../views/TripMembersTabRoute.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/trips' },
    { path: '/login', name: 'login', component: AuthRouteView, meta: { public: true } },
    { path: '/register', name: 'register', component: AuthRouteView, meta: { public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: AuthRouteView, meta: { public: true } },
    { path: '/trips', name: 'trips', component: TripsRouteView },
    { path: '/trips/create', name: 'trip-create', component: TripsRouteView },
    { path: '/trips/:tripId/dashboard', redirect: (to) => ({ name: tripTabRouteNames.overview, params: { tripId: to.params.tripId }, query: to.query }) },
    { path: '/trips/:tripId/insurance', redirect: (to) => ({ name: tripTabRouteNames.insurance, params: { tripId: to.params.tripId }, query: to.query }) },
    { path: '/trips/:tripId/payment-tools', redirect: (to) => ({ name: tripTabRouteNames.payments, params: { tripId: to.params.tripId }, query: to.query }) },
    {
      path: '/trips/:tripId',
      component: TripWorkspaceRouteView,
      children: [
        { path: '', redirect: (to) => ({ name: tripTabRouteNames.overview, params: { tripId: to.params.tripId }, query: to.query }) },
        { path: 'overview', name: tripTabRouteNames.overview, component: TripOverviewTabRoute },
        { path: 'itinerary', name: tripTabRouteNames.itinerary, component: TripItineraryTabRoute },
        { path: 'map', name: tripTabRouteNames.map, component: TripMapTabRoute },
        { path: 'expenses', name: tripTabRouteNames.expenses, component: TripExpensesTabRoute },
        { path: 'todos', name: tripTabRouteNames.todos, component: TripTodosTabRoute },
        { path: 'packing', name: tripTabRouteNames.packing, component: TripPackingTabRoute },
        { path: 'bookings', name: tripTabRouteNames.bookings, component: TripBookingsTabRoute },
        { path: 'favorites', name: tripTabRouteNames.favorites, component: TripFavoritesTabRoute },
        { path: 'album', name: tripTabRouteNames.album, component: TripAlbumTabRoute },
        { path: 'shopping', name: tripTabRouteNames.shopping, component: TripShoppingTabRoute },
        { path: 'insurance', name: tripTabRouteNames.insurance, component: TripInsuranceTabRoute },
        { path: 'payments', name: tripTabRouteNames.payments, component: TripPaymentsTabRoute },
        { path: 'members', name: tripTabRouteNames.members, component: TripMembersTabRoute },
      ],
    },
    { path: '/profile', name: 'profile', component: ProfileRouteView },
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
