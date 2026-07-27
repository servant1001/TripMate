<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useTripStore } from '../stores/trip'
import { firebaseEnabled } from '../services/firebase'
import { useTripmateSession } from '../composables/useTripmateSession'
import { useTripWorkspaceShell } from '../composables/useTripWorkspaceShell'
import { useTripWorkspaceItinerary } from '../composables/useTripWorkspaceItinerary'
import { useTripWorkspaceExpenses } from '../composables/useTripWorkspaceExpenses'
import { useTripWorkspaceTripEditor } from '../composables/useTripWorkspaceTripEditor'

const TripWorkspaceShell = defineAsyncComponent(
  () => import('../components/TripWorkspaceShell.vue'),
)
const TripManagementDialogs = defineAsyncComponent(
  () => import('../components/TripManagementDialogs.vue'),
)
const TripExpensesView = defineAsyncComponent(() => import('./TripExpensesView.vue'))
const TripItineraryView = defineAsyncComponent(() => import('./TripItineraryView.vue'))
const TripBookingsView = defineAsyncComponent(() => import('./TripBookingsView.vue'))
const TripFavoritesView = defineAsyncComponent(() => import('./TripFavoritesView.vue'))
const TripMapView = defineAsyncComponent(() => import('./TripMapView.vue'))
const TripAlbumView = defineAsyncComponent(() => import('./TripAlbumView.vue'))
const TripMembersView = defineAsyncComponent(() => import('./TripMembersView.vue'))
const TripPaymentsView = defineAsyncComponent(() => import('./TripPaymentsView.vue'))
const TripInsuranceView = defineAsyncComponent(() => import('./TripInsuranceView.vue'))
const TripShoppingView = defineAsyncComponent(() => import('./TripShoppingView.vue'))
const TripTodosView = defineAsyncComponent(() => import('./TripTodosView.vue'))
const TripPackingView = defineAsyncComponent(() => import('./TripPackingView.vue'))

const route = useRoute()
const router = useRouter()
const store = useTripStore()

const {
  user,
  authResolving,
  initSession,
  signOutUser,
  userDisplayName,
  userInitial,
} = useTripmateSession()

const activeId = computed(() => String(route.params.tripId || ''))
const current = computed(() => store.trip(activeId.value))
const currentItems = computed(() => store.items(activeId.value))
const currentExpenses = computed(() => store.tripExpenses(activeId.value))
const currentTodos = computed(() => store.tripTodos(activeId.value))
const currentPackingItems = computed(() => store.tripPackingItems(activeId.value))
const currentBookings = computed(() => store.tripBookings(activeId.value))
const currentFavorites = computed(() => store.tripFavorites(activeId.value))
const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value))
const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value))
const currentSettlements = computed(() => store.tripSettlements(activeId.value))
const currentInsurance = computed(() =>
  store
    .tripInsurances(activeId.value)
    .find((entry) => entry.userId === user.value?.uid),
)
const currentInsuranceStatuses = computed(() =>
  store.tripInsuranceStatuses(activeId.value),
)
const currentPaymentTools = computed(() => store.tripPaymentTools(activeId.value))
const currentRewardRules = computed(() => store.tripRewardRules(activeId.value))
const currentPaymentTransactions = computed(() =>
  store.tripPaymentTransactions(activeId.value),
)
const currentStoredBalances = computed(() =>
  store.tripStoredValueBalances(activeId.value),
)
const currentPaymentToolSummaries = computed(() =>
  store.tripPaymentToolSummaries(activeId.value),
)

const currentMember = computed(() => {
  const signedInUser = user.value
  if (!signedInUser) return undefined
  return (
    current.value?.members.find((member) => member.id === signedInUser.uid) ||
    current.value?.members.find(
      (member) =>
        member.email.toLowerCase() === (signedInUser.email || '').toLowerCase(),
    )
  )
})

const shell = useTripWorkspaceShell({
  route,
  router,
  current,
  currentMember,
  user,
})

const itinerary = useTripWorkspaceItinerary({
  store,
  items: currentItems,
  favorites: currentFavorites,
  user,
  canEditTrip: shell.canEditTrip,
})

const activeMemberId = computed(
  () =>
    currentMember.value?.id ||
    (!firebaseEnabled ? current.value?.ownerId : undefined),
)
const activeMember = computed(() =>
  activeMemberId.value
    ? current.value?.members.find((member) => member.id === activeMemberId.value)
    : undefined,
)

const expenseState = useTripWorkspaceExpenses({
  trip: current,
  expenses: currentExpenses,
  settlements: currentSettlements,
  activeMemberId,
})

const tripEditor = useTripWorkspaceTripEditor({
  store,
  current,
  currentUserId: computed(() => user.value?.uid),
  onDeleted: () => {
    goTrips()
  },
})

const categoryBudgets = computed(() => store.tripCategoryBudgets(activeId.value))
const dailyBudget = computed(() => store.tripDailyBudget(activeId.value))
const budgetCategoryNames = computed(() => [
  ...new Set([
    ...expenseState.baseBudgetCategories,
    ...Object.keys(categoryBudgets.value),
    ...currentExpenses.value.map((expense) => expense.category).filter(Boolean),
  ]),
])
const categoryBudgetSummary = computed(() =>
  budgetCategoryNames.value
    .map((category) => ({
      category,
      budget: Number(categoryBudgets.value[category]) || 0,
      spent: currentExpenses.value
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((row) => row.budget > 0 || row.spent > 0),
)
const dailyExpenseSummary = computed(() =>
  Object.entries(
    currentExpenses.value
      .filter((expense) => /^\d{4}-\d{2}-\d{2}$/.test(expense.date))
      .reduce<Record<string, number>>((days, expense) => {
        days[expense.date] = (days[expense.date] || 0) + expense.amount
        return days
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spent]) => ({ date, spent })),
)
const personalBudget = computed(() => activeMember.value?.personalBudget || 0)

const activeTripTab = shell.activeTripTab
const tripTabLabels = shell.tripTabLabels
const tripTabOptions = shell.tripTabOptions
const currentRole = shell.currentRole
const canEditTrip = shell.canEditTrip
const canManageMembers = shell.canManageMembers
const canEditTripSettings = shell.canEditTripSettings
const mobileTripMenuOpen = shell.mobileTripMenuOpen
const memberManagerRequested = shell.memberManagerRequested
const itinerarySortingEnabled = shell.itinerarySortingEnabled

const favoriteItineraryRequestId = itinerary.favoriteItineraryRequestId
const itineraryDays = itinerary.itineraryDays
const currentPersonalItems = itinerary.currentPersonalItems
const favoritesWithItineraryStatus = itinerary.favoritesWithItineraryStatus

const total = expenseState.total
const balances = expenseState.balances
const settlementSuggestions = expenseState.settlementSuggestions
const myPaid = expenseState.myPaid
const myBalance = expenseState.myBalance
const myExpense = expenseState.myExpense

const showJoin = tripEditor.showJoin
const showCreate = tripEditor.showCreate
const showEdit = tripEditor.showEdit
const savingTrip = tripEditor.savingTrip
const editCoverPreview = tripEditor.editCoverPreview
const invite = tripEditor.invite
const create = tripEditor.create
const edit = tripEditor.edit

function goTrips() {
  void router.push({ name: 'trips' })
}

function goLogin() {
  void router.push({ name: 'login' })
}

function goProfile() {
  void router.push({ name: 'profile' })
}

async function handleSignOut() {
  await signOutUser()
}

function memberName(memberId: string) {
  return (
    current.value?.members.find((member) => member.id === memberId)?.name ||
    '未知成員'
  )
}

function formatTripDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  return Number.isNaN(value.getTime())
    ? date
    : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日`
}

const tripDateRange = computed(() =>
  current.value
    ? `${formatTripDate(current.value.startDate)}－${formatTripDate(current.value.endDate)}`
    : '',
)
const tripDuration = computed(() => {
  if (!current.value) return ''
  const start = new Date(`${current.value.startDate}T00:00:00`).getTime()
  const end = new Date(`${current.value.endDate}T00:00:00`).getTime()
  const days = Math.round((end - start) / 86400000) + 1
  return Number.isFinite(days) && days > 0 ? `共 ${days} 天` : ''
})

function selectTripTab(tab: Parameters<typeof shell.selectTripTab>[0]) {
  shell.selectTripTab(tab, activeId.value)
}

function openMemberManager() {
  const opened = shell.openMemberManager(activeId.value)
  if (!opened) {
    ElMessage.warning('只有旅行建立者可以管理成員。')
  }
}

function toggleItinerarySorting() {
  if (!shell.canEditTrip.value) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  shell.itinerarySortingEnabled.value = !shell.itinerarySortingEnabled.value
  ElMessage.info(
    shell.itinerarySortingEnabled.value
      ? '已啟用排序：長按拖曳把手可調整行程。'
      : '行程排序已保存。',
  )
}

async function sortItineraryItems(payload: { date: string; oldIndex: number; newIndex: number }) {
  if (
    !shell.canEditTrip.value ||
    !shell.itinerarySortingEnabled.value ||
    payload.oldIndex === payload.newIndex
  ) {
    return
  }
  try {
    await itinerary.sortItineraryItems(payload)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。')
  }
}

async function sortGroupItineraryItems(payload: {
  groupId: string
  oldIndex: number
  newIndex: number
}) {
  if (
    !shell.canEditTrip.value ||
    !shell.itinerarySortingEnabled.value ||
    payload.oldIndex === payload.newIndex
  ) {
    return
  }
  try {
    await itinerary.sortGroupItineraryItems(payload)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新群組內行程順序。')
  }
}

async function sortPersonalItineraryItems(payload: {
  parentId: string
  oldIndex: number
  newIndex: number
}) {
  if (
    !shell.canEditTrip.value ||
    !shell.itinerarySortingEnabled.value ||
    payload.oldIndex === payload.newIndex
  ) {
    return
  }
  try {
    await itinerary.sortPersonalItineraryItems(payload)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新個人行程順序。')
  }
}

async function moveItineraryItem(payload: {
  itemId: string
  from: string
  to: string
  oldIndex: number
  newIndex: number
}) {
  if (!shell.canEditTrip.value || !shell.itinerarySortingEnabled.value || payload.from === payload.to) {
    return
  }
  try {
    await itinerary.moveItineraryItem(payload)
    const targetIsGroup = payload.to.startsWith('group:')
    const sourceIsGroup = payload.from.startsWith('group:')
    const targetIsPersonal = payload.to.startsWith('personal:')
    ElMessage.success(
      targetIsGroup
        ? '已移入地點群組。'
        : sourceIsGroup && payload.to.startsWith('day:')
          ? '已移出地點群組。'
          : targetIsPersonal
            ? '已移入自由活動，僅自己可見。'
            : '已移動行程。',
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法移動行程。')
  }
}

watch(
  [authResolving, user, () => route.fullPath],
  ([resolving, signedInUser, fullPath]) => {
    if (resolving || !firebaseEnabled || signedInUser) return
    void router.replace({ name: 'login', query: { redirect: String(fullPath) } })
  },
  { immediate: true },
)

onMounted(() => {
  void initSession()
})

onUnmounted(() => {
  tripEditor.clearEditCoverPreview()
})
</script>

<template>
  <section v-if="authResolving" class="auth-loading" aria-live="polite">
    <div>
      <strong>TripMate</strong>
      <p>正在確認登入狀態…</p>
    </div>
  </section>

  <TripWorkspaceShell
    v-else-if="current"
    :signed-in="Boolean(user)"
    :user-display-name="userDisplayName"
    :user-initial="userInitial"
    :trip="current"
    :date-range="tripDateRange"
    :duration="tripDuration"
    :active-trip-tab="activeTripTab"
    :trip-tab-labels="tripTabLabels"
    :trip-tab-options="tripTabOptions"
    :can-edit-trip-settings="canEditTripSettings"
    :can-manage-members="canManageMembers"
    :role-label="currentRole === 'editor' ? 'Editor・可編輯' : 'Viewer・唯讀'"
    :mobile-trip-menu-open="mobileTripMenuOpen"
    @go-trips="goTrips"
    @go-profile="goProfile"
    @go-login="goLogin"
    @sign-out="handleSignOut"
    @open-trip-menu="mobileTripMenuOpen = true"
    @close-trip-menu="mobileTripMenuOpen = false"
    @update:mobile-trip-menu-open="mobileTripMenuOpen = $event"
    @select-tab="selectTripTab"
    @back="goTrips"
    @edit-trip="tripEditor.startEditTrip"
    @remove-trip="tripEditor.removeTrip"
    @open-member-manager="openMemberManager"
  >
    <TripItineraryView
      v-if="activeTripTab === 'overview' || activeTripTab === 'itinerary'"
      :trip="current"
      :items="currentItems"
      :favorites="currentFavorites"
      :user-id="user?.uid || current.ownerId"
      :favorite-request-id="favoriteItineraryRequestId"
      :days="itineraryDays"
      :personal-items="currentPersonalItems"
      :shopping-items="currentShoppingItems"
      :can-edit="canEditTrip"
      :sorting-enabled="itinerarySortingEnabled"
      :format-date="itinerary.formatItineraryDate"
      :duration="itinerary.itineraryDuration"
      :time-warning="itinerary.itineraryTimeWarning"
      :maps-url="itinerary.mapsUrl"
      @favorite-request-consumed="itinerary.clearFavoriteRequest()"
      @toggle="itinerary.toggleItinerary"
      @remove="itinerary.removeItem"
      @toggle-sorting="toggleItinerarySorting"
      @sort="sortItineraryItems"
      @sort-group="sortGroupItineraryItems"
      @sort-personal="sortPersonalItineraryItems"
      @move="moveItineraryItem"
    />

    <TripMapView
      v-if="activeTripTab === 'map'"
      :days="itineraryDays"
      :format-date="itinerary.formatItineraryDate"
      :maps-url="itinerary.mapsUrl"
    />

    <TripExpensesView
      v-if="activeTripTab === 'overview' || activeTripTab === 'expenses'"
      :trip="current"
      :expenses="currentExpenses"
      :total="total"
      :my-paid="myPaid"
      :my-balance="myBalance"
      :personal-budget-member-id="activeMemberId"
      :personal-budget="personalBudget"
      :personal-spent="myExpense"
      :category-budget-values="categoryBudgets"
      :category-budget-options="budgetCategoryNames"
      :category-budgets="categoryBudgetSummary"
      :daily-budget="dailyBudget"
      :daily-expenses="dailyExpenseSummary"
      :can-set-personal-budget="Boolean(activeMemberId)"
      :can-manage-category-budgets="canEditTripSettings"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :payer-label="expenseState.expensePayerLabel"
      :split-label="expenseState.expenseSplitLabel"
      :participant-count="expenseState.expenseParticipantCount"
      :share="expenseState.expenseShare"
    />

    <TripTodosView
      v-if="activeTripTab === 'todos'"
      :trip="current"
      :todos="currentTodos"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
    />

    <TripPackingView
      v-if="activeTripTab === 'packing'"
      :trip="current"
      :items="currentPackingItems"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
    />

    <TripBookingsView
      v-if="activeTripTab === 'bookings'"
      :trip="current"
      :bookings="currentBookings"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
    />

    <TripFavoritesView
      v-if="activeTripTab === 'favorites'"
      :trip="current"
      :favorites="favoritesWithItineraryStatus"
      :currency="current.currency"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :actor-name="currentMember?.name || userDisplayName"
      :member-name="memberName"
      @add-to-itinerary="itinerary.addFavoriteToItinerary"
    />

    <TripAlbumView
      v-if="activeTripTab === 'album'"
      :trip="current"
      :photos="currentAlbumPhotos"
      :items="currentItems"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
      :format-date="formatTripDate"
    />

    <TripShoppingView
      v-if="activeTripTab === 'shopping'"
      :trip="current"
      :items="currentShoppingItems"
      :itineraries="currentItems"
      :can-edit="canEditTrip"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
      :format-date="itinerary.formatItineraryDate"
    />

    <TripPaymentsView
      v-if="activeTripTab === 'payments'"
      :trip="current"
      :tools="currentPaymentTools"
      :rules="currentRewardRules"
      :transactions="currentPaymentTransactions"
      :balances="currentStoredBalances"
      :summaries="currentPaymentToolSummaries"
      :user-id="user?.uid || current.ownerId"
      :can-edit="canEditTrip"
      :member-name="memberName"
    />

    <TripInsuranceView
      v-if="activeTripTab === 'insurance'"
      :trip="current"
      :insurance="currentInsurance"
      :statuses="currentInsuranceStatuses"
      :user-id="user?.uid || current.ownerId"
      :member-name="memberName"
      :can-edit="canEditTrip"
    />

    <TripMembersView
      v-if="activeTripTab === 'overview' || activeTripTab === 'members'"
      v-model:open-manager="memberManagerRequested"
      :trip="current"
      :balances="balances"
      :suggestions="settlementSuggestions"
      :settlements="currentSettlements"
      :expenses="currentExpenses"
      :can-manage="canManageMembers"
      :can-edit="canEditTrip"
      :member-name="memberName"
    />
  </TripWorkspaceShell>

  <TripManagementDialogs
    v-model:show-join="showJoin"
    v-model:show-create="showCreate"
    v-model:show-edit="showEdit"
    v-model:invite-code="invite.code"
    :create-form="create"
    :edit-form="edit"
    :edit-cover-preview="editCoverPreview"
    :saving-trip="savingTrip"
    @select-create-cover="() => undefined"
    @select-edit-cover="tripEditor.selectEditCover"
    @remove-edit-cover="tripEditor.removeEditCover"
    @join-trip="() => undefined"
    @create-trip="() => undefined"
    @save-trip="tripEditor.saveTrip"
    @remove-trip="tripEditor.removeTrip"
  />
</template>
