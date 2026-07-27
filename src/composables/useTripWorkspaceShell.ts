import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { User } from 'firebase/auth'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { Role, Trip } from '../types'
import { firebaseEnabled } from '../services/firebase'

export type TripTab =
  | 'overview'
  | 'itinerary'
  | 'map'
  | 'expenses'
  | 'todos'
  | 'packing'
  | 'bookings'
  | 'favorites'
  | 'album'
  | 'shopping'
  | 'insurance'
  | 'payments'
  | 'members'

export function useTripWorkspaceShell({
  route,
  router,
  current,
  currentMember,
  user,
}: {
  route: RouteLocationNormalizedLoaded
  router: Router
  current: ComputedRef<Trip | undefined>
  currentMember: ComputedRef<Trip['members'][number] | undefined>
  user: Ref<User | null>
}) {
  const mobileTripMenuOpen = ref(false)
  const memberManagerRequested = ref(false)
  const itinerarySortingEnabled = ref(false)

  const activeTripTab = computed<TripTab>(() => {
    const tab = String(route.params.tab || '')
    return tab === 'overview' ||
      tab === 'itinerary' ||
      tab === 'map' ||
      tab === 'expenses' ||
      tab === 'todos' ||
      tab === 'packing' ||
      tab === 'bookings' ||
      tab === 'favorites' ||
      tab === 'album' ||
      tab === 'shopping' ||
      tab === 'insurance' ||
      tab === 'payments' ||
      tab === 'members'
      ? tab
      : 'overview'
  })

  const tripTabLabels: Record<TripTab, string> = {
    overview: '總覽',
    itinerary: '行程',
    map: '地圖',
    expenses: '開銷',
    todos: '待辦',
    packing: '行李',
    bookings: '預訂',
    favorites: '收藏',
    album: '相簿',
    shopping: '購物',
    insurance: '保險',
    payments: '支付與回饋',
    members: '旅伴與結算',
  }

  const tripTabOptions: TripTab[] = [
    'overview',
    'itinerary',
    'expenses',
    'todos',
    'favorites',
    'shopping',
    'payments',
    'packing',
    'bookings',
    'insurance',
    'album',
    'map',
    'members',
  ]

  const currentRole = computed<Role | undefined>(
    () =>
      currentMember.value?.role ||
      (current.value?.ownerId === user.value?.uid ? 'owner' : undefined),
  )

  const canEditTrip = computed(
    () =>
      !firebaseEnabled ||
      currentRole.value === 'owner' ||
      currentRole.value === 'editor',
  )

  const canManageMembers = computed(
    () => !firebaseEnabled || current.value?.ownerId === user.value?.uid,
  )

  const canEditTripSettings = computed(
    () => !firebaseEnabled || current.value?.ownerId === user.value?.uid,
  )

  function selectTripTab(tab: TripTab, activeId: string) {
    mobileTripMenuOpen.value = false
    if (tab !== 'itinerary') itinerarySortingEnabled.value = false
    if (tab === activeTripTab.value) return
    void router.push({
      name: 'trip-tab',
      params: { tripId: activeId, tab },
      query: route.query,
    })
  }

  function openMemberManager(activeId: string) {
    if (!canManageMembers.value) return false
    memberManagerRequested.value = true
    if (activeTripTab.value !== 'overview' && activeTripTab.value !== 'members') {
      selectTripTab('members', activeId)
    }
    return true
  }

  return {
    mobileTripMenuOpen,
    memberManagerRequested,
    itinerarySortingEnabled,
    activeTripTab,
    tripTabLabels,
    tripTabOptions,
    currentRole,
    canEditTrip,
    canManageMembers,
    canEditTripSettings,
    selectTripTab,
    openMemberManager,
  }
}
