<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import TripHeroHeader from '../components/TripHeroHeader.vue'
import TripManagementDialogs from '../components/TripManagementDialogs.vue'
import TripExpensesView from './TripExpensesView.vue'
import TripItineraryView from './TripItineraryView.vue'
import TripBookingsView from './TripBookingsView.vue'
import TripFavoritesView from './TripFavoritesView.vue'
import TripMapView from './TripMapView.vue'
import TripAlbumView from './TripAlbumView.vue'
import TripMembersView from './TripMembersView.vue'
import TripPaymentsView from './TripPaymentsView.vue'
import TripInsuranceView from './TripInsuranceView.vue'
import TripShoppingView from './TripShoppingView.vue'
import TripTodosView from './TripTodosView.vue'
import TripPackingView from './TripPackingView.vue'
import { useTripStore } from '../stores/trip'
import type { Expense, Favorite, FavoriteType, ItineraryItem, Role } from '../types'
import { uploadTripCover } from '../services/cloudinary'
import { firebaseEnabled } from '../services/firebase'
import { participantsForExpense, payerSharesForExpense, splitModeLabel, splitShareForMember } from '../utils/expenseSplit'
import { useTripmateSession } from '../composables/useTripmateSession'

type TripTab =
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
const mobileTripMenuOpen = ref(false)
const memberManagerRequested = ref(false)
const showJoin = ref(false)
const showCreate = ref(false)
const showEdit = ref(false)
const savingTrip = ref(false)
const itinerarySortingEnabled = ref(false)
const favoriteItineraryRequestId = ref('')
const editCoverFile = ref<File>()
const editCoverPreview = ref('')
const invite = reactive({ code: '' })
const create = reactive({
  name: '',
  country: '日本',
  city: '東京',
  startDate: '',
  endDate: '',
  currency: 'JPY',
  budget: 0,
  coverUrl: '',
})
const edit = reactive({
  name: '',
  country: '',
  city: '',
  startDate: '',
  endDate: '',
  currency: 'JPY',
  budget: 0,
  coverUrl: '',
})

const current = computed(() => store.trip(activeId.value))
const currentItems = computed(() => store.items(activeId.value))
const currentPersonalItems = computed(() =>
  currentItems.value.filter(
    (entry) =>
      entry.activityKind === 'personal' &&
      (!firebaseEnabled || entry.ownerId === user.value?.uid),
  ),
)
const currentExpenses = computed(() => store.tripExpenses(activeId.value))
const currentTodos = computed(() => store.tripTodos(activeId.value))
const currentPackingItems = computed(() => store.tripPackingItems(activeId.value))
const currentBookings = computed(() => store.tripBookings(activeId.value))
const currentFavorites = computed(() => store.tripFavorites(activeId.value))
const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value))
const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value))
const currentSettlements = computed(() => store.tripSettlements(activeId.value))
const currentInsurance = computed(() =>
  store.tripInsurances(activeId.value).find((entry) => entry.userId === user.value?.uid),
)
const currentInsuranceStatuses = computed(() => store.tripInsuranceStatuses(activeId.value))
const currentPaymentTools = computed(() => store.tripPaymentTools(activeId.value))
const currentRewardRules = computed(() => store.tripRewardRules(activeId.value))
const currentPaymentTransactions = computed(() => store.tripPaymentTransactions(activeId.value))
const currentStoredBalances = computed(() => store.tripStoredValueBalances(activeId.value))
const currentPaymentToolSummaries = computed(() => store.tripPaymentToolSummaries(activeId.value))

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
const currentRole = computed<Role | undefined>(
  () => currentMember.value?.role || (current.value?.ownerId === user.value?.uid ? 'owner' : undefined),
)
const canEditTrip = computed(
  () => !firebaseEnabled || currentRole.value === 'owner' || currentRole.value === 'editor',
)
const canManageMembers = computed(
  () => !firebaseEnabled || current.value?.ownerId === user.value?.uid,
)
const canEditTripSettings = computed(
  () => !firebaseEnabled || current.value?.ownerId === user.value?.uid,
)

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

const favoritesWithItineraryStatus = computed(() =>
  currentFavorites.value.map((favoriteItem) => ({
    ...favoriteItem,
    addedToItinerary: currentItems.value.some(
      (entry) =>
        entry.favoriteId === favoriteItem.id ||
        (!entry.favoriteId &&
          entry.title === favoriteItem.name &&
          (favoriteItem.mapUrl
            ? entry.mapUrl === favoriteItem.mapUrl
            : favoriteItem.location
              ? entry.location === favoriteItem.location
              : entry.type === favoriteToItineraryType(favoriteItem.type))),
    ),
  })),
)

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

function selectTripTab(tab: TripTab) {
  mobileTripMenuOpen.value = false
  if (tab !== 'itinerary') itinerarySortingEnabled.value = false
  if (tab === activeTripTab.value) return
  void router.push({
    name: 'trip-tab',
    params: { tripId: activeId.value, tab },
    query: route.query,
  })
}

function openMemberManager() {
  if (!canManageMembers.value) {
    ElMessage.warning('只有旅行建立者可以管理成員。')
    return
  }
  memberManagerRequested.value = true
  if (activeTripTab.value !== 'overview' && activeTripTab.value !== 'members') {
    selectTripTab('members')
  }
}

function clearEditCoverPreview() {
  if (editCoverPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(editCoverPreview.value)
  }
  editCoverPreview.value = ''
}

function selectEditCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  clearEditCoverPreview()
  editCoverFile.value = file
  editCoverPreview.value = URL.createObjectURL(file)
}

function removeEditCover() {
  clearEditCoverPreview()
  editCoverFile.value = undefined
  edit.coverUrl = ''
}

function startEditTrip() {
  if (!current.value) return
  if (current.value.ownerId !== user.value?.uid) {
    ElMessage.warning('只有旅行建立者可以編輯旅行設定。')
    return
  }
  clearEditCoverPreview()
  editCoverFile.value = undefined
  Object.assign(edit, {
    name: current.value.name,
    country: current.value.country,
    city: current.value.city,
    startDate: current.value.startDate,
    endDate: current.value.endDate,
    currency: current.value.currency,
    budget: current.value.budget,
    coverUrl: current.value.coverUrl || '',
  })
  showEdit.value = true
}

async function saveTrip() {
  if (!current.value || !edit.name || !edit.startDate || !edit.endDate) {
    ElMessage.warning('請填寫旅行名稱與日期。')
    return
  }
  savingTrip.value = true
  try {
    if (editCoverFile.value) {
      edit.coverUrl = await uploadTripCover(editCoverFile.value, current.value.id)
    }
    await store.updateTrip({ ...current.value, ...edit })
    clearEditCoverPreview()
    editCoverFile.value = undefined
    showEdit.value = false
    ElMessage.success('旅行設定已更新。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。')
  } finally {
    savingTrip.value = false
  }
}

async function removeTrip() {
  if (!current.value || current.value.ownerId !== user.value?.uid) {
    ElMessage.warning('只有旅行建立者可以刪除旅行。')
    return
  }
  try {
    await ElMessageBox.confirm(
      `確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`,
      '刪除旅行',
      { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' },
    )
    await store.deleteTrip(current.value)
    goTrips()
    ElMessage.success('旅行已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。')
    }
  }
}

function favoriteToItineraryType(favoriteType: FavoriteType) {
  return (
    {
      attraction: '景點',
      restaurant: '餐廳',
      transport: '交通',
      stay: '住宿',
      shop: '商店',
      cafe: '餐廳',
      alternative: '景點',
      other: '景點',
    } as Record<FavoriteType, string>
  )[favoriteType]
}

async function removeItem(entry: ItineraryItem) {
  if (!canEditTrip.value) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  try {
    const isFree = entry.activityKind === 'free'
    await ElMessageBox.confirm(
      `確定刪除${isFree ? '自由活動群組' : '行程'}「${entry.title}」嗎？${
        isFree ? '你的個人行程也會一併移除。' : ''
      }`,
      `刪除${isFree ? '自由活動' : '行程'}`,
      { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' },
    )
    if (isFree) {
      await Promise.all(
        currentPersonalItems.value
          .filter((item) => item.parentFreeActivityId === entry.id)
          .map((item) => store.deleteItem(item)),
      )
    }
    await store.deleteItem(entry)
    ElMessage.success(isFree ? '自由活動已刪除。' : '行程已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。')
    }
  }
}

async function toggleItinerary(entry: ItineraryItem) {
  if (!canEditTrip.value) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  await store.toggleItem(entry.id)
}

function addFavoriteToItinerary(favoriteItem: Favorite) {
  if (!canEditTrip.value) {
    ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
    return
  }
  favoriteItineraryRequestId.value = favoriteItem.id
  selectTripTab('itinerary')
}

const itineraryDays = computed(() =>
  Object.entries(
    currentItems.value
      .filter((entry) => (entry.activityKind || 'shared') !== 'personal')
      .reduce<Record<string, ItineraryItem[]>>((days, entry) => {
        ;(days[entry.date] ||= []).push(entry)
        return days
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) ||
          (a.time || '').localeCompare(b.time || ''),
      ),
    })),
)

const mapsUrl = (location: string, mapUrl?: string) =>
  mapUrl ||
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function formatItineraryDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  return Number.isNaN(value.getTime())
    ? date
    : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日・${weekdays[value.getDay()]}`
}

function itineraryDuration(entry: ItineraryItem) {
  if (!entry.time || !entry.endTime) return ''
  const [startHour, startMinute] = entry.time.split(':').map(Number)
  const [endHour, endMinute] = entry.endTime.split(':').map(Number)
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `約 ${hours ? `${hours} 小時` : ''}${hours && remainingMinutes ? ' ' : ''}${remainingMinutes ? `${remainingMinutes} 分` : ''}`
}

function itineraryTimeWarning(entries: ItineraryItem[], index: number) {
  if (index === 0) return ''
  const previous = entries[index - 1]
  const entry = entries[index]
  if (!previous?.time || !entry?.time) return ''
  if (entry.time < previous.time) return '開始時間早於上一筆行程'
  if (entry.time < (previous.endTime || previous.time)) return '與上一筆行程時間重疊'
  return ''
}

function toggleItinerarySorting() {
  if (!canEditTrip.value) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  itinerarySortingEnabled.value = !itinerarySortingEnabled.value
  ElMessage.info(
    itinerarySortingEnabled.value
      ? '已啟用排序：長按拖曳把手可調整行程。'
      : '行程排序已保存。',
  )
}

async function sortItineraryItems({
  date,
  oldIndex,
  newIndex,
}: {
  date: string
  oldIndex: number
  newIndex: number
}) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = (itineraryDays.value.find((day) => day.date === date)?.entries || []).filter(
    (entry) => !entry.itineraryGroupId,
  )
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]
  const [moved] = reordered.splice(oldIndex, 1)
  if (!moved) return
  reordered.splice(newIndex, 0, moved)
  try {
    await store.reorderItems(reordered)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。')
  }
}

async function sortGroupItineraryItems({
  groupId,
  oldIndex,
  newIndex,
}: {
  groupId: string
  oldIndex: number
  newIndex: number
}) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = currentItems.value
    .filter((entry) => entry.itineraryGroupId === groupId)
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (a.time || '').localeCompare(b.time || ''),
    )
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]
  const [moved] = reordered.splice(oldIndex, 1)
  if (!moved) return
  reordered.splice(newIndex, 0, moved)
  try {
    await store.reorderItems(reordered)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新群組內行程順序。')
  }
}

async function sortPersonalItineraryItems({
  parentId,
  oldIndex,
  newIndex,
}: {
  parentId: string
  oldIndex: number
  newIndex: number
}) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = currentPersonalItems.value
    .filter((entry) => entry.parentFreeActivityId === parentId)
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (a.time || '').localeCompare(b.time || ''),
    )
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]
  const [moved] = reordered.splice(oldIndex, 1)
  if (!moved) return
  reordered.splice(newIndex, 0, moved)
  try {
    await store.reorderItems(reordered)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新個人行程順序。')
  }
}

async function moveItineraryItem({
  itemId,
  from,
  to,
  oldIndex,
  newIndex,
}: {
  itemId: string
  from: string
  to: string
  oldIndex: number
  newIndex: number
}) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || from === to) return
  const entry = currentItems.value.find((item) => item.id === itemId)
  if (!entry || entry.activityKind === 'free' || entry.activityKind === 'group') return
  const sourceIsPersonal = from.startsWith('personal:')
  const targetIsPersonal = to.startsWith('personal:')
  const sourceIsDay = from.startsWith('day:')
  const targetIsDay = to.startsWith('day:')
  const sourceIsGroup = from.startsWith('group:')
  const targetIsGroup = to.startsWith('group:')
  if ((!sourceIsPersonal && !sourceIsDay && !sourceIsGroup) || (!targetIsPersonal && !targetIsDay && !targetIsGroup)) return

  const byOrder = (a: ItineraryItem, b: ItineraryItem) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    (a.time || '').localeCompare(b.time || '')

  const entriesFor = (scope: string) =>
    scope.startsWith('personal:')
      ? currentPersonalItems.value
          .filter((item) => item.parentFreeActivityId === scope.slice('personal:'.length))
          .sort(byOrder)
      : scope.startsWith('group:')
        ? currentItems.value
            .filter((item) => item.itineraryGroupId === scope.slice('group:'.length))
            .sort(byOrder)
        : (itineraryDays.value.find((day) => day.date === scope.slice('day:'.length))?.entries || [])
            .filter((item) => !item.itineraryGroupId)
            .sort(byOrder)

  const sourceEntries = entriesFor(from)
  if (oldIndex < 0 || oldIndex >= sourceEntries.length || newIndex < 0) return
  const previous = { ...entry }
  let moved: ItineraryItem

  if (targetIsPersonal) {
    const parentFreeActivityId = to.slice('personal:'.length)
    const freeGroup = currentItems.value.find(
      (item) => item.id === parentFreeActivityId && item.activityKind === 'free',
    )
    if (!freeGroup || !user.value?.uid) return
    moved = {
      ...entry,
      activityKind: 'personal',
      ownerId: user.value.uid,
      parentFreeActivityId,
      itineraryGroupId: '',
      date: freeGroup.date,
    }
  } else if (targetIsGroup) {
    const itineraryGroupId = to.slice('group:'.length)
    const placeGroup = currentItems.value.find(
      (item) => item.id === itineraryGroupId && item.activityKind === 'group',
    )
    if (!placeGroup) return
    const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
    moved = {
      ...sharedEntry,
      activityKind: 'shared',
      ownerId: '',
      parentFreeActivityId: '',
      itineraryGroupId,
      date: placeGroup.date,
    }
  } else {
    const date = to.slice('day:'.length)
    const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
    moved = {
      ...sharedEntry,
      activityKind: 'shared',
      ownerId: '',
      parentFreeActivityId: '',
      itineraryGroupId: '',
      date,
    }
  }

  const targetEntries = entriesFor(to).filter((item) => item.id !== entry.id)
  const reorderedSource = sourceEntries.filter((item) => item.id !== entry.id)
  const reorderedTarget = [...targetEntries]
  reorderedTarget.splice(Math.min(Math.max(newIndex, 0), reorderedTarget.length), 0, moved)

  try {
    await store.moveItem(moved, previous)
    if (reorderedSource.length) await store.reorderItems(reorderedSource)
    await store.reorderItems(reorderedTarget)
    ElMessage.success(
      targetIsGroup
        ? '已移入地點群組。'
        : sourceIsGroup && targetIsDay
          ? '已移出地點群組。'
          : targetIsPersonal
            ? '已移入自由活動，僅自己可見。'
            : '已移動行程。',
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法移動行程。')
  }
}

function expenseParticipants(expense: Pick<Expense, 'kind' | 'payerId' | 'participantIds'>) {
  return participantsForExpense(expense, current.value?.members.map((member) => member.id) || [])
}

function expenseParticipantCount(expense: Expense) {
  return expenseParticipants(expense).length
}

function expensePayerName(payerId: string) {
  return current.value?.members.find((member) => member.id === payerId)?.name || '未知成員'
}

function expensePayerLabel(expense: Expense) {
  const payers = payerSharesForExpense(expense)
  const names = Object.keys(payers).map(expensePayerName)
  return names.length > 1
    ? `${names.join('、')} 共同支付`
    : `${names[0] || expensePayerName(expense.payerId)} 支付`
}

function expenseShare(expense: Expense) {
  return expenseShareForMember(expense, expenseParticipants(expense)[0] || '')
}

function expenseShareForMember(expense: Expense, memberId: string) {
  return splitShareForMember(expense, memberId, current.value?.members.map((member) => member.id) || [])
}

function expenseSplitLabel(expense: Expense) {
  return expense.kind === 'personal' ? '個人支出' : splitModeLabel(expense.splitMode)
}

const total = computed(() => currentExpenses.value.reduce((sum, expense) => sum + expense.amount, 0))
const baseBudgetCategories = ['餐飲', '交通', '住宿', '購物', '景點', '其他']
const categoryBudgets = computed(() => store.tripCategoryBudgets(activeId.value))
const dailyBudget = computed(() => store.tripDailyBudget(activeId.value))
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
const budgetCategoryNames = computed(() => [
  ...new Set([
    ...baseBudgetCategories,
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
const balances = computed(() => {
  const trip = current.value
  if (!trip) return []
  const paid = Object.fromEntries(trip.members.map((member) => [member.id, 0]))
  const owed = Object.fromEntries(trip.members.map((member) => [member.id, 0]))
  currentExpenses.value.forEach((expense) => {
    Object.entries(payerSharesForExpense(expense)).forEach(([memberId, amount]) => {
      paid[memberId] = (paid[memberId] || 0) + amount
    })
    expenseParticipants(expense).forEach((id) => {
      owed[id] = (owed[id] || 0) + expenseShareForMember(expense, id)
    })
  })
  currentSettlements.value.forEach((settlement) => {
    paid[settlement.fromId] = (paid[settlement.fromId] || 0) + settlement.amount
    paid[settlement.toId] = (paid[settlement.toId] || 0) - settlement.amount
  })
  return trip.members.map((member) => ({
    ...member,
    balance: paid[member.id] - owed[member.id],
  }))
})
const settlementSuggestions = computed(() => {
  const creditors = balances.value
    .filter((member) => member.balance > 0.01)
    .map((member) => ({ ...member, remaining: member.balance }))
  const debtors = balances.value
    .filter((member) => member.balance < -0.01)
    .map((member) => ({ ...member, remaining: -member.balance }))
  const suggestions: { fromId: string; toId: string; from: string; to: string; amount: number }[] = []
  let creditorIndex = 0
  debtors.forEach((debtor) => {
    while (debtor.remaining > 0.01 && creditors[creditorIndex]) {
      const creditor = creditors[creditorIndex]
      const amount = Math.min(debtor.remaining, creditor.remaining)
      suggestions.push({
        fromId: debtor.id,
        toId: creditor.id,
        from: debtor.name,
        to: creditor.name,
        amount,
      })
      debtor.remaining -= amount
      creditor.remaining -= amount
      if (creditor.remaining <= 0.01) creditorIndex += 1
    }
  })
  return suggestions
})
const activeMemberId = computed(() => currentMember.value?.id || (!firebaseEnabled ? current.value?.ownerId : undefined))
const activeMember = computed(() =>
  activeMemberId.value ? current.value?.members.find((member) => member.id === activeMemberId.value) : undefined,
)
const personalBudget = computed(() => activeMember.value?.personalBudget || 0)
const myPaid = computed(() =>
  activeMemberId.value
    ? currentExpenses.value.reduce(
        (sum, expense) => sum + (payerSharesForExpense(expense)[activeMemberId.value!] || 0),
        0,
      )
    : 0,
)
const myBalance = computed(() =>
  activeMemberId.value
    ? balances.value.find((member) => member.id === activeMemberId.value)?.balance || 0
    : 0,
)
const myExpense = computed(() =>
  activeMemberId.value
    ? currentExpenses.value.reduce(
        (sum, expense) => sum + expenseShareForMember(expense, activeMemberId.value!),
        0,
      )
    : 0,
)

function memberName(memberId: string) {
  return current.value?.members.find((member) => member.id === memberId)?.name || '未知成員'
}

function formatTripDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  return Number.isNaN(value.getTime())
    ? date
    : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日`
}

const tripDateRange = computed(() =>
  current.value ? `${formatTripDate(current.value.startDate)}－${formatTripDate(current.value.endDate)}` : '',
)
const tripDuration = computed(() => {
  if (!current.value) return ''
  const start = new Date(`${current.value.startDate}T00:00:00`).getTime()
  const end = new Date(`${current.value.endDate}T00:00:00`).getTime()
  const days = Math.round((end - start) / 86400000) + 1
  return Number.isFinite(days) && days > 0 ? `共 ${days} 天` : ''
})

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
  clearEditCoverPreview()
})
</script>

<template>
  <main class="app-shell">
    <AppHeader
      :signed-in="Boolean(user)"
      :user-display-name="userDisplayName"
      :user-initial="userInitial"
      :show-trip-menu-button="Boolean(current)"
      @go-trips="goTrips"
      @go-profile="goProfile"
      @go-login="goLogin"
      @sign-out="handleSignOut"
      @open-trip-menu="mobileTripMenuOpen = true"
    />

    <section v-if="authResolving" class="auth-loading" aria-live="polite">
      <div>
        <strong>TripMate</strong>
        <p>正在確認登入狀態…</p>
      </div>
    </section>

    <section v-else-if="current" class="page trip-detail-page">
      <TripHeroHeader
        :trip="current"
        :date-range="tripDateRange"
        :duration="tripDuration"
        :can-edit-settings="canEditTripSettings"
        :can-manage-members="canManageMembers"
        :open-member-manager="openMemberManager"
        :role-label="currentRole === 'editor' ? 'Editor・可編輯' : 'Viewer・唯讀'"
        @back="goTrips"
        @edit="startEditTrip"
        @remove="removeTrip"
      />

      <el-drawer
        v-model="mobileTripMenuOpen"
        class="mobile-trip-drawer"
        direction="ltr"
        size="min(82vw, 300px)"
        :with-header="false"
      >
        <div class="mobile-trip-drawer-heading">
          <div><span>TRIPMATE</span><strong>旅行內容</strong></div>
          <el-button
            text
            circle
            aria-label="關閉內容選單"
            title="關閉內容選單"
            @click="mobileTripMenuOpen = false"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <nav class="mobile-trip-drawer-nav" aria-label="旅行內容導覽">
          <button
            v-for="tab in tripTabOptions"
            :key="tab"
            type="button"
            :class="{ 'is-active': activeTripTab === tab }"
            @click="selectTripTab(tab)"
          >
            {{ tripTabLabels[tab] }}
          </button>
        </nav>
      </el-drawer>

      <nav class="trip-tabs" aria-label="旅行內容導覽" role="tablist">
        <button
          v-for="tab in tripTabOptions"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTripTab === tab"
          :class="{ 'is-active': activeTripTab === tab }"
          @click="selectTripTab(tab)"
        >
          {{ tripTabLabels[tab] }}
        </button>
      </nav>

      <div
        class="trip-detail-layout"
        :class="{ 'is-single-detail': activeTripTab !== 'overview' }"
        role="tabpanel"
        :aria-label="tripTabLabels[activeTripTab]"
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
          :format-date="formatItineraryDate"
          :duration="itineraryDuration"
          :time-warning="itineraryTimeWarning"
          :maps-url="mapsUrl"
          @favorite-request-consumed="favoriteItineraryRequestId = ''"
          @toggle="toggleItinerary"
          @remove="removeItem"
          @toggle-sorting="toggleItinerarySorting"
          @sort="sortItineraryItems"
          @sort-group="sortGroupItineraryItems"
          @sort-personal="sortPersonalItineraryItems"
          @move="moveItineraryItem"
        />
        <TripMapView
          v-if="activeTripTab === 'map'"
          :days="itineraryDays"
          :format-date="formatItineraryDate"
          :maps-url="mapsUrl"
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
          :payer-label="expensePayerLabel"
          :split-label="expenseSplitLabel"
          :participant-count="expenseParticipantCount"
          :share="expenseShare"
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
          @add-to-itinerary="addFavoriteToItinerary"
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
          :format-date="formatItineraryDate"
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
      </div>
    </section>

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
      @select-edit-cover="selectEditCover"
      @remove-edit-cover="removeEditCover"
      @join-trip="() => undefined"
      @create-trip="() => undefined"
      @save-trip="saveTrip"
      @remove-trip="removeTrip"
    />
  </main>
</template>
