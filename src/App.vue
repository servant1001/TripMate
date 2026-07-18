<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { User } from 'firebase/auth'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import TripExpenseCard from './components/TripExpenseCard.vue'
import TripHeroHeader from './components/TripHeroHeader.vue'
import TripItineraryCard from './components/TripItineraryCard.vue'
import TripMembersSettlementCard from './components/TripMembersSettlementCard.vue'
import { useTripStore } from './stores/trip'
import type { Expense, ExpenseKind, ItineraryItem, Role, Settlement, Trip } from './types'
import { uploadTripCover } from './services/cloudinary'
import { auth, ensureUserProfile, firebaseEnabled, logOut, registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle, updateUserSettings } from './services/firebase'
import { joinTripByInviteCode } from './services/cloudinary'

const router = useRouter(); const route = useRoute(); const store = useTripStore(); const activeId = ref(''); const screen = ref<'trips'|'trip'|'login'|'profile'>('trips'); const authResolving = ref(firebaseEnabled && Boolean(auth)); const showCreate = ref(false); const showEdit = ref(false); const showJoin = ref(false); const showMember = ref(false); const showItem = ref(false); const showExpense = ref(false); const showPersonalBudget = ref(false); const savingPersonalBudget = ref(false)
const current = computed(() => store.trip(activeId.value)); const currentItems = computed(() => store.items(activeId.value)); const currentExpenses = computed(() => store.tripExpenses(activeId.value)); const currentSettlements = computed(() => store.tripSettlements(activeId.value));
const create = reactive({ name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const coverFile = ref<File>(); const edit = reactive({ name: '', country: '', city: '', startDate: '', endDate: '', currency: 'JPY', budget: 0 })
const member = reactive({ name: '', email: '', role: 'editor' as Role }); const item = reactive({ date: '', time: '', endTime: '', title: '', location: '', type: '景點' }); const editingItemId = ref<string | null>(null); const draggedItemId = ref<string | null>(null); const dragOverItemId = ref<string | null>(null); const editingExpenseId = ref<string | null>(null); const expense = reactive({ title: '', amount: 0, payerId: '', kind: 'shared' as ExpenseKind, splitMode: 'equal' as 'equal' | 'custom', category: '餐飲', date: '' }); const expenseParticipantIds = ref<string[]>([]); const expenseShares = reactive<Record<string, number>>({})
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
function syncRoute() { const name = String(route.name || 'trips'); if (name === 'login' || name === 'register' || name === 'forgot-password') { screen.value = 'login'; authMode.value = name === 'register' ? 'register' : 'login'; return } if (name === 'profile') { screen.value = 'profile'; if (user.value) profile.displayName = user.value.displayName || user.value.email?.split('@')[0] || ''; return } if (name === 'trip-dashboard') { activeId.value = String(route.params.tripId); screen.value = 'trip'; return } screen.value = 'trips'; showCreate.value = name === 'trip-create' }
watch(() => route.fullPath, syncRoute, { immediate: true })
function authErrorMessage(error: unknown) { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; if (code === 'auth/unauthorized-domain') return '此網站尚未加入 Firebase Authentication 的授權網域。'; if (code === 'auth/operation-not-allowed') return 'Firebase 尚未啟用 Google 登入方式。'; if (code === 'auth/account-exists-with-different-credential') return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'; return error instanceof Error ? error.message : 'Google 登入未完成，請再試一次。' }
onMounted(async () => { if (!firebaseEnabled || !auth) { await store.load(); return } try { await getRedirectResult(auth) } catch (error) { ElMessage.error(authErrorMessage(error)) } removeAuthListener = onAuthStateChanged(auth, async (signedInUser) => { try { user.value = signedInUser; if (signedInUser) { await ensureUserProfile(signedInUser); await store.load(signedInUser.uid); if (route.meta.public) { const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/trips'; await router.replace(redirect) } } else { store.$patch({ trips: [], itinerary: [], expenses: [], settlements: [] }); if (!route.meta.public) await router.replace({ name: 'login', query: { redirect: route.fullPath } }) } } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法載入登入資料。') } finally { authResolving.value = false } }) })
onUnmounted(() => removeAuthListener?.())
async function submitEmailLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '登入失敗，請確認 Email 與密碼。' } finally { authSubmitting.value = false } }
async function submitEmailRegistration() { authFormError.value = ''; if (login.password.length < 6) { authFormError.value = '密碼至少需要 6 個字元。'; return } authSubmitting.value = true; try { await registerWithEmail(login.email, login.password) } catch (error) { authFormError.value = error instanceof Error ? error.message : '註冊失敗，請稍後再試。' } finally { authSubmitting.value = false } }
async function submitGoogleLogin() { authFormError.value = ''; authSubmitting.value = true; try { await signInWithGoogle() } catch (error) { authFormError.value = authErrorMessage(error) } finally { authSubmitting.value = false } }
async function resetPassword() { authFormError.value = ''; if (!login.email) { authFormError.value = '請先輸入要重設的 Email。'; return } try { await requestPasswordReset(login.email); ElMessage.success('重設密碼信已寄出。') } catch (error) { authFormError.value = error instanceof Error ? error.message : '無法寄出重設密碼信。' } }
async function saveProfile() { if (!user.value) return; try { await updateUserSettings(user.value, profile); user.value = auth?.currentUser || user.value; ElMessage.success('個人資料已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新個人資料。') } }
async function useDemo() { await store.load(); goTrips() }
async function joinTrip() { if (!user.value) return ElMessage.warning('請先登入後加入旅行。'); if (!invite.code.trim()) return ElMessage.warning('請輸入邀請碼。'); try { const { tripId } = await joinTripByInviteCode(invite.code); await store.load(user.value.uid); showJoin.value = false; invite.code = ''; goTrip(tripId); ElMessage.success('已加入旅行。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法加入旅行。') } }
async function createTrip() { if (!create.name || !create.startDate || !create.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); if (firebaseEnabled && !user.value) return ElMessage.warning('請先登入後建立旅行。'); try { if (coverFile.value) create.coverUrl = await uploadTripCover(coverFile.value); const ownerId = user.value?.uid || 'me'; const trip = await store.createTrip({ ...create, ownerId, members: [{ id: ownerId, name: user.value?.displayName || '我', email: user.value?.email || 'me@tripmate.app', role: 'owner' }] }, user.value?.uid); showCreate.value = false; Object.assign(create, { name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); goTrip(trip.id); ElMessage.success('旅行已建立。') } catch (e) { ElMessage.error(e instanceof Error ? e.message : '建立旅行失敗。') } }
function startEditTrip() { if (!current.value) return; if (current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以編輯旅行設定。'); Object.assign(edit, { name: current.value.name, country: current.value.country, city: current.value.city, startDate: current.value.startDate, endDate: current.value.endDate, currency: current.value.currency, budget: current.value.budget }); showEdit.value = true }
async function saveTrip() { if (!current.value || !edit.name || !edit.startDate || !edit.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); try { await store.updateTrip({ ...current.value, ...edit }); showEdit.value = false; ElMessage.success('旅行設定已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。') } }
async function removeTrip() { if (!current.value || current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以刪除旅行。'); try { await ElMessageBox.confirm(`確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`, '刪除旅行', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteTrip(current.value); goTrips(); ElMessage.success('旅行已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。') } }
async function addMember() { if (!canManageMembers.value) return ElMessage.warning('只有旅行建立者可以管理成員。'); if (!current.value || !member.name || !member.email) return ElMessage.warning('請填寫成員名稱與 Email。'); try { await store.addMember(current.value, member); showMember.value = false; Object.assign(member, { name: '', email: '', role: 'editor' }); ElMessage.success('已新增旅行成員。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法新增成員。') } }
function openItemForm(entry?: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, endTime: entry.endTime || '', title: entry.title, location: entry.location, type: entry.type } : { date: '', time: '', endTime: '', title: '', location: '', type: '景點' }); showItem.value = true }
async function saveItem() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); if (!activeId.value || !item.title || !item.date) return ElMessage.warning('請填寫行程名稱與日期。'); if (item.endTime && item.time && item.endTime <= item.time) return ElMessage.warning('結束時間必須晚於開始時間。'); const conflict = currentItems.value.some((entry) => entry.id !== editingItemId.value && entry.date === item.date && item.time && entry.time && entry.time < (item.endTime || item.time) && (entry.endTime || entry.time) > item.time); if (conflict) return ElMessage.warning('此時段與既有行程重疊，請調整時間。'); try { const existing = editingItemId.value ? currentItems.value.find((entry) => entry.id === editingItemId.value) : undefined; if (existing) await store.updateItem({ ...existing, ...item }); else await store.addItem({ tripId: activeId.value, ...item, order: currentItems.value.filter((entry) => entry.date === item.date).length }); showItem.value = false; editingItemId.value = null } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。') } }
async function removeItem(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); try { await ElMessageBox.confirm(`確定刪除「${entry.title}」嗎？`, '刪除行程', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteItem(entry); ElMessage.success('行程已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。') } }
async function toggleItinerary(entry: ItineraryItem) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); await store.toggleItem(entry.id) }
function resetExpenseShares(ids = expenseParticipantIds.value) { Object.keys(expenseShares).forEach((id) => delete expenseShares[id]); const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0; ids.forEach((id) => { expenseShares[id] = amount }) }
function openExpenseForm(existing?: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); const members = current.value?.members || []; editingExpenseId.value = existing?.id || null; Object.assign(expense, existing ? { title: existing.title, amount: existing.amount, payerId: existing.payerId, kind: existing.kind, splitMode: existing.splitMode || 'equal', category: existing.category, date: existing.date } : { title: '', amount: 0, payerId: currentMember.value?.id || members[0]?.id || '', kind: 'shared', splitMode: 'equal', category: '餐飲', date: new Date().toISOString().slice(0, 10) }); expenseParticipantIds.value = existing ? expenseParticipants(existing) : members.map((member) => member.id); resetExpenseShares(); if (existing?.splitMode === 'custom' && existing.shares) Object.assign(expenseShares, existing.shares); showExpense.value = true }
function openPersonalBudgetForm() { if (!activeMemberId.value) return ElMessage.warning('請先登入後設定個人預算。'); personalBudgetInput.value = personalBudget.value; showPersonalBudget.value = true }
async function savePersonalBudget() { if (!current.value || !activeMemberId.value) return; savingPersonalBudget.value = true; try { await store.updatePersonalBudget(current.value.id, activeMemberId.value, personalBudgetInput.value); showPersonalBudget.value = false; ElMessage.success('個人預算已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存個人預算。') } finally { savingPersonalBudget.value = false } }
function syncExpenseParticipants() { if (expense.kind === 'personal') expenseParticipantIds.value = expense.payerId ? [expense.payerId] : []; else if (!expenseParticipantIds.value.length) expenseParticipantIds.value = (current.value?.members || []).map((member) => member.id); const selected = new Set(expenseParticipantIds.value); Object.keys(expenseShares).forEach((id) => { if (!selected.has(id)) delete expenseShares[id] }); expenseParticipantIds.value.forEach((id) => { if (expenseShares[id] === undefined) expenseShares[id] = 0 }) }
const customShareTotal = computed(() => expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseShares[id]) || 0), 0))
async function saveExpense() { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); if (!current.value || !expense.title || expense.amount <= 0 || !expense.payerId) return ElMessage.warning('請完整填寫支出資料。'); const participantIds = expense.kind === 'personal' ? [expense.payerId] : expenseParticipantIds.value; if (!participantIds.length) return ElMessage.warning('請至少選擇一位分攤成員。'); if (expense.kind === 'shared' && expense.splitMode === 'custom' && Math.abs(customShareTotal.value - expense.amount) > .01) return ElMessage.warning('自訂分攤總額必須等於支出金額。'); try { const customShares = expense.kind === 'shared' && expense.splitMode === 'custom' ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseShares[id]) || 0])) : {}; const payload = { tripId: current.value.id, ...expense, participantIds, shares: customShares }; const existing = editingExpenseId.value ? currentExpenses.value.find((item) => item.id === editingExpenseId.value) : undefined; if (existing) await store.updateExpense({ ...existing, ...payload }); else await store.addExpense(payload); showExpense.value = false; editingExpenseId.value = null; ElMessage.success('支出已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存支出。') } }
async function removeExpense(expense: Expense) { if (!canEditTrip.value) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。'); try { await ElMessageBox.confirm(`確定刪除「${expense.title}」嗎？`, '刪除支出', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteExpense(expense); ElMessage.success('支出已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除支出。') } }
const itineraryDays = computed(() => Object.entries(currentItems.value.reduce<Record<string, ItineraryItem[]>>((days, entry) => { (days[entry.date] ||= []).push(entry); return days }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({ date, entries: entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')) })))
const mapsUrl = (location: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
function formatItineraryDate(date: string) { const value = new Date(`${date}T00:00:00`); return Number.isNaN(value.getTime()) ? date : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日・${weekdays[value.getDay()]}` }
function itineraryDuration(entry: ItineraryItem) { if (!entry.time || !entry.endTime) return ''; const [startHour, startMinute] = entry.time.split(':').map(Number); const [endHour, endMinute] = entry.endTime.split(':').map(Number); const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute); if (!Number.isFinite(minutes) || minutes <= 0) return ''; const hours = Math.floor(minutes / 60); const remainingMinutes = minutes % 60; return `約 ${hours ? `${hours} 小時` : ''}${hours && remainingMinutes ? ' ' : ''}${remainingMinutes ? `${remainingMinutes} 分` : ''}` }
function itineraryTimeWarning(entries: ItineraryItem[], index: number) { if (index === 0) return ''; const previous = entries[index - 1]; const entry = entries[index]; if (!previous?.time || !entry?.time) return ''; if (entry.time < previous.time) return '開始時間早於上一筆行程'; if (entry.time < (previous.endTime || previous.time)) return '與上一筆行程時間重疊'; return '' }
function startDrag(event: DragEvent, entry: ItineraryItem) { if (!canEditTrip.value) return; draggedItemId.value = entry.id; if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', entry.id) } }
function setDropTarget(entry: ItineraryItem) { if (draggedItemId.value && draggedItemId.value !== entry.id) dragOverItemId.value = entry.id }
function clearDropTarget(event: DragEvent, entry: ItineraryItem) { const nextTarget = event.relatedTarget as Node | null; if (!nextTarget || !(event.currentTarget as HTMLElement).contains(nextTarget)) { if (dragOverItemId.value === entry.id) dragOverItemId.value = null } }
function endDrag() { draggedItemId.value = null; dragOverItemId.value = null }
async function reorderItem(target: ItineraryItem) { const source = currentItems.value.find((entry) => entry.id === draggedItemId.value); draggedItemId.value = null; dragOverItemId.value = null; if (!source || source.id === target.id) return; if (source.date !== target.date) return ElMessage.warning('請在同一天內調整行程順序。'); const entries = itineraryDays.value.find((day) => day.date === target.date)?.entries || []; const sourceIndex = entries.findIndex((entry) => entry.id === source.id); const targetIndex = entries.findIndex((entry) => entry.id === target.id); if (sourceIndex < 0 || targetIndex < 0) return; const reordered = [...entries]; reordered.splice(sourceIndex, 1); reordered.splice(targetIndex, 0, source); try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。') } }
async function moveItem(entry: ItineraryItem, direction: -1 | 1) { if (!canEditTrip.value) return; const entries = itineraryDays.value.find((day) => day.date === entry.date)?.entries || []; const index = entries.findIndex((item) => item.id === entry.id); const targetIndex = index + direction; if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return; const reordered = [...entries]; [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]; try { await store.reorderItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行程順序。') } }
function expenseParticipants(expense: { kind: ExpenseKind; payerId: string; participantIds: string[] }) { return expense.kind === 'personal' ? [expense.payerId] : expense.participantIds.length ? expense.participantIds : current.value?.members.map((member) => member.id) || [] }
function expenseParticipantCount(expense: Expense) { return expenseParticipants(expense).length }
function expensePayerName(payerId: string) { return current.value?.members.find((member) => member.id === payerId)?.name || '未知成員' }
function expenseShare(expense: { amount: number; kind: ExpenseKind; payerId: string; participantIds: string[]; splitMode?: 'equal' | 'custom'; shares?: Record<string, number> }) { const participants = expenseParticipants(expense); return participants.length ? expense.amount / participants.length : 0 }
function expenseShareForMember(expense: { amount: number; kind: ExpenseKind; payerId: string; participantIds: string[]; splitMode?: 'equal' | 'custom'; shares?: Record<string, number> }, memberId: string) { if (expense.kind === 'shared' && expense.splitMode === 'custom' && expense.shares) return Number(expense.shares[memberId]) || 0; return expenseParticipants(expense).includes(memberId) ? expenseShare(expense) : 0 }
const total = computed(() => currentExpenses.value.reduce((sum, expense) => sum + expense.amount, 0))
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
      <button class="brand" @click="goTrips" aria-label="TripMate 我的旅行">Trip<span>Mate</span></button>
      <div class="header-actions">
        <el-dropdown v-if="user" trigger="click">
          <button class="user-menu-trigger" type="button" aria-label="開啟帳號選單">
            <span class="user-avatar" aria-hidden="true">{{ userInitial }}</span>
            <span class="user-display-name">{{ userDisplayName }}</span>
            <span class="user-menu-caret" aria-hidden="true">⌄</span>
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
      <TripHeroHeader :trip="current" :date-range="tripDateRange" :duration="tripDuration" :can-edit-settings="canEditTripSettings" :can-manage-members="canManageMembers" :role-label="currentRole === 'editor' ? 'Editor・可編輯' : 'Viewer・唯讀'" @back="goTrips" @edit="startEditTrip" @manage-members="showMember = true" @remove="removeTrip" />
      <nav class="trip-tabs" aria-label="旅行內容導覽"><a href="#itinerary">行程</a><a href="#expenses">開銷</a><a href="#members">旅伴與結算</a></nav>
      <div class="trip-detail-layout">
        <TripItineraryCard :days="itineraryDays" :can-edit-trip="canEditTrip" :dragged-item-id="draggedItemId" :drag-over-item-id="dragOverItemId" :format-date="formatItineraryDate" :duration="itineraryDuration" :time-warning="itineraryTimeWarning" :maps-url="mapsUrl" @add="openItemForm()" @toggle="toggleItinerary" @edit="openItemForm" @remove="removeItem" @move="moveItem" @drag-start="startDrag" @drag-end="endDrag" @drag-enter="setDropTarget" @drag-leave="clearDropTarget" @drop="reorderItem" />
        <TripExpenseCard :trip="current" :expenses="currentExpenses" :total="total" :my-paid="myPaid" :my-balance="myBalance" :personal-budget="personalBudget" :personal-spent="myExpense" :can-set-personal-budget="Boolean(activeMemberId)" :can-edit-trip="canEditTrip" :payer-name="expensePayerName" :participant-count="expenseParticipantCount" :share="expenseShare" @add="openExpenseForm()" @set-personal-budget="openPersonalBudgetForm" @edit="openExpenseForm" @remove="removeExpense" />
        <TripMembersSettlementCard :trip="current" :balances="balances" :suggestions="settlementSuggestions" :settlements="currentSettlements" :can-manage-members="canManageMembers" :can-edit-trip="canEditTrip" :member-paid="memberPaid" :member-name="memberName" @manage-members="showMember = true" @copy-invite="copyInvite" @settle="confirmSettlement" @undo-settlement="removeSettlement" />
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
</el-form>
<template #footer>
<el-button type="danger" plain @click="removeTrip">刪除旅行</el-button>
<el-button @click="showEdit=false">取消</el-button>
<el-button type="primary" @click="saveTrip">儲存變更</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showMember" title="邀請旅行成員" width="min(92vw, 460px)">
<el-form label-position="top">
<el-form-item label="名稱">
<el-input v-model="member.name" />
</el-form-item>
<el-form-item label="Email">
<el-input v-model="member.email" />
</el-form-item>
<el-form-item label="權限">
<el-select v-model="member.role">
<el-option label="Editor — 可共同編輯" value="editor" />
<el-option label="Viewer — 僅能查看" value="viewer" />
</el-select>
</el-form-item>
</el-form>
<template #footer>
<el-button @click="showMember=false">取消</el-button>
<el-button type="primary" @click="addMember">加入成員</el-button>
</template>
</el-dialog>
  <el-dialog v-model="showItem" :title="editingItemId ? '編輯行程' : '新增行程'" class="itinerary-dialog" width="min(92vw, 520px)">
<el-form class="itinerary-form" label-position="top">
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
<el-form-item label="地點">
<el-input v-model="item.location" />
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
</template>
