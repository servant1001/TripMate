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
import PaymentToolDialog from './components/PaymentToolDialog.vue'
import { repository } from './services/repository'
import { useTripStore } from './stores/trip'
import type { AlbumPhoto, Expense, ExpenseKind, ExpenseSplitMode, Favorite, FavoriteType, ItineraryActivityKind, ItineraryItem, Member, PackingItem, PaymentMethod, PaymentTool, PaymentToolType, PaymentToolVisibility, PaymentTransaction, RewardCapPeriod, RewardRule, RewardType, Role, Settlement, ShoppingItem, ShoppingPriority, ShoppingStatus, ShoppingType, TravelInsurance, Trip } from './types'
import { deleteTripImage, getInsuranceAttachmentUrl, uploadInsuranceAttachment, uploadTripCover, uploadTripImage } from './services/cloudinary'
import { auth, ensureUserProfile, firebaseEnabled, logOut, registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle, updateUserSettings } from './services/firebase'
import { joinTripByInviteCode } from './services/cloudinary'
import { expenseKindParticipants, participantsForExpense, payerSharesForExpense, splitModeLabel, splitShareForMember } from './utils/expenseSplit'
import { memberInsuranceStatus, validateCoveragePeriod } from './utils/insuranceCoverage'
import { calculateTransactionReward, rewardUsage, selectApplicableRule, storedValueBalance } from './utils/paymentRewards'

const router = useRouter(); const route = useRoute(); const store = useTripStore(); const activeId = ref(''); const screen = ref<'trips'|'trip'|'login'|'profile'>('trips'); const authResolving = ref(firebaseEnabled && Boolean(auth)); const showCreate = ref(false); const showEdit = ref(false); const showJoin = ref(false); const showMember = ref(false); const showItem = ref(false); const showExpense = ref(false); const showPacking = ref(false); const showFavorite = ref(false); const showAlbum = ref(false); const savingAlbum = ref(false); const showShopping = ref(false); const savingShopping = ref(false); const showShoppingItineraryPicker = ref(false); const shoppingItineraryPickerDay = ref(''); const shoppingItineraryPickerMode = ref<'form' | 'batch'>('form'); const batchShoppingItemIds = ref<string[]>([]); const batchShoppingItineraryItemIds = ref<string[]>([]); const showPersonalBudget = ref(false); const savingPersonalBudget = ref(false); const showCategoryBudgets = ref(false); const savingCategoryBudgets = ref(false); const mobileTripMenuOpen = ref(false); const showPaymentTool = ref(false); const showRewardRule = ref(false); const showPaymentTransaction = ref(false); const showStoredBalance = ref(false); const editingPaymentToolId = ref<string | null>(null); const editingRewardRuleId = ref<string | null>(null); const editingPaymentTransactionId = ref<string | null>(null); const balanceToolId = ref('')
type TripTab = 'overview' | 'itinerary' | 'map' | 'expenses' | 'todos' | 'packing' | 'bookings' | 'favorites' | 'album' | 'shopping' | 'insurance' | 'payments' | 'members'
const paymentToolImageUrl = ref('')
watch(showPaymentTool, (opened) => { if (opened) paymentToolImageUrl.value = editingPaymentToolId.value ? currentPaymentTools.value.find((tool) => tool.id === editingPaymentToolId.value)?.imageUrl || '' : '' })
const showItineraryGroup = ref(false); const editingItineraryGroupId = ref<string | null>(null); const itineraryGroupMemberIds = ref<string[]>([]); const itemItineraryGroupId = ref(''); const itineraryGroup = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', note: '' })
const current = computed(() => store.trip(activeId.value)); const currentItems = computed(() => store.items(activeId.value)); const currentPersonalItems = computed(() => currentItems.value.filter((entry) => entry.activityKind === 'personal' && (!firebaseEnabled || entry.ownerId === user.value?.uid))); const currentExpenses = computed(() => store.tripExpenses(activeId.value)); const currentTodos = computed(() => store.tripTodos(activeId.value)); const currentPackingItems = computed(() => store.tripPackingItems(activeId.value)); const currentBookings = computed(() => store.tripBookings(activeId.value)); const currentFavorites = computed(() => store.tripFavorites(activeId.value)); const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value)); const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value)); const currentSettlements = computed(() => store.tripSettlements(activeId.value)); const currentInsurance = computed(() => store.tripInsurances(activeId.value).find((entry) => entry.userId === user.value?.uid)); const currentInsuranceStatuses = computed(() => store.tripInsuranceStatuses(activeId.value)); const currentPaymentTools = computed(() => store.tripPaymentTools(activeId.value)); const currentRewardRules = computed(() => store.tripRewardRules(activeId.value)); const currentPaymentTransactions = computed(() => store.tripPaymentTransactions(activeId.value)); const currentStoredBalances = computed(() => store.tripStoredValueBalances(activeId.value)); const savingInsurance = ref(false)
const favoritesWithItineraryStatus = computed(() => currentFavorites.value.map((favoriteItem) => ({ ...favoriteItem, addedToItinerary: currentItems.value.some((entry) => entry.favoriteId === favoriteItem.id || (!entry.favoriteId && entry.title === favoriteItem.name && (favoriteItem.mapUrl ? entry.mapUrl === favoriteItem.mapUrl : favoriteItem.location ? entry.location === favoriteItem.location : entry.type === favoriteToItineraryType(favoriteItem.type)))) })))
const currentPaymentToolSummaries = computed(() => store.tripPaymentToolSummaries(activeId.value))
const insertAfterItemId = ref<string | null>(null)
const itemActivityKind = ref<ItineraryActivityKind>('shared'); const personalActivityParentId = ref('')
const create = reactive({ name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const coverFile = ref<File>(); const edit = reactive({ name: '', country: '', city: '', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const editCoverFile = ref<File>(); const editCoverPreview = ref(''); const savingTrip = ref(false)
const member = reactive({ name: '', email: '', role: 'editor' as Role }); const item = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', note: '', type: '景點', transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }); const editingItemId = ref<string | null>(null); const pendingFavoriteId = ref<string | null>(null); const itemFavoriteId = ref(''); const showFavoritePicker = ref(false); const favoritePickerTarget = ref<'source' | 'destination'>('source'); const favoritePickerSearch = ref(''); const favoritePickerType = ref<FavoriteType | 'all'>('all'); const itinerarySortingEnabled = ref(false); const packingSortingEnabled = ref(false); const favoriteSortingEnabled = ref(false); const editingExpenseId = ref<string |null>(null); const editingPackingId = ref<string | null>(null); const editingFavoriteId = ref<string | null>(null); const editingAlbumPhotoId = ref<string | null>(null); const albumFile = ref<File>(); const albumPreview = ref(''); const album = reactive({ caption: '', tripDate: '', itineraryItemId: '' }); const editingShoppingId = ref<string | null>(null); const shoppingImageFile = ref<File>(); const shoppingImagePreview = ref(''); const shoppingImageUrl = ref(''); const shoppingImageDisplay = computed(() => shoppingImagePreview.value.startsWith('blob:') ? shoppingImagePreview.value : shoppingImageUrl.value.trim() || shoppingImagePreview.value); const shoppingParticipantIds = ref<string[]>([]); const shoppingItineraryItemIds = ref<string[]>([]); const shopping = reactive({ name: '', description: '', shoppingType: 'personal' as ShoppingType, category: '其他', priority: 'medium' as ShoppingPriority, quantity: 1, unit: '件', estimatedUnitPrice: 0, actualUnitPrice: 0, currency: 'JPY', requestedBy: '', assignedTo: '', giftRecipient: '', storeName: '', storeBranch: '', location: '', address: '', mapUrl: '', website: '', note: '', status: 'wishlist' as ShoppingStatus, plannedDate: '', itineraryItemId: '' }); const expense = reactive({ title: '', amount: 0, payerId: '', kind: 'shared' as ExpenseKind, splitMode: 'equal' as ExpenseSplitMode, category: '餐飲', date: '' }); const packing = reactive({ name: '', category: '衣物', quantity: 1, assignedTo: '', isShared: false, note: '' }); const favorite = reactive({ name: '', type: 'attraction' as FavoriteType, location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' }); const expenseParticipantIds = ref<string[]>([]); const expenseShares = reactive<Record<string, number>>({}); const expenseRatios = reactive<Record<string, number>>({}); const expenseSplitUnits = reactive<Record<string, number>>({}); const expensePayerIds = ref<string[]>([]); const expensePayerShares = reactive<Record<string, number>>({}); const categoryBudgetDraft = reactive<Record<string, number>>({})
const invite = reactive({ code: '' })
const paymentTool = reactive({ name: '', type: 'credit_card' as PaymentToolType, issuer: '', lastFourDigits: '', network: 'visa' as NonNullable<PaymentTool['network']>, defaultCurrency: 'JPY', settlementCurrency: 'JPY', foreignTransactionFeeRatePercent: 0, visibility: 'private' as PaymentToolVisibility, note: '' }); const rewardRule = reactive({ paymentToolId: '', name: '', rewardType: 'cashback' as RewardType, baseRatePercent: 0, bonusRatePercent: 0, rewardCap: 0, maximumEligibleSpend: 0, minimumSpend: 0, capPeriod: 'trip' as RewardCapPeriod, periodStart: '', periodEnd: '', applicableCurrencies: '', applicableCategories: '', applicableMerchants: '', applicablePaymentMethods: [] as PaymentMethod[], excludedCategories: '', excludedMerchants: '', requiresRegistration: false, registrationCompleted: false, priority: 1, note: '' }); const paymentTransaction = reactive({ paymentToolId: '', title: '', merchant: '', category: '購物', transactionDate: '', transactionTime: '', paymentMethod: 'physical_card' as PaymentMethod, originalAmount: 0, originalCurrency: 'JPY', exchangeRate: 1, transactionType: 'purchase' as PaymentTransaction['transactionType'], status: 'posted' as PaymentTransaction['status'], refundedAmount: 0, note: '', syncExpense: false }); const storedBalance = reactive({ initialBalance: 0, currency: 'JPY' })
const user = ref<User | null>(null); const login = reactive({ email: '', password: '' }); const authMode = ref<'login' | 'register'>('login'); const authSubmitting = ref(false); const authFormError = ref(''); const personalBudgetInput = ref(0); let removeAuthListener: (() => void) | undefined
const profile = reactive({ displayName: '', defaultCurrency: 'JPY', timezone: 'Asia/Taipei' })
const savingExpense = ref(false); const expenseSourceCurrency = ref(''); const expenseSourceAmount = ref(0); const expenseExchangeRate = ref(1); const expenseReceiptFile = ref<File>(); const expenseReceiptUrl = ref(''); const expenseReceiptPreview = ref(''); const expenseNote = ref('')
const showDailyBudget = ref(false); const savingDailyBudget = ref(false); const dailyBudgetInput = ref(0)
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
  if (tab !== 'packing') packingSortingEnabled.value = false
  if (tab !== 'favorites') favoriteSortingEnabled.value = false
  if (tab === activeTripTab.value) return
  void router.push({ name: 'trip-tab', params: { tripId: activeId.value, tab }, query: route.query })
}
function syncRoute() { const name = String(route.name || 'trips'); if (name === 'login' || name === 'register' || name === 'forgot-password') { screen.value = 'login'; authMode.value = name === 'register' ? 'register' : 'login'; return } if (name === 'profile') { screen.value = 'profile'; if (user.value) profile.displayName = user.value.displayName || user.value.email?.split('@')[0] || ''; return } if (name === 'trip-tab') { activeId.value = String(route.params.tripId); screen.value = 'trip'; return } screen.value = 'trips'; showCreate.value = name === 'trip-create' }
watch(() => route.fullPath, syncRoute, { immediate: true })
function authErrorMessage(error: unknown) { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; if (code === 'auth/unauthorized-domain') return '此網站尚未加入 Firebase Authentication 的授權網域。'; if (code === 'auth/operation-not-allowed') return 'Firebase 尚未啟用 Google 登入方式。'; if (code === 'auth/account-exists-with-different-credential') return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'; return error instanceof Error ? error.message : 'Google 登入未完成，請再試一次。' }
onMounted(async () => { if (!firebaseEnabled || !auth) { await store.load(); return } try { await getRedirectResult(auth) } catch (error) { ElMessage.error(authErrorMessage(error)) } removeAuthListener = onAuthStateChanged(auth, async (signedInUser) => { try { user.value = signedInUser; if (signedInUser) { await ensureUserProfile(signedInUser); await store.load(signedInUser.uid); if (route.meta.public) { const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/trips'; await router.replace(redirect) } } else { store.$patch({ trips: [], itinerary: [], expenses: [], settlements: [], todos: [], packingItems: [], bookings: [], favorites: [], albumPhotos: [], shoppingItems: [], categoryBudgets: {}, dailyBudgets: {}, insurances: [], insuranceStatuses: {} }); if (!route.meta.public) await router.replace({ name: 'login', query: { redirect: route.fullPath } }) } } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法載入登入資料。') } finally { authResolving.value = false } }) })
onUnmounted(() => { removeAuthListener?.(); clearEditCoverPreview(); clearAlbumPreview(); clearShoppingImagePreview() })
async function submitEmailLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '登入失敗，請確認 Email 與密碼。' } finally { authSubmitting.value = false } }
async function submitEmailRegistration() { authFormError.value = ''; if (login.password.length < 6) { authFormError.value = '密碼至少需要 6 個字元。'; return } authSubmitting.value = true; try { await registerWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '註冊失敗，請稍後再試。' } finally { authSubmitting.value = false } }
async function submitGoogleLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithGoogle() } catch (error) { authFormError.value = authErrorMessage(error) } finally { authSubmitting.value = false } }
async function resetPassword() { authFormError.value = ''; if (!login.email) { authFormError.value = '請先輸入要重設的 Email。'; return } try { await requestPasswordReset(login.email); ElMessage.success('重設密碼信已寄出。') } catch (error) { authFormError.value = error instanceof Error ? error.message : '無法寄出重設密碼信。' } }
async function saveProfile() { if (!user.value) return; try { await updateUserSettings(user.value, profile); user.value = auth?.currentUser || user.value; ElMessage.success('個人資料已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新個人資料。') } }
async function useDemo() { await store.load(); goTrips() }
async function joinTrip() { if (!user.value) return ElMessage.warning('請先登入後加入旅行。'); if (!invite.code.trim()) return ElMessage.warning('請輸入邀請碼。'); try { const { tripId } = await joinTripByInviteCode(invite.code); await store.load(user.value.uid); showJoin.value = false; invite.code = ''; goTrip(tripId); ElMessage.success('已加入旅行。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法加入旅行。') } }
async function createTrip() { if (!create.name || !create.startDate || !create.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); if (firebaseEnabled && !user.value) return ElMessage.warning('請先登入後建立旅行。'); try { if (coverFile.value) create.coverUrl = await uploadTripCover(coverFile.value); const ownerId = user.value?.uid || 'me'; const trip = await store.createTrip({ ...create, ownerId, members: [{ id: ownerId, name: user.value?.displayName || '我', email: user.value?.email || 'me@tripmate.app', role: 'owner' }] }, user.value?.uid); showCreate.value = false; Object.assign(create, { name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); goTrip(trip.id); ElMessage.success('旅行已建立。') } catch (e) { ElMessage.error(e instanceof Error ? e.message : '建立旅行失敗。') } }
function clearEditCoverPreview() { if (editCoverPreview.value.startsWith('blob:')) URL.revokeObjectURL(editCoverPreview.value); editCoverPreview.value = '' }
function selectEditCover(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; clearEditCoverPreview(); editCoverFile.value = file; editCoverPreview.value = URL.createObjectURL(file) }
function removeEditCover() { clearEditCoverPreview(); editCoverFile.value = undefined; edit.coverUrl = '' }
function startEditTrip() { if (!current.value) return; if (current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以編輯旅行設定。'); clearEditCoverPreview(); editCoverFile.value = undefined; Object.assign(edit, { name: current.value.name, country: current.value.country, city: current.value.city, startDate: current.value.startDate, endDate: current.value.endDate, currency: current.value.currency, budget: current.value.budget, coverUrl: current.value.coverUrl || '' }); showEdit.value = true }
async function saveTrip() { if (!current.value || !edit.name || !edit.startDate || !edit.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); savingTrip.value = true; try { if (editCoverFile.value) edit.coverUrl = await uploadTripCover(editCoverFile.value, current.value.id); await store.updateTrip({ ...current.value, ...edit }); clearEditCoverPreview(); editCoverFile.value = undefined; showEdit.value = false; ElMessage.success('旅行設定已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。') } finally { savingTrip.value = false } }
async function removeTrip() { if (!current.value || current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以刪除旅行。'); try { await ElMessageBox.confirm(`確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`, '刪除旅行', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteTrip(current.value); goTrips(); ElMessage.success('旅行已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。') } }
function openMemberManager() { if (!canManageMembers.value) return ElMessage.warning('只有旅行建立者可以管理成員。'); showMember.value = true }
async function addMember() { if (!canManageMembers.value) return ElMessage.warning('只有旅行建立者可以管理成員。'); if (!current.value || !member.name || !member.email) return ElMessage.warning('請填寫成員名稱與 Email。'); try { await store.addMember(current.value, member); Object.assign(member, { name: '', email: '', role: 'editor' }); ElMessage.success('已新增旅行成員。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法新增成員。') } }
async function removeMember(memberToRemove: Member) {
  if (!current.value || !canManageMembers.value) return ElMessage.warning('只有旅行建立者可以管理成員。')
  if (memberToRemove.id === current.value.ownerId) return ElMessage.warning('旅行建立者無法被移除。')
  const hasExpense = currentExpenses.value.some((expense) => expense.payerId === memberToRemove.id || expenseParticipants(expense).includes(memberToRemove.id))
  const hasSettlement = currentSettlements.value.some((settlement) => settlement.fromId === memberToRemove.id || settlement.toId === memberToRemove.id)
  if (hasExpense || hasSettlement) return ElMessage.warning('此成員已有支出或結算紀錄，請先完成帳務處理後再移除。')
  try { await ElMessageBox.confirm(`確定要將「${memberToRemove.name}」移出這趟旅行嗎？對方將無法再存取此旅行。`, '移除旅行成員', { confirmButtonText: '移除成員', cancelButtonText: '取消', type: 'warning' }); await store.removeMember(current.value, memberToRemove.id); ElMessage.success('已移除旅行成員。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法移除旅行成員。') }
}
function normalizeFavoriteType(favoriteType: FavoriteType): FavoriteType { return favoriteType === 'cafe' ? 'restaurant' : favoriteType === 'alternative' || favoriteType === 'other' ? 'attraction' : favoriteType }
function favoriteToItineraryType(favoriteType: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', transport: '交通', stay: '住宿', shop: '商店', cafe: '餐廳', alternative: '景點', other: '景點' } as Record<FavoriteType, string>)[favoriteType] }
function favoriteTypeLabel(favoriteType: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', transport: '交通', stay: '住宿', shop: '商店', cafe: '餐廳', alternative: '景點', other: '景點' } as Record<FavoriteType, string>)[favoriteType] }
const favoritePickerOptions: Array<{ value: FavoriteType | 'all'; label: string }> = [{ value: 'all', label: '全部' }, { value: 'attraction', label: '景點' }, { value: 'restaurant', label: '餐廳' }, { value: 'transport', label: '交通' }, { value: 'stay', label: '住宿' }, { value: 'shop', label: '商店' }]
const filteredFavoritesForPicker = computed(() => { const keyword = favoritePickerSearch.value.trim().toLowerCase(); return currentFavorites.value.filter((entry) => { const matchesType = favoritePickerType.value === 'all' || normalizeFavoriteType(entry.type) === favoritePickerType.value; const matchesSearch = !keyword || [entry.name, entry.location, entry.note].some((value) => value?.toLowerCase().includes(keyword)); return matchesType && matchesSearch }) })
function openFavoritePicker(target: 'source' | 'destination' = 'source') { favoritePickerTarget.value = target; favoritePickerSearch.value = ''; favoritePickerType.value = 'all'; showFavoritePicker.value = true }
function applyFavoriteToItem(favoriteId: string) { const selected = currentFavorites.value.find((entry) => entry.id === favoriteId); if (!selected) return; const type = favoriteToItineraryType(selected.type); itemFavoriteId.value = selected.id; pendingFavoriteId.value = selected.id; Object.assign(item, { title: selected.name, location: selected.location || '', mapUrl: selected.mapUrl || '', imageUrl: selected.imageUrl || '', type }); if (type !== '交通') Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }) }
function applyFavoriteAsTransportDestination(favoriteId: string) { const selected = currentFavorites.value.find((entry) => entry.id === favoriteId); if (!selected) return; Object.assign(item, { transportDestinationFavoriteId: selected.id, transportDestinationName: selected.name, transportDestinationLocation: selected.location || '', transportDestinationMapUrl: selected.mapUrl || '' }) }
function selectFavoriteForItem(favoriteId: string) { if (favoritePickerTarget.value === 'destination') applyFavoriteAsTransportDestination(favoriteId); else applyFavoriteToItem(favoriteId); showFavoritePicker.value = false }
function openItemForm(entry?: ItineraryItem, favoriteId?: string) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); insertAfterItemId.value = null; const linkedFavoriteId = favoriteId || entry?.favoriteId || ''; pendingFavoriteId.value = linkedFavoriteId || null; itemFavoriteId.value = linkedFavoriteId; itemItineraryGroupId.value = entry?.itineraryGroupId || ''; editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, endTime: entry.endTime || '', title: entry.title, location: entry.location, mapUrl: entry.mapUrl || '', imageUrl: entry.imageUrl || '', note: entry.note || '', type: entry.type, transportDestinationFavoriteId: entry.transportDestinationFavoriteId || '', transportDestinationName: entry.transportDestinationName || '', transportDestinationLocation: entry.transportDestinationLocation || '', transportDestinationMapUrl: entry.transportDestinationMapUrl || '' } : { date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', note: '', type: '景點', transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }); showItem.value = true }
function openNewItemForm() { itemActivityKind.value = 'shared'; personalActivityParentId.value = ''; openItemForm() }
function openItemFormForEdit(entry: ItineraryItem) { itemActivityKind.value = entry.activityKind || 'shared'; personalActivityParentId.value = entry.parentFreeActivityId || ''; openItemForm(entry) }
function openPersonalItemForm(group: ItineraryItem) { itemActivityKind.value = 'personal'; personalActivityParentId.value = group.id; openItemForm(); item.date = group.date; item.type = '個人行程' }
function openItemFormAfter(entry: ItineraryItem) { itemActivityKind.value = 'shared'; personalActivityParentId.value = ''; openItemForm(); insertAfterItemId.value = entry.id; itemItineraryGroupId.value = entry.itineraryGroupId || ''; item.date = entry.date }
function normalizeGoogleMapsUrl(value: string) { const raw = value.trim(); if (!raw) return ''; const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; try { const hostname = new URL(normalized).hostname.toLowerCase(); if (!/(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') throw new Error(); return normalized } catch { throw new Error('請貼上有效的 Google Maps 景點網址。') } }
async function saveItem() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); if (!activeId.value || !item.title || !item.date) return ElMessage.warning('請填寫行程名稱與日期。'); if (item.endTime && item.time && item.endTime <= item.time) return ElMessage.warning('結束時間必須晚於開始時間。'); const kind = itemActivityKind.value; if (kind === 'group') return ElMessage.warning('地點群組請使用建立群組功能。'); if (kind === 'personal' && !personalActivityParentId.value) return ElMessage.warning('請從自由活動群組新增個人行程。'); const sameLevelItems = kind === 'personal' ? currentPersonalItems.value.filter((entry) => entry.parentFreeActivityId === personalActivityParentId.value) : currentItems.value.filter((entry) => (entry.activityKind || 'shared') !== 'personal'); const conflict = sameLevelItems.some((entry) => entry.id !== editingItemId.value && entry.date === item.date && item.time && entry.time && entry.time < (item.endTime || item.time) && (entry.endTime || entry.time) > item.time); if (conflict) return ElMessage.warning('此時段與既有行程重疊，請調整時間。'); try { const isFree = kind === 'free'; const isPersonal = kind === 'personal'; const mapUrl = isFree ? '' : normalizeGoogleMapsUrl(item.mapUrl); const transportDestinationMapUrl = !isFree && item.type === '交通' ? normalizeGoogleMapsUrl(item.transportDestinationMapUrl) : ''; const rawImage = item.imageUrl.trim(); const imageUrl = !isFree && rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : isFree ? '' : rawImage; const existing = editingItemId.value ? currentItems.value.find((entry) => entry.id === editingItemId.value) : undefined; const payload = { ...item, type: isFree ? '自由活動' : item.type, location: isFree ? '' : item.location.trim(), mapUrl, imageUrl, note: item.note.trim(), activityKind: kind, parentFreeActivityId: isPersonal ? personalActivityParentId.value : '', itineraryGroupId: !isFree && !isPersonal ? itemItineraryGroupId.value : '', ownerId: isPersonal ? (user.value?.uid || current.value?.ownerId || '') : '', favoriteId: !isFree ? pendingFavoriteId.value || existing?.favoriteId || '' : '', transportDestinationMapUrl, transportDestinationFavoriteId: !isFree && item.type === '交通' ? item.transportDestinationFavoriteId : '', transportDestinationName: !isFree && item.type === '交通' ? item.transportDestinationName.trim() : '', transportDestinationLocation: !isFree && item.type === '交通' ? item.transportDestinationLocation.trim() : '' }; if (existing) await store.updateItem({ ...existing, ...payload }); else { const ordered = sameLevelItems.filter((entry) => entry.date === item.date).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')); const afterIndex = !isPersonal && insertAfterItemId.value ? ordered.findIndex((entry) => entry.id === insertAfterItemId.value) : -1; const insertIndex = afterIndex >= 0 ? afterIndex + 1 : ordered.length; const added = await store.addItem({ tripId: activeId.value, ...payload, order: insertIndex }); if (afterIndex >= 0) { const reordered = [...ordered]; reordered.splice(insertIndex, 0, added); await store.reorderItems(reordered) } const savedFavorite = !isFree && !isPersonal && pendingFavoriteId.value ? currentFavorites.value.find((entry) => entry.id === pendingFavoriteId.value) : undefined; if (savedFavorite) await store.updateFavorite({ ...savedFavorite, addedToItinerary: true }) } showItem.value = false; editingItemId.value = null; insertAfterItemId.value = null; pendingFavoriteId.value = null; personalActivityParentId.value = ''; itemActivityKind.value = 'shared' } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。') } }
async function removeItem(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); try { const isFree = entry.activityKind === 'free'; await ElMessageBox.confirm(`確定刪除${isFree ? '自由活動群組' : '行程'}「${entry.title}」嗎？${isFree ? '你的個人行程也會一併移除。' : ''}`, `刪除${isFree ? '自由活動' : '行程'}`, { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); if (isFree) await Promise.all(currentPersonalItems.value.filter((item) => item.parentFreeActivityId === entry.id).map((item) => store.deleteItem(item))); await store.deleteItem(entry); ElMessage.success(isFree ? '自由活動已刪除。' : '行程已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。') } }
function openItineraryGroupForm(entries: ItineraryItem[] = [], existing?: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); editingItineraryGroupId.value = existing?.id || null; itineraryGroupMemberIds.value = existing ? currentItems.value.filter((item) => item.itineraryGroupId === existing.id).map((item) => item.id) : entries.map((item) => item.id); const first = entries[0] || existing; Object.assign(itineraryGroup, existing ? { date: existing.date, time: existing.time || '', endTime: existing.endTime || '', title: existing.title, location: existing.location || '', mapUrl: existing.mapUrl || '', note: existing.note || '' } : { date: first?.date || current.value?.startDate || '', time: '', endTime: '', title: '', location: first?.location || '', mapUrl: first?.mapUrl || '', note: '' }); showItineraryGroup.value = true }
async function saveItineraryGroup() { if (!current.value || !itineraryGroup.title.trim() || !itineraryGroup.date) return ElMessage.warning('請填寫群組名稱與日期。'); if (itineraryGroup.endTime && itineraryGroup.time && itineraryGroup.endTime <= itineraryGroup.time) return ElMessage.warning('群組結束時間必須晚於開始時間。'); try { const existing = editingItineraryGroupId.value ? currentItems.value.find((item) => item.id === editingItineraryGroupId.value) : undefined; const payload = { tripId: current.value.id, date: itineraryGroup.date, time: itineraryGroup.time || '', endTime: itineraryGroup.endTime || '', title: itineraryGroup.title.trim(), location: itineraryGroup.location.trim(), mapUrl: normalizeGoogleMapsUrl(itineraryGroup.mapUrl), imageUrl: '', note: itineraryGroup.note.trim(), type: '地點群組', activityKind: 'group' as const, parentFreeActivityId: '', ownerId: '' }; const group = existing ? { ...existing, ...payload } : await store.addItem({ ...payload, order: currentItems.value.filter((item) => item.date === itineraryGroup.date && !item.itineraryGroupId).length }); if (existing) await store.updateItem(group); const selected = new Set(itineraryGroupMemberIds.value); await Promise.all(currentItems.value.filter((item) => item.date === itineraryGroup.date && item.id !== group.id && (item.activityKind || 'shared') === 'shared' && (item.itineraryGroupId === group.id || selected.has(item.id))).map((item) => store.updateItem({ ...item, itineraryGroupId: selected.has(item.id) ? group.id : '' }))); showItineraryGroup.value = false; editingItineraryGroupId.value = null; itineraryGroupMemberIds.value = []; ElMessage.success(existing ? '地點群組已更新。' : '已建立地點群組。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存地點群組。') } }
async function dissolveItineraryGroup(group: ItineraryItem) { if (!canEditTrip.value) return; try { await ElMessageBox.confirm(`解散「${group.title}」後，群組內行程會保留為一般行程。`, '解散地點群組', { confirmButtonText: '解散群組', cancelButtonText: '取消', type: 'warning' }); await Promise.all(currentItems.value.filter((item) => item.itineraryGroupId === group.id).map((item) => store.updateItem({ ...item, itineraryGroupId: '' }))); await store.deleteItem(group); ElMessage.success('地點群組已解散，原行程已保留。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法解散地點群組。') } }
async function toggleItinerary(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); await store.toggleItem(entry.id) }
function resetExpenseSplitValues(ids = expenseParticipantIds.value) { const clear = (value: Record<string, number>) => Object.keys(value).forEach((id) => delete value[id]); clear(expenseShares); clear(expenseRatios); clear(expenseSplitUnits); const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0; const ratio = ids.length ? Number((100 / ids.length).toFixed(2)) : 0; ids.forEach((id) => { expenseShares[id] = amount; expenseRatios[id] = ratio; expenseSplitUnits[id] = 1 }) }
function resetExpensePayerValues(ids = expensePayerIds.value) { Object.keys(expensePayerShares).forEach((id) => delete expensePayerShares[id]); const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0; ids.forEach((id) => { expensePayerShares[id] = amount }) }
function syncExpenseParticipants() { const fallback = current.value?.members.map((member) => member.id) || []; expenseParticipantIds.value = expenseKindParticipants(expense.kind, expense.payerId, expenseParticipantIds.value, fallback); const selected = new Set(expenseParticipantIds.value); [expenseShares, expenseRatios, expenseSplitUnits].forEach((values) => Object.keys(values).forEach((id) => { if (!selected.has(id)) delete values[id] })); expenseParticipantIds.value.forEach((id) => { if (expenseShares[id] === undefined) expenseShares[id] = 0; if (expenseRatios[id] === undefined) expenseRatios[id] = 0; if (expenseSplitUnits[id] === undefined) expenseSplitUnits[id] = 1 }) }
function syncExpensePayers() { if (expense.kind === 'personal' && expensePayerIds.value.length > 1) expensePayerIds.value = [expensePayerIds.value[0]]; const selected = new Set(expensePayerIds.value); Object.keys(expensePayerShares).forEach((id) => { if (!selected.has(id)) delete expensePayerShares[id] }); expensePayerIds.value.forEach((id) => { if (expensePayerShares[id] === undefined) expensePayerShares[id] = 0 }); expense.payerId = expensePayerIds.value[0] || ''; if (expense.kind === 'personal') expenseParticipantIds.value = expense.payerId ? [expense.payerId] : [] }
function clearExpenseReceiptPreview() { if (expenseReceiptPreview.value.startsWith('blob:')) URL.revokeObjectURL(expenseReceiptPreview.value); expenseReceiptPreview.value = '' }
function selectExpenseReceipt(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return ElMessage.warning('請選擇圖片格式的收據。'); clearExpenseReceiptPreview(); expenseReceiptFile.value = file; expenseReceiptPreview.value = URL.createObjectURL(file) }
function removeExpenseReceipt() { clearExpenseReceiptPreview(); expenseReceiptFile.value = undefined; expenseReceiptUrl.value = '' }
function openExpenseForm(existing?: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); const members = current.value?.members || []; editingExpenseId.value = existing?.id || null; Object.assign(expense, existing ? { title: existing.title, amount: existing.amount, payerId: existing.payerId, kind: existing.kind, splitMode: existing.splitMode || 'equal', category: existing.category, date: existing.date } : { title: '', amount: 0, payerId: currentMember.value?.id || members[0]?.id || '', kind: 'shared', splitMode: 'equal', category: '餐飲', date: new Date().toISOString().slice(0, 10) }); expenseParticipantIds.value = existing ? expenseParticipants(existing) : members.map((member) => member.id); expensePayerIds.value = existing ? Object.keys(payerSharesForExpense(existing)) : expense.payerId ? [expense.payerId] : []; resetExpenseSplitValues(); resetExpensePayerValues(); if (existing?.shares) Object.assign(expenseShares, existing.shares); if (existing?.ratios) Object.assign(expenseRatios, existing.ratios); if (existing?.splitUnits) Object.assign(expenseSplitUnits, existing.splitUnits); if (existing?.payerShares) Object.assign(expensePayerShares, existing.payerShares); clearExpenseReceiptPreview(); expenseReceiptFile.value = undefined; expenseReceiptUrl.value = existing?.receiptUrl || ''; expenseReceiptPreview.value = existing?.receiptUrl || ''; expenseSourceCurrency.value = existing?.sourceCurrency || current.value?.currency || 'JPY'; expenseSourceAmount.value = Number(existing?.sourceAmount ?? existing?.amount ?? 0); expenseExchangeRate.value = Number(existing?.exchangeRate || 1); expenseNote.value = existing?.note || ''; showExpense.value = true }
function openPersonalBudgetForm() { if (!activeMemberId.value) return ElMessage.warning('請先登入後設定個人預算。'); personalBudgetInput.value = personalBudget.value; showPersonalBudget.value = true }
async function savePersonalBudget() { if (!current.value || !activeMemberId.value) return; savingPersonalBudget.value = true; try { const budget = Math.max(0, Number(personalBudgetInput.value) || 0); await repository.updatePersonalBudget(current.value, activeMemberId.value, budget); const currentUserMember = current.value.members.find((entry) => entry.id === activeMemberId.value); if (currentUserMember) currentUserMember.personalBudget = budget; showPersonalBudget.value = false; ElMessage.success('個人預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存個人預算。') } finally { savingPersonalBudget.value = false } }
function openCategoryBudgetForm() { if (!canEditTripSettings.value) return ElMessage.warning('只有旅行建立者可以設定分類預算。'); Object.keys(categoryBudgetDraft).forEach((category) => delete categoryBudgetDraft[category]); budgetCategoryNames.value.forEach((category) => { categoryBudgetDraft[category] = Number(categoryBudgets.value[category]) || 0 }); showCategoryBudgets.value = true }
async function saveCategoryBudgets() { if (!current.value || !canEditTripSettings.value) return; savingCategoryBudgets.value = true; try { await store.updateCategoryBudgets(current.value.id, categoryBudgetDraft); showCategoryBudgets.value = false; ElMessage.success('分類預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存分類預算。') } finally { savingCategoryBudgets.value = false } }
function openDailyBudgetForm() { if (!canEditTripSettings.value) return ElMessage.warning('只有旅行建立者可以設定每日預算。'); dailyBudgetInput.value = dailyBudget.value; showDailyBudget.value = true }
async function saveDailyBudget() { if (!current.value || !canEditTripSettings.value) return; savingDailyBudget.value = true; try { await store.updateDailyBudget(current.value.id, dailyBudgetInput.value); showDailyBudget.value = false; ElMessage.success('每日預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存每日預算。') } finally { savingDailyBudget.value = false } }
function openPackingForm(existing?: PackingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。'); editingPackingId.value = existing?.id || null; Object.assign(packing, existing ? { name: existing.name, category: existing.category, quantity: existing.quantity, assignedTo: existing.assignedTo || '', isShared: existing.isShared, note: existing.note || '' } : { name: '', category: '衣物', quantity: 1, assignedTo: '', isShared: false, note: '' }); showPacking.value = true }
async function savePackingItem() { if (!current.value || !packing.name.trim()) return ElMessage.warning('請填寫物品名稱。'); try { const payload = { tripId: current.value.id, name: packing.name.trim(), category: packing.category, quantity: Math.max(1, Number(packing.quantity) || 1), assignedTo: packing.assignedTo || '', isShared: packing.isShared, note: packing.note.trim(), createdBy: user.value?.uid || current.value.ownerId }; const existing = editingPackingId.value ? currentPackingItems.value.find((entry) => entry.id === editingPackingId.value) : undefined; if (existing) await store.updatePackingItem({ ...existing, ...payload }); else await store.addPackingItem({ ...payload, order: currentPackingItems.value.filter((entry) => entry.isShared === packing.isShared).length }); showPacking.value = false; editingPackingId.value = null; ElMessage.success('行李物品已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行李物品。') } }
async function togglePackingItem(packingItem: PackingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。'); try { await store.togglePackingItem(packingItem) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行李狀態。') } }
function togglePackingSorting() {
  if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。')
  packingSortingEnabled.value = !packingSortingEnabled.value
  ElMessage.info(packingSortingEnabled.value ? '已啟用排序：長按拖曳把手可調整行李順序。' : '行李排序已保存。')
}
async function sortPackingItems({ group, oldIndex, newIndex, itemIds }: { group: 'shared' | 'personal'; oldIndex: number; newIndex: number; itemIds: string[] }) {
  if (!canEditTrip.value || !packingSortingEnabled.value || oldIndex === newIndex) return
  const isShared = group === 'shared'
  const allItems = currentPackingItems.value.filter((entry) => entry.isShared === isShared).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.createdAt - b.createdAt)
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= itemIds.length || newIndex >= itemIds.length) return
  const reorderedVisibleIds = [...itemIds]
  const [movedId] = reorderedVisibleIds.splice(oldIndex, 1)
  if (!movedId) return
  reorderedVisibleIds.splice(newIndex, 0, movedId)
  const itemsById = new Map(allItems.map((entry) => [entry.id, entry]))
  let visibleIndex = 0
  const reordered = allItems.map((entry) => itemIds.includes(entry.id) ? itemsById.get(reorderedVisibleIds[visibleIndex++]) || entry : entry)
  try { await store.reorderPackingItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行李排序。') }
}
async function removePackingItem(packingItem: PackingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。'); try { await ElMessageBox.confirm(`確定刪除物品「${packingItem.name}」嗎？`, '刪除行李物品', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deletePackingItem(packingItem); ElMessage.success('行李物品已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行李物品。') } }
function openFavoriteForm(existing?: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); editingFavoriteId.value = existing?.id || null; Object.assign(favorite, existing ? { name: existing.name, type: normalizeFavoriteType(existing.type), location: existing.location || '', mapUrl: existing.mapUrl || '', website: existing.website || '', imageUrl: existing.imageUrl || '', estimatedCost: existing.estimatedCost || 0, recommendedBy: existing.recommendedBy || '', note: existing.note || '' } : { name: '', type: 'attraction', location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' }); showFavorite.value = true }
const editingFavorite = computed(() => editingFavoriteId.value ? currentFavorites.value.find((entry) => entry.id === editingFavoriteId.value) : undefined)
const favoriteCreatorName = computed(() => editingFavorite.value ? memberName(editingFavorite.value.createdBy) : currentMember.value?.name || userDisplayName.value)
const favoriteModifierName = computed(() => editingFavorite.value ? memberName(editingFavorite.value.updatedBy || editingFavorite.value.createdBy) : currentMember.value?.name || userDisplayName.value)
async function saveFavorite() { if (!current.value || !favorite.name.trim()) return ElMessage.warning('請填寫收藏名稱。'); try { const rawWebsite = favorite.website.trim(); const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite; const rawImage = favorite.imageUrl.trim(); const imageUrl = rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : rawImage; const mapUrl = normalizeGoogleMapsUrl(favorite.mapUrl); const actorId = user.value?.uid || current.value.ownerId; const payload = { tripId: current.value.id, name: favorite.name.trim(), type: favorite.type, location: favorite.location.trim(), mapUrl, website, imageUrl, estimatedCost: Math.max(0, Number(favorite.estimatedCost) || 0), recommendedBy: favorite.recommendedBy.trim(), note: favorite.note.trim(), createdBy: actorId, updatedBy: actorId, updatedAt: Date.now() }; const existing = editingFavoriteId.value ? currentFavorites.value.find((entry) => entry.id === editingFavoriteId.value) : undefined; if (existing) await store.updateFavorite({ ...existing, ...payload, createdBy: existing.createdBy }); else await store.addFavorite(payload); showFavorite.value = false; editingFavoriteId.value = null; ElMessage.success('旅遊收藏已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅遊收藏。') } }
async function removeFavorite(favoriteItem: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); try { await ElMessageBox.confirm(`確定刪除收藏「${favoriteItem.name}」嗎？`, '刪除旅遊收藏', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteFavorite(favoriteItem); ElMessage.success('旅遊收藏已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅遊收藏。') } }
async function duplicateFavorite(favoriteItem: Favorite) { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); try { const actorId = user.value?.uid || current.value.ownerId; await store.addFavorite({ tripId: current.value.id, name: `${favoriteItem.name}（副本）`, type: favoriteItem.type, location: favoriteItem.location || '', mapUrl: favoriteItem.mapUrl || '', website: favoriteItem.website || '', imageUrl: favoriteItem.imageUrl || '', estimatedCost: favoriteItem.estimatedCost || 0, recommendedBy: favoriteItem.recommendedBy || '', note: favoriteItem.note || '', order: Date.now(), createdBy: actorId, updatedBy: actorId, updatedAt: Date.now() }); ElMessage.success('已複製收藏，可再編輯副本。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法複製旅遊收藏。') } }
function toggleFavoriteSorting() {
  if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
  favoriteSortingEnabled.value = !favoriteSortingEnabled.value
  ElMessage.info(favoriteSortingEnabled.value ? '已啟用排序：長按拖曳把手可調整收藏順序。' : '收藏排序已保存。')
}
async function sortFavorites({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
  if (!canEditTrip.value || !favoriteSortingEnabled.value || oldIndex === newIndex) return
  const favorites = [...currentFavorites.value].sort((a, b) => {
    const aHasOrder = a.order !== undefined
    const bHasOrder = b.order !== undefined
    if (aHasOrder && bHasOrder) return (a.order || 0) - (b.order || 0)
    if (aHasOrder) return -1
    if (bHasOrder) return 1
    return Number(a.addedToItinerary) - Number(b.addedToItinerary) || b.createdAt - a.createdAt
  })
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= favorites.length || newIndex >= favorites.length) return
  const [moved] = favorites.splice(oldIndex, 1)
  if (!moved) return
  favorites.splice(newIndex, 0, moved)
  try { await store.reorderFavorites(favorites) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新收藏排序。') }
}
function clearAlbumPreview() { if (albumPreview.value.startsWith('blob:')) URL.revokeObjectURL(albumPreview.value); albumPreview.value = '' }
function resetAlbumForm() { clearAlbumPreview(); albumFile.value = undefined; editingAlbumPhotoId.value = null; Object.assign(album, { caption: '', tripDate: '', itineraryItemId: '' }) }
function selectAlbumPhoto(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return ElMessage.warning('請選擇圖片檔案。'); if (file.size > 10 * 1024 * 1024) return ElMessage.warning('圖片大小請控制在 10 MB 以內。'); clearAlbumPreview(); albumFile.value = file; albumPreview.value = URL.createObjectURL(file) }
function openAlbumForm(existing?: AlbumPhoto) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); resetAlbumForm(); editingAlbumPhotoId.value = existing?.id || null; Object.assign(album, existing ? { caption: existing.caption || '', tripDate: existing.tripDate || '', itineraryItemId: existing.itineraryItemId || '' } : { caption: '', tripDate: '', itineraryItemId: '' }); albumPreview.value = existing?.imageUrl || ''; showAlbum.value = true }
async function saveAlbumPhoto() { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); const existing = editingAlbumPhotoId.value ? currentAlbumPhotos.value.find((entry) => entry.id === editingAlbumPhotoId.value) : undefined; if (!existing && !albumFile.value) return ElMessage.warning('請選擇要上傳的照片。'); savingAlbum.value = true; try { const imageUrl = albumFile.value ? await uploadTripImage(albumFile.value, 'album', current.value.id) : existing?.imageUrl || ''; const payload = { tripId: current.value.id, imageUrl, caption: album.caption.trim(), tripDate: album.tripDate || '', itineraryItemId: album.itineraryItemId || '', uploadedBy: user.value?.uid || current.value.ownerId }; if (existing) await store.updateAlbumPhoto({ ...existing, ...payload }); else await store.addAlbumPhoto(payload); showAlbum.value = false; resetAlbumForm(); ElMessage.success(existing ? '相片資訊已更新。' : '照片已加入旅行相簿。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅行相片。') } finally { savingAlbum.value = false } }
async function removeAlbumPhoto(photo: AlbumPhoto) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); try { await ElMessageBox.confirm('確定從旅行相簿移除這張照片嗎？', '刪除旅行相片', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteAlbumPhoto(photo); ElMessage.success('相片已從相簿移除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行相片。') } }
function clearShoppingImagePreview() { if (shoppingImagePreview.value.startsWith('blob:')) URL.revokeObjectURL(shoppingImagePreview.value); shoppingImagePreview.value = '' }
function resetShoppingForm() { clearShoppingImagePreview(); shoppingImageFile.value = undefined; shoppingImageUrl.value = ''; editingShoppingId.value = null; shoppingParticipantIds.value = []; shoppingItineraryItemIds.value = []; Object.assign(shopping, { name: '', description: '', shoppingType: 'personal', category: '其他', priority: 'medium', quantity: 1, unit: '件', estimatedUnitPrice: 0, actualUnitPrice: 0, currency: current.value?.currency || 'JPY', requestedBy: '', assignedTo: '', giftRecipient: '', storeName: '', storeBranch: '', location: '', address: '', mapUrl: '', website: '', note: '', status: 'wishlist', plannedDate: '', itineraryItemId: '' }) }
function selectShoppingImage(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return ElMessage.warning('請選擇圖片檔案。'); if (file.size > 10 * 1024 * 1024) return ElMessage.warning('圖片大小請控制在 10 MB 以內。'); clearShoppingImagePreview(); shoppingImageFile.value = file; shoppingImagePreview.value = URL.createObjectURL(file) }
function openShoppingForm(existing?: ShoppingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); resetShoppingForm(); editingShoppingId.value = existing?.id || null; if (existing) { Object.assign(shopping, { name: existing.name, description: existing.description || '', shoppingType: existing.shoppingType, category: existing.category, priority: existing.priority, quantity: existing.quantity, unit: existing.unit || '件', estimatedUnitPrice: existing.estimatedUnitPrice || 0, actualUnitPrice: existing.actualUnitPrice || 0, currency: existing.currency, requestedBy: existing.requestedBy || '', assignedTo: existing.assignedTo || '', giftRecipient: existing.giftRecipient || '', storeName: existing.storeName || '', storeBranch: existing.storeBranch || '', location: existing.location || '', address: existing.address || '', mapUrl: existing.mapUrl || '', website: existing.website || '', note: existing.note || '', status: existing.status, plannedDate: existing.plannedDate || '', itineraryItemId: existing.itineraryItemId || '' }); shoppingItineraryItemIds.value = [...new Set(existing.itineraryItemIds?.length ? existing.itineraryItemIds : existing.itineraryItemId ? [existing.itineraryItemId] : [])]; shoppingParticipantIds.value = [...(existing.participantIds || [])]; shoppingImagePreview.value = existing.imageUrl || ''; shoppingImageUrl.value = existing.imageUrl || '' } else { shopping.assignedTo = user.value?.uid || current.value?.ownerId || ''; shoppingParticipantIds.value = current.value?.members.map((member) => member.id) || [] } showShopping.value = true }
function normalizeExternalUrl(value: string) { const raw = value.trim(); return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw }
async function saveShoppingItem() { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); if (!shopping.name.trim()) return ElMessage.warning('請填寫商品名稱。'); const existing = editingShoppingId.value ? currentShoppingItems.value.find((entry) => entry.id === editingShoppingId.value) : undefined; const duplicate = !existing && currentShoppingItems.value.find((entry) => entry.name.trim().toLocaleLowerCase() === shopping.name.trim().toLocaleLowerCase() && entry.status !== 'cancelled'); try { if (duplicate) await ElMessageBox.confirm(`購物清單中已經有「${duplicate.name}」，仍要新增嗎？`, '可能重複的商品', { confirmButtonText: '仍要新增', cancelButtonText: '取消', type: 'warning' }); savingShopping.value = true; const quantity = Math.max(1, Number(shopping.quantity) || 1); const estimatedUnitPrice = Math.max(0, Number(shopping.estimatedUnitPrice) || 0); const actualUnitPrice = Math.max(0, Number(shopping.actualUnitPrice) || 0); const imageUrl = shoppingImageFile.value ? await uploadTripImage(shoppingImageFile.value, 'shopping', current.value.id) : normalizeExternalUrl(shoppingImageUrl.value) || existing?.imageUrl || ''; const mapUrl = normalizeGoogleMapsUrl(shopping.mapUrl); const itineraryItemIds = [...new Set(shoppingItineraryItemIds.value)].filter((id) => currentItems.value.some((entry) => entry.id === id)); const payload = { tripId: current.value.id, name: shopping.name.trim(), description: shopping.description.trim(), shoppingType: shopping.shoppingType, category: shopping.category.trim() || '其他', priority: shopping.priority, quantity, unit: shopping.unit.trim() || '件', estimatedUnitPrice, estimatedTotalPrice: estimatedUnitPrice * quantity, actualUnitPrice, actualTotalPrice: actualUnitPrice * quantity, currency: shopping.currency || current.value.currency, requestedBy: shopping.requestedBy.trim(), assignedTo: shopping.assignedTo || '', giftRecipient: shopping.giftRecipient.trim(), storeName: shopping.storeName.trim(), storeBranch: shopping.storeBranch.trim(), location: shopping.location.trim(), address: shopping.address.trim(), mapUrl, website: normalizeExternalUrl(shopping.website), imageUrl, note: shopping.note.trim(), status: shopping.status, plannedDate: shopping.plannedDate || '', itineraryItemId: itineraryItemIds[0] || '', itineraryItemIds, participantIds: shopping.shoppingType === 'shared' ? shoppingParticipantIds.value : [], purchasedBy: existing?.purchasedBy || '', purchasedAt: existing?.purchasedAt, expenseId: existing?.expenseId || '', createdBy: existing?.createdBy || user.value?.uid || current.value.ownerId }; if (existing) await store.updateShoppingItem({ ...existing, ...payload }); else await store.addShoppingItem(payload); showShopping.value = false; resetShoppingForm(); ElMessage.success(existing ? '購物項目已更新。' : '商品已加入購物清單。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法儲存購物項目。') } finally { savingShopping.value = false } }
async function updateShoppingStatus(item: ShoppingItem, status: ShoppingStatus) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); try { const isPurchased = status === 'purchased'; await store.updateShoppingItem({ ...item, status, purchasedBy: isPurchased ? item.purchasedBy || item.assignedTo || user.value?.uid || current.value?.ownerId : item.purchasedBy || '', purchasedAt: isPurchased ? item.purchasedAt || Date.now() : item.purchasedAt }); ElMessage.success(status === 'purchased' ? '已標記為已購買。' : '商品狀態已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新商品狀態。') } }
async function removeShoppingItem(item: ShoppingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); try { await ElMessageBox.confirm(`確定刪除商品「${item.name}」嗎？`, '刪除購物項目', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteShoppingItem(item); ElMessage.success('購物項目已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除購物項目。') } }
async function duplicateShoppingItem(item: ShoppingItem) { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); try { const itineraryItemIds = [...new Set(item.itineraryItemIds?.length ? item.itineraryItemIds : item.itineraryItemId ? [item.itineraryItemId] : [])]; await store.addShoppingItem({ tripId: current.value.id, name: `${item.name}（副本）`, description: item.description || '', shoppingType: item.shoppingType, category: item.category, priority: item.priority, quantity: item.quantity, unit: item.unit || '件', estimatedUnitPrice: item.estimatedUnitPrice || 0, estimatedTotalPrice: item.estimatedTotalPrice || 0, actualUnitPrice: 0, actualTotalPrice: 0, currency: item.currency || current.value.currency, requestedBy: item.requestedBy || '', assignedTo: item.assignedTo || '', giftRecipient: item.giftRecipient || '', storeName: item.storeName || '', storeBranch: item.storeBranch || '', location: item.location || '', address: item.address || '', mapUrl: item.mapUrl || '', website: item.website || '', imageUrl: item.imageUrl || '', note: item.note || '', status: 'wishlist', plannedDate: item.plannedDate || '', itineraryItemId: itineraryItemIds[0] || '', itineraryItemIds, participantIds: [...(item.participantIds || [])], purchasedBy: '', purchasedAt: undefined, expenseId: '', createdBy: user.value?.uid || current.value.ownerId }); ElMessage.success('已複製商品，可再編輯副本。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法複製商品。') } }
async function convertShoppingToExpense(item: ShoppingItem) { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); if (item.expenseId) return ElMessage.info('這筆商品已建立對應開銷。'); const amount = Number(item.actualTotalPrice) || Number(item.actualUnitPrice) * item.quantity || Number(item.estimatedTotalPrice) || Number(item.estimatedUnitPrice) * item.quantity; if (!(amount > 0)) return ElMessage.warning('請先在商品中填寫預估或實際價格。'); const payerId = item.purchasedBy || item.assignedTo || user.value?.uid || current.value.ownerId; const kind: ExpenseKind = item.shoppingType === 'shared' ? 'shared' : 'personal'; const participantIds = kind === 'shared' ? (item.participantIds?.length ? item.participantIds : current.value.members.map((member) => member.id)) : [payerId]; try { await ElMessageBox.confirm(`建立「${item.name}」的旅行開銷 ${item.currency} ${amount.toLocaleString()} 嗎？`, '建立旅行開銷', { confirmButtonText: '建立開銷', cancelButtonText: '取消', type: 'success' }); const expense = await store.addExpense({ tripId: current.value.id, title: item.name, amount, payerId, kind, participantIds, splitMode: 'equal', shares: {}, category: '購物', date: item.plannedDate || localDate() }); await store.updateShoppingItem({ ...item, status: 'purchased', purchasedBy: payerId, purchasedAt: item.purchasedAt || Date.now(), expenseId: expense.id, actualTotalPrice: Number(item.actualTotalPrice) || amount }); ElMessage.success('已建立旅行開銷並連結商品。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法建立旅行開銷。') } }
function addFavoriteToItinerary(favoriteItem: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); openNewItemForm(); pendingFavoriteId.value = favoriteItem.id; itemFavoriteId.value = favoriteItem.id; Object.assign(item, { date: current.value?.startDate || '', time: '', endTime: '' }); applyFavoriteToItem(favoriteItem.id) }
const customShareTotal = computed(() => expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseShares[id]) || 0), 0))
const ratioTotal = computed(() => expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseRatios[id]) || 0), 0))
const splitUnitTotal = computed(() => expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseSplitUnits[id]) || 0), 0))
const payerTotal = computed(() => expensePayerIds.value.reduce((sum, id) => sum + (Number(expensePayerShares[id]) || 0), 0))
async function saveExpense() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); if (!current.value || !expense.title || expense.amount <= 0 || !expense.payerId) return ElMessage.warning('請完整填寫支出資料。'); const participantIds = expense.kind === 'personal' ? [expense.payerId] : expenseParticipantIds.value; if (!participantIds.length) return ElMessage.warning('請至少選擇一位分攤成員。'); if (!expensePayerIds.value.length) return ElMessage.warning('請至少選擇一位付款人。'); if (expense.kind === 'shared' && expense.splitMode === 'custom' && Math.abs(customShareTotal.value - expense.amount) > .01) return ElMessage.warning('自訂分攤總額必須等於支出金額。'); if (expense.kind === 'shared' && expense.splitMode === 'ratio' && Math.abs(ratioTotal.value - 100) > .01) return ElMessage.warning('比例分攤總和必須為 100%。'); if (expense.kind === 'shared' && expense.splitMode === 'shares' && splitUnitTotal.value <= 0) return ElMessage.warning('份數分攤總份數必須大於 0。'); if (Math.abs(payerTotal.value - expense.amount) > .01) return ElMessage.warning('付款金額合計必須等於支出金額。'); const existing = editingExpenseId.value ? currentExpenses.value.find((item) => item.id === editingExpenseId.value) : undefined; savingExpense.value = true; try { const receiptUrl = expenseReceiptFile.value ? await uploadTripImage(expenseReceiptFile.value, 'expense', current.value.id) : expenseReceiptUrl.value; const payload = { tripId: current.value.id, ...expense, participantIds, payerId: expensePayerIds.value[0], payerShares: Object.fromEntries(expensePayerIds.value.map((id) => [id, Number(expensePayerShares[id]) || 0])), shares: expense.kind === 'shared' && expense.splitMode === 'custom' ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseShares[id]) || 0])) : {}, ratios: expense.kind === 'shared' && expense.splitMode === 'ratio' ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseRatios[id]) || 0])) : {}, splitUnits: expense.kind === 'shared' && expense.splitMode === 'shares' ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseSplitUnits[id]) || 0])) : {}, sourceCurrency: expenseSourceCurrency.value.trim() || current.value.currency, sourceAmount: Math.max(0, Number(expenseSourceAmount.value) || 0), exchangeRate: Math.max(0, Number(expenseExchangeRate.value) || 0), receiptUrl, note: expenseNote.value.trim() }; if (existing) await store.updateExpense({ ...existing, ...payload }); else await store.addExpense(payload); clearExpenseReceiptPreview(); showExpense.value = false; editingExpenseId.value = null; ElMessage.success('支出已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存支出。') } finally { savingExpense.value = false } }
async function removeExpense(expense: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); try { await ElMessageBox.confirm(`確定刪除「${expense.title}」嗎？`, '刪除支出', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteExpense(expense); ElMessage.success('支出已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除支出。') } }
const itineraryDays = computed(() => Object.entries(currentItems.value.filter((entry) => (entry.activityKind || 'shared') !== 'personal').reduce<Record<string, ItineraryItem[]>>((days, entry) => { (days[entry.date] ||= []).push(entry); return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, entries: entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')) })))
const itineraryGroupsForItem = computed(() => currentItems.value.filter((entry) => entry.activityKind === 'group' && entry.date === item.date))
const shoppingItineraryDays = computed(() => Object.entries(currentItems.value.filter((entry) => entry.activityKind !== 'free').reduce<Record<string, ItineraryItem[]>>((days, entry) => { (days[entry.date] ||= []).push(entry); return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, entries: entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')) })))
const selectedShoppingItineraries = computed(() => shoppingItineraryItemIds.value.map((id) => currentItems.value.find((entry) => entry.id === id)).filter((entry): entry is ItineraryItem => Boolean(entry)))
const selectedShoppingItinerary = computed(() => selectedShoppingItineraries.value[0])
const shoppingItineraryEntries = computed(() => shoppingItineraryDays.value.find((day) => day.date === shoppingItineraryPickerDay.value)?.entries || [])
const activeShoppingItineraryItemIds = computed<string[]>({ get: () => shoppingItineraryPickerMode.value === 'batch' ? batchShoppingItineraryItemIds.value : shoppingItineraryItemIds.value, set: (value) => { if (shoppingItineraryPickerMode.value === 'batch') batchShoppingItineraryItemIds.value = value; else shoppingItineraryItemIds.value = value } })
function openShoppingItineraryPicker() { shoppingItineraryPickerMode.value = 'form'; shoppingItineraryPickerDay.value = selectedShoppingItinerary.value?.date || shoppingItineraryDays.value[0]?.date || ''; showShoppingItineraryPicker.value = true }
function openBatchShoppingItineraryPicker(items: ShoppingItem[]) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); batchShoppingItemIds.value = items.map((item) => item.id); batchShoppingItineraryItemIds.value = []; shoppingItineraryPickerMode.value = 'batch'; shoppingItineraryPickerDay.value = shoppingItineraryDays.value[0]?.date || ''; showShoppingItineraryPicker.value = true }
function selectShoppingItinerary(entry: ItineraryItem) { const selected = new Set(activeShoppingItineraryItemIds.value); if (selected.has(entry.id)) selected.delete(entry.id); else selected.add(entry.id); activeShoppingItineraryItemIds.value = [...selected] }
async function confirmShoppingItinerarySelection() { if (shoppingItineraryPickerMode.value !== 'batch') { showShoppingItineraryPicker.value = false; return } const itineraryItemIds = [...new Set(batchShoppingItineraryItemIds.value)]; const items = currentShoppingItems.value.filter((item) => batchShoppingItemIds.value.includes(item.id)); if (!items.length || !itineraryItemIds.length) return ElMessage.warning('請至少選擇一筆商品與一個關聯行程。'); try { await Promise.all(items.map((item) => { const linkedIds = [...new Set([...(item.itineraryItemIds?.length ? item.itineraryItemIds : item.itineraryItemId ? [item.itineraryItemId] : []), ...itineraryItemIds])]; return store.updateShoppingItem({ ...item, itineraryItemId: linkedIds[0] || '', itineraryItemIds: linkedIds }) })); showShoppingItineraryPicker.value = false; batchShoppingItemIds.value = []; batchShoppingItineraryItemIds.value = []; ElMessage.success(`已將 ${items.length} 項商品加入 ${itineraryItemIds.length} 個關聯行程。`) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新商品關聯行程。') } }
function clearShoppingItinerary() { activeShoppingItineraryItemIds.value = []; if (shoppingItineraryPickerMode.value === 'form') shopping.itineraryItemId = ''; }
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
function expenseParticipants(expense: { kind: ExpenseKind; payerId: string; participantIds: string[] }) { return participantsForExpense(expense, current.value?.members.map((member) => member.id) || []) }
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
function memberPaid(memberId: string) { return currentExpenses.value.reduce((sum, expense) => sum + (payerSharesForExpense(expense)[memberId] || 0), 0) }
function memberName(memberId: string) { return current.value?.members.find((member) => member.id === memberId)?.name || '未知成員' }
function formatTripDate(date: string) { const value = new Date(`${date}T00:00:00`); return Number.isNaN(value.getTime()) ? date : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日` }
const tripDateRange = computed(() => current.value ? `${formatTripDate(current.value.startDate)}－${formatTripDate(current.value.endDate)}` : '')
const tripDuration = computed(() => { if (!current.value) return ''; const start = new Date(`${current.value.startDate}T00:00:00`).getTime(); const end = new Date(`${current.value.endDate}T00:00:00`).getTime(); const days = Math.round((end - start) / 86400000) + 1; return Number.isFinite(days) && days > 0 ? `共 ${days} 天` : '' })
function localDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
async function confirmSettlement(suggestion: { fromId: string; toId: string; from: string; to: string; amount: number }) { if (!canEditTrip.value || !current.value) return ElMessage.warning('Viewer 僅能查看結算資料。'); try { await ElMessageBox.confirm(`確認「${suggestion.from}」已支付 ${current.value.currency} ${suggestion.amount.toFixed(0)} 給「${suggestion.to}」？`, '標記為已結算', { confirmButtonText: '確認結算', cancelButtonText: '取消', type: 'success' }); await store.addSettlement({ tripId: current.value.id, fromId: suggestion.fromId, toId: suggestion.toId, amount: suggestion.amount, date: localDate(), createdAt: Date.now() }); ElMessage.success('已記錄結算。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法記錄結算。') } }
async function removeSettlement(settlement: Settlement) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看結算資料。'); try { await ElMessageBox.confirm('確定要復原這筆結算嗎？', '復原結算', { confirmButtonText: '復原', cancelButtonText: '取消', type: 'warning' }); await store.deleteSettlement(settlement); ElMessage.success('結算已復原。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法復原結算。') } }
function openTrip(t: Trip) { goTrip(t.id) }
async function saveInsurance(payload: Omit<TravelInsurance, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TravelInsurance, 'createdAt'>>, files: File[]) {
  if (!current.value || !user.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行保險狀態。')
  savingInsurance.value = true
  try {
    const previousAttachments = [...(currentInsurance.value?.attachments || [])]
    const attachments = [...(payload.attachments || [])]
    for (const file of files) attachments.push(await uploadInsuranceAttachment(file, current.value.id))
    const coverage = validateCoveragePeriod(payload.coverageStartAt, payload.coverageEndAt, current.value)
    await store.saveInsurance({ ...payload, attachments }, { status: memberInsuranceStatus(payload.status, coverage), coverageStatus: coverage })
    await Promise.all(previousAttachments.filter((attachment) => attachment.publicId && !attachments.some((next) => next.publicId === attachment.publicId)).map((attachment) => deleteTripImage(attachment.publicId!, 'insurance', current.value!.id)))
    ElMessage.success('保險資料已安全儲存。')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存保險資料。') } finally { savingInsurance.value = false }
}
async function removeInsurance(insurance: TravelInsurance) { try { await store.deleteInsurance(insurance); await Promise.allSettled((insurance.attachments || []).filter((attachment) => attachment.publicId).map((attachment) => deleteTripImage(attachment.publicId!, 'insurance', insurance.tripId))); ElMessage.success('保險資料已刪除。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法刪除保險資料。') } }
async function openInsuranceAttachment(attachment: import('./types').InsuranceAttachment) { if (!current.value || !currentInsurance.value) return; try { const url = await getInsuranceAttachmentUrl(attachment, current.value.id, currentInsurance.value.userId); window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法安全開啟附件。') } }
function openPaymentToolForm(tool?: PaymentTool) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看支付資訊。'); editingPaymentToolId.value = tool?.id || null; Object.assign(paymentTool, tool ? { name: tool.name, type: tool.type, issuer: tool.issuer || '', lastFourDigits: tool.lastFourDigits || '', network: tool.network || 'other', defaultCurrency: tool.defaultCurrency || current.value?.currency || 'JPY', settlementCurrency: tool.settlementCurrency || current.value?.currency || 'JPY', foreignTransactionFeeRatePercent: (tool.foreignTransactionFeeRate || 0) * 100, visibility: tool.visibility, note: tool.note || '' } : { name: '', type: 'credit_card', issuer: '', lastFourDigits: '', network: 'visa', defaultCurrency: current.value?.currency || 'JPY', settlementCurrency: current.value?.currency || 'JPY', foreignTransactionFeeRatePercent: 0, visibility: 'private', note: '' }); showPaymentTool.value = true }
async function savePaymentTool() { if (!current.value || !paymentTool.name.trim()) return ElMessage.warning('請填寫支付工具名稱。'); if (paymentTool.lastFourDigits && !/^\d{4}$/.test(paymentTool.lastFourDigits)) return ElMessage.warning('末四碼必須是 4 位數字。'); const existing = editingPaymentToolId.value ? currentPaymentTools.value.find((item) => item.id === editingPaymentToolId.value) : undefined; const ownerUserId = existing?.ownerUserId || user.value?.uid || current.value.ownerId; await store.savePaymentTool({ ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}), tripId: current.value.id, ownerUserId, type: paymentTool.type, name: paymentTool.name.trim(), issuer: paymentTool.issuer.trim() || undefined, lastFourDigits: paymentTool.lastFourDigits || undefined, network: paymentTool.network, defaultCurrency: paymentTool.defaultCurrency, settlementCurrency: paymentTool.settlementCurrency, foreignTransactionFeeRate: Math.max(0, Number(paymentTool.foreignTransactionFeeRatePercent) || 0) / 100, imageUrl: paymentToolImageUrl.value.trim() || undefined, visibility: paymentTool.visibility, isActive: existing?.isActive ?? true, note: paymentTool.note.trim() || undefined, createdBy: existing?.createdBy || ownerUserId }); showPaymentTool.value = false; ElMessage.success('支付工具已儲存。') }
async function removePaymentTool(tool: PaymentTool) { try { await ElMessageBox.confirm(`確定刪除「${tool.name}」及其回饋規則嗎？`, '刪除支付工具', { type: 'warning' }); await store.deletePaymentTool(tool); ElMessage.success('支付工具已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除支付工具。') } }
async function togglePaymentTool(tool: PaymentTool) { await store.savePaymentTool({ ...tool, isActive: !tool.isActive }); ElMessage.success(tool.isActive ? '支付工具已停用。' : '支付工具已啟用。') }
const splitRewardConditions = (value: string) => value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
function openRewardRuleForm(tool?: PaymentTool, rule?: RewardRule) { const target = tool || currentPaymentTools.value.find((item) => item.id === rule?.paymentToolId); if (!target) return ElMessage.warning('請先建立支付工具。'); editingRewardRuleId.value = rule?.id || null; Object.assign(rewardRule, rule ? { paymentToolId: rule.paymentToolId, name: rule.name, rewardType: rule.rewardType, baseRatePercent: rule.baseRate * 100, bonusRatePercent: (rule.bonusRate || 0) * 100, rewardCap: rule.rewardCap || 0, maximumEligibleSpend: rule.maximumEligibleSpend || 0, minimumSpend: rule.minimumSpend || 0, capPeriod: rule.capPeriod, periodStart: rule.periodStartAt ? new Date(rule.periodStartAt).toISOString().slice(0, 10) : '', periodEnd: rule.periodEndAt ? new Date(rule.periodEndAt).toISOString().slice(0, 10) : '', applicableCurrencies: (rule.applicableCurrencies || []).join('、'), applicableCategories: (rule.applicableCategories || []).join('、'), applicableMerchants: (rule.applicableMerchants || []).join('、'), applicablePaymentMethods: rule.applicablePaymentMethods || [], excludedCategories: (rule.excludedCategories || []).join('、'), excludedMerchants: (rule.excludedMerchants || []).join('、'), requiresRegistration: rule.requiresRegistration, registrationCompleted: Boolean(rule.registrationCompleted), priority: rule.priority, note: rule.note || '' } : { paymentToolId: target.id, name: '', rewardType: 'cashback', baseRatePercent: 0, bonusRatePercent: 0, rewardCap: 0, maximumEligibleSpend: 0, minimumSpend: 0, capPeriod: 'trip', periodStart: '', periodEnd: '', applicableCurrencies: '', applicableCategories: '', applicableMerchants: '', applicablePaymentMethods: [], excludedCategories: '', excludedMerchants: '', requiresRegistration: false, registrationCompleted: false, priority: 1, note: '' }); showRewardRule.value = true }
async function saveRewardRule() { if (!current.value || !rewardRule.paymentToolId || !rewardRule.name.trim()) return ElMessage.warning('請填寫回饋規則名稱。'); const start = rewardRule.periodStart ? new Date(`${rewardRule.periodStart}T00:00:00`).getTime() : undefined; const end = rewardRule.periodEnd ? new Date(`${rewardRule.periodEnd}T23:59:59`).getTime() : undefined; if (start && end && end < start) return ElMessage.warning('活動結束日期不得早於開始日期。'); const existing = editingRewardRuleId.value ? currentRewardRules.value.find((item) => item.id === editingRewardRuleId.value) : undefined; const baseRate = Math.max(0, Number(rewardRule.baseRatePercent) || 0) / 100; const bonusRate = Math.max(0, Number(rewardRule.bonusRatePercent) || 0) / 100; await store.saveRewardRule({ ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}), tripId: current.value.id, paymentToolId: rewardRule.paymentToolId, name: rewardRule.name.trim(), rewardType: rewardRule.rewardType, baseRate, bonusRate, totalRate: baseRate + bonusRate, rewardCap: Number(rewardRule.rewardCap) || undefined, maximumEligibleSpend: Number(rewardRule.maximumEligibleSpend) || undefined, minimumSpend: Number(rewardRule.minimumSpend) || undefined, applicableCurrencies: splitRewardConditions(rewardRule.applicableCurrencies), applicableCategories: splitRewardConditions(rewardRule.applicableCategories), applicableMerchants: splitRewardConditions(rewardRule.applicableMerchants), applicablePaymentMethods: rewardRule.applicablePaymentMethods, excludedCategories: splitRewardConditions(rewardRule.excludedCategories), excludedMerchants: splitRewardConditions(rewardRule.excludedMerchants), capPeriod: rewardRule.capPeriod, periodStartAt: start, periodEndAt: end, requiresRegistration: rewardRule.requiresRegistration, registrationCompleted: rewardRule.registrationCompleted, priority: Number(rewardRule.priority) || 1, isActive: existing?.isActive ?? true, note: rewardRule.note.trim() || undefined, createdBy: existing?.createdBy || user.value?.uid || current.value.ownerId }); showRewardRule.value = false; ElMessage.success('回饋規則已儲存。') }
async function removeRewardRule(rule: RewardRule) { try { await ElMessageBox.confirm(`確定刪除規則「${rule.name}」嗎？`, '刪除回饋規則', { type: 'warning' }); await store.deleteRewardRule(rule); ElMessage.success('回饋規則已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除回饋規則。') } }
function openPaymentTransactionForm(tool?: PaymentTool, transaction?: PaymentTransaction) { const target = tool || currentPaymentTools.value.find((item) => item.id === transaction?.paymentToolId) || currentPaymentTools.value.find((item) => item.ownerUserId === user.value?.uid); if (!target) return ElMessage.warning('請先建立自己的支付工具。'); editingPaymentTransactionId.value = transaction?.id || null; Object.assign(paymentTransaction, transaction ? { paymentToolId: transaction.paymentToolId, title: transaction.title, merchant: transaction.merchant || '', category: transaction.category || '購物', transactionDate: transaction.transactionDate, transactionTime: transaction.transactionTime || '', paymentMethod: transaction.paymentMethod || 'physical_card', originalAmount: transaction.originalAmount, originalCurrency: transaction.originalCurrency, exchangeRate: transaction.exchangeRate || 1, transactionType: transaction.transactionType, status: transaction.status, refundedAmount: transaction.refundedAmount || 0, note: transaction.note || '', syncExpense: false } : { paymentToolId: target.id, title: '', merchant: '', category: '購物', transactionDate: localDate(), transactionTime: '', paymentMethod: 'physical_card', originalAmount: 0, originalCurrency: target.defaultCurrency || current.value?.currency || 'JPY', exchangeRate: 1, transactionType: 'purchase', status: 'posted', refundedAmount: 0, note: '', syncExpense: false }); showPaymentTransaction.value = true }
async function savePaymentTransaction() { if (!current.value || !paymentTransaction.paymentToolId || !paymentTransaction.title.trim() || Number(paymentTransaction.originalAmount) <= 0 || !paymentTransaction.transactionDate) return ElMessage.warning('請填寫付款工具、消費名稱、金額與日期。'); if (Number(paymentTransaction.exchangeRate) <= 0) return ElMessage.warning('匯率必須大於 0。'); const tool = currentPaymentTools.value.find((item) => item.id === paymentTransaction.paymentToolId); if (!tool) return; const existing = editingPaymentTransactionId.value ? currentPaymentTransactions.value.find((item) => item.id === editingPaymentTransactionId.value) : undefined; const convertedAmount = Number(paymentTransaction.originalAmount) * Number(paymentTransaction.exchangeRate); const input = { amount: convertedAmount, date: paymentTransaction.transactionDate, currency: paymentTransaction.originalCurrency, category: paymentTransaction.category, merchant: paymentTransaction.merchant, paymentMethod: paymentTransaction.paymentMethod }; const rule = selectApplicableRule(currentRewardRules.value.filter((item) => item.paymentToolId === tool.id), input); const usage = rule ? rewardUsage(rule, currentPaymentTransactions.value.filter((transaction) => transaction.id !== existing?.id), new Date(`${paymentTransaction.transactionDate}T12:00:00`).getTime()) : undefined; const calculation = calculateTransactionReward({ amount: convertedAmount, rate: rule?.totalRate || 0, feeRate: tool.foreignTransactionFeeRate, refundedAmount: Number(paymentTransaction.refundedAmount) || 0, maximumEligibleAmount: usage?.remainingEligibleSpend, maximumRewardAmount: usage?.remainingRewardCap }); let expenseId = existing?.expenseId || ''; if (paymentTransaction.syncExpense && !expenseId && paymentTransaction.transactionType === 'purchase') { const expense = await store.addExpense({ tripId: current.value.id, title: paymentTransaction.title.trim(), amount: convertedAmount, payerId: tool.ownerUserId, kind: 'personal', participantIds: [tool.ownerUserId], splitMode: 'equal', shares: {}, category: paymentTransaction.category, date: paymentTransaction.transactionDate, note: paymentTransaction.note.trim() }); expenseId = expense.id } await store.savePaymentTransaction({ ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}), tripId: current.value.id, paymentToolId: tool.id, ownerUserId: tool.ownerUserId, title: paymentTransaction.title.trim(), merchant: paymentTransaction.merchant.trim() || undefined, category: paymentTransaction.category.trim() || undefined, transactionDate: paymentTransaction.transactionDate, transactionTime: paymentTransaction.transactionTime || undefined, transactionType: paymentTransaction.transactionType, status: paymentTransaction.status, paymentMethod: paymentTransaction.paymentMethod, originalAmount: Number(paymentTransaction.originalAmount), originalCurrency: paymentTransaction.originalCurrency, exchangeRate: Number(paymentTransaction.exchangeRate), convertedAmount, settlementCurrency: tool.settlementCurrency || current.value.currency, foreignTransactionFeeRate: tool.foreignTransactionFeeRate || 0, foreignTransactionFee: calculation.foreignTransactionFee, eligibleAmount: calculation.eligibleAmount, appliedRewardRuleId: rule?.id, estimatedRewardRate: rule?.totalRate || 0, estimatedRewardAmount: calculation.estimatedRewardAmount, estimatedNetRewardAmount: calculation.estimatedNetRewardAmount, estimatedNetRewardRate: calculation.estimatedNetRewardRate, refundedAmount: Number(paymentTransaction.refundedAmount) || undefined, expenseId: expenseId || undefined, note: paymentTransaction.note.trim() || undefined, createdBy: existing?.createdBy || user.value?.uid || current.value.ownerId }); showPaymentTransaction.value = false; ElMessage.success('付款紀錄已儲存。') }
async function removePaymentTransaction(transaction: PaymentTransaction) { try { await ElMessageBox.confirm(`確定刪除「${transaction.title}」嗎？關聯開銷不會自動刪除。`, '刪除付款紀錄', { type: 'warning' }); await store.deletePaymentTransaction(transaction); ElMessage.success('付款紀錄已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除付款紀錄。') } }
function openStoredBalanceForm(tool: PaymentTool) { balanceToolId.value = tool.id; const balance = currentStoredBalances.value.find((item) => item.paymentToolId === tool.id); storedBalance.initialBalance = balance?.initialBalance || 0; storedBalance.currency = balance?.currency || tool.defaultCurrency || current.value?.currency || 'JPY'; showStoredBalance.value = true }
async function saveStoredBalance() { const tool = currentPaymentTools.value.find((item) => item.id === balanceToolId.value); if (!tool) return; const balance = storedValueBalance(tool, currentPaymentTransactions.value, Number(storedBalance.initialBalance) || 0); balance.currency = storedBalance.currency; await store.saveStoredValueBalance(balance); showStoredBalance.value = false; ElMessage.success('儲值工具餘額已更新。') }
async function copyInvite() { await navigator.clipboard.writeText(current.value?.inviteCode || ''); ElMessage.success('邀請碼已複製。') }
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
<TripItineraryView v-if="activeTripTab === 'overview' || activeTripTab === 'itinerary'" :days="itineraryDays" :personal-items="currentPersonalItems" :shopping-items="currentShoppingItems" :can-edit="canEditTrip" :sorting-enabled="itinerarySortingEnabled" :format-date="formatItineraryDate" :duration="itineraryDuration" :time-warning="itineraryTimeWarning" :maps-url="mapsUrl" @add="openNewItemForm" @add-after="openItemFormAfter" @add-personal="openPersonalItemForm" @toggle="toggleItinerary" @edit="openItemFormForEdit" @remove="removeItem" @create-group="openItineraryGroupForm($event.entries)" @edit-group="openItineraryGroupForm([], $event)" @dissolve-group="dissolveItineraryGroup" @toggle-sorting="toggleItinerarySorting" @sort="sortItineraryItems" @sort-group="sortGroupItineraryItems" @sort-personal="sortPersonalItineraryItems" @move="moveItineraryItem" />
        <TripMapView v-if="activeTripTab === 'map'" :days="itineraryDays" :format-date="formatItineraryDate" :maps-url="mapsUrl" />
        <TripExpensesView v-if="activeTripTab === 'overview' || activeTripTab === 'expenses'" :trip="current" :expenses="currentExpenses" :total="total" :my-paid="myPaid" :my-balance="myBalance" :personal-budget="personalBudget" :personal-spent="myExpense" :category-budgets="categoryBudgetSummary" :daily-budget="dailyBudget" :daily-expenses="dailyExpenseSummary" :can-set-personal-budget="Boolean(activeMemberId)" :can-manage-category-budgets="canEditTripSettings" :can-edit="canEditTrip" :payer-label="expensePayerLabel" :split-label="expenseSplitLabel" :participant-count="expenseParticipantCount" :share="expenseShare" @add="openExpenseForm()" @set-personal-budget="openPersonalBudgetForm" @manage-category-budgets="openCategoryBudgetForm" @manage-daily-budget="openDailyBudgetForm" @edit="openExpenseForm" @remove="removeExpense" />
        <TripTodosView v-if="activeTripTab === 'todos'" :trip="current" :todos="currentTodos" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" />
        <TripPackingView v-if="activeTripTab === 'packing'" :trip="current" :items="currentPackingItems" :can-edit="canEditTrip" :sorting-enabled="packingSortingEnabled" :member-name="memberName" @add="openPackingForm()" @toggle="togglePackingItem" @toggle-sorting="togglePackingSorting" @sort="sortPackingItems" @edit="openPackingForm" @remove="removePackingItem" />
        <TripBookingsView v-if="activeTripTab === 'bookings'" :trip="current" :bookings="currentBookings" :can-edit="canEditTrip" :user-id="user?.uid || current.ownerId" :member-name="memberName" />
        <TripFavoritesView v-if="activeTripTab === 'favorites'" :trip="current" :favorites="favoritesWithItineraryStatus" :currency="current.currency" :can-edit="canEditTrip" :sorting-enabled="favoriteSortingEnabled" :member-name="memberName" @add="openFavoriteForm()" @toggle-sorting="toggleFavoriteSorting" @sort="sortFavorites" @edit="openFavoriteForm" @duplicate="duplicateFavorite" @remove="removeFavorite" @add-to-itinerary="addFavoriteToItinerary" />
        <TripAlbumView v-if="activeTripTab === 'album'" :trip="current" :photos="currentAlbumPhotos" :can-edit="canEditTrip" :member-name="memberName" :format-date="formatTripDate" @add="openAlbumForm()" @edit="openAlbumForm" @remove="removeAlbumPhoto" />
        <TripShoppingView v-if="activeTripTab === 'shopping'" :trip="current" :items="currentShoppingItems" :can-edit="canEditTrip" :member-name="memberName" @add="openShoppingForm()" @edit="openShoppingForm" @duplicate="duplicateShoppingItem" @remove="removeShoppingItem" @status="updateShoppingStatus" @convert="convertShoppingToExpense" @batch-link="openBatchShoppingItineraryPicker($event)" />
        <TripPaymentsView v-if="activeTripTab === 'payments'" :trip="current" :tools="currentPaymentTools" :rules="currentRewardRules" :transactions="currentPaymentTransactions" :balances="currentStoredBalances" :summaries="currentPaymentToolSummaries" :user-id="user?.uid || current.ownerId" :can-edit="canEditTrip" :member-name="memberName" @add-tool="openPaymentToolForm()" @edit-tool="openPaymentToolForm" @remove-tool="removePaymentTool" @toggle-tool="togglePaymentTool" @add-rule="openRewardRuleForm" @edit-rule="openRewardRuleForm(undefined, $event)" @remove-rule="removeRewardRule" @add-transaction="openPaymentTransactionForm" @edit-transaction="openPaymentTransactionForm(undefined, $event)" @remove-transaction="removePaymentTransaction" @manage-balance="openStoredBalanceForm" />
        <TripInsuranceView v-if="activeTripTab === 'insurance'" :trip="current" :insurance="currentInsurance" :statuses="currentInsuranceStatuses" :user-id="user?.uid || current.ownerId" :member-name="memberName" :can-edit="canEditTrip" :saving="savingInsurance" @save="saveInsurance" @remove="removeInsurance" @open-attachment="openInsuranceAttachment" />
        <TripMembersView v-if="activeTripTab === 'overview' || activeTripTab === 'members'" :trip="current" :balances="balances" :suggestions="settlementSuggestions" :settlements="currentSettlements" :can-manage="canManageMembers" :can-edit="canEditTrip" :open-member-manager="openMemberManager" :member-paid="memberPaid" :member-name="memberName" @copy-invite="copyInvite" @settle="confirmSettlement" @undo-settlement="removeSettlement" />
      </div>
    </section>
  </main>
  <el-dialog v-model="showJoin" title="使用邀請碼加入旅行" width="min(92vw, 430px)">
<p class="muted">請向旅行建立者索取邀請碼。加入前需先完成登入。</p>
<el-input v-model="invite.code" placeholder="例如：AB12CD" maxlength="12" />
<template #footer>
<el-button @click="showJoin=false">取消</el-button>
<el-button type="primary" @click="joinTrip">加入旅行</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showCreate" title="建立旅行" width="min(92vw, 560px)">
<el-form label-position="top">
<el-form-item label="旅行名稱">
<el-input v-model="create.name" placeholder="例如：東京楓葉散策" />
</el-form-item>
<div class="two-col">
<el-form-item label="國家">
<el-input v-model="create.country" />
</el-form-item>
<el-form-item label="城市">
<el-input v-model="create.city" />
</el-form-item>
</div>
<div class="two-col">
<el-form-item label="開始日期">
<el-date-picker v-model="create.startDate" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
<el-form-item label="結束日期">
<el-date-picker v-model="create.endDate" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
</div>
<div class="two-col">
<el-form-item label="幣別">
<el-select v-model="create.currency">
<el-option label="JPY" value="JPY" />
<el-option label="TWD" value="TWD" />
<el-option label="USD" value="USD" />
</el-select>
</el-form-item>
<el-form-item label="總預算">
<el-input-number v-model="create.budget" :min="0" />
</el-form-item>
</div>
<el-form-item label="旅行封面（Cloudinary 簽名上傳）">
<input type="file" accept="image/*" @change="coverFile = ($event.target as HTMLInputElement).files?.[0]" />
<small>未設定簽名服務時可先略過；Cloudinary API Secret 永不會出現在前端。</small>
</el-form-item>
</el-form>
<template #footer>
<el-button @click="showCreate=false">取消</el-button>
<el-button type="primary" @click="createTrip">建立旅行</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showEdit" title="編輯旅行" width="min(92vw, 560px)">
<el-form label-position="top">
<el-form-item label="旅行名稱">
<el-input v-model="edit.name" />
</el-form-item>
<div class="two-col">
<el-form-item label="國家">
<el-input v-model="edit.country" />
</el-form-item>
<el-form-item label="城市">
<el-input v-model="edit.city" />
</el-form-item>
</div>
<div class="two-col">
<el-form-item label="開始日期">
<el-date-picker v-model="edit.startDate" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
<el-form-item label="結束日期">
<el-date-picker v-model="edit.endDate" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
</div>
<div class="two-col">
<el-form-item label="幣別">
<el-select v-model="edit.currency">
<el-option label="JPY" value="JPY" />
<el-option label="TWD" value="TWD" />
<el-option label="USD" value="USD" />
</el-select>
</el-form-item>
<el-form-item label="總預算">
<el-input-number v-model="edit.budget" :min="0" />
</el-form-item>
</div>
<el-form-item label="旅行封面">
<div class="edit-cover-control">
<img v-if="editCoverPreview || edit.coverUrl" :src="editCoverPreview || edit.coverUrl" alt="旅行封面預覽" />
<div v-else class="edit-cover-placeholder" aria-hidden="true">✦</div>
<div class="edit-cover-actions"><label class="edit-cover-file-button" for="edit-cover-file">{{ editCoverPreview || edit.coverUrl ? '更換照片' : '上傳照片' }}</label><input id="edit-cover-file" type="file" accept="image/*" @change="selectEditCover" /><el-button v-if="editCoverPreview || edit.coverUrl" class="edit-cover-remove-button" text @click="removeEditCover">移除封面</el-button><small>支援圖片檔；儲存變更時才會上傳。</small></div>
</div>
</el-form-item>
</el-form>
<template #footer>
<el-button type="danger" plain :disabled="savingTrip" @click="removeTrip">刪除旅行</el-button>
<el-button :disabled="savingTrip" @click="showEdit=false">取消</el-button>
<el-button type="primary" :loading="savingTrip" :disabled="savingTrip" @click="saveTrip">儲存變更</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showMember" title="成員管理" class="member-manager-dialog" width="min(92vw, 560px)">
<section class="member-manager-current" aria-labelledby="current-members-title">
<div class="member-manager-section-heading"><div><p>目前成員</p><h3 id="current-members-title">{{ current?.members.length || 0 }} 位旅伴</h3></div><span>旅行建立者可邀請或移除成員</span></div>
<div class="member-manager-list">
<article v-for="currentMemberEntry in current?.members" :key="currentMemberEntry.id" class="member-manager-row">
<span class="member-manager-avatar" aria-hidden="true">{{ currentMemberEntry.name.slice(0, 1) }}</span>
<div class="member-manager-copy"><strong>{{ currentMemberEntry.name }}</strong><span>{{ currentMemberEntry.email }}</span></div>
<span class="member-manager-role" :class="`is-${currentMemberEntry.role}`">{{ currentMemberEntry.role === 'owner' ? '建立者' : currentMemberEntry.role === 'editor' ? '可編輯' : '唯讀' }}</span>
<el-tooltip v-if="currentMemberEntry.id !== current?.ownerId" content="移除成員" placement="top"><el-button class="member-remove-button" text circle :aria-label="`移除 ${currentMemberEntry.name}`" @click="removeMember(currentMemberEntry)">×</el-button></el-tooltip>
</article>
</div>
</section>
<el-divider />
<section class="member-manager-invite" aria-labelledby="invite-member-title">
<div><p>邀請旅伴</p><h3 id="invite-member-title">新增旅行成員</h3><span>對方需先使用此 Email 登入 TripMate。</span></div>
<el-form label-position="top">
<div class="member-manager-form-grid"><el-form-item label="名稱"><el-input v-model="member.name" autocomplete="name" /></el-form-item><el-form-item label="Email"><el-input v-model="member.email" autocomplete="email" /></el-form-item></div>
<el-form-item label="權限"><el-select v-model="member.role"><el-option label="Editor — 可共同編輯" value="editor" /><el-option label="Viewer — 僅能查看" value="viewer" /></el-select></el-form-item>
<el-button class="member-invite-button" type="primary" @click="addMember">邀請加入</el-button>
</el-form>
</section>
<template #footer><el-button @click="showMember=false">完成</el-button></template>
</el-dialog>
<el-dialog v-model="showItem" :title="editingItemId ? `編輯${itemActivityKind === 'free' ? '自由活動' : itemActivityKind === 'personal' ? '我的行程' : '行程'}` : itemActivityKind === 'personal' ? '新增我的行程' : '新增行程'" class="itinerary-dialog" width="min(92vw, 520px)">
<el-form class="itinerary-form" label-position="top">
<el-form-item v-if="!editingItemId && itemActivityKind !== 'personal'" label="行程安排方式">
<el-radio-group v-model="itemActivityKind" class="itinerary-activity-kind"><el-radio-button label="shared">共用行程</el-radio-button><el-radio-button label="free">自由活動</el-radio-button></el-radio-group>
<small>{{ itemActivityKind === 'free' ? '自由活動會建立一張所有旅伴都看得到的群組卡片；每位旅伴可在其中安排自己的個人行程。' : '共用行程會顯示給所有旅伴，並可從旅遊收藏快速帶入。' }}</small>
</el-form-item>
<el-form-item v-if="currentFavorites.length && itemActivityKind !== 'free'" label="從旅遊收藏快速帶入">
<div class="itinerary-favorite-picker-control"><div class="itinerary-favorite-picker-copy"><strong>{{ itemFavoriteId ? '已選擇旅遊收藏' : '尚未選擇收藏' }}</strong><span>{{ itemFavoriteId ? (currentFavorites.find((entry) => entry.id === itemFavoriteId)?.name || '已選擇項目') : '可從收藏清單帶入名稱、類型、地點與圖片' }}</span></div><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker">{{ itemFavoriteId ? '更換收藏' : '選擇收藏' }}</el-button></div>
<small>{{ itemActivityKind === 'personal' ? '會帶入收藏的名稱、地點、Google Maps 與圖片；日期已依自由活動群組設定。' : '日期與時間不會自動設定，請依實際行程選擇。' }}</small>
</el-form-item>
<el-form-item :label="itemActivityKind === 'free' ? '自由活動名稱' : '行程名稱'">
<el-input v-model="item.title" :placeholder="itemActivityKind === 'free' ? '例如：下午自由活動、分組逛街' : itemActivityKind === 'personal' ? '例如：前往秋葉原' : ''" />
</el-form-item>
<el-form-item v-if="itemActivityKind !== 'personal'" label="日期">
<el-date-picker v-model="item.date" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" />
</el-form-item>
<el-form-item v-if="itemActivityKind === 'shared' && itineraryGroupsForItem.length" label="加入地點群組（選填）"><el-select v-model="itemItineraryGroupId" clearable placeholder="不加入群組"><el-option v-for="group in itineraryGroupsForItem" :key="group.id" :label="`${group.title}・${group.location || '未設定區域'}`" :value="group.id" /></el-select><small>可將這筆行程加入當日既有群組；留白則維持一般共用行程。</small></el-form-item>
<div class="itinerary-time-grid">
<el-form-item label="開始時間">
<el-time-picker v-model="item.time" value-format="HH:mm" format="HH:mm" placeholder="選擇開始時間" />
</el-form-item>
<el-form-item label="結束時間">
<el-time-picker v-model="item.endTime" value-format="HH:mm" format="HH:mm" placeholder="選擇結束時間（選填）" />
</el-form-item>
</div>
<el-form-item v-if="itemActivityKind !== 'free'" label="類型">
<el-select v-model="item.type">
<el-option label="景點" value="景點" />
<el-option label="餐廳" value="餐廳" />
<el-option label="交通" value="交通" />
<el-option label="住宿" value="住宿" />
<el-option label="商店" value="商店" />
</el-select>
</el-form-item>
<el-form-item v-if="itemActivityKind !== 'free' && item.type === '交通'" label="抵達站／目的地（選填）">
<div class="itinerary-favorite-picker-control transport-destination-control"><div class="itinerary-favorite-picker-copy"><strong>{{ item.transportDestinationName || '尚未選擇抵達站' }}</strong><span>{{ item.transportDestinationLocation || (item.transportDestinationMapUrl ? '已設定 Google Maps 連結' : '從旅遊收藏選擇下車站或目的地') }}</span></div><div class="transport-destination-actions"><el-button v-if="item.transportDestinationName" text class="transport-destination-clear" aria-label="清除抵達站" @click="Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' })">清除</el-button><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker('destination')">{{ item.transportDestinationName ? '更換抵達站' : '選擇抵達站' }}</el-button></div></div>
<small>可選交通站、景點、住宿等任何收藏項目；設定後行程卡片會顯示出發站 → 抵達站。</small>
</el-form-item>
<el-form-item v-if="itemActivityKind !== 'free'" label="Google Maps 景點網址（選填）">
<el-input v-model="item.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" />
<small>行程卡片會直接開啟此景點；既有的地點文字資料會保留。</small>
</el-form-item>
<el-form-item v-if="itemActivityKind !== 'free'" label="行程圖片網址（選填）">
<el-input v-model="item.imageUrl" placeholder="貼上圖片網址，例如 https://..." />
<div v-if="item.imageUrl" class="itinerary-form-image-preview"><img :src="item.imageUrl" alt="行程圖片預覽" /><div><strong>行程圖片預覽</strong><span>從旅遊收藏帶入或使用此網址顯示</span></div></div>
<small>圖片會以縮圖顯示在每日行程卡片；從旅遊收藏帶入時會自動填入。</small>
</el-form-item>
<el-form-item label="備註（選填）">
<el-input v-model="item.note" type="textarea" :rows="3" maxlength="240" show-word-limit placeholder="例如：預約資訊、集合地點或注意事項" />
</el-form-item>
</el-form>
<template #footer>
<el-button @click="showItem=false">取消</el-button>
<el-button type="primary" @click="saveItem">儲存行程</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showItineraryGroup" :title="editingItineraryGroupId ? '編輯地點群組' : '建立地點群組'" width="min(92vw, 560px)">
<el-form label-position="top"><div class="two-col"><el-form-item label="群組名稱"><el-input v-model="itineraryGroup.title" placeholder="例如：築地市場探索" /></el-form-item><el-form-item label="區域／地點"><el-input v-model="itineraryGroup.location" placeholder="例如：築地市場" /></el-form-item></div><div class="three-col"><el-form-item label="日期"><el-date-picker v-model="itineraryGroup.date" type="date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="固定開始時間（選填）"><el-time-picker v-model="itineraryGroup.time" value-format="HH:mm" format="HH:mm" placeholder="未排時間" /></el-form-item><el-form-item label="結束時間（選填）"><el-time-picker v-model="itineraryGroup.endTime" value-format="HH:mm" format="HH:mm" placeholder="選填" /></el-form-item></div><el-form-item label="Google Maps 區域連結（選填）"><el-input v-model="itineraryGroup.mapUrl" placeholder="貼上 Google Maps 區域或地點網址" /></el-form-item><el-form-item label="群組備註（選填）"><el-input v-model="itineraryGroup.note" type="textarea" :rows="2" maxlength="200" show-word-limit /></el-form-item><el-form-item label="群組內行程"><el-checkbox-group v-model="itineraryGroupMemberIds" class="itinerary-group-member-selector"><el-checkbox v-for="entry in currentItems.filter((entry) => entry.date === itineraryGroup.date && (entry.activityKind || 'shared') === 'shared')" :key="entry.id" :label="entry.id">{{ entry.title }}<small>{{ entry.time || '未排時間' }}・{{ entry.type }}</small></el-checkbox></el-checkbox-group><small>可勾選或取消行程，儲存後會移入或移出這個群組。</small></el-form-item></el-form>
<template #footer><el-button @click="showItineraryGroup=false">取消</el-button><el-button type="primary" @click="saveItineraryGroup">儲存群組</el-button></template>
  </el-dialog>
  <el-dialog v-model="showFavoritePicker" :title="favoritePickerTarget === 'destination' ? '選擇抵達站／目的地' : '選擇旅遊收藏'" class="favorite-picker-dialog" width="min(92vw, 660px)" append-to-body>
<div class="favorite-picker-toolbar"><el-input v-model="favoritePickerSearch" clearable placeholder="搜尋收藏名稱、地點或備註" aria-label="搜尋旅遊收藏" /><div class="favorite-picker-filters" role="group" aria-label="篩選收藏類型"><el-button v-for="option in favoritePickerOptions" :key="option.value" class="favorite-picker-filter" :class="[{ 'is-active': favoritePickerType === option.value }, option.value === 'all' ? '' : `type-${option.value}`]" :aria-pressed="favoritePickerType === option.value" @click="favoritePickerType = option.value">{{ option.label }}<small>{{ option.value === 'all' ? currentFavorites.length : currentFavorites.filter((entry) => normalizeFavoriteType(entry.type) === option.value).length }}</small></el-button></div></div>
<div v-if="filteredFavoritesForPicker.length" class="favorite-picker-list"><button v-for="savedFavorite in filteredFavoritesForPicker" :key="savedFavorite.id" type="button" class="favorite-picker-row" :class="{ 'is-selected': favoritePickerTarget === 'destination' ? item.transportDestinationFavoriteId === savedFavorite.id : itemFavoriteId === savedFavorite.id }" @click="selectFavoriteForItem(savedFavorite.id)"><img v-if="savedFavorite.imageUrl" :src="savedFavorite.imageUrl" :alt="`${savedFavorite.name} 圖片`" /><span v-else class="favorite-picker-placeholder">{{ favoriteTypeLabel(savedFavorite.type).slice(0, 1) }}</span><span class="favorite-picker-row-copy"><strong>{{ savedFavorite.name }}</strong><span class="favorite-picker-type" :class="`type-${normalizeFavoriteType(savedFavorite.type)}`">{{ favoriteTypeLabel(savedFavorite.type) }}</span><small v-if="savedFavorite.location">{{ savedFavorite.location }}</small><small v-else-if="savedFavorite.mapUrl" class="favorite-picker-map-status">已設定 Google Maps 連結</small><small v-else>未填寫地點名稱或地圖連結</small></span><span class="favorite-picker-select">{{ favoritePickerTarget === 'destination' ? '設為抵達站' : '帶入' }}</span></button></div>
<div v-else class="favorite-picker-empty"><strong>找不到符合的收藏</strong><p>試試其他關鍵字或類別。</p></div>
<template #footer><el-button @click="showFavoritePicker=false">取消</el-button></template>
</el-dialog>
  <el-dialog v-model="showExpense" :title="editingExpenseId ? '編輯支出' : '新增支出'" width="min(92vw, 460px)">
<el-form label-position="top">
<el-form-item label="項目">
<el-input v-model="expense.title" />
</el-form-item>
<div class="two-col">
<el-form-item label="金額">
<el-input-number v-model="expense.amount" :min="0" />
<small>以旅行幣別 {{ current?.currency }} 記帳與結算。</small>
</el-form-item>
<el-form-item label="日期">
<el-date-picker v-model="expense.date" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
</div>
<div class="three-col expense-source-fields">
<el-form-item label="原始幣別（選填）"><el-input v-model="expenseSourceCurrency" placeholder="例如：JPY" maxlength="8" /></el-form-item>
<el-form-item label="原始金額（選填）"><el-input-number v-model="expenseSourceAmount" :min="0" :precision="2" controls-position="right" /></el-form-item>
<el-form-item label="換算匯率（選填）"><el-input-number v-model="expenseExchangeRate" :min="0" :precision="6" controls-position="right" /></el-form-item>
</div>
<p class="expense-source-hint">原始幣別資訊僅供查閱；結算固定使用上方 {{ current?.currency }} 金額。換算匯率表示 1 原始幣別可換得多少旅行幣別。</p>
<el-form-item label="付款人">
<el-select v-model="expensePayerIds" multiple collapse-tags collapse-tags-tooltip placeholder="選擇付款旅伴" @change="syncExpensePayers">
<el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" />
</el-select>
<small>{{ expense.kind === 'shared' ? '可選擇多位付款人；多人付款時請填寫每位實際付款金額。' : '個人支出只能選擇一位付款人。' }}</small>
</el-form-item>
<el-form-item v-if="expensePayerIds.length" :label="expensePayerIds.length > 1 ? '各自付款金額' : '付款金額'">
<div class="custom-shares">
<div v-for="memberId in expensePayerIds" :key="memberId"><span>{{ expensePayerName(memberId) }}</span><el-input-number v-model="expensePayerShares[memberId]" :min="0" :precision="2" controls-position="right" /></div>
</div>
<small :class="{ 'share-total-error': Math.abs(payerTotal - expense.amount) > .01 }">付款合計 {{ payerTotal.toFixed(2) }}／支出 {{ expense.amount.toFixed(2) }}</small>
</el-form-item>
<div class="two-col">
<el-form-item label="類型">
<el-select v-model="expense.kind" @change="syncExpenseParticipants">
<el-option label="共同分攤" value="shared" />
<el-option label="個人支出" value="personal" />
</el-select>
</el-form-item>
<el-form-item label="分類">
<el-select v-model="expense.category">
<el-option label="餐飲" value="餐飲" />
<el-option label="交通" value="交通" />
<el-option label="住宿" value="住宿" />
<el-option label="購物" value="購物" />
</el-select>
</el-form-item>
</div>
<el-form-item v-if="expense.kind === 'shared'" label="分攤方式">
<el-radio-group v-model="expense.splitMode" @change="resetExpenseSplitValues()">
<el-radio value="equal">平均分攤</el-radio>
<el-radio value="custom">自訂金額</el-radio>
<el-radio value="ratio">比例分攤</el-radio>
<el-radio value="shares">份數分攤</el-radio>
</el-radio-group>
</el-form-item>
<el-form-item v-if="expense.kind === 'shared'" label="分攤成員">
<el-checkbox-group v-model="expenseParticipantIds" class="expense-participants" @change="syncExpenseParticipants">
<el-checkbox v-for="m in current?.members" :key="m.id" :label="m.id">{{ m.name }}</el-checkbox>
</el-checkbox-group>
<small>{{ expense.splitMode === 'custom' ? '請為每位已選成員填入分攤金額。' : expense.splitMode === 'ratio' ? '輸入每位旅伴的百分比，合計必須為 100%。' : expense.splitMode === 'shares' ? '輸入每位旅伴的份數，例如 2、1、1。' : '將由已選成員平均分攤本筆支出。' }}</small>
</el-form-item>
<el-form-item v-if="expense.kind === 'shared' && expense.splitMode === 'custom'" label="各自分攤金額">
<div class="custom-shares">
<div v-for="memberId in expenseParticipantIds" :key="memberId"><span>{{ expensePayerName(memberId) }}</span><el-input-number v-model="expenseShares[memberId]" :min="0" :precision="2" controls-position="right" /></div>
</div>
<small :class="{ 'share-total-error': Math.abs(customShareTotal - expense.amount) > .01 }">合計 {{ customShareTotal.toFixed(2) }}／支出 {{ expense.amount.toFixed(2) }}</small>
</el-form-item>
<el-form-item v-else-if="expense.kind === 'shared' && expense.splitMode === 'ratio'" label="各自分攤比例">
<div class="custom-shares">
<div v-for="memberId in expenseParticipantIds" :key="memberId"><span>{{ expensePayerName(memberId) }}</span><el-input-number v-model="expenseRatios[memberId]" :min="0" :max="100" :precision="2" controls-position="right" /><em>%</em></div>
</div>
<small :class="{ 'share-total-error': Math.abs(ratioTotal - 100) > .01 }">合計 {{ ratioTotal.toFixed(2) }}％／必須為 100％</small>
</el-form-item>
<el-form-item v-else-if="expense.kind === 'shared' && expense.splitMode === 'shares'" label="各自分攤份數">
<div class="custom-shares">
<div v-for="memberId in expenseParticipantIds" :key="memberId"><span>{{ expensePayerName(memberId) }}</span><el-input-number v-model="expenseSplitUnits[memberId]" :min="0" :precision="2" controls-position="right" /><em>份</em></div>
</div>
<small :class="{ 'share-total-error': splitUnitTotal <= 0 }">總份數 {{ splitUnitTotal.toFixed(2) }}；系統將依份數比例計算每人應付。</small>
</el-form-item>
<el-form-item v-else label="分攤成員">
<el-input :model-value="expensePayerName(expense.payerId)" disabled />
<small>個人支出僅計入付款人，不會影響其他成員結算。</small>
</el-form-item>
<el-form-item label="收據／付款證明（選填）">
<div class="expense-receipt-field">
<input type="file" accept="image/*" aria-label="上傳收據或付款證明圖片" @change="selectExpenseReceipt" />
<div v-if="expenseReceiptPreview || expenseReceiptUrl" class="expense-receipt-preview"><img :src="expenseReceiptPreview || expenseReceiptUrl" alt="收據預覽" /><el-button text type="danger" @click="removeExpenseReceipt">移除圖片</el-button></div>
</div>
<small>支援圖片格式；收據會安全儲存於本旅行的檔案空間。</small>
</el-form-item>
<el-form-item label="備註（選填）"><el-input v-model="expenseNote" type="textarea" :rows="2" maxlength="240" show-word-limit placeholder="例如：付款方式、訂單編號或匯率來源" /></el-form-item>
</el-form>
<template #footer>
<el-button @click="showExpense=false">取消</el-button>
<el-button type="primary" :loading="savingExpense" @click="saveExpense">儲存支出</el-button>
</template>
   </el-dialog>
  <el-dialog v-model="showPacking" :title="editingPackingId ? '編輯行李物品' : '新增行李物品'" width="min(92vw, 500px)">
<el-form label-position="top">
<el-form-item label="物品名稱"><el-input v-model="packing.name" placeholder="例如：行動電源" /></el-form-item>
<div class="two-col"><el-form-item label="分類"><el-select v-model="packing.category"><el-option label="衣物" value="衣物" /><el-option label="盥洗用品" value="盥洗用品" /><el-option label="電子用品" value="電子用品" /><el-option label="證件" value="證件" /><el-option label="藥品" value="藥品" /><el-option label="其他" value="其他" /></el-select></el-form-item><el-form-item label="數量"><el-input-number v-model="packing.quantity" :min="1" :max="99" controls-position="right" /></el-form-item></div>
<el-form-item label="物品類型"><el-radio-group v-model="packing.isShared"><el-radio :value="false">個人物品</el-radio><el-radio :value="true">共用物品</el-radio></el-radio-group><small>{{ packing.isShared ? '共用物品會顯示在全體旅伴一起準備的清單。' : '個人物品可指定一位負責旅伴。' }}</small></el-form-item>
<el-form-item :label="packing.isShared ? '負責旅伴（選填）' : '負責旅伴（選填）'"><el-select v-model="packing.assignedTo" clearable placeholder="尚未指派"><el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item>
<el-form-item label="備註（選填）"><el-input v-model="packing.note" maxlength="80" show-word-limit /></el-form-item>
</el-form>
<template #footer><el-button @click="showPacking=false">取消</el-button><el-button type="primary" @click="savePackingItem">儲存物品</el-button></template>
  </el-dialog>
  <el-dialog v-model="showFavorite" :title="editingFavoriteId ? '編輯旅遊收藏' : '新增旅遊收藏'" width="min(92vw, 560px)">
<el-form label-position="top">
<div class="two-col favorite-audit-fields"><el-form-item label="建立人"><el-input :model-value="favoriteCreatorName" readonly aria-label="建立人" /></el-form-item><el-form-item label="修改人"><el-input :model-value="favoriteModifierName" readonly aria-label="修改人" /></el-form-item></div>
<div class="two-col"><el-form-item label="收藏類型"><el-select v-model="favorite.type"><el-option label="景點" value="attraction" /><el-option label="餐廳" value="restaurant" /><el-option label="交通" value="transport" /><el-option label="住宿" value="stay" /><el-option label="商店" value="shop" /></el-select><small>類型與每日行程一致，加入行程時會直接帶入。</small></el-form-item><el-form-item label="名稱"><el-input v-model="favorite.name" placeholder="例如：淺草寺" /></el-form-item></div>
<el-form-item label="Google Maps 景點網址（選填）"><el-input v-model="favorite.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>收藏帶入行程時，這個網址會一併帶入。</small></el-form-item>
<div class="two-col"><el-form-item label="網站（選填）"><el-input v-model="favorite.website" placeholder="https://example.com" /></el-form-item><el-form-item label="預估費用（選填）"><el-input-number v-model="favorite.estimatedCost" :min="0" :step="100" controls-position="right" /></el-form-item></div>
<div class="two-col"><el-form-item label="推薦人（選填）"><el-input v-model="favorite.recommendedBy" placeholder="例如：林恩威、旅遊文章" /></el-form-item><el-form-item label="圖片網址（選填）"><el-input v-model="favorite.imageUrl" placeholder="https://..." /></el-form-item></div>
<el-form-item label="備註（選填）"><el-input v-model="favorite.note" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="想去的原因、開放時間或注意事項" /></el-form-item>
</el-form>
<template #footer><el-button @click="showFavorite=false">取消</el-button><el-button type="primary" @click="saveFavorite">儲存收藏</el-button></template>
  </el-dialog>
  <el-dialog v-model="showAlbum" :title="editingAlbumPhotoId ? '編輯旅行相片' : '上傳旅行相片'" class="album-dialog" width="min(92vw, 520px)" @closed="resetAlbumForm">
<el-form label-position="top">
<el-form-item label="照片"><div class="album-upload-control"><img v-if="albumPreview" :src="albumPreview" alt="旅行相片預覽" /><div v-else class="album-upload-placeholder" aria-hidden="true">✦</div><div class="album-upload-actions"><label class="album-upload-file-button" for="album-photo-file">{{ albumPreview ? '更換照片' : '選擇照片' }}</label><input id="album-photo-file" type="file" accept="image/*" @change="selectAlbumPhoto" /><small>支援圖片檔，大小上限 10 MB；儲存時會安全地上傳到 Cloudinary。</small></div></div></el-form-item>
<div class="two-col"><el-form-item label="旅行日期（選填）"><el-date-picker v-model="album.tripDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇拍攝日期" /></el-form-item><el-form-item label="關聯行程（選填）"><el-select v-model="album.itineraryItemId" clearable placeholder="選擇行程"><el-option v-for="entry in currentItems" :key="entry.id" :label="`${entry.date}・${entry.title}`" :value="entry.id" /></el-select></el-form-item></div>
<el-form-item label="相片說明（選填）"><el-input v-model="album.caption" type="textarea" :rows="3" maxlength="160" show-word-limit placeholder="例如：淺草寺傍晚的天空" /></el-form-item>
</el-form>
<template #footer><el-button :disabled="savingAlbum" @click="showAlbum=false">取消</el-button><el-button type="primary" :loading="savingAlbum" :disabled="savingAlbum" @click="saveAlbumPhoto">{{ editingAlbumPhotoId ? '儲存變更' : '上傳照片' }}</el-button></template>
  </el-dialog>
  <el-dialog v-model="showShopping" :title="editingShoppingId ? '編輯購物項目' : '新增購物項目'" class="shopping-dialog" width="min(92vw, 640px)" @closed="resetShoppingForm">
<el-form label-position="top">
<el-form-item label="商品圖片（選填）"><div class="shopping-upload-control"><img v-if="shoppingImageDisplay" :src="shoppingImageDisplay" alt="商品圖片預覽" /><div v-else class="shopping-upload-placeholder" aria-hidden="true">✦</div><div class="shopping-upload-actions"><label class="shopping-upload-file-button" for="shopping-image-file">{{ shoppingImageDisplay ? '更換圖片' : '選擇圖片' }}</label><input id="shopping-image-file" type="file" accept="image/*" @change="selectShoppingImage" /><small>可上傳圖片檔（上限 10 MB），儲存時會上傳到 Cloudinary。</small></div></div></el-form-item>
<el-form-item label="商品圖片網址（選填）"><el-input v-model="shoppingImageUrl" placeholder="https://example.com/product-image.jpg" /><small>可直接貼上公開圖片網址；若同時選擇圖片檔，會優先使用上傳檔案。</small></el-form-item>
<div class="two-col"><el-form-item label="商品名稱"><el-input v-model="shopping.name" placeholder="例如：東京香蕉蛋糕" maxlength="80" /></el-form-item><el-form-item label="購物類型"><el-select v-model="shopping.shoppingType"><el-option label="個人購物" value="personal" /><el-option label="代購商品" value="proxy" /><el-option label="共同採買" value="shared" /><el-option label="伴手禮" value="gift" /></el-select></el-form-item></div>
<div class="three-col"><el-form-item label="分類"><el-select v-model="shopping.category" allow-create filterable default-first-option><el-option v-for="category in ['藥妝','食品','零食','伴手禮','服飾','鞋包','美妝','保養品','電器','玩具','動漫','文具','生活用品','收藏品','嬰幼兒用品','其他']" :key="category" :label="category" :value="category" /></el-select></el-form-item><el-form-item label="優先順序"><el-select v-model="shopping.priority"><el-option label="高優先" value="high" /><el-option label="一般" value="medium" /><el-option label="低優先" value="low" /></el-select></el-form-item><el-form-item label="狀態"><el-select v-model="shopping.status"><el-option label="想買" value="wishlist" /><el-option label="已規劃" value="planned" /><el-option label="已購買" value="purchased" /><el-option label="缺貨" value="unavailable" /><el-option label="已取消" value="cancelled" /></el-select></el-form-item></div>
<div class="three-col"><el-form-item label="數量"><el-input-number v-model="shopping.quantity" :min="1" :max="99" controls-position="right" /></el-form-item><el-form-item label="單位"><el-input v-model="shopping.unit" placeholder="件、盒、包" /></el-form-item><el-form-item label="幣別"><el-select v-model="shopping.currency"><el-option label="JPY" value="JPY" /><el-option label="TWD" value="TWD" /><el-option label="USD" value="USD" /></el-select></el-form-item></div>
<div class="two-col"><el-form-item label="預估單價"><el-input-number v-model="shopping.estimatedUnitPrice" :min="0" :step="100" controls-position="right" /></el-form-item><el-form-item label="實際單價（選填）"><el-input-number v-model="shopping.actualUnitPrice" :min="0" :step="100" controls-position="right" /></el-form-item></div>
<div class="two-col"><el-form-item label="預計購買日期（選填）"><el-date-picker v-model="shopping.plannedDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item><el-form-item label="關聯行程（可多選）"><div class="shopping-itinerary-picker-control"><div class="shopping-itinerary-picker-copy"><strong>{{ selectedShoppingItineraries.length ? `已關聯 ${selectedShoppingItineraries.length} 個行程` : '尚未關聯行程' }}</strong><span>{{ selectedShoppingItineraries.length ? selectedShoppingItineraries.map((entry) => entry.title).join('、') : '先選擇第幾天，再勾選該日行程' }}</span></div><div class="shopping-itinerary-picker-actions"><el-button v-if="shoppingItineraryItemIds.length" text class="shopping-itinerary-clear" @click="clearShoppingItinerary">清除</el-button><el-button class="shopping-itinerary-picker-button" @click="openShoppingItineraryPicker">{{ shoppingItineraryItemIds.length ? '調整行程' : '選擇行程' }}</el-button></div></div></el-form-item></div>
<div class="two-col"><el-form-item label="負責購買人"><el-select v-model="shopping.assignedTo" clearable placeholder="尚未分派"><el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item><el-form-item label="購買地點／商店"><el-input v-model="shopping.storeName" placeholder="例如：唐吉訶德新宿店" /></el-form-item></div>
<div class="two-col"><el-form-item label="分店（選填）"><el-input v-model="shopping.storeBranch" placeholder="例如：東口店・3F" /></el-form-item><el-form-item label="Google Maps 地點網址（選填）"><el-input v-model="shopping.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>清單上的地圖按鈕會直接開啟此地點。</small></el-form-item></div>
<el-form-item v-if="shopping.shoppingType === 'shared'" label="共同採買分攤旅伴"><el-checkbox-group v-model="shoppingParticipantIds" class="shopping-participants"><el-checkbox v-for="m in current?.members" :key="m.id" :label="m.id">{{ m.name }}</el-checkbox></el-checkbox-group><small>轉成開銷時會沿用這些旅伴進行平均分攤。</small></el-form-item>
<div v-if="shopping.shoppingType === 'proxy' || shopping.shoppingType === 'gift'" class="two-col"><el-form-item v-if="shopping.shoppingType === 'proxy'" label="委託人"><el-input v-model="shopping.requestedBy" placeholder="例如：小美" /></el-form-item><el-form-item v-else label="贈送對象"><el-input v-model="shopping.giftRecipient" placeholder="例如：家人、同事" /></el-form-item><el-form-item label="商品網址（選填）"><el-input v-model="shopping.website" placeholder="https://example.com" /></el-form-item></div>
<el-form-item label="商品說明／備註（選填）"><el-input v-model="shopping.note" type="textarea" :rows="3" maxlength="240" show-word-limit placeholder="規格、顏色、限購資訊或購買注意事項" /></el-form-item>
</el-form>
<template #footer><el-button :disabled="savingShopping" @click="showShopping=false">取消</el-button><el-button type="primary" :loading="savingShopping" :disabled="savingShopping" @click="saveShoppingItem">{{ editingShoppingId ? '儲存變更' : '新增商品' }}</el-button></template>
  </el-dialog>
  <el-dialog v-model="showShoppingItineraryPicker" :title="shoppingItineraryPickerMode === 'batch' ? '將商品加入關聯行程' : '選擇關聯行程'" class="shopping-itinerary-picker-dialog" width="min(92vw, 620px)" append-to-body>
<div v-if="shoppingItineraryDays.length" class="shopping-itinerary-picker">
<div class="shopping-itinerary-day-select"><label for="shopping-itinerary-day">選擇旅行天數</label><el-select id="shopping-itinerary-day" v-model="shoppingItineraryPickerDay" aria-label="選擇旅行天數" placeholder="選擇旅行天數"><el-option v-for="(day, index) in shoppingItineraryDays" :key="day.date" :label="`第 ${index + 1} 天・${formatItineraryDate(day.date)}`" :value="day.date" /></el-select></div>
<div class="shopping-itinerary-picker-heading"><strong>{{ formatItineraryDate(shoppingItineraryPickerDay) }}</strong><span>{{ shoppingItineraryPickerMode === 'batch' ? `將 ${batchShoppingItemIds.length} 項商品加入行程` : `${shoppingItineraryEntries.length} 個可選行程` }}</span></div>
<div class="shopping-itinerary-picker-list"><button v-for="entry in shoppingItineraryEntries" :key="entry.id" type="button" class="shopping-itinerary-picker-row" :class="{ 'is-selected': activeShoppingItineraryItemIds.includes(entry.id) }" @click="selectShoppingItinerary(entry)"><img v-if="entry.imageUrl" :src="entry.imageUrl" :alt="`${entry.title} 圖片`" /><span v-else class="shopping-itinerary-picker-placeholder">{{ (entry.type || '行程').slice(0, 1) }}</span><span class="shopping-itinerary-picker-row-copy"><strong>{{ entry.title }}</strong><span><time>{{ entry.time || '未排時間' }}</time><template v-if="entry.endTime">－{{ entry.endTime }}</template><em>{{ entry.activityKind === 'personal' ? '個人行程' : entry.type }}</em></span><small v-if="entry.location">{{ entry.location }}</small></span><span class="shopping-itinerary-picker-select">{{ activeShoppingItineraryItemIds.includes(entry.id) ? '已勾選' : '選擇' }}</span></button></div>
</div>
<div v-else class="shopping-itinerary-picker-empty"><strong>尚未建立可關聯的行程</strong><p>先在每日行程中建立行程後，再回來關聯商品。</p></div>
<template #footer><el-button @click="showShoppingItineraryPicker=false">取消</el-button><el-button v-if="activeShoppingItineraryItemIds.length" @click="clearShoppingItinerary">清除{{ shoppingItineraryPickerMode === 'batch' ? '選取' : '關聯' }}</el-button><el-button type="primary" @click="confirmShoppingItinerarySelection">{{ shoppingItineraryPickerMode === 'batch' ? '加入關聯行程' : '確認關聯' }}{{ activeShoppingItineraryItemIds.length ? `（${activeShoppingItineraryItemIds.length}）` : '' }}</el-button></template>
  </el-dialog>
  <el-dialog v-model="showPersonalBudget" title="設定個人預算" width="min(92vw, 420px)">
<p class="muted">此預算僅供你自己查看，會依你實際分攤到的開銷計算使用率。</p>
<el-form label-position="top">
<el-form-item label="個人預算">
<el-input-number v-model="personalBudgetInput" :min="0" :step="1000" controls-position="right" />
</el-form-item>
</el-form>
<template #footer>
<el-button :disabled="savingPersonalBudget" @click="showPersonalBudget=false">取消</el-button>
<el-button type="primary" :loading="savingPersonalBudget" :disabled="savingPersonalBudget" @click="savePersonalBudget">儲存個人預算</el-button>
</template>
   </el-dialog>
  <el-dialog v-model="showCategoryBudgets" title="設定分類預算" width="min(92vw, 520px)">
<p class="muted">分類預算會依全體旅伴建立的支出計算；未設定或填入 0 的分類不會顯示。</p>
<el-form class="category-budget-form" label-position="top">
<el-form-item v-for="category in budgetCategoryNames" :key="category" :label="category">
<el-input-number v-model="categoryBudgetDraft[category]" :min="0" :step="1000" controls-position="right" />
</el-form-item>
</el-form>
<template #footer>
<el-button :disabled="savingCategoryBudgets" @click="showCategoryBudgets=false">取消</el-button>
<el-button type="primary" :loading="savingCategoryBudgets" :disabled="savingCategoryBudgets" @click="saveCategoryBudgets">儲存分類預算</el-button>
</template>
  </el-dialog>
  <el-dialog v-model="showDailyBudget" title="設定每日預算" width="min(92vw, 420px)">
<p class="muted">每日預算會依支出的日期統計，填入 0 可關閉每日預算提醒。</p>
<el-form label-position="top"><el-form-item :label="`每日預算（${current?.currency || ''}）`"><el-input-number v-model="dailyBudgetInput" :min="0" :step="1000" controls-position="right" /></el-form-item></el-form>
<template #footer><el-button :disabled="savingDailyBudget" @click="showDailyBudget=false">取消</el-button><el-button type="primary" :loading="savingDailyBudget" :disabled="savingDailyBudget" @click="saveDailyBudget">儲存每日預算</el-button></template>
  </el-dialog>
  <PaymentToolDialog v-model:open="showPaymentTool" v-model:image-url="paymentToolImageUrl" :editing="Boolean(editingPaymentToolId)" :form="paymentTool" @save="savePaymentTool" />
  <el-dialog v-model="showRewardRule" :title="editingRewardRuleId ? '編輯回饋規則' : '新增回饋規則'" width="min(94vw, 720px)"><el-form label-position="top"><div class="two-col"><el-form-item label="回饋規則名稱" required><el-input v-model="rewardRule.name" placeholder="例如：日本餐廳加碼回饋" /></el-form-item><el-form-item label="支付工具"><el-select v-model="rewardRule.paymentToolId"><el-option v-for="tool in currentPaymentTools.filter((item) => item.ownerUserId === (user?.uid || current?.ownerId))" :key="tool.id" :label="tool.name" :value="tool.id" /></el-select></el-form-item><el-form-item label="回饋類型"><el-select v-model="rewardRule.rewardType"><el-option label="現金回饋" value="cashback" /><el-option label="點數" value="points" /><el-option label="里程" value="miles" /><el-option label="折抵金" value="statement_credit" /><el-option label="其他" value="other" /></el-select></el-form-item><el-form-item label="規則優先順序"><el-input-number v-model="rewardRule.priority" :min="1" controls-position="right" /></el-form-item><el-form-item label="基本回饋（%）"><el-input-number v-model="rewardRule.baseRatePercent" :min="0" :precision="2" controls-position="right" /></el-form-item><el-form-item label="加碼回饋（%）"><el-input-number v-model="rewardRule.bonusRatePercent" :min="0" :precision="2" controls-position="right" /></el-form-item><el-form-item label="最低消費門檻"><el-input-number v-model="rewardRule.minimumSpend" :min="0" controls-position="right" /></el-form-item><el-form-item label="回饋金額上限"><el-input-number v-model="rewardRule.rewardCap" :min="0" controls-position="right" /></el-form-item><el-form-item label="符合回饋消費上限"><el-input-number v-model="rewardRule.maximumEligibleSpend" :min="0" controls-position="right" /></el-form-item><el-form-item label="上限計算期間"><el-select v-model="rewardRule.capPeriod"><el-option label="本次旅行" value="trip" /><el-option label="自訂活動期間" value="custom" /><el-option label="每月" value="monthly" /><el-option label="帳單週期" value="billing_cycle" /></el-select></el-form-item><el-form-item label="活動開始"><el-date-picker v-model="rewardRule.periodStart" type="date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="活動結束"><el-date-picker v-model="rewardRule.periodEnd" type="date" value-format="YYYY-MM-DD" /></el-form-item></div><el-divider content-position="left">適用條件（留空代表不限）</el-divider><div class="two-col"><el-form-item label="適用幣別"><el-input v-model="rewardRule.applicableCurrencies" placeholder="例如：JPY、TWD" /></el-form-item><el-form-item label="適用消費分類"><el-input v-model="rewardRule.applicableCategories" placeholder="例如：餐廳、交通" /></el-form-item><el-form-item label="適用商店／品牌"><el-input v-model="rewardRule.applicableMerchants" placeholder="例如：LAWSON、唐吉訶德" /></el-form-item><el-form-item label="適用付款方式"><el-checkbox-group v-model="rewardRule.applicablePaymentMethods" class="payment-method-checks"><el-checkbox label="physical_card">實體卡</el-checkbox><el-checkbox label="apple_pay">Apple Pay</el-checkbox><el-checkbox label="google_pay">Google Pay</el-checkbox><el-checkbox label="online">網路付款</el-checkbox><el-checkbox label="qr_payment">掃碼付款</el-checkbox><el-checkbox label="transport_card_topup">交通卡儲值</el-checkbox><el-checkbox label="stored_value">儲值支付</el-checkbox></el-checkbox-group></el-form-item><el-form-item label="排除消費分類"><el-input v-model="rewardRule.excludedCategories" placeholder="例如：保險、稅金" /></el-form-item><el-form-item label="排除商店／品牌"><el-input v-model="rewardRule.excludedMerchants" placeholder="例如：指定排除商家" /></el-form-item></div><p class="payment-rule-condition-hint">多個條件可用逗號或頓號分隔；商店名稱以消費紀錄中的商店欄位比對。</p><el-form-item><el-checkbox v-model="rewardRule.requiresRegistration">需要活動登錄</el-checkbox><el-checkbox v-if="rewardRule.requiresRegistration" v-model="rewardRule.registrationCompleted">已完成登錄</el-checkbox></el-form-item><el-form-item label="備註"><el-input v-model="rewardRule.note" type="textarea" :rows="3" /></el-form-item></el-form><template #footer><el-button @click="showRewardRule=false">取消</el-button><el-button type="primary" @click="saveRewardRule">儲存規則</el-button></template></el-dialog>
  <el-dialog v-model="showPaymentTransaction" :title="editingPaymentTransactionId ? '編輯付款紀錄' : '新增付款紀錄'" width="min(94vw, 680px)"><el-form label-position="top"><div class="two-col"><el-form-item label="支付工具" required><el-select v-model="paymentTransaction.paymentToolId"><el-option v-for="tool in currentPaymentTools.filter((item) => item.ownerUserId === (user?.uid || current?.ownerId))" :key="tool.id" :label="tool.name" :value="tool.id" /></el-select></el-form-item><el-form-item label="消費名稱" required><el-input v-model="paymentTransaction.title" /></el-form-item><el-form-item label="店家"><el-input v-model="paymentTransaction.merchant" /></el-form-item><el-form-item label="分類"><el-input v-model="paymentTransaction.category" /></el-form-item><el-form-item label="日期" required><el-date-picker v-model="paymentTransaction.transactionDate" type="date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="付款方式"><el-select v-model="paymentTransaction.paymentMethod"><el-option label="實體卡" value="physical_card"/><el-option label="Apple Pay" value="apple_pay"/><el-option label="Google Pay" value="google_pay"/><el-option label="網路付款" value="online"/><el-option label="掃碼付款" value="qr_payment"/><el-option label="交通卡儲值" value="transport_card_topup"/><el-option label="儲值支付" value="stored_value"/><el-option label="其他" value="other"/></el-select></el-form-item><el-form-item label="原始金額" required><el-input-number v-model="paymentTransaction.originalAmount" :min="0" controls-position="right" /></el-form-item><el-form-item label="原始幣別"><el-input v-model="paymentTransaction.originalCurrency" /></el-form-item><el-form-item label="匯率"><el-input-number v-model="paymentTransaction.exchangeRate" :min="0.000001" :precision="6" controls-position="right" /></el-form-item><el-form-item label="交易類型"><el-select v-model="paymentTransaction.transactionType"><el-option label="消費" value="purchase"/><el-option label="儲值" value="top_up"/><el-option label="退款" value="refund"/><el-option label="調整" value="adjustment"/></el-select></el-form-item><el-form-item label="狀態"><el-select v-model="paymentTransaction.status"><el-option label="已入帳" value="posted"/><el-option label="待入帳" value="pending"/><el-option label="部分退款" value="partially_refunded"/><el-option label="已退款" value="refunded"/><el-option label="已取消" value="cancelled"/></el-select></el-form-item></div><el-form-item label="退款金額（選填）"><el-input-number v-model="paymentTransaction.refundedAmount" :min="0" :max="paymentTransaction.originalAmount" controls-position="right" /></el-form-item><el-form-item><el-checkbox v-model="paymentTransaction.syncExpense">同步建立個人旅行開銷（僅新交易）</el-checkbox></el-form-item><el-form-item label="備註"><el-input v-model="paymentTransaction.note" type="textarea" /></el-form-item></el-form><template #footer><el-button @click="showPaymentTransaction=false">取消</el-button><el-button type="primary" @click="savePaymentTransaction">儲存付款紀錄</el-button></template></el-dialog>
  <el-dialog v-model="showStoredBalance" title="設定儲值工具初始餘額" width="min(92vw, 420px)"><el-form label-position="top"><el-form-item label="初始餘額"><el-input-number v-model="storedBalance.initialBalance" :min="0" controls-position="right" /></el-form-item><el-form-item label="幣別"><el-input v-model="storedBalance.currency" /></el-form-item></el-form><template #footer><el-button @click="showStoredBalance=false">取消</el-button><el-button type="primary" @click="saveStoredBalance">儲存餘額</el-button></template></el-dialog>
</template>

<style>
.member-manager-dialog .el-dialog__body{padding-top:18px}.member-manager-current,.member-manager-invite{display:grid;gap:16px}.member-manager-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.member-manager-section-heading>div,.member-manager-invite>div{display:grid;gap:2px}.member-manager-section-heading p,.member-manager-invite p{margin:0;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.member-manager-section-heading h3,.member-manager-invite h3{margin:0;color:#173d37;font-size:17px;line-height:1.4}.member-manager-section-heading>span,.member-manager-invite>div>span{color:#71827c;font-size:12px;line-height:1.5}.member-manager-list{display:grid;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px}.member-manager-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto 40px;align-items:center;gap:11px;padding:11px 12px;border-bottom:1px solid #edf1ee}.member-manager-row:last-child{border-bottom:0}.member-manager-avatar{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#dceee6;color:#216a5b;font-size:14px;font-weight:800}.member-manager-copy{display:grid;min-width:0;gap:2px}.member-manager-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.member-manager-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.member-manager-role{padding:4px 8px;border-radius:999px;background:#f1f4f2;color:#687b74;font-size:12px;font-weight:700;white-space:nowrap}.member-manager-role.is-owner{background:#edf5ef;color:#2f7d70}.member-manager-role.is-editor{background:#eef5f5;color:#357072}.member-remove-button{width:40px!important;min-width:40px!important;height:40px!important;color:#c36358;font-size:22px}.member-remove-button:hover,.member-remove-button:focus-visible{background:#fdf0ed;color:#b64237}.member-manager-dialog .el-divider{margin:22px 0}.member-manager-form-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:12px}.member-manager-invite .el-form-item{margin-bottom:14px}.member-manager-invite .el-input,.member-manager-invite .el-select{width:100%}.member-invite-button{min-height:42px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.member-invite-button:hover,.member-invite-button:focus-visible{background:#1d5a52;color:#fff}.edit-cover-control,.album-upload-control,.shopping-upload-control{display:flex;align-items:center;gap:14px}.edit-cover-control>img,.edit-cover-placeholder,.album-upload-control>img,.album-upload-placeholder,.shopping-upload-control>img,.shopping-upload-placeholder{width:112px;height:72px;flex:0 0 auto;border:1px solid #dbe6e0;border-radius:10px;object-fit:cover}.edit-cover-placeholder,.album-upload-placeholder,.shopping-upload-placeholder{display:grid;place-items:center;background:#eef5f0;color:#5d9385;font-size:25px}.edit-cover-actions,.album-upload-actions,.shopping-upload-actions{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:6px 10px}.edit-cover-actions input,.album-upload-actions input,.shopping-upload-actions input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.edit-cover-file-button,.album-upload-file-button,.shopping-upload-file-button{display:inline-flex;min-height:36px;padding:0 11px;align-items:center;border:1px solid #bad5c9;border-radius:8px;background:#fff;color:#2f7d70;font-size:13px;font-weight:700;cursor:pointer}.edit-cover-file-button:hover,.edit-cover-file-button:focus-within,.album-upload-file-button:hover,.album-upload-file-button:focus-within,.shopping-upload-file-button:hover,.shopping-upload-file-button:focus-within{border-color:#7eb4a1;background:#eef5f0;color:#123f3a}.edit-cover-remove-button{min-height:36px;color:#b7574d}.edit-cover-actions small,.album-upload-actions small,.shopping-upload-actions small{flex-basis:100%;color:#71827c;font-size:12px;line-height:1.45}.three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.three-col .el-input-number,.shopping-dialog .el-select,.shopping-dialog .el-date-editor{width:100%}.shopping-participants{display:flex;flex-wrap:wrap;gap:7px 12px}.shopping-participants .el-checkbox{margin-right:0}.category-budget-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.category-budget-form .el-input-number{width:100%}@media(max-width:600px){.member-manager-section-heading{align-items:start;flex-direction:column;gap:5px}.member-manager-row{grid-template-columns:38px minmax(0,1fr) auto}.member-manager-role{grid-column:2;justify-self:start}.member-remove-button{grid-column:3;grid-row:1/3}.member-manager-form-grid,.three-col{grid-template-columns:1fr}.member-manager-dialog .el-dialog__body,.album-dialog .el-dialog__body,.shopping-dialog .el-dialog__body{padding:16px}.member-manager-dialog .el-dialog__footer,.album-dialog .el-dialog__footer,.shopping-dialog .el-dialog__footer{padding:12px 16px 18px}.edit-cover-control,.album-upload-control,.shopping-upload-control{align-items:flex-start;flex-direction:column}.edit-cover-control>img,.edit-cover-placeholder,.album-upload-control>img,.album-upload-placeholder,.shopping-upload-control>img,.shopping-upload-placeholder{width:100%;height:150px}.category-budget-form{grid-template-columns:1fr}}
.itinerary-favorite-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #dbe8e1;border-radius:10px;background:#f8fbf9}.itinerary-favorite-picker-copy{display:grid;min-width:0;gap:2px}.itinerary-favorite-picker-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.itinerary-favorite-picker-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.itinerary-favorite-picker-button{min-height:38px;flex:0 0 auto;border-color:#b7d3c6;border-radius:9px;color:#236c59;font-weight:700}.itinerary-favorite-picker-button:hover,.itinerary-favorite-picker-button:focus-visible{border-color:#6da790;background:#eef6f1;color:#123f3a}.favorite-picker-dialog .el-dialog__body{padding-top:16px}.favorite-picker-toolbar{display:grid;gap:12px}.favorite-picker-toolbar .el-input__wrapper{min-height:44px}.favorite-picker-filters{display:flex;flex-wrap:wrap;gap:7px}.favorite-picker-filter{min-height:34px;padding:0 10px;border-color:#dce8e1;border-radius:999px;color:#55736a;font-size:13px}.favorite-picker-filter small{margin-left:5px;font-size:11px;font-weight:800;opacity:.78}.favorite-picker-filter.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.favorite-picker-filter.type-attraction.is-active{border-color:#207b68;background:#e7f5ef;color:#176653}.favorite-picker-filter.type-restaurant.is-active{border-color:#cf7658;background:#fff0e9;color:#a84e34}.favorite-picker-filter.type-transport.is-active{border-color:#4b7ea1;background:#eaf3fb;color:#315f82}.favorite-picker-filter.type-stay.is-active{border-color:#7861a4;background:#f0ebfb;color:#5d4789}.favorite-picker-list{display:grid;gap:9px;max-height:min(52vh,460px);margin-top:16px;overflow:auto;padding:2px}.favorite-picker-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:12px;width:100%;padding:10px;border:1px solid #e0e9e4;border-radius:12px;background:#fff;text-align:left;cursor:pointer;transition:border-color .16s,box-shadow .16s,background .16s}.favorite-picker-row:hover,.favorite-picker-row:focus-visible{border-color:#8ab9a8;background:#f8fcf9;box-shadow:0 4px 12px rgba(18,63,58,.07);outline:none}.favorite-picker-row.is-selected{border-color:#2f7d70;background:#eef7f2}.favorite-picker-row>img,.favorite-picker-placeholder{display:grid;width:52px;height:52px;place-items:center;border-radius:10px;object-fit:cover}.favorite-picker-placeholder{background:#eaf4ef;color:#2f7d70;font-size:18px;font-weight:800}.favorite-picker-row-copy{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:5px 7px}.favorite-picker-row-copy strong{max-width:100%;overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}.favorite-picker-row-copy small{width:100%;overflow:hidden;color:#71827c;font-size:12px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}.favorite-picker-row-copy .favorite-picker-map-status{color:#2f7d70;font-weight:700}.favorite-picker-type{padding:2px 7px;border-radius:999px;background:#edf5f0;color:#47776a;font-size:11px;font-weight:700}.favorite-picker-type.type-attraction{background:#e6f5ee;color:#19715c}.favorite-picker-type.type-restaurant{background:#fff0e9;color:#ad5136}.favorite-picker-type.type-transport{background:#eaf3fb;color:#34678d}.favorite-picker-type.type-stay{background:#f0ebfb;color:#624b90}.favorite-picker-select{padding:6px 9px;border-radius:8px;background:#eef5f0;color:#2f7d70;font-size:13px;font-weight:800}.favorite-picker-row:hover .favorite-picker-select,.favorite-picker-row:focus-visible .favorite-picker-select,.favorite-picker-row.is-selected .favorite-picker-select{background:#2f7d70;color:#fff}.favorite-picker-empty{display:grid;justify-items:center;gap:4px;margin-top:16px;padding:34px 16px;border:1px dashed #cbded5;border-radius:12px;color:#6b7d78;text-align:center}.favorite-picker-empty strong{color:#315c52;font-size:15px}.favorite-picker-empty p{margin:0;font-size:13px}@media(max-width:600px){.itinerary-favorite-picker-control{align-items:flex-start;flex-direction:column}.itinerary-favorite-picker-button{width:100%;min-height:42px}.favorite-picker-dialog .el-dialog__body{padding:16px}.favorite-picker-list{max-height:52vh}.favorite-picker-row{grid-template-columns:46px minmax(0,1fr);gap:10px;padding:9px}.favorite-picker-row>img,.favorite-picker-placeholder{width:46px;height:46px}.favorite-picker-select{grid-column:2;justify-self:start;padding:4px 8px}.favorite-picker-filters{gap:6px}.favorite-picker-filter{min-height:36px;padding:0 9px}}
.transport-destination-control{border-color:#b9d9ce;background:#f4faf6}.transport-destination-actions{display:flex;flex:0 0 auto;align-items:center;gap:2px}.transport-destination-clear{min-height:36px;color:#7a8a84}.transport-destination-clear:hover,.transport-destination-clear:focus-visible{color:#b94f45;background:#fdf0ed}@media(max-width:600px){.transport-destination-actions{width:100%;justify-content:flex-end}.transport-destination-actions .itinerary-favorite-picker-button{width:auto}}
.favorite-picker-filter.type-shop.is-active{border-color:#b07a2d;background:#fff4d9;color:#875a15}.favorite-picker-type.type-shop{background:#fff4d9;color:#875a15}
.itinerary-activity-kind{display:grid!important;width:100%;grid-template-columns:repeat(2,minmax(0,1fr));isolation:isolate}.itinerary-activity-kind .el-radio-button{display:block;width:100%;min-width:0}.itinerary-activity-kind .el-radio-button__inner{display:flex;width:100%;min-height:44px;box-sizing:border-box;align-items:center;justify-content:center;padding:0 12px;border-color:#c7ddd3;color:#315e55;font-weight:700;line-height:1.35;white-space:nowrap}.itinerary-activity-kind .el-radio-button__original-radio:checked + .el-radio-button__inner{border-color:#123f3a;background:#123f3a;box-shadow:-1px 0 0 0 #123f3a;color:#fff}
.itinerary-form-image-preview{display:flex;align-items:center;gap:11px;margin-top:10px;padding:9px;border:1px solid #dce8e2;border-radius:10px;background:#f8fbf9}.itinerary-form-image-preview img{width:64px;height:48px;flex:0 0 auto;border-radius:7px;object-fit:cover}.itinerary-form-image-preview>div{display:grid;min-width:0;gap:2px}.itinerary-form-image-preview strong{color:#244a43;font-size:13px}.itinerary-form-image-preview span{color:#71827c;font-size:12px;line-height:1.4}@media(max-width:420px){.itinerary-form-image-preview{align-items:flex-start}.itinerary-form-image-preview img{width:58px;height:44px}}
.shopping-itinerary-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #dbe8e1;border-radius:10px;background:#f8fbf9}.shopping-itinerary-picker-copy{display:grid;min-width:0;gap:2px}.shopping-itinerary-picker-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-actions{display:flex;flex:0 0 auto;align-items:center;gap:2px}.shopping-itinerary-picker-button{min-height:38px;border-color:#b7d3c6;border-radius:9px;color:#236c59;font-weight:700}.shopping-itinerary-picker-button:hover,.shopping-itinerary-picker-button:focus-visible{border-color:#6da790;background:#eef6f1;color:#123f3a}.shopping-itinerary-clear{min-height:36px;color:#7a8a84}.shopping-itinerary-clear:hover,.shopping-itinerary-clear:focus-visible{color:#b94f45;background:#fdf0ed}.shopping-itinerary-picker{display:grid;gap:14px}.shopping-itinerary-day-select{display:grid;gap:6px}.shopping-itinerary-day-select label{color:#52736a;font-size:12px;font-weight:700}.shopping-itinerary-day-select .el-select{width:100%}.shopping-itinerary-day-select .el-select__wrapper{min-height:44px;border-radius:10px}.shopping-itinerary-picker-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px;color:#315e55}.shopping-itinerary-picker-heading strong{font-size:14px}.shopping-itinerary-picker-heading span{color:#71827c;font-size:12px}.shopping-itinerary-picker-list{display:grid;gap:9px;max-height:min(48vh,400px);overflow:auto;padding:2px}.shopping-itinerary-picker-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;padding:9px;border:1px solid #e0e9e4;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.shopping-itinerary-picker-row:hover,.shopping-itinerary-picker-row:focus-visible{border-color:#8ab9a8;background:#f8fcf9;outline:none}.shopping-itinerary-picker-row.is-selected{border-color:#2f7d70;background:#eef7f2}.shopping-itinerary-picker-row>img,.shopping-itinerary-picker-placeholder{display:grid;width:48px;height:48px;place-items:center;border-radius:9px;object-fit:cover}.shopping-itinerary-picker-placeholder{background:#eaf4ef;color:#2f7d70;font-size:17px;font-weight:800}.shopping-itinerary-picker-row-copy{display:grid;min-width:0;gap:3px}.shopping-itinerary-picker-row-copy strong{overflow:hidden;color:#244a43;font-size:14px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-row-copy>span{display:flex;align-items:center;gap:4px;color:#5f7770;font-size:12px}.shopping-itinerary-picker-row-copy em{padding:2px 6px;border-radius:999px;background:#eef5f0;color:#47776a;font-size:10px;font-style:normal;font-weight:700}.shopping-itinerary-picker-row-copy small{overflow:hidden;color:#7a8b85;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.shopping-itinerary-picker-select{padding:6px 9px;border-radius:8px;background:#eef5f0;color:#2f7d70;font-size:12px;font-weight:800}.shopping-itinerary-picker-row.is-selected .shopping-itinerary-picker-select{background:#2f7d70;color:#fff}.shopping-itinerary-picker-empty{display:grid;justify-items:center;gap:4px;padding:38px 16px;border:1px dashed #cbded5;border-radius:12px;color:#6b7d78;text-align:center}.shopping-itinerary-picker-empty strong{color:#315c52;font-size:15px}.shopping-itinerary-picker-empty p{margin:0;font-size:13px}@media(max-width:600px){.shopping-itinerary-picker-control{align-items:flex-start;flex-direction:column}.shopping-itinerary-picker-actions{width:100%;justify-content:flex-end}.shopping-itinerary-picker-row{grid-template-columns:44px minmax(0,1fr);gap:9px}.shopping-itinerary-picker-row>img,.shopping-itinerary-picker-placeholder{width:44px;height:44px}.shopping-itinerary-picker-select{grid-column:2;justify-self:start;padding:4px 8px}}
.favorite-audit-fields .el-input__wrapper{background:#f7faf8;box-shadow:0 0 0 1px #dce8e1 inset}.favorite-audit-fields .el-input__inner{color:#52736a;font-weight:600}
.itinerary-group-member-selector{display:grid;gap:7px;max-height:220px;overflow:auto;padding:10px;border:1px solid #e4e9e4;border-radius:10px;background:#fafcfb}.itinerary-group-member-selector .el-checkbox{display:flex;height:auto;margin:0;align-items:flex-start}.itinerary-group-member-selector .el-checkbox__label{display:grid;gap:2px;color:#315c52}.itinerary-group-member-selector small{color:#71827c;font-size:12px}
.expense-source-hint{margin:-8px 0 12px;color:#71827c;font-size:12px;line-height:1.5}.expense-receipt-field{display:grid;gap:10px}.expense-receipt-preview{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #dbe8e1;border-radius:10px;background:#f7fbf8}.expense-receipt-preview img{width:64px;height:64px;border-radius:8px;object-fit:cover}.expense-receipt-preview .el-button{margin-left:auto}.payment-image-hint,.payment-rule-condition-hint{margin:6px 0 12px;color:#6b7d78;font-size:12px;line-height:1.5}.payment-image-preview{display:block;width:72px;height:72px;margin-top:8px;border:1px solid #dbe8e1;border-radius:10px;object-fit:cover}.payment-method-checks{display:flex;flex-wrap:wrap;gap:7px 12px;padding:10px;border:1px solid #dce8e1;border-radius:10px;background:#f8fbf9}.payment-method-checks .el-checkbox{height:auto;margin-right:0;color:#315c52;font-size:13px}
</style>
