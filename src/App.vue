<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Close, Menu } from '@element-plus/icons-vue'
import type { User } from 'firebase/auth'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import TripExpenseCard from './components/TripExpenseCard.vue'
import TripHeroHeader from './components/TripHeroHeader.vue'
import TripItineraryCard from './components/TripItineraryCard.vue'
import TripMapCard from './components/TripMapCard.vue'
import TripBookingCard from './components/TripBookingCard.vue'
import TripFavoriteCard from './components/TripFavoriteCard.vue'
import TripAlbumCard from './components/TripAlbumCard.vue'
import TripShoppingCard from './components/TripShoppingCard.vue'
import TripMembersSettlementCard from './components/TripMembersSettlementCard.vue'
import TripPackingCard from './components/TripPackingCard.vue'
import TripTodoCard from './components/TripTodoCard.vue'
import { repository } from './services/repository'
import { useTripStore } from './stores/trip'
import type { AlbumPhoto, Booking, BookingType, Expense, ExpenseKind, Favorite, FavoriteType, ItineraryItem, Member, PackingItem, Role, Settlement, ShoppingItem, ShoppingPriority, ShoppingStatus, ShoppingType, TodoItem, TodoScope, Trip } from './types'
import { uploadTripCover, uploadTripImage } from './services/cloudinary'
import { auth, ensureUserProfile, firebaseEnabled, logOut, registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle, updateUserSettings } from './services/firebase'
import { joinTripByInviteCode } from './services/cloudinary'

const router = useRouter(); const route = useRoute(); const store = useTripStore(); const activeId = ref(''); const screen = ref<'trips'|'trip'|'login'|'profile'>('trips'); const authResolving = ref(firebaseEnabled && Boolean(auth)); const showCreate = ref(false); const showEdit = ref(false); const showJoin = ref(false); const showMember = ref(false); const showItem = ref(false); const showExpense = ref(false); const showTodo = ref(false); const showPacking = ref(false); const showBooking = ref(false); const showFavorite = ref(false); const showAlbum = ref(false); const savingAlbum = ref(false); const showShopping = ref(false); const savingShopping = ref(false); const showPersonalBudget = ref(false); const savingPersonalBudget = ref(false); const showCategoryBudgets = ref(false); const savingCategoryBudgets = ref(false); const mobileTripMenuOpen = ref(false)
type TripTab = 'overview' | 'itinerary' | 'map' | 'expenses' | 'todos' | 'packing' | 'bookings' | 'favorites' | 'album' | 'shopping' | 'members'
const current = computed(() => store.trip(activeId.value)); const currentItems = computed(() => store.items(activeId.value)); const currentExpenses = computed(() => store.tripExpenses(activeId.value)); const currentTodos = computed(() => store.tripTodos(activeId.value)); const currentPackingItems = computed(() => store.tripPackingItems(activeId.value)); const currentBookings = computed(() => store.tripBookings(activeId.value)); const currentFavorites = computed(() => store.tripFavorites(activeId.value)); const currentAlbumPhotos = computed(() => store.tripAlbumPhotos(activeId.value)); const currentShoppingItems = computed(() => store.tripShoppingItems(activeId.value)); const currentSettlements = computed(() => store.tripSettlements(activeId.value));
const insertAfterItemId = ref<string | null>(null)
const create = reactive({ name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const coverFile = ref<File>(); const edit = reactive({ name: '', country: '', city: '', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const editCoverFile = ref<File>(); const editCoverPreview = ref(''); const savingTrip = ref(false)
const member = reactive({ name: '', email: '', role: 'editor' as Role }); const item = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', type: '景點' }); const editingItemId = ref<string | null>(null); const pendingFavoriteId = ref<string | null>(null); const itemFavoriteId = ref(''); const itinerarySortingEnabled = ref(false); const packingSortingEnabled = ref(false); const favoriteSortingEnabled = ref(false); const editingExpenseId = ref<string |null>(null); const editingTodoId = ref<string | null>(null); const editingPackingId = ref<string | null>(null); const editingBookingId = ref<string | null>(null); const editingFavoriteId = ref<string | null>(null); const editingAlbumPhotoId = ref<string | null>(null); const albumFile = ref<File>(); const albumPreview = ref(''); const album = reactive({ caption: '', tripDate: '', itineraryItemId: '' }); const editingShoppingId = ref<string | null>(null); const shoppingImageFile = ref<File>(); const shoppingImagePreview = ref(''); const shoppingParticipantIds = ref<string[]>([]); const shopping = reactive({ name: '', description: '', shoppingType: 'personal' as ShoppingType, category: '其他', priority: 'medium' as ShoppingPriority, quantity: 1, unit: '件', estimatedUnitPrice: 0, actualUnitPrice: 0, currency: 'JPY', requestedBy: '', assignedTo: '', giftRecipient: '', storeName: '', storeBranch: '', location: '', address: '', mapUrl: '', website: '', note: '', status: 'wishlist' as ShoppingStatus, plannedDate: '', itineraryItemId: '' }); const expense = reactive({ title: '', amount: 0, payerId: '', kind: 'shared' as ExpenseKind, splitMode: 'equal' as 'equal' | 'custom', category: '餐飲', date: '' }); const todo = reactive({ title: '', scope: 'shared' as TodoScope, assigneeId: '', dueDate: '' }); const packing = reactive({ name: '', category: '衣物', quantity: 1, assignedTo: '', isShared: false, note: '' }); const booking = reactive({ type: 'flight' as BookingType, title: '', startDate: '', endDate: '', location: '', bookingNumber: '', bookedBy: '', contact: '', website: '', note: '' }); const favorite = reactive({ name: '', type: 'attraction' as FavoriteType, location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' }); const expenseParticipantIds = ref<string[]>([]); const expenseShares = reactive<Record<string, number>>({}); const categoryBudgetDraft = reactive<Record<string, number>>({})
const invite = reactive({ code: '' })
const user = ref<User | null>(null); const login = reactive({ email: '', password: '' }); const authMode = ref<'login' | 'register'>('login'); const authSubmitting = ref(false); const authFormError = ref(''); const personalBudgetInput = ref(0); let removeAuthListener: (() => void) | undefined
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
function goTrip(tripId: string) { void router.push({ name: 'trip-dashboard', params: { tripId } }) }
const activeTripTab = computed<TripTab>(() => {
  const tab = route.query.tab
  return tab === 'itinerary' || tab === 'map' || tab === 'expenses' || tab === 'todos' || tab === 'packing' || tab === 'bookings' || tab === 'favorites' || tab === 'album' || tab === 'shopping' || tab === 'members' ? tab : 'overview'
})
const tripTabLabels: Record<TripTab, string> = { overview: '總覽', itinerary: '行程', map: '地圖', expenses: '開銷', todos: '待辦', packing: '行李', bookings: '預訂', favorites: '收藏', album: '相簿', shopping: '購物', members: '旅伴與結算' }
const tripTabOptions: TripTab[] = ['overview', 'itinerary', 'expenses', 'todos', 'packing', 'bookings', 'favorites', 'shopping', 'album', 'map', 'members']
function selectTripTab(tab: TripTab) {
  mobileTripMenuOpen.value = false
  if (tab !== 'itinerary') itinerarySortingEnabled.value = false
  if (tab !== 'packing') packingSortingEnabled.value = false
  if (tab !== 'favorites') favoriteSortingEnabled.value = false
  if (tab === activeTripTab.value) return
  const query = { ...route.query }
  delete query.tab
  void router.push({ name: 'trip-dashboard', params: { tripId: activeId.value }, query: tab === 'overview' ? query : { ...query, tab } })
}
function syncRoute() { const name = String(route.name || 'trips'); if (name === 'login' || name === 'register' || name === 'forgot-password') { screen.value = 'login'; authMode.value = name === 'register' ? 'register' : 'login'; return } if (name === 'profile') { screen.value = 'profile'; if (user.value) profile.displayName = user.value.displayName || user.value.email?.split('@')[0] || ''; return } if (name === 'trip-dashboard') { activeId.value = String(route.params.tripId); screen.value = 'trip'; return } screen.value = 'trips'; showCreate.value = name === 'trip-create' }
watch(() => route.fullPath, syncRoute, { immediate: true })
function authErrorMessage(error: unknown) { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; if (code === 'auth/unauthorized-domain') return '此網站尚未加入 Firebase Authentication 的授權網域。'; if (code === 'auth/operation-not-allowed') return 'Firebase 尚未啟用 Google 登入方式。'; if (code === 'auth/account-exists-with-different-credential') return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'; return error instanceof Error ? error.message : 'Google 登入未完成，請再試一次。' }
onMounted(async () => { if (!firebaseEnabled || !auth) { await store.load(); return } try { await getRedirectResult(auth) } catch (error) { ElMessage.error(authErrorMessage(error)) } removeAuthListener = onAuthStateChanged(auth, async (signedInUser) => { try { user.value = signedInUser; if (signedInUser) { await ensureUserProfile(signedInUser); await store.load(signedInUser.uid); if (route.meta.public) { const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/trips'; await router.replace(redirect) } } else { store.$patch({ trips: [], itinerary: [], expenses: [], settlements: [], todos: [], packingItems: [], bookings: [], favorites: [], albumPhotos: [], shoppingItems: [], categoryBudgets: {} }); if (!route.meta.public) await router.replace({ name: 'login', query: { redirect: route.fullPath } }) } } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法載入登入資料。') } finally { authResolving.value = false } }) })
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
async function saveTrip() { if (!current.value || !edit.name || !edit.startDate || !edit.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); savingTrip.value = true; try { if (editCoverFile.value) edit.coverUrl = await uploadTripCover(editCoverFile.value); await store.updateTrip({ ...current.value, ...edit }); clearEditCoverPreview(); editCoverFile.value = undefined; showEdit.value = false; ElMessage.success('旅行設定已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。') } finally { savingTrip.value = false } }
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
function favoriteToItineraryType(favoriteType: FavoriteType) { return favoriteType === 'restaurant' || favoriteType === 'cafe' ? '餐飲' : favoriteType === 'stay' ? '住宿' : favoriteType === 'alternative' ? '其他' : '景點' }
function applyFavoriteToItem(favoriteId: string) { const selected = currentFavorites.value.find((entry) => entry.id === favoriteId); if (!selected) return; pendingFavoriteId.value = selected.id; Object.assign(item, { title: selected.name, location: selected.location || '', mapUrl: selected.mapUrl || '', imageUrl: selected.imageUrl || '', type: favoriteToItineraryType(selected.type) }) }
function openItemForm(entry?: ItineraryItem, favoriteId?: string) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); insertAfterItemId.value = null; pendingFavoriteId.value = favoriteId || null; itemFavoriteId.value = favoriteId || ''; editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, endTime: entry.endTime || '', title: entry.title, location: entry.location, mapUrl: entry.mapUrl || '', imageUrl: entry.imageUrl || '', type: entry.type } : { date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', type: '景點' }); showItem.value = true }
function openItemFormAfter(entry: ItineraryItem) { openItemForm(); insertAfterItemId.value = entry.id; item.date = entry.date }
function normalizeGoogleMapsUrl(value: string) { const raw = value.trim(); if (!raw) return ''; const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; try { const hostname = new URL(normalized).hostname.toLowerCase(); if (!/(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') throw new Error(); return normalized } catch { throw new Error('請貼上有效的 Google Maps 景點網址。') } }
async function saveItem() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); if (!activeId.value || !item.title || !item.date) return ElMessage.warning('請填寫行程名稱與日期。'); if (item.endTime && item.time && item.endTime <= item.time) return ElMessage.warning('結束時間必須晚於開始時間。'); const conflict = currentItems.value.some((entry) => entry.id !== editingItemId.value && entry.date === item.date && item.time && entry.time && entry.time < (item.endTime || item.time) && (entry.endTime || entry.time) > item.time); if (conflict) return ElMessage.warning('此時段與既有行程重疊，請調整時間。'); try { const mapUrl = normalizeGoogleMapsUrl(item.mapUrl); const rawImage = item.imageUrl.trim(); const imageUrl = rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : rawImage; const payload = { ...item, mapUrl, imageUrl }; const existing = editingItemId.value ? currentItems.value.find((entry) => entry.id === editingItemId.value) : undefined; if (existing) await store.updateItem({ ...existing, ...payload }); else { const dayEntries = currentItems.value.filter((entry) => entry.date === item.date).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')); const afterIndex = insertAfterItemId.value ? dayEntries.findIndex((entry) => entry.id === insertAfterItemId.value) : -1; const insertIndex = afterIndex >= 0 ? afterIndex + 1 : dayEntries.length; const added = await store.addItem({ tripId: activeId.value, ...payload, order: insertIndex }); if (afterIndex >= 0) { const reordered = [...dayEntries]; reordered.splice(insertIndex, 0, added); await store.reorderItems(reordered) } const savedFavorite = pendingFavoriteId.value ? currentFavorites.value.find((entry) => entry.id === pendingFavoriteId.value) : undefined; if (savedFavorite) await store.updateFavorite({ ...savedFavorite, addedToItinerary: true }) } showItem.value = false; editingItemId.value = null; insertAfterItemId.value = null; pendingFavoriteId.value = null } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。') } }
async function removeItem(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); try { await ElMessageBox.confirm(`確定刪除「${entry.title}」嗎？`, '刪除行程', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteItem(entry); ElMessage.success('行程已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。') } }
async function toggleItinerary(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); await store.toggleItem(entry.id) }
function resetExpenseShares(ids = expenseParticipantIds.value) { Object.keys(expenseShares).forEach((id) => delete expenseShares[id]); const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0; ids.forEach((id) => { expenseShares[id] = amount }) }
function openExpenseForm(existing?: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); const members = current.value?.members || []; editingExpenseId.value = existing?.id || null; Object.assign(expense, existing ? { title: existing.title, amount: existing.amount, payerId: existing.payerId, kind: existing.kind, splitMode: existing.splitMode || 'equal', category: existing.category, date: existing.date } : { title: '', amount: 0, payerId: currentMember.value?.id || members[0]?.id || '', kind: 'shared', splitMode: 'equal', category: '餐飲', date: new Date().toISOString().slice(0, 10) }); expenseParticipantIds.value = existing ? expenseParticipants(existing) : members.map((member) => member.id); resetExpenseShares(); if (existing?.splitMode === 'custom' && existing.shares) Object.assign(expenseShares, existing.shares); showExpense.value = true }
function openPersonalBudgetForm() { if (!activeMemberId.value) return ElMessage.warning('請先登入後設定個人預算。'); personalBudgetInput.value = personalBudget.value; showPersonalBudget.value = true }
async function savePersonalBudget() { if (!current.value || !activeMemberId.value) return; savingPersonalBudget.value = true; try { const budget = Math.max(0, Number(personalBudgetInput.value) || 0); await repository.updatePersonalBudget(current.value, activeMemberId.value, budget); const currentUserMember = current.value.members.find((entry) => entry.id === activeMemberId.value); if (currentUserMember) currentUserMember.personalBudget = budget; showPersonalBudget.value = false; ElMessage.success('個人預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存個人預算。') } finally { savingPersonalBudget.value = false } }
function openCategoryBudgetForm() { if (!canEditTripSettings.value) return ElMessage.warning('只有旅行建立者可以設定分類預算。'); Object.keys(categoryBudgetDraft).forEach((category) => delete categoryBudgetDraft[category]); budgetCategoryNames.value.forEach((category) => { categoryBudgetDraft[category] = Number(categoryBudgets.value[category]) || 0 }); showCategoryBudgets.value = true }
async function saveCategoryBudgets() { if (!current.value || !canEditTripSettings.value) return; savingCategoryBudgets.value = true; try { await store.updateCategoryBudgets(current.value.id, categoryBudgetDraft); showCategoryBudgets.value = false; ElMessage.success('分類預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存分類預算。') } finally { savingCategoryBudgets.value = false } }
function openTodoForm(existing?: TodoItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); editingTodoId.value = existing?.id || null; Object.assign(todo, existing ? { title: existing.title, scope: existing.scope || 'shared', assigneeId: existing.assigneeId || '', dueDate: existing.dueDate || '' } : { title: '', scope: 'shared', assigneeId: '', dueDate: '' }); showTodo.value = true }
async function saveTodo() { if (!current.value || !todo.title.trim()) return ElMessage.warning('請填寫待辦事項。'); if (todo.scope === 'personal' && !todo.assigneeId) return ElMessage.warning('個人待辦請指定負責旅伴。'); try { const payload = { tripId: current.value.id, title: todo.title.trim(), scope: todo.scope, assigneeId: todo.assigneeId || '', dueDate: todo.dueDate || '' }; const existing = editingTodoId.value ? currentTodos.value.find((entry) => entry.id === editingTodoId.value) : undefined; if (existing) await store.updateTodo({ ...existing, ...payload }); else await store.addTodo(payload); showTodo.value = false; editingTodoId.value = null; ElMessage.success('待辦已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存待辦。') } }
async function toggleTodo(todoItem: TodoItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); try { await store.toggleTodo(todoItem) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新待辦狀態。') } }
async function removeTodo(todoItem: TodoItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); try { await ElMessageBox.confirm(`確定刪除待辦「${todoItem.title}」嗎？`, '刪除待辦', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteTodo(todoItem); ElMessage.success('待辦已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除待辦。') } }
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
function openBookingForm(existing?: Booking) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行預訂，無法修改。'); editingBookingId.value = existing?.id || null; Object.assign(booking, existing ? { type: existing.type, title: existing.title, startDate: existing.startDate, endDate: existing.endDate || '', location: existing.location || '', bookingNumber: existing.bookingNumber || '', bookedBy: existing.bookedBy || '', contact: existing.contact || '', website: existing.website || '', note: existing.note || '' } : { type: 'flight', title: '', startDate: '', endDate: '', location: '', bookingNumber: '', bookedBy: '', contact: '', website: '', note: '' }); showBooking.value = true }
async function saveBooking() { if (!current.value || !booking.title.trim() || !booking.startDate) return ElMessage.warning('請填寫預訂名稱與開始日期。'); try { const rawWebsite = booking.website.trim(); const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite; const payload = { tripId: current.value.id, type: booking.type, title: booking.title.trim(), startDate: booking.startDate, endDate: booking.endDate || '', location: booking.location.trim(), bookingNumber: booking.bookingNumber.trim(), bookedBy: booking.bookedBy || '', contact: booking.contact.trim(), website, note: booking.note.trim(), createdBy: user.value?.uid || current.value.ownerId }; const existing = editingBookingId.value ? currentBookings.value.find((entry) => entry.id === editingBookingId.value) : undefined; if (existing) await store.updateBooking({ ...existing, ...payload }); else await store.addBooking(payload); showBooking.value = false; editingBookingId.value = null; ElMessage.success('旅行預訂已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅行預訂。') } }
async function removeBooking(bookingItem: Booking) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行預訂，無法修改。'); try { await ElMessageBox.confirm(`確定刪除預訂「${bookingItem.title}」嗎？`, '刪除旅行預訂', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteBooking(bookingItem); ElMessage.success('旅行預訂已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行預訂。') } }
function openFavoriteForm(existing?: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); editingFavoriteId.value = existing?.id || null; Object.assign(favorite, existing ? { name: existing.name, type: existing.type, location: existing.location || '', mapUrl: existing.mapUrl || '', website: existing.website || '', imageUrl: existing.imageUrl || '', estimatedCost: existing.estimatedCost || 0, recommendedBy: existing.recommendedBy || '', note: existing.note || '' } : { name: '', type: 'attraction', location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' }); showFavorite.value = true }
async function saveFavorite() { if (!current.value || !favorite.name.trim()) return ElMessage.warning('請填寫收藏名稱。'); try { const rawWebsite = favorite.website.trim(); const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite; const rawImage = favorite.imageUrl.trim(); const imageUrl = rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : rawImage; const mapUrl = normalizeGoogleMapsUrl(favorite.mapUrl); const payload = { tripId: current.value.id, name: favorite.name.trim(), type: favorite.type, location: favorite.location.trim(), mapUrl, website, imageUrl, estimatedCost: Math.max(0, Number(favorite.estimatedCost) || 0), recommendedBy: favorite.recommendedBy.trim(), note: favorite.note.trim(), createdBy: user.value?.uid || current.value.ownerId }; const existing = editingFavoriteId.value ? currentFavorites.value.find((entry) => entry.id === editingFavoriteId.value) : undefined; if (existing) await store.updateFavorite({ ...existing, ...payload }); else await store.addFavorite(payload); showFavorite.value = false; editingFavoriteId.value = null; ElMessage.success('旅遊收藏已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅遊收藏。') } }
async function removeFavorite(favoriteItem: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); try { await ElMessageBox.confirm(`確定刪除收藏「${favoriteItem.name}」嗎？`, '刪除旅遊收藏', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteFavorite(favoriteItem); ElMessage.success('旅遊收藏已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅遊收藏。') } }
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
async function saveAlbumPhoto() { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); const existing = editingAlbumPhotoId.value ? currentAlbumPhotos.value.find((entry) => entry.id === editingAlbumPhotoId.value) : undefined; if (!existing && !albumFile.value) return ElMessage.warning('請選擇要上傳的照片。'); savingAlbum.value = true; try { const imageUrl = albumFile.value ? await uploadTripImage(albumFile.value, 'album') : existing?.imageUrl || ''; const payload = { tripId: current.value.id, imageUrl, caption: album.caption.trim(), tripDate: album.tripDate || '', itineraryItemId: album.itineraryItemId || '', uploadedBy: user.value?.uid || current.value.ownerId }; if (existing) await store.updateAlbumPhoto({ ...existing, ...payload }); else await store.addAlbumPhoto(payload); showAlbum.value = false; resetAlbumForm(); ElMessage.success(existing ? '相片資訊已更新。' : '照片已加入旅行相簿。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅行相片。') } finally { savingAlbum.value = false } }
async function removeAlbumPhoto(photo: AlbumPhoto) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); try { await ElMessageBox.confirm('確定從旅行相簿移除這張照片嗎？', '刪除旅行相片', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteAlbumPhoto(photo); ElMessage.success('相片已從相簿移除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行相片。') } }
function clearShoppingImagePreview() { if (shoppingImagePreview.value.startsWith('blob:')) URL.revokeObjectURL(shoppingImagePreview.value); shoppingImagePreview.value = '' }
function resetShoppingForm() { clearShoppingImagePreview(); shoppingImageFile.value = undefined; editingShoppingId.value = null; shoppingParticipantIds.value = []; Object.assign(shopping, { name: '', description: '', shoppingType: 'personal', category: '其他', priority: 'medium', quantity: 1, unit: '件', estimatedUnitPrice: 0, actualUnitPrice: 0, currency: current.value?.currency || 'JPY', requestedBy: '', assignedTo: '', giftRecipient: '', storeName: '', storeBranch: '', location: '', address: '', mapUrl: '', website: '', note: '', status: 'wishlist', plannedDate: '', itineraryItemId: '' }) }
function selectShoppingImage(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return ElMessage.warning('請選擇圖片檔案。'); if (file.size > 10 * 1024 * 1024) return ElMessage.warning('圖片大小請控制在 10 MB 以內。'); clearShoppingImagePreview(); shoppingImageFile.value = file; shoppingImagePreview.value = URL.createObjectURL(file) }
function openShoppingForm(existing?: ShoppingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); resetShoppingForm(); editingShoppingId.value = existing?.id || null; if (existing) { Object.assign(shopping, { name: existing.name, description: existing.description || '', shoppingType: existing.shoppingType, category: existing.category, priority: existing.priority, quantity: existing.quantity, unit: existing.unit || '件', estimatedUnitPrice: existing.estimatedUnitPrice || 0, actualUnitPrice: existing.actualUnitPrice || 0, currency: existing.currency, requestedBy: existing.requestedBy || '', assignedTo: existing.assignedTo || '', giftRecipient: existing.giftRecipient || '', storeName: existing.storeName || '', storeBranch: existing.storeBranch || '', location: existing.location || '', address: existing.address || '', mapUrl: existing.mapUrl || '', website: existing.website || '', note: existing.note || '', status: existing.status, plannedDate: existing.plannedDate || '', itineraryItemId: existing.itineraryItemId || '' }); shoppingParticipantIds.value = [...(existing.participantIds || [])]; shoppingImagePreview.value = existing.imageUrl || '' } else { shopping.assignedTo = user.value?.uid || current.value?.ownerId || ''; shoppingParticipantIds.value = current.value?.members.map((member) => member.id) || [] } showShopping.value = true }
function normalizeExternalUrl(value: string) { const raw = value.trim(); return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw }
async function saveShoppingItem() { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); if (!shopping.name.trim()) return ElMessage.warning('請填寫商品名稱。'); const existing = editingShoppingId.value ? currentShoppingItems.value.find((entry) => entry.id === editingShoppingId.value) : undefined; const duplicate = !existing && currentShoppingItems.value.find((entry) => entry.name.trim().toLocaleLowerCase() === shopping.name.trim().toLocaleLowerCase() && entry.status !== 'cancelled'); try { if (duplicate) await ElMessageBox.confirm(`購物清單中已經有「${duplicate.name}」，仍要新增嗎？`, '可能重複的商品', { confirmButtonText: '仍要新增', cancelButtonText: '取消', type: 'warning' }); savingShopping.value = true; const quantity = Math.max(1, Number(shopping.quantity) || 1); const estimatedUnitPrice = Math.max(0, Number(shopping.estimatedUnitPrice) || 0); const actualUnitPrice = Math.max(0, Number(shopping.actualUnitPrice) || 0); const imageUrl = shoppingImageFile.value ? await uploadTripImage(shoppingImageFile.value, 'shopping') : existing?.imageUrl || ''; const mapUrl = normalizeGoogleMapsUrl(shopping.mapUrl); const payload = { tripId: current.value.id, name: shopping.name.trim(), description: shopping.description.trim(), shoppingType: shopping.shoppingType, category: shopping.category.trim() || '其他', priority: shopping.priority, quantity, unit: shopping.unit.trim() || '件', estimatedUnitPrice, estimatedTotalPrice: estimatedUnitPrice * quantity, actualUnitPrice, actualTotalPrice: actualUnitPrice * quantity, currency: shopping.currency || current.value.currency, requestedBy: shopping.requestedBy.trim(), assignedTo: shopping.assignedTo || '', giftRecipient: shopping.giftRecipient.trim(), storeName: shopping.storeName.trim(), storeBranch: shopping.storeBranch.trim(), location: shopping.location.trim(), address: shopping.address.trim(), mapUrl, website: normalizeExternalUrl(shopping.website), imageUrl, note: shopping.note.trim(), status: shopping.status, plannedDate: shopping.plannedDate || '', itineraryItemId: shopping.itineraryItemId || '', participantIds: shopping.shoppingType === 'shared' ? shoppingParticipantIds.value : [], purchasedBy: existing?.purchasedBy || '', purchasedAt: existing?.purchasedAt, expenseId: existing?.expenseId || '', createdBy: existing?.createdBy || user.value?.uid || current.value.ownerId }; if (existing) await store.updateShoppingItem({ ...existing, ...payload }); else await store.addShoppingItem(payload); showShopping.value = false; resetShoppingForm(); ElMessage.success(existing ? '購物項目已更新。' : '商品已加入購物清單。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法儲存購物項目。') } finally { savingShopping.value = false } }
async function updateShoppingStatus(item: ShoppingItem, status: ShoppingStatus) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); try { const isPurchased = status === 'purchased'; await store.updateShoppingItem({ ...item, status, purchasedBy: isPurchased ? item.purchasedBy || item.assignedTo || user.value?.uid || current.value?.ownerId : item.purchasedBy || '', purchasedAt: isPurchased ? item.purchasedAt || Date.now() : item.purchasedAt }); ElMessage.success(status === 'purchased' ? '已標記為已購買。' : '商品狀態已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新商品狀態。') } }
async function removeShoppingItem(item: ShoppingItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); try { await ElMessageBox.confirm(`確定刪除商品「${item.name}」嗎？`, '刪除購物項目', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteShoppingItem(item); ElMessage.success('購物項目已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除購物項目。') } }
async function convertShoppingToExpense(item: ShoppingItem) { if (!current.value || !canEditTrip.value) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。'); if (item.expenseId) return ElMessage.info('這筆商品已建立對應開銷。'); const amount = Number(item.actualTotalPrice) || Number(item.actualUnitPrice) * item.quantity || Number(item.estimatedTotalPrice) || Number(item.estimatedUnitPrice) * item.quantity; if (!(amount > 0)) return ElMessage.warning('請先在商品中填寫預估或實際價格。'); const payerId = item.purchasedBy || item.assignedTo || user.value?.uid || current.value.ownerId; const kind: ExpenseKind = item.shoppingType === 'shared' ? 'shared' : 'personal'; const participantIds = kind === 'shared' ? (item.participantIds?.length ? item.participantIds : current.value.members.map((member) => member.id)) : [payerId]; try { await ElMessageBox.confirm(`建立「${item.name}」的旅行開銷 ${item.currency} ${amount.toLocaleString()} 嗎？`, '建立旅行開銷', { confirmButtonText: '建立開銷', cancelButtonText: '取消', type: 'success' }); const expense = await store.addExpense({ tripId: current.value.id, title: item.name, amount, payerId, kind, participantIds, splitMode: 'equal', shares: {}, category: '購物', date: item.plannedDate || localDate() }); await store.updateShoppingItem({ ...item, status: 'purchased', purchasedBy: payerId, purchasedAt: item.purchasedAt || Date.now(), expenseId: expense.id, actualTotalPrice: Number(item.actualTotalPrice) || amount }); ElMessage.success('已建立旅行開銷並連結商品。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法建立旅行開銷。') } }
function addFavoriteToItinerary(favoriteItem: Favorite) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); openItemForm(undefined, favoriteItem.id); Object.assign(item, { date: current.value?.startDate || '', time: '', endTime: '' }); applyFavoriteToItem(favoriteItem.id) }
function syncExpenseParticipants() { if (expense.kind === 'personal') expenseParticipantIds.value = expense.payerId ? [expense.payerId] : []; else if (!expenseParticipantIds.value.length) expenseParticipantIds.value = (current.value?.members || []).map((member) => member.id); const selected = new Set(expenseParticipantIds.value); Object.keys(expenseShares).forEach((id) => { if (!selected.has(id)) delete expenseShares[id] }); expenseParticipantIds.value.forEach((id) => { if (expenseShares[id] === undefined) expenseShares[id] = 0 }) }
const customShareTotal = computed(() => expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseShares[id]) || 0), 0))
async function saveExpense() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); if (!current.value || !expense.title || expense.amount <= 0 || !expense.payerId) return ElMessage.warning('請完整填寫支出資料。'); const participantIds = expense.kind === 'personal' ? [expense.payerId] : expenseParticipantIds.value; if (!participantIds.length) return ElMessage.warning('請至少選擇一位分攤成員。'); if (expense.kind === 'shared' && expense.splitMode === 'custom' && Math.abs(customShareTotal.value - expense.amount) > .01) return ElMessage.warning('自訂分攤總額必須等於支出金額。'); try { const customShares = expense.kind === 'shared' && expense.splitMode === 'custom' ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseShares[id]) || 0])) : {}; const payload = { tripId: current.value.id, ...expense, participantIds, shares: customShares }; const existing = editingExpenseId.value ? currentExpenses.value.find((item) => item.id === editingExpenseId.value) : undefined; if (existing) await store.updateExpense({ ...existing, ...payload }); else await store.addExpense(payload); showExpense.value = false; editingExpenseId.value = null; ElMessage.success('支出已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存支出。') } }
async function removeExpense(expense: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); try { await ElMessageBox.confirm(`確定刪除「${expense.title}」嗎？`, '刪除支出', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteExpense(expense); ElMessage.success('支出已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除支出。') } }
const itineraryDays = computed(() => Object.entries(currentItems.value.reduce<Record<string, ItineraryItem[]>>((days, entry) => { (days[entry.date] ||= []).push(entry); return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, entries: entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')) })))
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
  const entries = itineraryDays.value.find((day) => day.date === date)?.entries || []
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
  const reordered = [...entries]
  const [moved] = reordered.splice(oldIndex, 1)
  if (!moved) return
  reordered.splice(newIndex, 0, moved)
  try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。') }
}
async function moveItem(entry: ItineraryItem, direction: -1 | 1) { if (!canEditTrip.value || !itinerarySortingEnabled.value) return; const entries = itineraryDays.value.find((day) => day.date === entry.date)?.entries || []; const index = entries.findIndex((item) => item.id === entry.id); const targetIndex = index + direction; if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return; const reordered = [...entries]; [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]; try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。') } }
function expenseParticipants(expense: { kind: ExpenseKind; payerId: string; participantIds: string[] }) { return expense.kind === 'personal' ? [expense.payerId] : expense.participantIds.length ? expense.participantIds : current.value?.members.map((member) => member.id) || [] }
function expenseParticipantCount(expense: Expense) { return expenseParticipants(expense).length }
function expensePayerName(payerId: string) { return current.value?.members.find((member) => member.id === payerId)?.name || '未知成員' }
function expenseShare(expense: { amount: number; kind: ExpenseKind; payerId: string; participantIds: string[]; splitMode?: 'equal' | 'custom'; shares?: Record<string, number> }) { const participants = expenseParticipants(expense); return participants.length ? expense.amount / participants.length : 0 }
function expenseShareForMember(expense: { amount: number; kind: ExpenseKind; payerId: string; participantIds: string[]; splitMode?: 'equal' | 'custom'; shares?: Record<string, number> }, memberId: string) { if (expense.kind === 'shared' && expense.splitMode === 'custom' && expense.shares) return Number(expense.shares[memberId]) || 0; return expenseParticipants(expense).includes(memberId) ? expenseShare(expense) : 0 }
const total = computed(() => currentExpenses.value.reduce((sum, expense) => sum + expense.amount, 0))
const baseBudgetCategories = ['餐飲', '交通', '住宿', '購物', '景點', '其他']
const categoryBudgets = computed(() => store.tripCategoryBudgets(activeId.value))
const budgetCategoryNames = computed(() => [...new Set([...baseBudgetCategories, ...Object.keys(categoryBudgets.value), ...currentExpenses.value.map((expense) => expense.category).filter(Boolean)])])
const categoryBudgetSummary = computed(() => budgetCategoryNames.value.map((category) => ({ category, budget: Number(categoryBudgets.value[category]) || 0, spent: currentExpenses.value.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0) })).filter((row) => row.budget > 0 || row.spent > 0))
const balances = computed(() => { const trip = current.value; if (!trip) return []; const paid = Object.fromEntries(trip.members.map((member) => [member.id, 0])); const owed = Object.fromEntries(trip.members.map((member) => [member.id, 0])); currentExpenses.value.forEach((expense) => { paid[expense.payerId] = (paid[expense.payerId] || 0) + expense.amount; expenseParticipants(expense).forEach((id) => { owed[id] = (owed[id] || 0) + expenseShareForMember(expense, id) }) }); currentSettlements.value.forEach((settlement) => { paid[settlement.fromId] = (paid[settlement.fromId] || 0) + settlement.amount; paid[settlement.toId] = (paid[settlement.toId] || 0) - settlement.amount }); return trip.members.map((member) => ({ ...member, balance: paid[member.id] - owed[member.id] })) })
const settlementSuggestions = computed(() => { const creditors = balances.value.filter((member) => member.balance > .01).map((member) => ({ ...member, remaining: member.balance })); const debtors = balances.value.filter((member) => member.balance < -.01).map((member) => ({ ...member, remaining: -member.balance })); const suggestions: { fromId: string; toId: string; from: string; to: string; amount: number }[] = []; let creditorIndex = 0; debtors.forEach((debtor) => { while (debtor.remaining > .01 && creditors[creditorIndex]) { const creditor = creditors[creditorIndex]; const amount = Math.min(debtor.remaining, creditor.remaining); suggestions.push({ fromId: debtor.id, toId: creditor.id, from: debtor.name, to: creditor.name, amount }); debtor.remaining -= amount; creditor.remaining -= amount; if (creditor.remaining <= .01) creditorIndex += 1 } }); return suggestions })
const activeMemberId = computed(() => currentMember.value?.id || (!firebaseEnabled ? current.value?.ownerId : undefined))
const activeMember = computed(() => activeMemberId.value ? current.value?.members.find((member) => member.id === activeMemberId.value) : undefined)
const personalBudget = computed(() => activeMember.value?.personalBudget || 0)
const myPaid = computed(() => activeMemberId.value ? currentExpenses.value.filter((expense) => expense.payerId === activeMemberId.value).reduce((sum, expense) => sum + expense.amount, 0) : 0)
const myBalance = computed(() => activeMemberId.value ? balances.value.find((member) => member.id === activeMemberId.value)?.balance || 0 : 0)
const myExpense = computed(() => activeMemberId.value ? currentExpenses.value.reduce((sum, expense) => sum + expenseShareForMember(expense, activeMemberId.value!), 0) : 0)
function memberPaid(memberId: string) { return currentExpenses.value.filter((expense) => expense.payerId === memberId).reduce((sum, expense) => sum + expense.amount, 0) }
function memberName(memberId: string) { return current.value?.members.find((member) => member.id === memberId)?.name || '未知成員' }
function formatTripDate(date: string) { const value = new Date(`${date}T00:00:00`); return Number.isNaN(value.getTime()) ? date : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日` }
const tripDateRange = computed(() => current.value ? `${formatTripDate(current.value.startDate)}－${formatTripDate(current.value.endDate)}` : '')
const tripDuration = computed(() => { if (!current.value) return ''; const start = new Date(`${current.value.startDate}T00:00:00`).getTime(); const end = new Date(`${current.value.endDate}T00:00:00`).getTime(); const days = Math.round((end - start) / 86400000) + 1; return Number.isFinite(days) && days > 0 ? `共 ${days} 天` : '' })
function localDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
async function confirmSettlement(suggestion: { fromId: string; toId: string; from: string; to: string; amount: number }) { if (!canEditTrip.value || !current.value) return ElMessage.warning('Viewer 僅能查看結算資料。'); try { await ElMessageBox.confirm(`確認「${suggestion.from}」已支付 ${current.value.currency} ${suggestion.amount.toFixed(0)} 給「${suggestion.to}」？`, '標記為已結算', { confirmButtonText: '確認結算', cancelButtonText: '取消', type: 'success' }); await store.addSettlement({ tripId: current.value.id, fromId: suggestion.fromId, toId: suggestion.toId, amount: suggestion.amount, date: localDate(), createdAt: Date.now() }); ElMessage.success('已記錄結算。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法記錄結算。') } }
async function removeSettlement(settlement: Settlement) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看結算資料。'); try { await ElMessageBox.confirm('確定要復原這筆結算嗎？', '復原結算', { confirmButtonText: '復原', cancelButtonText: '取消', type: 'warning' }); await store.deleteSettlement(settlement); ElMessage.success('結算已復原。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法復原結算。') } }
function openTrip(t: Trip) { goTrip(t.id) }
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
        <button type="button" role="tab" :aria-selected="activeTripTab === 'packing'" :class="{ 'is-active': activeTripTab === 'packing' }" @click="selectTripTab('packing')">行李</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'bookings'" :class="{ 'is-active': activeTripTab === 'bookings' }" @click="selectTripTab('bookings')">預訂</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'favorites'" :class="{ 'is-active': activeTripTab === 'favorites' }" @click="selectTripTab('favorites')">收藏</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'shopping'" :class="{ 'is-active': activeTripTab === 'shopping' }" @click="selectTripTab('shopping')">購物</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'album'" :class="{ 'is-active': activeTripTab === 'album' }" @click="selectTripTab('album')">相簿</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'map'" :class="{ 'is-active': activeTripTab === 'map' }" @click="selectTripTab('map')">地圖</button>
        <button type="button" role="tab" :aria-selected="activeTripTab === 'members'" :class="{ 'is-active': activeTripTab === 'members' }" @click="selectTripTab('members')">旅伴與結算</button>
      </nav>
      <div class="trip-detail-layout" :class="{ 'is-single-detail': activeTripTab !== 'overview' }" role="tabpanel" :aria-label="activeTripTab === 'overview' ? '旅行總覽' : activeTripTab === 'itinerary' ? '行程' : activeTripTab === 'map' ? '地圖' : activeTripTab === 'expenses' ? '開銷' : activeTripTab === 'todos' ? '待辦' : activeTripTab === 'packing' ? '行李' : activeTripTab === 'bookings' ? '預訂' : activeTripTab === 'favorites' ? '收藏' : activeTripTab === 'album' ? '旅行相簿' : activeTripTab === 'shopping' ? '購物清單' : '旅伴與結算'">
        <TripItineraryCard v-if="activeTripTab === 'overview' || activeTripTab === 'itinerary'" :days="itineraryDays" :shopping-items="currentShoppingItems" :can-edit-trip="canEditTrip" :sorting-enabled="itinerarySortingEnabled" :format-date="formatItineraryDate" :duration="itineraryDuration" :time-warning="itineraryTimeWarning" :maps-url="mapsUrl" @add="openItemForm()" @add-after="openItemFormAfter" @toggle="toggleItinerary" @edit="openItemForm" @remove="removeItem" @move="moveItem" @toggle-sorting="toggleItinerarySorting" @sort="sortItineraryItems" />
        <TripMapCard v-if="activeTripTab === 'map'" :days="itineraryDays" :format-date="formatItineraryDate" :maps-url="mapsUrl" />
        <TripExpenseCard v-if="activeTripTab === 'overview' || activeTripTab === 'expenses'" :trip="current" :expenses="currentExpenses" :total="total" :my-paid="myPaid" :my-balance="myBalance" :personal-budget="personalBudget" :personal-spent="myExpense" :category-budgets="categoryBudgetSummary" :can-set-personal-budget="Boolean(activeMemberId)" :can-manage-category-budgets="canEditTripSettings" :can-edit-trip="canEditTrip" :payer-name="expensePayerName" :participant-count="expenseParticipantCount" :share="expenseShare" @add="openExpenseForm()" @set-personal-budget="openPersonalBudgetForm" @manage-category-budgets="openCategoryBudgetForm" @edit="openExpenseForm" @remove="removeExpense" />
        <TripTodoCard v-if="activeTripTab === 'todos'" :trip="current" :todos="currentTodos" :can-edit-trip="canEditTrip" :member-name="memberName" @add="openTodoForm()" @toggle="toggleTodo" @edit="openTodoForm" @remove="removeTodo" />
        <TripPackingCard v-if="activeTripTab === 'packing'" :trip="current" :items="currentPackingItems" :can-edit-trip="canEditTrip" :sorting-enabled="packingSortingEnabled" :member-name="memberName" @add="openPackingForm()" @toggle="togglePackingItem" @toggle-sorting="togglePackingSorting" @sort="sortPackingItems" @edit="openPackingForm" @remove="removePackingItem" />
        <TripBookingCard v-if="activeTripTab === 'bookings'" :trip="current" :bookings="currentBookings" :can-edit-trip="canEditTrip" :member-name="memberName" @add="openBookingForm()" @edit="openBookingForm" @remove="removeBooking" />
        <TripFavoriteCard v-if="activeTripTab === 'favorites'" :trip="current" :favorites="currentFavorites" :currency="current.currency" :can-edit-trip="canEditTrip" :sorting-enabled="favoriteSortingEnabled" :member-name="memberName" @add="openFavoriteForm()" @toggle-sorting="toggleFavoriteSorting" @sort="sortFavorites" @edit="openFavoriteForm" @remove="removeFavorite" @add-to-itinerary="addFavoriteToItinerary" />
        <TripAlbumCard v-if="activeTripTab === 'album'" :trip="current" :photos="currentAlbumPhotos" :can-edit-trip="canEditTrip" :member-name="memberName" :format-date="formatTripDate" @add="openAlbumForm()" @edit="openAlbumForm" @remove="removeAlbumPhoto" />
        <TripShoppingCard v-if="activeTripTab === 'shopping'" :trip="current" :items="currentShoppingItems" :can-edit-trip="canEditTrip" :member-name="memberName" @add="openShoppingForm()" @edit="openShoppingForm" @remove="removeShoppingItem" @status="updateShoppingStatus" @convert="convertShoppingToExpense" />
        <TripMembersSettlementCard v-if="activeTripTab === 'overview' || activeTripTab === 'members'" :trip="current" :balances="balances" :suggestions="settlementSuggestions" :settlements="currentSettlements" :can-manage-members="canManageMembers" :can-edit-trip="canEditTrip" :open-member-manager="openMemberManager" :member-paid="memberPaid" :member-name="memberName" @copy-invite="copyInvite" @settle="confirmSettlement" @undo-settlement="removeSettlement" />
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
<el-dialog v-model="showItem" :title="editingItemId ? '編輯行程' : '新增行程'" class="itinerary-dialog" width="min(92vw, 520px)">
<el-form class="itinerary-form" label-position="top">
<el-form-item v-if="!editingItemId && currentFavorites.length" label="從旅遊收藏快速帶入">
<el-select v-model="itemFavoriteId" clearable filterable placeholder="選擇收藏後自動帶入名稱、類型與 Google Maps 網址" @change="applyFavoriteToItem">
<el-option v-for="savedFavorite in currentFavorites" :key="savedFavorite.id" :label="savedFavorite.location ? `${savedFavorite.name}・${savedFavorite.location}` : savedFavorite.name" :value="savedFavorite.id" />
</el-select>
<small>日期與時間不會自動設定，請依實際行程選擇。</small>
</el-form-item>
<el-form-item label="行程名稱">
<el-input v-model="item.title" />
</el-form-item>
<el-form-item label="日期">
<el-date-picker v-model="item.date" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" />
</el-form-item>
<div class="itinerary-time-grid">
<el-form-item label="開始時間">
<el-time-picker v-model="item.time" value-format="HH:mm" format="HH:mm" placeholder="選擇開始時間" />
</el-form-item>
<el-form-item label="結束時間">
<el-time-picker v-model="item.endTime" value-format="HH:mm" format="HH:mm" placeholder="選擇結束時間（選填）" />
</el-form-item>
</div>
<el-form-item label="類型">
<el-select v-model="item.type">
<el-option label="景點" value="景點" />
<el-option label="餐廳" value="餐廳" />
<el-option label="交通" value="交通" />
<el-option label="住宿" value="住宿" />
</el-select>
</el-form-item>
<el-form-item label="Google Maps 景點網址（選填）">
<el-input v-model="item.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" />
<small>行程卡片會直接開啟此景點；既有的地點文字資料會保留。</small>
</el-form-item>
<el-form-item label="行程圖片網址（選填）">
<el-input v-model="item.imageUrl" placeholder="貼上圖片網址，例如 https://..." />
<small>圖片會以縮圖顯示在每日行程卡片；從旅遊收藏帶入時會自動填入。</small>
</el-form-item>
</el-form>
<template #footer>
<el-button @click="showItem=false">取消</el-button>
<el-button type="primary" @click="saveItem">儲存行程</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showExpense" :title="editingExpenseId ? '編輯支出' : '新增支出'" width="min(92vw, 460px)">
<el-form label-position="top">
<el-form-item label="項目">
<el-input v-model="expense.title" />
</el-form-item>
<div class="two-col">
<el-form-item label="金額">
<el-input-number v-model="expense.amount" :min="0" />
</el-form-item>
<el-form-item label="日期">
<el-date-picker v-model="expense.date" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
</div>
<el-form-item label="付款人">
<el-select v-model="expense.payerId" @change="syncExpenseParticipants">
<el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" />
</el-select>
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
<el-radio-group v-model="expense.splitMode" @change="resetExpenseShares()">
<el-radio value="equal">平均分攤</el-radio>
<el-radio value="custom">自訂金額</el-radio>
</el-radio-group>
</el-form-item>
<el-form-item v-if="expense.kind === 'shared'" label="分攤成員">
<el-checkbox-group v-model="expenseParticipantIds" class="expense-participants">
<el-checkbox v-for="m in current?.members" :key="m.id" :label="m.id">{{ m.name }}</el-checkbox>
</el-checkbox-group>
<small>{{ expense.splitMode === 'custom' ? '請為每位已選成員填入分攤金額。' : '將由已選成員平均分攤本筆支出。' }}</small>
</el-form-item>
<el-form-item v-if="expense.kind === 'shared' && expense.splitMode === 'custom'" label="各自分攤金額">
<div class="custom-shares">
<div v-for="memberId in expenseParticipantIds" :key="memberId"><span>{{ expensePayerName(memberId) }}</span><el-input-number v-model="expenseShares[memberId]" :min="0" :precision="2" controls-position="right" /></div>
</div>
<small :class="{ 'share-total-error': Math.abs(customShareTotal - expense.amount) > .01 }">合計 {{ customShareTotal.toFixed(2) }}／支出 {{ expense.amount.toFixed(2) }}</small>
</el-form-item>
<el-form-item v-else label="分攤成員">
<el-input :model-value="expensePayerName(expense.payerId)" disabled />
<small>個人支出僅計入付款人，不會影響其他成員結算。</small>
</el-form-item>
</el-form>
<template #footer>
<el-button @click="showExpense=false">取消</el-button>
<el-button type="primary" @click="saveExpense">儲存支出</el-button>
</template>
   </el-dialog>
  <el-dialog v-model="showTodo" :title="editingTodoId ? '編輯待辦' : '新增待辦'" width="min(92vw, 460px)">
<el-form label-position="top">
<el-form-item label="待辦事項"><el-input v-model="todo.title" placeholder="例如：預訂機場接送" /></el-form-item>
<el-form-item label="待辦類型"><el-radio-group v-model="todo.scope"><el-radio value="shared">共同待辦</el-radio><el-radio value="personal">個人待辦</el-radio></el-radio-group><small>{{ todo.scope === 'personal' ? '個人待辦需指定一位負責旅伴。' : '共同待辦可由所有旅伴一起完成。' }}</small></el-form-item>
<div class="two-col">
<el-form-item :label="todo.scope === 'personal' ? '負責旅伴' : '負責旅伴（選填）'"><el-select v-model="todo.assigneeId" clearable :placeholder="todo.scope === 'personal' ? '選擇一位旅伴' : '尚未指派'"><el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item>
<el-form-item label="期限（選填）"><el-date-picker v-model="todo.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item>
</div>
</el-form>
<template #footer><el-button @click="showTodo=false">取消</el-button><el-button type="primary" @click="saveTodo">儲存待辦</el-button></template>
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
  <el-dialog v-model="showBooking" :title="editingBookingId ? '編輯旅行預訂' : '新增旅行預訂'" width="min(92vw, 560px)">
<el-form label-position="top">
<div class="two-col"><el-form-item label="預訂類型"><el-select v-model="booking.type"><el-option label="機票" value="flight" /><el-option label="住宿" value="hotel" /><el-option label="交通" value="transport" /><el-option label="票券" value="ticket" /><el-option label="餐廳" value="restaurant" /><el-option label="其他" value="other" /></el-select></el-form-item><el-form-item label="預訂名稱"><el-input v-model="booking.title" placeholder="例如：台北－東京來回機票" /></el-form-item></div>
<div class="two-col"><el-form-item label="開始日期"><el-date-picker v-model="booking.startDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item><el-form-item label="結束日期（選填）"><el-date-picker v-model="booking.endDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item></div>
<el-form-item label="地點（選填）"><el-input v-model="booking.location" placeholder="例如：東京成田機場／新宿" /></el-form-item>
<div class="two-col"><el-form-item label="預訂編號（選填）"><el-input v-model="booking.bookingNumber" placeholder="例如：ABC123" /></el-form-item><el-form-item label="預訂人（選填）"><el-select v-model="booking.bookedBy" clearable placeholder="選擇旅伴"><el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item></div>
<div class="two-col"><el-form-item label="聯絡方式（選填）"><el-input v-model="booking.contact" placeholder="電話、Email 或客服資訊" /></el-form-item><el-form-item label="預訂網站（選填）"><el-input v-model="booking.website" placeholder="https://example.com" /></el-form-item></div>
<el-form-item label="備註（選填）"><el-input v-model="booking.note" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="航班、入住或取票注意事項" /></el-form-item>
</el-form>
<template #footer><el-button @click="showBooking=false">取消</el-button><el-button type="primary" @click="saveBooking">儲存預訂</el-button></template>
  </el-dialog>
  <el-dialog v-model="showFavorite" :title="editingFavoriteId ? '編輯旅遊收藏' : '新增旅遊收藏'" width="min(92vw, 560px)">
<el-form label-position="top">
<div class="two-col"><el-form-item label="收藏類型"><el-select v-model="favorite.type"><el-option label="景點" value="attraction" /><el-option label="餐廳" value="restaurant" /><el-option label="商店" value="shop" /><el-option label="咖啡廳" value="cafe" /><el-option label="住宿" value="stay" /><el-option label="備選行程" value="alternative" /><el-option label="其他" value="other" /></el-select></el-form-item><el-form-item label="名稱"><el-input v-model="favorite.name" placeholder="例如：淺草寺" /></el-form-item></div>
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
<el-form-item label="商品圖片（選填）"><div class="shopping-upload-control"><img v-if="shoppingImagePreview" :src="shoppingImagePreview" alt="商品圖片預覽" /><div v-else class="shopping-upload-placeholder" aria-hidden="true">✦</div><div class="shopping-upload-actions"><label class="shopping-upload-file-button" for="shopping-image-file">{{ shoppingImagePreview ? '更換圖片' : '選擇圖片' }}</label><input id="shopping-image-file" type="file" accept="image/*" @change="selectShoppingImage" /><small>支援圖片檔，大小上限 10 MB；儲存時上傳到 Cloudinary。</small></div></div></el-form-item>
<div class="two-col"><el-form-item label="商品名稱"><el-input v-model="shopping.name" placeholder="例如：東京香蕉蛋糕" maxlength="80" /></el-form-item><el-form-item label="購物類型"><el-select v-model="shopping.shoppingType"><el-option label="個人購物" value="personal" /><el-option label="代購商品" value="proxy" /><el-option label="共同採買" value="shared" /><el-option label="伴手禮" value="gift" /></el-select></el-form-item></div>
<div class="three-col"><el-form-item label="分類"><el-select v-model="shopping.category" allow-create filterable default-first-option><el-option v-for="category in ['藥妝','食品','零食','伴手禮','服飾','鞋包','美妝','保養品','電器','玩具','動漫','文具','生活用品','收藏品','嬰幼兒用品','其他']" :key="category" :label="category" :value="category" /></el-select></el-form-item><el-form-item label="優先順序"><el-select v-model="shopping.priority"><el-option label="高優先" value="high" /><el-option label="一般" value="medium" /><el-option label="低優先" value="low" /></el-select></el-form-item><el-form-item label="狀態"><el-select v-model="shopping.status"><el-option label="想買" value="wishlist" /><el-option label="已規劃" value="planned" /><el-option label="已購買" value="purchased" /><el-option label="缺貨" value="unavailable" /><el-option label="已取消" value="cancelled" /></el-select></el-form-item></div>
<div class="three-col"><el-form-item label="數量"><el-input-number v-model="shopping.quantity" :min="1" :max="99" controls-position="right" /></el-form-item><el-form-item label="單位"><el-input v-model="shopping.unit" placeholder="件、盒、包" /></el-form-item><el-form-item label="幣別"><el-select v-model="shopping.currency"><el-option label="JPY" value="JPY" /><el-option label="TWD" value="TWD" /><el-option label="USD" value="USD" /></el-select></el-form-item></div>
<div class="two-col"><el-form-item label="預估單價"><el-input-number v-model="shopping.estimatedUnitPrice" :min="0" :step="100" controls-position="right" /></el-form-item><el-form-item label="實際單價（選填）"><el-input-number v-model="shopping.actualUnitPrice" :min="0" :step="100" controls-position="right" /></el-form-item></div>
<div class="two-col"><el-form-item label="預計購買日期（選填）"><el-date-picker v-model="shopping.plannedDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item><el-form-item label="關聯行程（選填）"><el-select v-model="shopping.itineraryItemId" clearable placeholder="選擇行程"><el-option v-for="entry in currentItems" :key="entry.id" :label="`${entry.date}・${entry.title}`" :value="entry.id" /></el-select></el-form-item></div>
<div class="two-col"><el-form-item label="負責購買人"><el-select v-model="shopping.assignedTo" clearable placeholder="尚未分派"><el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item><el-form-item label="購買地點／商店"><el-input v-model="shopping.storeName" placeholder="例如：唐吉訶德新宿店" /></el-form-item></div>
<div class="two-col"><el-form-item label="分店（選填）"><el-input v-model="shopping.storeBranch" placeholder="例如：東口店・3F" /></el-form-item><el-form-item label="Google Maps 地點網址（選填）"><el-input v-model="shopping.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>清單上的地圖按鈕會直接開啟此地點。</small></el-form-item></div>
<el-form-item v-if="shopping.shoppingType === 'shared'" label="共同採買分攤旅伴"><el-checkbox-group v-model="shoppingParticipantIds" class="shopping-participants"><el-checkbox v-for="m in current?.members" :key="m.id" :label="m.id">{{ m.name }}</el-checkbox></el-checkbox-group><small>轉成開銷時會沿用這些旅伴進行平均分攤。</small></el-form-item>
<div v-if="shopping.shoppingType === 'proxy' || shopping.shoppingType === 'gift'" class="two-col"><el-form-item v-if="shopping.shoppingType === 'proxy'" label="委託人"><el-input v-model="shopping.requestedBy" placeholder="例如：小美" /></el-form-item><el-form-item v-else label="贈送對象"><el-input v-model="shopping.giftRecipient" placeholder="例如：家人、同事" /></el-form-item><el-form-item label="商品網址（選填）"><el-input v-model="shopping.website" placeholder="https://example.com" /></el-form-item></div>
<el-form-item label="商品說明／備註（選填）"><el-input v-model="shopping.note" type="textarea" :rows="3" maxlength="240" show-word-limit placeholder="規格、顏色、限購資訊或購買注意事項" /></el-form-item>
</el-form>
<template #footer><el-button :disabled="savingShopping" @click="showShopping=false">取消</el-button><el-button type="primary" :loading="savingShopping" :disabled="savingShopping" @click="saveShoppingItem">{{ editingShoppingId ? '儲存變更' : '新增商品' }}</el-button></template>
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
</template>

<style>
.member-manager-dialog .el-dialog__body{padding-top:18px}.member-manager-current,.member-manager-invite{display:grid;gap:16px}.member-manager-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.member-manager-section-heading>div,.member-manager-invite>div{display:grid;gap:2px}.member-manager-section-heading p,.member-manager-invite p{margin:0;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.member-manager-section-heading h3,.member-manager-invite h3{margin:0;color:#173d37;font-size:17px;line-height:1.4}.member-manager-section-heading>span,.member-manager-invite>div>span{color:#71827c;font-size:12px;line-height:1.5}.member-manager-list{display:grid;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px}.member-manager-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto 40px;align-items:center;gap:11px;padding:11px 12px;border-bottom:1px solid #edf1ee}.member-manager-row:last-child{border-bottom:0}.member-manager-avatar{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#dceee6;color:#216a5b;font-size:14px;font-weight:800}.member-manager-copy{display:grid;min-width:0;gap:2px}.member-manager-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.member-manager-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.member-manager-role{padding:4px 8px;border-radius:999px;background:#f1f4f2;color:#687b74;font-size:12px;font-weight:700;white-space:nowrap}.member-manager-role.is-owner{background:#edf5ef;color:#2f7d70}.member-manager-role.is-editor{background:#eef5f5;color:#357072}.member-remove-button{width:40px!important;min-width:40px!important;height:40px!important;color:#c36358;font-size:22px}.member-remove-button:hover,.member-remove-button:focus-visible{background:#fdf0ed;color:#b64237}.member-manager-dialog .el-divider{margin:22px 0}.member-manager-form-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:12px}.member-manager-invite .el-form-item{margin-bottom:14px}.member-manager-invite .el-input,.member-manager-invite .el-select{width:100%}.member-invite-button{min-height:42px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.member-invite-button:hover,.member-invite-button:focus-visible{background:#1d5a52;color:#fff}.edit-cover-control,.album-upload-control,.shopping-upload-control{display:flex;align-items:center;gap:14px}.edit-cover-control>img,.edit-cover-placeholder,.album-upload-control>img,.album-upload-placeholder,.shopping-upload-control>img,.shopping-upload-placeholder{width:112px;height:72px;flex:0 0 auto;border:1px solid #dbe6e0;border-radius:10px;object-fit:cover}.edit-cover-placeholder,.album-upload-placeholder,.shopping-upload-placeholder{display:grid;place-items:center;background:#eef5f0;color:#5d9385;font-size:25px}.edit-cover-actions,.album-upload-actions,.shopping-upload-actions{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:6px 10px}.edit-cover-actions input,.album-upload-actions input,.shopping-upload-actions input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.edit-cover-file-button,.album-upload-file-button,.shopping-upload-file-button{display:inline-flex;min-height:36px;padding:0 11px;align-items:center;border:1px solid #bad5c9;border-radius:8px;background:#fff;color:#2f7d70;font-size:13px;font-weight:700;cursor:pointer}.edit-cover-file-button:hover,.edit-cover-file-button:focus-within,.album-upload-file-button:hover,.album-upload-file-button:focus-within,.shopping-upload-file-button:hover,.shopping-upload-file-button:focus-within{border-color:#7eb4a1;background:#eef5f0;color:#123f3a}.edit-cover-remove-button{min-height:36px;color:#b7574d}.edit-cover-actions small,.album-upload-actions small,.shopping-upload-actions small{flex-basis:100%;color:#71827c;font-size:12px;line-height:1.45}.three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.three-col .el-input-number,.shopping-dialog .el-select,.shopping-dialog .el-date-editor{width:100%}.shopping-participants{display:flex;flex-wrap:wrap;gap:7px 12px}.shopping-participants .el-checkbox{margin-right:0}.category-budget-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.category-budget-form .el-input-number{width:100%}@media(max-width:600px){.member-manager-section-heading{align-items:start;flex-direction:column;gap:5px}.member-manager-row{grid-template-columns:38px minmax(0,1fr) auto}.member-manager-role{grid-column:2;justify-self:start}.member-remove-button{grid-column:3;grid-row:1/3}.member-manager-form-grid,.three-col{grid-template-columns:1fr}.member-manager-dialog .el-dialog__body,.album-dialog .el-dialog__body,.shopping-dialog .el-dialog__body{padding:16px}.member-manager-dialog .el-dialog__footer,.album-dialog .el-dialog__footer,.shopping-dialog .el-dialog__footer{padding:12px 16px 18px}.edit-cover-control,.album-upload-control,.shopping-upload-control{align-items:flex-start;flex-direction:column}.edit-cover-control>img,.edit-cover-placeholder,.album-upload-control>img,.album-upload-placeholder,.shopping-upload-control>img,.shopping-upload-placeholder{width:100%;height:150px}.category-budget-form{grid-template-columns:1fr}}
</style>
