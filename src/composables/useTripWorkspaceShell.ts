import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { User } from 'firebase/auth'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { Role, Trip } from '../types'
import { firebaseEnabled } from '../services/firebase'
import {
  tripTabFromRouteName,
  tripTabLabels,
  tripTabOptions,
  tripTabRouteNames,
  type TripTab,
} from '../router/tripWorkspaceTabs'

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

  const activeTripTab = computed<TripTab>(() => tripTabFromRouteName(String(route.name || '')))

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
      name: tripTabRouteNames[tab],
      params: { tripId: activeId },
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
