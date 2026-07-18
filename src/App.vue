<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { User } from 'firebase/auth'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import { useTripStore } from './stores/trip'
import type { ExpenseKind, ItineraryItem, Role, Trip } from './types'
import { uploadTripCover } from './services/cloudinary'
import { auth, ensureUserProfile, firebaseEnabled, logOut, registerWithEmail, requestPasswordReset, signInWithEmail, signInWithGoogle, updateUserSettings } from './services/firebase'
import { joinTripByInviteCode } from './services/cloudinary'

const router = useRouter(); const route = useRoute(); const store = useTripStore(); const activeId = ref(''); const screen = ref<'trips'|'trip'|'login'|'profile'>('trips'); const authResolving = ref(firebaseEnabled && Boolean(auth)); const showCreate = ref(false); const showEdit = ref(false); const showJoin = ref(false); const showMember = ref(false); const showItem = ref(false); const showExpense = ref(false)
const current = computed(() => store.trip(activeId.value)); const currentItems = computed(() => store.items(activeId.value)); const currentExpenses = computed(() => store.tripExpenses(activeId.value));
const create = reactive({ name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); const coverFile = ref<File>(); const edit = reactive({ name: '', country: '', city: '', startDate: '', endDate: '', currency: 'JPY', budget: 0 })
const member = reactive({ name: '', email: '', role: 'editor' as Role }); const item = reactive({ date: '', time: '', title: '', location: '', type: '景點' }); const editingItemId = ref<string | null>(null); const expense = reactive({ title: '', amount: 0, payerId: '', kind: 'shared' as ExpenseKind, category: '餐飲', date: '' })
const invite = reactive({ code: '' })
const user = ref<User | null>(null); const login = reactive({ email: '', password: '' }); const authMode = ref<'login' | 'register'>('login'); let removeAuthListener: (() => void) | undefined
const profile = reactive({ displayName: '', defaultCurrency: 'JPY', timezone: 'Asia/Taipei' })
function goTrips() { void router.push({ name: 'trips' }) }
function goLogin() { void router.push({ name: 'login' }) }
function goProfile() { void router.push({ name: 'profile' }) }
function goTrip(tripId: string) { void router.push({ name: 'trip-dashboard', params: { tripId } }) }
function syncRoute() { const name = String(route.name || 'trips'); if (name === 'login' || name === 'register' || name === 'forgot-password') { screen.value = 'login'; authMode.value = name === 'register' ? 'register' : 'login'; return } if (name === 'profile') { screen.value = 'profile'; if (user.value) profile.displayName = user.value.displayName || user.value.email?.split('@')[0] || ''; return } if (name === 'trip-dashboard') { activeId.value = String(route.params.tripId); screen.value = 'trip'; return } screen.value = 'trips'; showCreate.value = name === 'trip-create' }
watch(() => route.fullPath, syncRoute, { immediate: true })
function authErrorMessage(error: unknown) { const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''; if (code === 'auth/unauthorized-domain') return '此網站尚未加入 Firebase Authentication 的授權網域。'; if (code === 'auth/operation-not-allowed') return 'Firebase 尚未啟用 Google 登入方式。'; if (code === 'auth/account-exists-with-different-credential') return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'; return error instanceof Error ? error.message : 'Google 登入未完成，請再試一次。' }
onMounted(async () => { if (!firebaseEnabled || !auth) { await store.load(); return } try { await getRedirectResult(auth) } catch (error) { ElMessage.error(authErrorMessage(error)) } removeAuthListener = onAuthStateChanged(auth, async (signedInUser) => { try { user.value = signedInUser; if (signedInUser) { await ensureUserProfile(signedInUser); await store.load(signedInUser.uid); if (route.meta.public) { const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/trips'; await router.replace(redirect) } } else { store.$patch({ trips: [], itinerary: [], expenses: [] }); if (!route.meta.public) await router.replace({ name: 'login', query: { redirect: route.fullPath } }) } } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法載入登入資料。') } finally { authResolving.value = false } }) })
onUnmounted(() => removeAuthListener?.())
async function submitEmailLogin() { try { await signInWithEmail(login.email, login.password) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '登入失敗。') } }
async function submitEmailRegistration() { if (login.password.length < 6) return ElMessage.warning('密碼至少需要 6 個字元。'); try { await registerWithEmail(login.email, login.password) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '註冊失敗。') } }
async function submitGoogleLogin() { try { await signInWithGoogle() } catch (error) { ElMessage.error(authErrorMessage(error)) } }
async function resetPassword() { if (!login.email) return ElMessage.warning('請先輸入 Email。'); try { await requestPasswordReset(login.email); ElMessage.success('重設密碼信已寄出。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法寄出重設密碼信。') } }
async function saveProfile() { if (!user.value) return; try { await updateUserSettings(user.value, profile); user.value = auth?.currentUser || user.value; ElMessage.success('個人資料已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新個人資料。') } }
async function useDemo() { await store.load(); goTrips() }
async function joinTrip() { if (!user.value) return ElMessage.warning('請先登入後加入旅行。'); if (!invite.code.trim()) return ElMessage.warning('請輸入邀請碼。'); try { const { tripId } = await joinTripByInviteCode(invite.code); await store.load(user.value.uid); showJoin.value = false; invite.code = ''; goTrip(tripId); ElMessage.success('已加入旅行。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法加入旅行。') } }
async function createTrip() { if (!create.name || !create.startDate || !create.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); if (firebaseEnabled && !user.value) return ElMessage.warning('請先登入後建立旅行。'); try { if (coverFile.value) create.coverUrl = await uploadTripCover(coverFile.value); const ownerId = user.value?.uid || 'me'; const trip = await store.createTrip({ ...create, ownerId, members: [{ id: ownerId, name: user.value?.displayName || '我', email: user.value?.email || 'me@tripmate.app', role: 'owner' }] }, user.value?.uid); showCreate.value = false; Object.assign(create, { name: '', country: '日本', city: '東京', startDate: '', endDate: '', currency: 'JPY', budget: 0, coverUrl: '' }); goTrip(trip.id); ElMessage.success('旅行已建立。') } catch (e) { ElMessage.error(e instanceof Error ? e.message : '建立旅行失敗。') } }
function startEditTrip() { if (!current.value) return; if (current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以編輯旅行設定。'); Object.assign(edit, { name: current.value.name, country: current.value.country, city: current.value.city, startDate: current.value.startDate, endDate: current.value.endDate, currency: current.value.currency, budget: current.value.budget }); showEdit.value = true }
async function saveTrip() { if (!current.value || !edit.name || !edit.startDate || !edit.endDate) return ElMessage.warning('請填寫旅行名稱與日期。'); try { await store.updateTrip({ ...current.value, ...edit }); showEdit.value = false; ElMessage.success('旅行設定已更新。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。') } }
async function removeTrip() { if (!current.value || current.value.ownerId !== user.value?.uid) return ElMessage.warning('只有旅行建立者可以刪除旅行。'); try { await ElMessageBox.confirm(`確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`, '刪除旅行', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteTrip(current.value); goTrips(); ElMessage.success('旅行已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。') } }
async function addMember() { if (!current.value || !member.name || !member.email) return ElMessage.warning('請填寫成員名稱與 Email。'); try { await store.addMember(current.value, member); showMember.value = false; Object.assign(member, { name: '', email: '', role: 'editor' }); ElMessage.success('已新增旅行成員。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法新增成員。') } }
function openItemForm(entry?: ItineraryItem) { editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, title: entry.title, location: entry.location, type: entry.type } : { date: '', time: '', title: '', location: '', type: '景點' }); showItem.value = true }
async function saveItem() { if (!activeId.value || !item.title || !item.date) return ElMessage.warning('請填寫行程名稱與日期。'); try { const existing = editingItemId.value ? currentItems.value.find((entry) => entry.id === editingItemId.value) : undefined; if (existing) await store.updateItem({ ...existing, ...item }); else await store.addItem({ tripId: activeId.value, ...item }); showItem.value = false; editingItemId.value = null } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。') } }
async function removeItem(entry: ItineraryItem) { try { await ElMessageBox.confirm(`確定刪除「${entry.title}」嗎？`, '刪除行程', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteItem(entry); ElMessage.success('行程已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。') } }
async function addExpense() { if (!current.value || !expense.title || expense.amount <= 0 || !expense.payerId) return ElMessage.warning('請完整填寫支出資料。'); await store.addExpense({ tripId: current.value.id, ...expense, participantIds: current.value.members.map((m) => m.id) }); showExpense.value = false; Object.assign(expense, { title: '', amount: 0, payerId: '', kind: 'shared', category: '餐飲', date: '' }) }
const total = computed(() => currentExpenses.value.reduce((sum, e) => sum + e.amount, 0)); const balances = computed(() => { const trip = current.value; if (!trip) return []; const paid = Object.fromEntries(trip.members.map((m) => [m.id, 0])); const owed = Object.fromEntries(trip.members.map((m) => [m.id, 0])); currentExpenses.value.forEach((e) => { paid[e.payerId] += e.amount; const shares = e.kind === 'personal' ? [e.payerId] : e.participantIds; shares.forEach((id) => owed[id] += e.amount / shares.length) }); return trip.members.map((m) => ({ ...m, balance: paid[m.id] - owed[m.id] })) })
function openTrip(t: Trip) { goTrip(t.id) }
async function copyInvite() { await navigator.clipboard.writeText(current.value?.inviteCode || ''); ElMessage.success('邀請碼已複製。') }
async function signOutUser() { await logOut(); ElMessage.success('已登出。') }
</script>

<template>
  <main class="app-shell">
    <header>
<button class="brand" @click="goTrips">Trip<span>Mate</span>
</button>
<div class="header-actions">
<span class="status">{{ firebaseEnabled ? 'Firebase 已連線' : '本機示範模式' }}</span>
<el-button v-if="user" text @click="goProfile">{{ user.displayName || user.email }}</el-button>
<el-button v-if="user" plain @click="signOutUser">登出</el-button>
<el-button v-else plain @click="goLogin">帳號</el-button>
</div>
</header>
    <section v-if="authResolving" class="auth-loading" aria-live="polite">
<div>
<strong>TripMate</strong>
<p>正在確認登入狀態…</p>
</div>
</section>
    <section v-if="screen === 'login'" class="auth panel">
<div>
<p class="eyebrow">歡迎回來</p>
<h1>和旅伴一起，安排每一段旅程。</h1>
<p>{{ firebaseEnabled ? '使用你的 TripMate 帳號登入，即可安全地同步旅行資料。' : '尚未設定 Firebase，因此可先使用本機示範模式體驗完整旅行管理流程。' }}</p>
</div>
<div class="auth-card">
<h2>{{ authMode === 'login' ? '登入 TripMate' : '建立 TripMate 帳號' }}</h2>
<el-input v-model="login.email" placeholder="Email" autocomplete="email" />
<el-input v-model="login.password" type="password" placeholder="密碼（至少 6 個字元）" show-password :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" />
<el-button type="primary" @click="authMode === 'login' ? submitEmailLogin() : submitEmailRegistration()">{{ authMode === 'login' ? 'Email 登入' : '建立帳號' }}</el-button>
<el-button v-if="firebaseEnabled" @click="submitGoogleLogin">使用 Google 登入</el-button>
<button v-if="firebaseEnabled && authMode === 'login'" class="link" @click="resetPassword">忘記密碼</button>
<button v-if="firebaseEnabled" class="link" @click="authMode = authMode === 'login' ? 'register' : 'login'">{{ authMode === 'login' ? '還沒有帳號？立即註冊' : '已有帳號？回到登入' }}</button>
<button v-else class="link" @click="useDemo">以示範帳號繼續</button>
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
    <section v-else-if="current" class="page">
<button class="back" @click="goTrips">← 所有旅行</button>
<div class="trip-head">
<div>
<p class="eyebrow">{{ current.country }} · {{ current.city }}</p>
<h1>{{ current.name }}</h1>
<p>{{ current.startDate }} — {{ current.endDate }} · 預算 {{ current.currency }} {{ current.budget.toLocaleString() }}</p>
</div>
<div class="actions">
<el-button v-if="current.ownerId === user?.uid" @click="startEditTrip">編輯旅行</el-button>
<el-button @click="showMember=true">成員 {{ current.members.length }}</el-button>
<el-button type="primary" @click="openItemForm()">＋ 新增行程</el-button>
</div>
</div>
<nav class="tabs">
<a href="#itinerary">行程</a>
<a href="#expenses">開銷</a>
<a href="#members">成員</a>
</nav>
<div class="dashboard">
<section id="itinerary" class="panel section">
<div class="section-title">
<div>
<p class="eyebrow">ITINERARY</p>
<h2>每日行程</h2>
</div>
<el-button text type="primary" @click="openItemForm()">新增</el-button>
</div>
<div v-if="currentItems.length" class="timeline">
<div v-for="entry in currentItems" :key="entry.id" class="event">
<el-checkbox :model-value="entry.completed" @change="store.toggleItem(entry.id)" />
<time>{{ entry.date }} {{ entry.time }}</time>
<strong>{{ entry.title }}</strong>
<span>{{ entry.type }} · {{ entry.location || '未設定地點' }}</span>
<span class="event-actions"><button class="link" @click="openItemForm(entry)">編輯</button><button class="link danger-link" @click="removeItem(entry)">刪除</button></span>
</div>
</div>
<p v-else class="muted">尚未安排任何行程。從抵達日的第一站開始吧。</p>
</section>
<section id="expenses" class="panel section">
<div class="section-title">
<div>
<p class="eyebrow">EXPENSES</p>
<h2>旅行開銷</h2>
</div>
<el-button text type="primary" @click="showExpense=true">新增支出</el-button>
</div>
<div class="expense-total">
<span>目前支出</span>
<strong>{{ current.currency }} {{ total.toLocaleString() }}</strong>
<small v-if="current.budget">預算使用 {{ Math.round(total / current.budget * 100) }}%</small>
</div>
<ul v-if="currentExpenses.length" class="expenses">
<li v-for="e in currentExpenses" :key="e.id">
<span>{{ e.category }}</span>
<div>
<strong>{{ e.title }}</strong>
<small>{{ e.kind === 'shared' ? '共同分攤' : '個人支出' }}</small>
</div>
<b>{{ current.currency }} {{ e.amount.toLocaleString() }}</b>
</li>
</ul>
<p v-else class="muted">尚未記錄支出。</p>
</section>
<section id="members" class="panel section">
<div class="section-title">
<div>
<p class="eyebrow">COMPANIONS</p>
<h2>旅伴與結算</h2>
</div>
<el-button text type="primary" @click="showMember=true">邀請成員</el-button>
</div>
<div class="invite">邀請碼 <strong>{{ current.inviteCode }}</strong>
<button @click="copyInvite">複製</button>
</div>
<div class="balances">
<div v-for="person in balances" :key="person.id">
<span>{{ person.name }} <em>{{ person.role }}</em>
</span>
<b :class="person.balance >= 0 ? 'positive' : 'negative'">{{ person.balance >= 0 ? '應收' : '應付' }} {{ current.currency }} {{ Math.abs(person.balance).toFixed(0) }}</b>
</div>
</div>
</section>
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
  <el-dialog v-model="showItem" :title="editingItemId ? '編輯行程' : '新增行程'" width="min(92vw, 460px)">
<el-form label-position="top">
<el-form-item label="行程名稱">
<el-input v-model="item.title" />
</el-form-item>
<div class="two-col">
<el-form-item label="日期">
<el-date-picker v-model="item.date" type="date" value-format="YYYY-MM-DD" />
</el-form-item>
<el-form-item label="時間">
<el-time-picker v-model="item.time" value-format="HH:mm" format="HH:mm" />
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
  <el-dialog v-model="showExpense" title="新增支出" width="min(92vw, 460px)">
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
<el-select v-model="expense.payerId">
<el-option v-for="m in current?.members" :key="m.id" :label="m.name" :value="m.id" />
</el-select>
</el-form-item>
<div class="two-col">
<el-form-item label="類型">
<el-select v-model="expense.kind">
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
</el-form>
<template #footer>
<el-button @click="showExpense=false">取消</el-button>
<el-button type="primary" @click="addExpense">儲存支出</el-button>
</template>
</el-dialog>
</template>
