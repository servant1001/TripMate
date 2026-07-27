<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Close, Menu } from '@element-plus/icons-vue'
import type { User } from 'firebase/auth'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import TripExpensesView from './views/TripExpensesView.vue'
import TripHeroHeader from './components/TripHeroHeader.vue'
import TripItineraryView from './views/TripItineraryView.vue'
import TripBookingsView from './views/TripBookingsView.vue'
import TripFavoritesView from './views/TripFavoritesView.vue'
import TripMapView from './views/TripMapView.vue'
import TripAlbumView from './views/TripAlbumView.vue'
import TripMembersView from './views/TripMembersView.vue'
import TripPaymentsView from './views/TripPaymentsView.vue'
import TripInsuranceView from './views/TripInsuranceView.vue'
import TripShoppingView from './views/TripShoppingView.vue'
import TripTodosView from './views/TripTodosView.vue'
import TripPackingView from './views/TripPackingView.vue'
import TripManagementDialogs from './components/TripManagementDialogs.vue'
import { useTripStore } from './stores/trip'
import type { Expense, Favorite, FavoriteType, ItineraryItem, Role, Trip } from './types'
import { uploadTripCover } from './services/cloudinary'
import { auth, ensureUserProfile, firebaseEnabled, logOut, registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle, updateUserSettings } from './services/firebase'
import { joinTripByInviteCode } from './services/cloudinary'
import { participantsForExpense, payerSharesForExpense, splitModeLabel, splitShareForMember } from './utils/expenseSplit'

const router = useRouter(); const route = useRoute(); const store = useTripStore(); const activeId = ref(''); const screen = ref<'trips'|'trip'|'login'|'profile'>('trips'); const authResolving = ref(firebaseEnabled && Boolean(auth)); const showCreate = ref(false); const showEdit = ref(false); const showJoin = ref(false); const mobileTripMenuOpen = ref(false); const memberManagerRequested = ref(false)
type TripTab = 'overview' | 'itinerary' | 'map' | 'expenses' | 'todos' | 'packing' | 'bookings' | 'favorites' | 'album' | 'shopping' | 'insurance' | 'payments' | 'members'
const current = computed(() => store.trip(activeId.value)); const currentItems = computed(() => store.items(activeId.value)); const currentPersonalItems = computed(() => currentItems.value.filter((entry) => entry.activityKind === 'personal' && (!firebaseEnabled || entry.ownerId === user.value?.uid))); const currentExpenses = computed(() => store.tripExpenses(activeId.value)); const currentTodos = computed(() => store.tripTodos(activeId.value)); const currentPackingItems = computed(() => store.tripPackingItems(activeId.value)); const currentBookings = computed(() => store.tripBookings(activeId.value)); const currentFavorites = computed(() => store.tripFavorites(activeId.value)); const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value)); const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value)); const currentSettlements = computed(() => store.tripSettlements(activeId.value)); const currentInsurance = computed(() => store.tripInsurances(activeId.value).find((entry) => entry.userId === user.value?.uid)); const currentInsuranceStatuses = computed(() => store.tripInsuranceStatuses(activeId.value)); const currentPaymentTools = computed(() => store.tripPaymentTools(activeId.value)); const currentRewardRules = computed(() => store.tripRewardRules(activeId.value)); const currentPaymentTransactions = computed(() => store.tripPaymentTransactions(activeId.value)); const currentStoredBalances = computed(() => store.tripStoredValueBalances(activeId.value));
const favoritesWithItineraryStatus = computed(() => currentFavorites.value.map((favoriteItem) => ({ ...favoriteItem, addedToItinerary: currentItems.value.some((entry) => entry.favoriteId === favoriteItem.id || (!entry.favoriteId && entry.title === favoriteItem.name && (favoriteItem.mapUrl ? entry.mapUrl === favoriteItem.mapUrl : favoriteItem.location ? entry.location === favoriteItem.location : entry.type === favoriteToItineraryType(favoriteItem.type)))) })))
const currentPaymentToolSummaries = computed(() => store.tripPaymentToolSummaries(activeId.value))
const create = reactive({ name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const coverFile = ref<File>(); const edit = reactive({ name: '', country: '', city: '', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const editCoverFile = ref<File>(); const editCoverPreview = ref(''); const savingTrip = ref(false)
const itinerarySortingEnabled = ref(false); const favoriteItineraryRequestId = ref('')
const invite = reactive({ code: '' })
const user = ref<User | null>(null); const login = reactive({ email: '', password: '' }); const authMode = ref<'login' | 'register'>('login'); const authSubmitting = ref(false); const authFormError = ref(''); let removeAuthListener: (() => void) | undefined
const profile = reactive({ displayName: '', defaultCurrency: 'JPY', timezone: 'Asia/Taipei' })
const currentMember = computed(() => { const signedInUser = user.value; if (!signedInUser) return undefined; return current.value?.members.find((member) => member.id === signedInUser.uid) || current.value?.members.find((member) => member.email.toLowerCase() === (signedInUser.email || '').toLowerCase()) })
const currentRole = computed<Role | undefined>(() => currentMember.value?.role || (current.value?.ownerId === user.value?.uid ? 'owner' : undefined))
const canEditTrip = computed(() => !firebaseEnabled || currentRole.value === 'owner' || currentRole.value === 'editor')
const canManageMembers = computed(() => !firebaseEnabled || current.value?.ownerId === user.value?.uid)
const canEditTripSettings = computed(() => !firebaseEnabled || current.value?.ownerId === user.value?.uid)
const userDisplayName = computed(() => user.value?.displayName || user.value?.email?.split('@')[0] || '旅伴')
const userInitial = computed(() => userDisplayName.value.slice(0, 1).toUpperCase())
function goTrips() { void router.push({ name: 'trips' }) }
function goLogin() { void router.push({ name: 'login' }) }
function goProfile() { void router.push({ name: 'profile' }) }
function goTrip(tripId: string) { void router.push({ name: 'trip-tab', params: { tripId, tab: 'overview' } }) }
const activeTripTab = computed<TripTab>(() => {
  const tab = String(route.params.tab || '')
  return tab === 'overview' || tab === 'itinerary' || tab === 'map' || tab === 'expenses' || tab === 'todos' || tab === 'packing' || tab === 'bookings' || tab === 'favorites' || tab === 'album' || tab === 'shopping' || tab === 'insurance' || tab === 'payments' || tab === 'members' ? tab : 'overview'
})
const tripTabLabels: Record<TripTab, string> = { overview: '總覽', itinerary: '行程', map: '地圖', expenses: '開銷', todos: '待辦', packing: '行李', bookings: '預訂', favorites: '收藏', album: '相簿', shopping: '購物', insurance: '保險', payments: '支付與回饋', members: '旅伴與結算' }
const tripTabOptions: TripTab[] = ['overview', 'itinerary', 'expenses', 'todos', 'favorites', 'shopping', 'payments', 'packing', 'bookings', 'insurance', 'album', 'map', 'members']
function selectTripTab(tab: TripTab) {
  mobileTripMenuOpen.value = false
  if (tab !== 'itinerary') itinerarySortingEnabled.value = false
  if (tab === activeTripTab.value) return
  void router.push({ name: 'trip-tab', params: { tripId: activeId.value, tab }, query: route.query })
}
function openMemberManager() { if (!canManageMembers.value) return ElMessage.warning('只有旅行建立者可以管理成員。'); memberManagerRequested.value = true; if (activeTripTab.value !== 'overview' && activeTripTab.value !== 'members') selectTripTab('members') }
function syncRoute() { const name = String(route.name || 'trips'); if (name === 'login' || name === 'register' || name === 'forgot-password') { screen.value = 'login'; authMode.value = name === 'register' ? 'register' : 'login'; return } if (name === 'profile') { screen.value = 'profile'; if (user.value) profile.displayName = user.value.displayName || user.value.email?.split('@')[0] || ''; return } if (name === 'trip-tab') { activeId.value = String(route.params.tripId); screen.value = 'trip'; return } screen.value = 'trips'; showCreate.value = name === 'trip-create' }
watch(() => route.fullPath, syncRoute, { immediate: true })
function authErrorMessage(error: unknown) { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; if (code === 'auth/unauthorized-domain') return '此網站尚未加入 Firebase Authentication 的授權網域。'; if (code === 'auth/operation-not-allowed') return 'Firebase 尚未啟用 Google 登入方式。'; if (code === 'auth/account-exists-with-different-credential') return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'; return error instanceof Error ? error.message : 'Google 登入未完成，請再試一次。' }
onMounted(async () => { if (!firebaseEnabled || !auth) { await store.load(); return } try { await getRedirectResult(auth) } catch (error) { ElMessage.error(authErrorMessage(error)) } removeAuthListener = onAuthStateChanged(auth, async (signedInUser) => { try { user.value = signedInUser; if (signedInUser) { await ensureUserProfile(signedInUser); await store.load(signedInUser.uid); if (route.meta.public) { const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/trips'; await router.replace(redirect) } } else { store.$patch({ trips: [], itinerary: [], expenses: [], settlements: [], todos: [], packingItems: [], bookings: [], favorites: [], albumPhotos: [], shoppingItems: [], categoryBudgets: {}, dailyBudgets: {}, insurances: [], insuranceStatuses: {} }); if (!route.meta.public) await router.replace({ name: 'login', query: { redirect: route.fullPath } }) } } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法載入登入資料。') } finally { authResolving.value = false } }) })
onUnmounted(() => { removeAuthListener?.(); clearEditCoverPreview() })
async function submitEmailLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '登入失敗，請確認 Email 與密碼。' } finally { authSubmitting.value = false } }
async function submitEmailRegistration() { authFormError.value = ''; if (login.password.length < 6) { authFormError.value = '密碼至少需要 6 個字元。'; return } authSubmitting.value = true; try { await registerWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '註冊失敗，請稍後再試。' } finally { authSubmitting.value = false } }
async function submitGoogleLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithGoogle() } catch (error) { authFormError.value = authErrorMessage(error) } finally { authSubmitting.value = false } }
async function resetPassword() { authFormError.value = ''; if (!login.email) { authFormError.value = '請先輸入要重設的 Email。'; return } try { await requestPasswordReset(login.email); ElMessage.success('重設密碼信已寄出。') } catch (error) { authFormError.value = error instanceof Error ? error.message : '無法寄出重設密碼信。' } }
async function saveProfile() { if (!user.value) return; try { await updateUserSettings(user.value, profile); user.value = auth?.currentUser || user.value; ElMessage.success('個人資料已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新個人資料。') } }
async function useDemo() { await store.load(); goTrips() }
async function joinTrip() { if (!user.value) return ElMessage.warning('請先登入後加入旅行。'); if (!invite.code.trim()) return ElMessage.warning('請輸入邀請碼。'); try { const { tripId } = await joinTripByInviteCode(invite.code); await store.load(user.value.uid); showJoin.value = false; invite.code = ''; goTrip(tripId); ElMessage.success('已加入旅行。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法加入旅行。') } }
async function createTrip() { if (!create.name || !create.startDate || !create.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); if (firebaseEnabled && !user.value) return ElMessage.warning('請先登入後建立旅行。'); try { if (coverFile.value) create.coverUrl = await uploadTripCover(coverFile.value); const ownerId = user.value?.uid || 'me'; const trip = await store.createTrip({ ...create, ownerId, members: [{ id: ownerId, name: user.value?.displayName || '我', email: user.value?.email || 'me@tripmate.app', role: 'owner' }] }, user.value?.uid); showCreate.value = false; Object.assign(create, { name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); goTrip(trip.id); ElMessage.success('旅行已建立。') } catch (e) { ElMessage.error(e instanceof Error ? e.message : '建立旅行失敗。') } }
function selectCreateCover(event: Event) { coverFile.value = (event.target as HTMLInputElement).files?.[0] }
function clearEditCoverPreview() { if (editCoverPreview.value.startsWith('blob:')) URL.revokeObjectURL(editCoverPreview.value); editCoverPreview.value = '' }
function selectEditCover(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; clearEditCoverPreview(); editCoverFile.value = file; editCoverPreview.value = URL.createObjectURL(file) }
function removeEditCover() { clearEditCoverPreview(); editCoverFile.value = undefined; edit.coverUrl = '' }
function startEditTrip() { if (!current.value) return; if (current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以編輯旅行設定。'); clearEditCoverPreview(); editCoverFile.value = undefined; Object.assign(edit, { name: current.value.name, country: current.value.country, city: current.value.city, startDate: current.value.startDate, endDate: current.value.endDate, currency: current.value.currency, budget: current.value.budget, coverUrl: current.value.coverUrl || '' }); showEdit.value = true }
async function saveTrip() { if (!current.value || !edit.name || !edit.startDate || !edit.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); savingTrip.value = true; try { if (editCoverFile.value) edit.coverUrl = await uploadTripCover(editCoverFile.value, current.value.id); await store.updateTrip({ ...current.value, ...edit }); clearEditCoverPreview(); editCoverFile.value = undefined; showEdit.value = false; ElMessage.success('旅行設定已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。') } finally { savingTrip.value = false } }
async function removeTrip() { if (!current.value || current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以刪除旅行。'); try { await ElMessageBox.confirm(`確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`, '刪除旅行', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteTrip(current.value); goTrips(); ElMessage.success('旅行已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。') } }
function favoriteToItineraryType(favoriteType: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', transport: '交通', stay: '住宿', shop: '商店', cafe: '餐廳', alternative: '景點', other: '景點' } as Record<FavoriteType, string>)[favoriteType] }
async function removeItem(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); try { const isFree = entry.activityKind === 'free'; await ElMessageBox.confirm(`確定刪除${isFree ? '自由活動群組' : '行程'}「${entry.title}」嗎？${isFree ? '你的個人行程也會一併移除。' : ''}`, `刪除${isFree ? '自由活動' : '行程'}`, { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); if (isFree) await Promise.all(currentPersonalItems.value.filter((item) => item.parentFreeActivityId === entry.id).map((item) => store.deleteItem(item))); await store.deleteItem(entry); ElMessage.success(isFree ? '自由活動已刪除。' : '行程已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。') } }
async function toggleItinerary(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); await store.toggleItem(entry.id) }
function addFavoriteToItinerary(favoriteItem: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); favoriteItineraryRequestId.value = favoriteItem.id; selectTripTab('itinerary') }
const itineraryDays = computed(() => Object.entries(currentItems.value.filter((entry) => (entry.activityKind || 'shared') !== 'personal').reduce<Record<string, ItineraryItem[]>>((days, entry) => { (days[entry.date] ||= []).push(entry); return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, entries: entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')) })))
const mapsUrl = (location: string, mapUrl?: string) => mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
function formatItineraryDate(date: string) { const value = new Date(`${date}T00:00:00`); return Number.isNaN(value.getTime()) ? date : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日・${weekdays[value.getDay()]}` }
function itineraryDuration(entry: ItineraryItem) { if (!entry.time || !entry.endTime) return ''; const [startHour, startMinute] = entry.time.split(':').map(Number); const [endHour, endMinute] = entry.endTime.split(':').map(Number); const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute); if (!Number.isFinite(minutes) || minutes <= 0) return ''; const hours = Math.floor(minutes / 60); const remainingMinutes = minutes % 60; return `約 ${hours ? `${hours} 小時` : ''}${hours && remainingMinutes ? ' ' : ''}${remainingMinutes ? `${remainingMinutes} 分` : ''}` }
function itineraryTimeWarning(entries: ItineraryItem[], index: number) { if (index === 0) return ''; const previous = entries[index - 1]; const entry = entries[index]; if (!previous?.time || !entry?.time) return ''; if (entry.time < previous.time) return '開始時間早於上一筆行程'; if (entry.time < (previous.endTime || previous.time)) return '與上一筆行程時間重疊'; return '' }
function toggleItinerarySorting() {
  if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。')
  itinerarySortingEnabled.value = !itinerarySortingEnabled.value
  ElMessage.info(itinerarySortingEnabled.value ? '已啟用排序：長按拖曳把手可調整行程。' : '行程排序已保存。')
}
async function sortItineraryItems({ date, oldIndex, newIndex }: { date: string; oldIndex: number; newIndex: number }) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = (itineraryDays.value.find((day) => day.date === date)?.entries || []).filter((entry) => !entry.itineraryGroupId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]
  const [moved] = reordered.splice(oldIndex, 1)
  if (!moved) return
  reordered.splice(newIndex, 0, moved)
  try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。') }
}
async function sortGroupItineraryItems({ groupId, oldIndex, newIndex }: { groupId: string; oldIndex: number; newIndex: number }) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = currentItems.value.filter((entry) => entry.itineraryGroupId === groupId).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || ''))
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]; const [moved] = reordered.splice(oldIndex, 1); if (!moved) return; reordered.splice(newIndex, 0, moved)
  try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新群組內行程順序。') }
}
async function sortPersonalItineraryItems({ parentId, oldIndex, newIndex }: { parentId: string; oldIndex: number; newIndex: number }) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || oldIndex === newIndex) return
  const entries = currentPersonalItems.value.filter((entry) => entry.parentFreeActivityId === parentId).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || ''))
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]; const [moved] = reordered.splice(oldIndex, 1); if (!moved) return; reordered.splice(newIndex, 0, moved)
  try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新個人行程順序。') }
}
async function moveItineraryItem({ itemId, from, to, oldIndex, newIndex }: { itemId: string; from: string; to: string; oldIndex: number; newIndex: number }) {
  if (!canEditTrip.value || !itinerarySortingEnabled.value || from === to) return
  const entry = currentItems.value.find((item) => item.id === itemId)
  if (!entry || entry.activityKind === 'free' || entry.activityKind === 'group') return
  const sourceIsPersonal = from.startsWith('personal:'); const targetIsPersonal = to.startsWith('personal:')
  const sourceIsDay = from.startsWith('day:'); const targetIsDay = to.startsWith('day:')
  const sourceIsGroup = from.startsWith('group:'); const targetIsGroup = to.startsWith('group:')
  if ((!sourceIsPersonal && !sourceIsDay && !sourceIsGroup) || (!targetIsPersonal && !targetIsDay && !targetIsGroup)) return
  const byOrder = (a: ItineraryItem, b: ItineraryItem) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')
  const entriesFor = (scope: string) => scope.startsWith('personal:') ? currentPersonalItems.value.filter((item) => item.parentFreeActivityId === scope.slice('personal:'.length)).sort(byOrder) : scope.startsWith('group:') ? currentItems.value.filter((item) => item.itineraryGroupId === scope.slice('group:'.length)).sort(byOrder) : (itineraryDays.value.find((day) => day.date === scope.slice('day:'.length))?.entries || []).filter((item) => !item.itineraryGroupId).sort(byOrder)
  const sourceEntries = entriesFor(from)
  if (oldIndex < 0 || oldIndex >= sourceEntries.length || newIndex < 0) return
  const previous = { ...entry }
  let moved: ItineraryItem; let targetEntries: ItineraryItem[]
  if (targetIsPersonal) {
    const parentFreeActivityId = to.slice('personal:'.length); const freeGroup = currentItems.value.find((item) => item.id === parentFreeActivityId && item.activityKind === 'free')
    if (!freeGroup || !user.value?.uid) return
    moved = { ...entry, activityKind: 'personal', ownerId: user.value.uid, parentFreeActivityId, itineraryGroupId: '', date: freeGroup.date }
  } else if (targetIsGroup) {
    const itineraryGroupId = to.slice('group:'.length); const placeGroup = currentItems.value.find((item) => item.id === itineraryGroupId && item.activityKind === 'group')
    if (!placeGroup) return
    const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
    moved = { ...sharedEntry, activityKind: 'shared', ownerId: '', parentFreeActivityId: '', itineraryGroupId, date: placeGroup.date }
  } else {
    const date = to.slice('day:'.length); const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
    moved = { ...sharedEntry, activityKind: 'shared', ownerId: '', parentFreeActivityId: '', itineraryGroupId: '', date }
  }
  targetEntries = entriesFor(to).filter((item) => item.id !== entry.id)
  const reorderedSource = sourceEntries.filter((item) => item.id !== entry.id)
  const reorderedTarget = [...targetEntries]; reorderedTarget.splice(Math.min(Math.max(newIndex, 0), reorderedTarget.length), 0, moved)
  try { await store.moveItem(moved, previous); if (reorderedSource.length) await store.reorderItems(reorderedSource); await store.reorderItems(reorderedTarget); ElMessage.success(targetIsGroup ? '已移入地點群組。' : sourceIsGroup && targetIsDay ? '已移出地點群組。' : targetIsPersonal ? '已移入自由活動，僅自己可見。' : '已移動行程。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法移動行程。') }
}
function expenseParticipants(expense: Pick<Expense, 'kind' | 'payerId' | 'participantIds'>) { return participantsForExpense(expense, current.value?.members.map((member) => member.id) || []) }
function expenseParticipantCount(expense: Expense) { return expenseParticipants(expense).length }
function expensePayerName(payerId: string) { return current.value?.members.find((member) => member.id === payerId)?.name || '未知成員' }
function expensePayerLabel(expense: Expense) { const payers = payerSharesForExpense(expense); const names = Object.keys(payers).map(expensePayerName); return names.length > 1 ? `${names.join('、')} 共同支付` : `${names[0] || expensePayerName(expense.payerId)} 支付` }
function expenseShare(expense: Expense) { return expenseShareForMember(expense, expenseParticipants(expense)[0] || '') }
function expenseShareForMember(expense: Expense, memberId: string) { return splitShareForMember(expense, memberId, current.value?.members.map((member) => member.id) || []) }
function expenseSplitLabel(expense: Expense) { return expense.kind === 'personal' ? '個人支出' : splitModeLabel(expense.splitMode) }
const total = computed(() => currentExpenses.value.reduce((sum, expense) => sum + expense.amount, 0))
const baseBudgetCategories = ['餐飲', '交通', '住宿', '購物', '景點', '其他']
const categoryBudgets = computed(() => store.tripCategoryBudgets(activeId.value))
const dailyBudget = computed(() => store.tripDailyBudget(activeId.value))
const dailyExpenseSummary = computed(() => Object.entries(currentExpenses.value.filter((expense) => /^\d{4}-\d{2}-\d{2}$/.test(expense.date)).reduce<Record<string, number>>((days, expense) => { days[expense.date] = (days[expense.date] || 0) + expense.amount; return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, spent]) => ({ date, spent })))
const budgetCategoryNames = computed(() => [...new Set([...baseBudgetCategories, ...Object.keys(categoryBudgets.value), ...currentExpenses.value.map((expense) => expense.category).filter(Boolean)])])
const categoryBudgetSummary = computed(() => budgetCategoryNames.value.map((category) => ({ category, budget: Number(categoryBudgets.value[category]) || 0, spent: currentExpenses.value.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0) })).filter((row) => row.budget > 0 || row.spent > 0))
const balances = computed(() => { const trip = current.value; if (!trip) return []; const paid = Object.fromEntries(trip.members.map((member) => [member.id, 0])); const owed = Object.fromEntries(trip.members.map((member) => [member.id, 0])); currentExpenses.value.forEach((expense) => { Object.entries(payerSharesForExpense(expense)).forEach(([memberId, amount]) => { paid[memberId] = (paid[memberId] || 0) + amount }); expenseParticipants(expense).forEach((id) => { owed[id] = (owed[id] || 0) + expenseShareForMember(expense, id) }) }); currentSettlements.value.forEach((settlement) => { paid[settlement.fromId] = (paid[settlement.fromId] || 0) + settlement.amount; paid[settlement.toId] = (paid[settlement.toId] || 0) - settlement.amount }); return trip.members.map((member) => ({ ...member, balance: paid[member.id] - owed[member.id] })) })
const settlementSuggestions = computed(() => { const creditors = balances.value.filter((member) => member.balance > .01).map((member) => ({ ...member, remaining: member.balance })); const debtors = balances.value.filter((member) => member.balance < -.01).map((member) => ({ ...member, remaining: -member.balance })); const suggestions: { fromId: string; toId: string; from: string; to: string; amount: number }[] = []; let creditorIndex = 0; debtors.forEach((debtor) => { while (debtor.remaining > .01 && creditors[creditorIndex]) { const creditor = creditors[creditorIndex]; const amount = Math.min(debtor.remaining, creditor.remaining); suggestions.push({ fromId: debtor.id, toId: creditor.id, from: debtor.name, to: creditor.name, amount }); debtor.remaining -= amount; creditor.remaining -= amount; if (creditor.remaining <= .01) creditorIndex += 1 } }); return suggestions })
const activeMemberId = computed(() => currentMember.value?.id || (!firebaseEnabled ? current.value?.ownerId : undefined))
const activeMember = computed(() => activeMemberId.value ? current.value?.members.find((member) => member.id === activeMemberId.value) : undefined)
const personalBudget = computed(() => activeMember.value?.personalBudget || 0)
const myPaid = computed(() => activeMemberId.value ? currentExpenses.value.reduce((sum, expense) => sum + (payerSharesForExpense(expense)[activeMemberId.value!] || 0), 0) : 0)
const myBalance = computed(() => activeMemberId.value ? balances.value.find((member) => member.id === activeMemberId.value)?.balance || 0 : 0)
const myExpense = computed(() => activeMemberId.value ? currentExpenses.value.reduce((sum, expense) => sum + expenseShareForMember(expense, activeMemberId.value!), 0) : 0)
function memberName(memberId: string) { return current.value?.members.find((member) => member.id === memberId)?.name || '未知成員' }
function formatTripDate(date: string) { const value = new Date(`${date}T00:00:00`); return Number.isNaN(value.getTime()) ? date : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日` }
const tripDateRange = computed(() => current.value ? `${formatTripDate(current.value.startDate)}－${formatTripDate(current.value.endDate)}` : '')
const tripDuration = computed(() => { if (!current.value) return ''; const start = new Date(`${current.value.startDate}T00:00:00`).getTime(); const end = new Date(`${current.value.endDate}T00:00:00`).getTime(); const days = Math.round((end - start) / 86400000) + 1; return Number.isFinite(days) && days > 0 ? `共 ${days} 天` : '' })
function openTrip(t: Trip) { goTrip(t.id) }
async function signOutUser() { await logOut(); ElMessage.success('已登出。') }
</script>

<template>
  <main class="app-shell">
    <header v-if="screen !== 'login'" class="app-header">
      <div class="header-brand-area">
        <el-button v-if="screen === 'trip' && current" class="mobile-trip-header-menu" text circle aria-label="開啟旅行內容選單" title="開啟旅行內容選單" @click="mobileTripMenuOpen = true"><el-icon><Menu /></el-icon></el-button>
        <button class="brand" @click="goTrips" aria-label="TripMate 我的旅行">Trip<span>Mate</span></button>
      </div>
      <div class="header-actions">
        <el-dropdown v-if="user" trigger="click">
          <button class="user-menu-trigger" type="button" aria-label="開啟帳號選單">
            <span class="user-avatar" aria-hidden="true">{{ userInitial }}</span>
            <span class="user-display-name">{{ userDisplayName }}</span>
            <el-icon class="user-menu-caret" aria-hidden="true"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="goProfile">個人資料</el-dropdown-item>
              <el-dropdown-item divided @click="signOutUser">登出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-else class="header-login-button" @click="goLogin">登入</el-button>
      </div>
    </header>
    <section v-if="authResolving" class="auth-loading" aria-live="polite">
<div>
<strong>TripMate</strong>
<p>正在確認登入狀態…</p>
</div>
</section>
    <section v-if="screen === 'login'" class="auth-page">
<div class="auth-shell">
<aside class="auth-brand-panel">
<button class="auth-logo" @click="goTrips" aria-label="TripMate 首頁">Trip<span>Mate</span></button>
<div class="auth-brand-copy">
<p class="auth-kicker">TRAVEL TOGETHER</p>
<h1>和旅伴一起，<br>安排每一段旅程</h1>
<p>共同規劃行程、記錄開銷，把旅行回憶收藏在一起。</p>
</div>
<div class="travel-illustration" aria-hidden="true">
<div class="travel-photo travel-photo-main"><span>東京</span><i>✦</i></div>
<div class="travel-photo travel-photo-small"><span>週末出發</span></div>
<div class="travel-route"><b></b><b></b><b></b></div>
<div class="travel-suitcase">✦</div>
</div>
<ul class="auth-features">
<li><span>01</span>共同排行程</li>
<li><span>02</span>多人分帳</li>
<li><span>03</span>收藏回憶</li>
</ul>
</aside>
<div class="auth-card-wrap">
<button class="mobile-auth-logo" @click="goTrips" aria-label="TripMate 首頁">Trip<span>Mate</span></button>
<div class="auth-card">
<div class="auth-card-heading">
<h2>{{ authMode === 'login' ? '歡迎回來' : '建立你的帳號' }}</h2>
<p>{{ authMode === 'login' ? '登入 TripMate，繼續規劃下一段旅程。' : '加入 TripMate，和旅伴一起開始規劃。' }}</p>
</div>
<form class="auth-form" @submit.prevent="authMode === 'login' ? submitEmailLogin() : submitEmailRegistration()">
<div class="auth-field">
<label for="tripmate-email">Email</label>
<el-input id="tripmate-email" v-model="login.email" type="email" placeholder="name@example.com" autocomplete="email" :disabled="authSubmitting" />
</div>
<div class="auth-field">
<div class="auth-field-label"><label for="tripmate-password">密碼</label><button v-if="firebaseEnabled && authMode === 'login'" type="button" class="forgot-password" @click="resetPassword">忘記密碼？</button></div>
<el-input id="tripmate-password" v-model="login.password" type="password" placeholder="輸入密碼" show-password :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" :disabled="authSubmitting" />
</div>
<p v-if="authFormError" class="auth-form-error" role="alert">{{ authFormError }}</p>
<el-button class="auth-primary-button" native-type="submit" :loading="authSubmitting" :disabled="authSubmitting">{{ authMode === 'login' ? '登入' : '免費註冊' }}</el-button>
</form>
<template v-if="firebaseEnabled">
<div class="auth-divider"><span>或繼續使用</span></div>
<el-button class="google-auth-button" :loading="authSubmitting" :disabled="authSubmitting" @click="submitGoogleLogin"><span class="google-mark" aria-hidden="true">G</span>使用 Google 登入</el-button>
<p class="auth-switch">{{ authMode === 'login' ? '還沒有帳號？' : '已經有帳號？' }} <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; authFormError = ''">{{ authMode === 'login' ? '免費註冊' : '回到登入' }}</button></p>
</template>
<button v-else type="button" class="auth-demo-button" @click="useDemo">以示範帳號繼續</button>
</div>
</div>
</div>
</section>
    <section v-else-if="screen === 'trips'" class="page">
<div class="hero">
<div>
<p class="eyebrow">我的旅程</p>
<h1>下一趟旅行，從一起規劃開始。</h1>
<p>集中管理行程、花費、成員與旅行待辦。</p>
</div>
<div class="actions">
<el-button v-if="firebaseEnabled" size="large" @click="showJoin=true">輸入邀請碼</el-button>
<el-button type="primary" size="large" @click="showCreate=true">＋ 建立旅行</el-button>
</div>
</div>
<div v-if="store.trips.length" class="trip-grid">
<article v-for="trip in store.trips" :key="trip.id" class="trip-card" @click="openTrip(trip)">
<img v-if="trip.coverUrl" :src="trip.coverUrl" alt="旅行封面" />
<div v-else class="cover-placeholder">✦</div>
<div class="trip-info">
<p>{{ trip.country }} · {{ trip.city }}</p>
<h2>{{ trip.name }}</h2>
<span>{{ trip.startDate }} — {{ trip.endDate }}</span>
<small>{{ trip.members.length }} 位旅伴 · 邀請碼 {{ trip.inviteCode }}</small>
</div>
</article>
</div>
<div v-else class="empty panel">
<div>✦</div>
<h2>建立第一趟旅行</h2>
<p>輸入目的地與日期後，就可以邀請朋友、排進行程並記錄共同花費。</p>
<el-button type="primary" @click="showCreate=true">建立旅行</el-button>
</div>
</section>
    <section v-else-if="screen === 'profile'" class="page profile-page">
<button class="back" @click="goTrips">← 所有旅行</button>
<div class="profile-card panel">
<div>
<p class="eyebrow">PROFILE</p>
<h1>個人資料</h1>
<p class="muted">更新顯示名稱、預設幣別與旅行時區。</p>
</div>
<el-form label-position="top">
<el-form-item label="顯示名稱">
<el-input v-model="profile.displayName" maxlength="40" show-word-limit />
</el-form-item>
<el-form-item label="Email">
<el-input :model-value="user?.email || ''" disabled />
</el-form-item>
<div class="two-col">
<el-form-item label="預設幣別">
<el-select v-model="profile.defaultCurrency">
<el-option label="JPY 日圓" value="JPY" />
<el-option label="TWD 新台幣" value="TWD" />
<el-option label="USD 美元" value="USD" />
</el-select>
</el-form-item>
<el-form-item label="預設時區">
<el-select v-model="profile.timezone">
<el-option label="台北（Asia/Taipei）" value="Asia/Taipei" />
<el-option label="東京（Asia/Tokyo）" value="Asia/Tokyo" />
<el-option label="倫敦（Europe/London）" value="Europe/London" />
</el-select>
</el-form-item>
</div>
<el-button type="primary" @click="saveProfile">儲存個人資料</el-button>
</el-form>
</div>
</section>
    <section v-else-if="current" class="page trip-detail-page">
      <TripHeroHeader :trip="current" :date-range="tripDateRange" :duration="tripDuration" :can-edit-settings="canEditTripSettings" :can-manage-members="canManageMembers" :open-member-manager="openMemberManager" :role-label="currentRole === 'editor' ? 'Editor・可編輯' : 'Viewer・唯讀'" @back="goTrips" @edit="startEditTrip" @remove="removeTrip" />
      <el-drawer v-model="mobileTripMenuOpen" class="mobile-trip-drawer" direction="ltr" size="min(82vw, 300px)" :with-header="false">
        <div class="mobile-trip-drawer-heading"><div><span>TRIPMATE</span><strong>旅行內容</strong></div><el-button text circle aria-label="關閉內容選單" title="關閉內容選單" @click="mobileTripMenuOpen = false"><el-icon><Close /></el-icon></el-button></div>
        <nav class="mobile-trip-drawer-nav" aria-label="旅行內容導覽">
          <button v-for="tab in tripTabOptions" :key="tab" type="button" :class="{ 'is-active': activeTripTab === tab }" @click="selectTripTab(tab)">{{ tripTabLabels[tab] }}</button>
        </nav>
      </el-drawer>
      <nav class="trip-tabs" aria-label="旅行內容導覽" role="tablist">
        <button type="button" role="tab" :aria-selected="activeTripTab === 'overview'" :class="{ 'is-active': activeTripTab === 'overview' }" @click="selectTripTab('overview')">總覽</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'itinerary'" :class="{ 'is-active': activeTripTab === 'itinerary' }" @click="selectTripTab('itinerary')">行程</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'expenses'" :class="{ 'is-active': activeTripTab === 'expenses' }" @click="selectTripTab('expenses')">開銷</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'todos'" :class="{ 'is-active': activeTripTab === 'todos' }" @click="selectTripTab('todos')">待辦</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'favorites'" :class="{ 'is-active': activeTripTab === 'favorites' }" @click="selectTripTab('favorites')">收藏</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'shopping'" :class="{ 'is-active': activeTripTab === 'shopping' }" @click="selectTripTab('shopping')">購物</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'payments'" :class="{ 'is-active': activeTripTab === 'payments' }" @click="selectTripTab('payments')">支付與回饋</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'packing'" :class="{ 'is-active': activeTripTab === 'packing' }" @click="selectTripTab('packing')">行李</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'bookings'" :class="{ 'is-active': activeTripTab === 'bookings' }" @click="selectTripTab('bookings')">預訂</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'insurance'" :class="{ 'is-active': activeTripTab === 'insurance' }" @click="selectTripTab('insurance')">保險</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'album'" :class="{ 'is-active': activeTripTab === 'album' }" @click="selectTripTab('album')">相簿</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'map'" :class="{ 'is-active': activeTripTab === 'map' }" @click="selectTripTab('map')">地圖</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'members'" :class="{ 'is-active': activeTripTab === 'members' }" @click="selectTripTab('members')">旅伴與結算</button>
      </nav>
      <div class="trip-detail-layout" :class="{ 'is-single-detail': activeTripTab !== 'overview' }" role="tabpanel" :aria-label="tripTabLabels[activeTripTab]">
<TripItineraryView v-if="activeTripTab === 'overview' || activeTripTab === 'itinerary'" :trip="current" :items="currentItems" :favorites="currentFavorites" :user-id="user?.uid || current.ownerId" :favorite-request-id="favoriteItineraryRequestId" :days="itineraryDays" :personal-items="currentPersonalItems" :shopping-items="currentShoppingItems" :can-edit="canEditTrip" :sorting-enabled="itinerarySortingEnabled" :format-date="formatItineraryDate" :duration="itineraryDuration" :time-warning="itineraryTimeWarning" :maps-url="mapsUrl" @favorite-request-consumed="favoriteItineraryRequestId = ''" @toggle="toggleItinerary" @remove="removeItem" @toggle-sorting="toggleItinerarySorting" @sort="sortItineraryItems" @sort-group="sortGroupItineraryItems" @sort-personal="sortPersonalItineraryItems" @move="moveItineraryItem" />
        <TripMapView v-if="activeTripTab === 'map'" :days="itineraryDays" :format-date="formatItineraryDate" :maps-url="mapsUrl" />
        <TripExpensesView v-if="activeTripTab === 'overview' || activeTripTab === 'expenses'" :trip="current" :expenses="currentExpenses" :total="total" :my-paid="myPaid" :my-balance="myBalance" :personal-budget-member-id="activeMemberId" :personal-budget="personalBudget" :personal-spent="myExpense" :category-budget-values="categoryBudgets" :category-budget-options="budgetCategoryNames" :category-budgets="categoryBudgetSummary" :daily-budget="dailyBudget" :daily-expenses="dailyExpenseSummary" :can-set-personal-budget="Boolean(activeMemberId)" :can-manage-category-budgets="canEditTripSettings" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :payer-label="expensePayerLabel" :split-label="expenseSplitLabel" :participant-count="expenseParticipantCount" :share="expenseShare" />
        <TripTodosView v-if="activeTripTab === 'todos'" :trip="current" :todos="currentTodos" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" />
        <TripPackingView v-if="activeTripTab === 'packing'" :trip="current" :items="currentPackingItems" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" />
        <TripBookingsView v-if="activeTripTab === 'bookings'" :trip="current" :bookings="currentBookings" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" />
        <TripFavoritesView v-if="activeTripTab === 'favorites'" :trip="current" :favorites="favoritesWithItineraryStatus" :currency="current.currency" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :actor-name="currentMember?.name || userDisplayName" :member-name="memberName" @add-to-itinerary="addFavoriteToItinerary" />
        <TripAlbumView v-if="activeTripTab === 'album'" :trip="current" :photos="currentAlbumPhotos" :items="currentItems" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" :format-date="formatTripDate" />
        <TripShoppingView v-if="activeTripTab === 'shopping'" :trip="current" :items="currentShoppingItems" :itineraries="currentItems" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" :format-date="formatItineraryDate" />
        <TripPaymentsView v-if="activeTripTab === 'payments'" :trip="current" :tools="currentPaymentTools" :rules="currentRewardRules" :transactions="currentPaymentTransactions" :balances="currentStoredBalances" :summaries="currentPaymentToolSummaries" :user-id="user?.uid || current.ownerId" :can-edit="canEditTrip" :member-name="memberName" />
        <TripInsuranceView v-if="activeTripTab === 'insurance'" :trip="current" :insurance="currentInsurance" :statuses="currentInsuranceStatuses" :user-id="user?.uid || current.ownerId" :member-name="memberName" :can-edit="canEditTrip" />
        <TripMembersView v-if="activeTripTab === 'overview' || activeTripTab === 'members'" v-model:open-manager="memberManagerRequested" :trip="current" :balances="balances" :suggestions="settlementSuggestions" :settlements="currentSettlements" :expenses="currentExpenses" :can-manage="canManageMembers" :can-edit="canEditTrip" :member-name="memberName" />
      </div>
    </section>
  </main>
  <TripManagementDialogs
    v-model:show-join="showJoin"
    v-model:show-create="showCreate"
    v-model:show-edit="showEdit"
    v-model:invite-code="invite.code"
    :create-form="create"
    :edit-form="edit"
    :edit-cover-preview="editCoverPreview"
    :saving-trip="savingTrip"
    @select-create-cover="selectCreateCover"
    @select-edit-cover="selectEditCover"
    @remove-edit-cover="removeEditCover"
    @join-trip="joinTrip"
    @create-trip="createTrip"
    @save-trip="saveTrip"
    @remove-trip="removeTrip"
  />
</template>

<style>
.member-manager-dialog .el-dialog__body{padding-top:18px}.member-manager-current,.member-manager-invite{display:grid;gap:16px}.member-manager-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.member-manager-section-heading>div,.member-manager-invite>div{display:grid;gap:2px}.member-manager-section-heading p,.member-manager-invite p{margin:0;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.member-manager-section-heading h3,.member-manager-invite h3{margin:0;color:#173d37;font-size:17px;line-height:1.4}.member-manager-section-heading>span,.member-manager-invite>div>span{color:#71827c;font-size:12px;line-height:1.5}.member-manager-list{display:grid;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px}.member-manager-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto 40px;align-items:center;gap:11px;padding:11px 12px;border-bottom:1px solid #edf1ee}.member-manager-row:last-child{border-bottom:0}.member-manager-avatar{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#dceee6;color:#216a5b;font-size:14px;font-weight:800}.member-manager-copy{display:grid;min-width:0;gap:2px}.member-manager-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.member-manager-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.member-manager-role{padding:4px 8px;border-radius:999px;background:#f1f4f2;color:#687b74;font-size:12px;font-weight:700;white-space:nowrap}.member-manager-role.is-owner{background:#edf5ef;color:#2f7d70}.member-manager-role.is-editor{background:#eef5f5;color:#357072}.member-remove-button{width:40px!important;min-width:40px!important;height:40px!important;color:#c36358;font-size:22px}.member-remove-button:hover,.member-remove-button:focus-visible{background:#fdf0ed;color:#b64237}.member-manager-dialog .el-divider{margin:22px 0}.member-manager-form-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:12px}.member-manager-invite .el-form-item{margin-bottom:14px}.member-manager-invite .el-input,.member-manager-invite .el-select{width:100%}.member-invite-button{min-height:42px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.member-invite-button:hover,.member-invite-button:focus-visible{background:#1d5a52;color:#fff}@media(max-width:600px){.member-manager-section-heading{align-items:start;flex-direction:column;gap:5px}.member-manager-row{grid-template-columns:38px minmax(0,1fr) auto}.member-manager-role{grid-column:2;justify-self:start}.member-remove-button{grid-column:3;grid-row:1/3}.member-manager-form-grid{grid-template-columns:1fr}.member-manager-dialog .el-dialog__body{padding:16px}.member-manager-dialog .el-dialog__footer{padding:12px 16px 18px}}
.shopping-itinerary-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #dbe8e1;border-radius:10px;background:#f8fbf9}.shopping-itinerary-picker-copy{display:grid;min-width:0;gap:2px}.shopping-itinerary-picker-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-actions{display:flex;flex:0 0 auto;align-items:center;gap:2px}.shopping-itinerary-picker-button{min-height:38px;border-color:#b7d3c6;border-radius:9px;color:#236c59;font-weight:700}.shopping-itinerary-picker-button:hover,.shopping-itinerary-picker-button:focus-visible{border-color:#6da790;background:#eef6f1;color:#123f3a}.shopping-itinerary-clear{min-height:36px;color:#7a8a84}.shopping-itinerary-clear:hover,.shopping-itinerary-clear:focus-visible{color:#b94f45;background:#fdf0ed}.shopping-itinerary-picker{display:grid;gap:14px}.shopping-itinerary-day-select{display:grid;gap:6px}.shopping-itinerary-day-select label{color:#52736a;font-size:12px;font-weight:700}.shopping-itinerary-day-select .el-select{width:100%}.shopping-itinerary-day-select .el-select__wrapper{min-height:44px;border-radius:10px}.shopping-itinerary-picker-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px;color:#315e55}.shopping-itinerary-picker-heading strong{font-size:14px}.shopping-itinerary-picker-heading span{color:#71827c;font-size:12px}.shopping-itinerary-picker-list{display:grid;gap:9px;max-height:min(48vh,400px);overflow:auto;padding:2px}.shopping-itinerary-picker-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;padding:9px;border:1px solid #e0e9e4;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.shopping-itinerary-picker-row:hover,.shopping-itinerary-picker-row:focus-visible{border-color:#8ab9a8;background:#f8fcf9;outline:none}.shopping-itinerary-picker-row.is-selected{border-color:#2f7d70;background:#eef7f2}.shopping-itinerary-picker-row>img,.shopping-itinerary-picker-placeholder{display:grid;width:48px;height:48px;place-items:center;border-radius:9px;object-fit:cover}.shopping-itinerary-picker-placeholder{background:#eaf4ef;color:#2f7d70;font-size:17px;font-weight:800}.shopping-itinerary-picker-row-copy{display:grid;min-width:0;gap:3px}.shopping-itinerary-picker-row-copy strong{overflow:hidden;color:#244a43;font-size:14px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-row-copy>span{display:flex;align-items:center;gap:4px;color:#5f7770;font-size:12px}.shopping-itinerary-picker-row-copy em{padding:2px 6px;border-radius:999px;background:#eef5f0;color:#47776a;font-size:10px;font-style:normal;font-weight:700}.shopping-itinerary-picker-row-copy small{overflow:hidden;color:#7a8b85;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-select{padding:6px 9px;border-radius:8px;background:#eef5f0;color:#2f7d70;font-size:12px;font-weight:800}.shopping-itinerary-picker-row.is-selected .shopping-itinerary-picker-select{background:#2f7d70;color:#fff}.shopping-itinerary-picker-empty{display:grid;justify-items:center;gap:4px;padding:38px 16px;border:1px dashed #cbded5;border-radius:12px;color:#6b7d78;text-align:center}.shopping-itinerary-picker-empty strong{color:#315c52;font-size:15px}.shopping-itinerary-picker-empty p{margin:0;font-size:13px}@media(max-width:600px){.shopping-itinerary-picker-control{align-items:flex-start;flex-direction:column}.shopping-itinerary-picker-actions{width:100%;justify-content:flex-end}.shopping-itinerary-picker-row{grid-template-columns:44px minmax(0,1fr);gap:9px}.shopping-itinerary-picker-row>img,.shopping-itinerary-picker-placeholder{width:44px;height:44px}.shopping-itinerary-picker-select{grid-column:2;justify-self:start;padding:4px 8px}}
.favorite-audit-fields .el-input__wrapper{background:#f7faf8;box-shadow:0 0 0 1px #dce8e1 inset}.favorite-audit-fields .el-input__inner{color:#52736a;font-weight:600}
.itinerary-group-member-selector{display:grid;gap:7px;max-height:220px;overflow:auto;padding:10px;border:1px solid #e4e9e4;border-radius:10px;background:#fafcfb}.itinerary-group-member-selector .el-checkbox{display:flex;height:auto;margin:0;align-items:flex-start}.itinerary-group-member-selector .el-checkbox__label{display:grid;gap:2px;color:#315c52}.itinerary-group-member-selector small{color:#71827c;font-size:12px}
.payment-image-hint,.payment-rule-condition-hint{margin:6px 0 12px;color:#6b7d78;font-size:12px;line-height:1.5}.payment-image-preview{display:block;width:72px;height:72px;margin-top:8px;border:1px solid #dbe8e1;border-radius:10px;object-fit:cover}.payment-method-checks{display:flex;flex-wrap:wrap;gap:7px 12px;padding:10px;border:1px solid #dce8e1;border-radius:10px;background:#f8fbf9}.payment-method-checks .el-checkbox{height:auto;margin-right:0;color:#315c52;font-size:13px}
</style>
