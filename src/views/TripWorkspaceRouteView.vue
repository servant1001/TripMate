<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useTripStore } from '../stores/trip'
import { firebaseEnabled } from '../services/firebase'
import { getLatestExchangeRate } from '../services/exchangeRates'
import { normalizeTripCurrency } from '../constants/tripCurrencies'
import { useTripmateSession } from '../composables/useTripmateSession'
import { useTripWorkspaceShell } from '../composables/useTripWorkspaceShell'
import { useTripWorkspaceItinerary } from '../composables/useTripWorkspaceItinerary'
import { useTripWorkspaceExpenses } from '../composables/useTripWorkspaceExpenses'
import { useTripWorkspaceTripEditor } from '../composables/useTripWorkspaceTripEditor'
import {
  provideTripWorkspaceContext,
  type TripWorkspaceContext,
} from '../composables/useTripWorkspaceContext'

const TripWorkspaceShell = defineAsyncComponent(
  () => import('../components/TripWorkspaceShell.vue'),
)
const TripManagementDialogs = defineAsyncComponent(
  () => import('../components/TripManagementDialogs.vue'),
)

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
const currentAlbumFolders = computed(() => store.tripAlbumFolders(activeId.value))
const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value))
const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value))
const currentSettlements = computed(() => store.tripSettlements(activeId.value))
const currentInsurance = computed(() =>
  store.tripInsurances(activeId.value).find((entry) => entry.userId === user.value?.uid),
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
  openItineraryTab: () => {
    if (activeId.value) shell.selectTripTab('itinerary', activeId.value)
  },
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
const tripExchangeRateText = ref('')
const tripExchangeRateDate = ref('')
const tripExchangeRateError = ref('')
const tripExchangeRateLoading = ref(false)

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

function formatExchangeRate(rate: number) {
  const safe = Number(rate) || 0
  return safe.toLocaleString('zh-TW', {
    minimumFractionDigits: safe >= 1 ? 2 : 4,
    maximumFractionDigits: safe >= 10 ? 2 : safe >= 1 ? 3 : 4,
  })
}

async function refreshTripExchangeRate(force = false) {
  const normalized = normalizeTripCurrency(current.value?.currency)
  tripExchangeRateText.value = ''
  tripExchangeRateDate.value = ''
  tripExchangeRateError.value = ''

  if (!normalized) return

  tripExchangeRateLoading.value = true
  try {
    const quote = await getLatestExchangeRate(normalized, 'TWD', { force })
    if (normalizeTripCurrency(current.value?.currency) !== normalized) return
    tripExchangeRateText.value = `今日匯率 1 ${quote.from} ≈ TWD ${formatExchangeRate(quote.rate)}`
    tripExchangeRateDate.value = quote.date
    if (force) {
      ElMessage.success('已更新今日匯率。')
    }
  } catch (error) {
    if (normalizeTripCurrency(current.value?.currency) !== normalized) return
    tripExchangeRateError.value =
      error instanceof Error ? error.message : '暫時無法取得今日匯率。'
  } finally {
    if (normalizeTripCurrency(current.value?.currency) === normalized) {
      tripExchangeRateLoading.value = false
    }
  }
}

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

async function sortItineraryItems(payload: {
  date: string
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

async function moveItineraryItem(payload: {
  itemId: string
  from: string
  to: string
  oldIndex: number
  newIndex: number
}) {
  if (
    !shell.canEditTrip.value ||
    !shell.itinerarySortingEnabled.value ||
    payload.from === payload.to
  ) {
    return
  }
  try {
    await itinerary.moveItineraryItem(payload)
    const targetIsGroup = payload.to.startsWith('group:')
    const sourceIsGroup = payload.from.startsWith('group:')
    ElMessage.success(
      targetIsGroup
        ? '已移入群組卡。'
        : sourceIsGroup && payload.to.startsWith('day:')
          ? '已移出群組卡。'
          : '已移動行程。',
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法移動行程。')
  }
}

const workspaceContext: TripWorkspaceContext = {
  current,
  currentItems,
  currentExpenses,
  currentTodos,
  currentPackingItems,
  currentBookings,
  currentFavorites,
  currentAlbumFolders,
  currentAlbumPhotos,
  currentShoppingItems,
  currentSettlements,
  currentInsurance,
  currentInsuranceStatuses,
  currentPaymentTools,
  currentRewardRules,
  currentPaymentTransactions,
  currentStoredBalances,
  currentPaymentToolSummaries,
  currentMember,
  favoritesWithItineraryStatus,
  itineraryDays,
  activeMemberId,
  categoryBudgets,
  budgetCategoryNames,
  categoryBudgetSummary,
  dailyBudget,
  dailyExpenseSummary,
  personalBudget,
  balances,
  settlementSuggestions,
  total,
  myPaid,
  myBalance,
  myExpense,
  canEditTrip,
  canManageMembers,
  canEditTripSettings,
  favoriteItineraryRequestId,
  itinerarySortingEnabled,
  userId: computed(() => user.value?.uid || current.value?.ownerId || ''),
  actorName: computed(() => userDisplayName.value),
  memberManagerRequested,
  memberName,
  formatTripDate,
  mapsUrl: itinerary.mapsUrl,
  formatItineraryDate: itinerary.formatItineraryDate,
  itineraryDuration: itinerary.itineraryDuration,
  itineraryTimeWarning: itinerary.itineraryTimeWarning,
  expensePayerLabel: expenseState.expensePayerLabel,
  expenseSplitLabel: expenseState.expenseSplitLabel,
  expenseParticipantCount: expenseState.expenseParticipantCount,
  expenseShare: expenseState.expenseShare,
  toggleItinerary: itinerary.toggleItinerary,
  removeItem: itinerary.removeItem,
  addFavoriteToItinerary: itinerary.addFavoriteToItinerary,
  clearFavoriteRequest: itinerary.clearFavoriteRequest,
  toggleItinerarySorting,
  sortItineraryItems,
  sortGroupItineraryItems,
  moveItineraryItem,
}

provideTripWorkspaceContext(workspaceContext)

watch(
  [authResolving, user, () => route.fullPath],
  ([resolving, signedInUser, fullPath]) => {
    if (resolving || !firebaseEnabled || signedInUser) return
    void router.replace({ name: 'login', query: { redirect: String(fullPath) } })
  },
  { immediate: true },
)

watch(
  () => current.value?.currency,
  async () => {
    await refreshTripExchangeRate()
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
    :exchange-rate-text="tripExchangeRateText"
    :exchange-rate-date="tripExchangeRateDate"
    :exchange-rate-loading="tripExchangeRateLoading"
    :exchange-rate-error="tripExchangeRateError"
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
    @refresh-exchange-rate="() => void refreshTripExchangeRate(true)"
  >
    <RouterView />
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
