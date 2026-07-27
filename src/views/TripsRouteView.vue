<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import TripManagementDialogs from '../components/TripManagementDialogs.vue'
import { useTripStore } from '../stores/trip'
import type { Trip } from '../types'
import { uploadTripCover, joinTripByInviteCode } from '../services/cloudinary'
import { firebaseEnabled } from '../services/firebase'
import { useTripmateSession } from '../composables/useTripmateSession'

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

const showCreate = ref(false)
const showEdit = ref(false)
const showJoin = ref(false)
const savingTrip = ref(false)
const coverFile = ref<File>()
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

function goTrips() {
  void router.push({ name: 'trips' })
}

function goLogin() {
  void router.push({ name: 'login' })
}

function goProfile() {
  void router.push({ name: 'profile' })
}

function goTrip(tripId: string) {
  void router.push({ name: 'trip-tab', params: { tripId, tab: 'overview' } })
}

function openTrip(trip: Trip) {
  goTrip(trip.id)
}

function selectCreateCover(event: Event) {
  coverFile.value = (event.target as HTMLInputElement).files?.[0]
}

async function handleSignOut() {
  await signOutUser()
}

async function joinTrip() {
  if (!user.value) {
    ElMessage.warning('請先登入後加入旅行。')
    return
  }
  if (!invite.code.trim()) {
    ElMessage.warning('請輸入邀請碼。')
    return
  }
  try {
    const { tripId } = await joinTripByInviteCode(invite.code)
    await store.load(user.value.uid)
    showJoin.value = false
    invite.code = ''
    goTrip(tripId)
    ElMessage.success('已加入旅行。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法加入旅行。')
  }
}

async function createTrip() {
  if (!create.name || !create.startDate || !create.endDate) {
    ElMessage.warning('請填寫旅行名稱與日期。')
    return
  }
  if (firebaseEnabled && !user.value) {
    ElMessage.warning('請先登入後建立旅行。')
    return
  }
  try {
    if (coverFile.value) create.coverUrl = await uploadTripCover(coverFile.value)
    const ownerId = user.value?.uid || 'me'
    const trip = await store.createTrip(
      {
        ...create,
        ownerId,
        members: [
          {
            id: ownerId,
            name: user.value?.displayName || '我',
            email: user.value?.email || 'me@tripmate.app',
            role: 'owner',
          },
        ],
      },
      user.value?.uid,
    )
    showCreate.value = false
    Object.assign(create, {
      name: '',
      country: '日本',
      city: '東京',
      startDate: '',
      endDate: '',
      currency: 'JPY',
      budget: 0,
      coverUrl: '',
    })
    coverFile.value = undefined
    goTrip(trip.id)
    ElMessage.success('旅行已建立。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '建立旅行失敗。')
  }
}

watch(
  () => route.name,
  (name) => {
    showCreate.value = name === 'trip-create'
  },
  { immediate: true },
)

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
</script>

<template>
  <main class="app-shell">
    <AppHeader
      :signed-in="Boolean(user)"
      :user-display-name="userDisplayName"
      :user-initial="userInitial"
      @go-trips="goTrips"
      @go-profile="goProfile"
      @go-login="goLogin"
      @sign-out="handleSignOut"
    />

    <section v-if="authResolving" class="auth-loading" aria-live="polite">
      <div>
        <strong>TripMate</strong>
        <p>正在確認登入狀態…</p>
      </div>
    </section>

    <section v-else class="page">
      <div class="hero">
        <div>
          <p class="eyebrow">我的旅程</p>
          <h1>下一趟旅行，從一起規劃開始。</h1>
          <p>集中管理行程、花費、成員與旅行待辦。</p>
        </div>
        <div class="actions">
          <el-button v-if="firebaseEnabled" size="large" @click="showJoin = true">
            輸入邀請碼
          </el-button>
          <el-button type="primary" size="large" @click="showCreate = true">
            ＋ 建立旅行
          </el-button>
        </div>
      </div>

      <div v-if="store.trips.length" class="trip-grid">
        <article
          v-for="trip in store.trips"
          :key="trip.id"
          class="trip-card"
          @click="openTrip(trip)"
        >
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
        <el-button type="primary" @click="showCreate = true">建立旅行</el-button>
      </div>
    </section>

    <TripManagementDialogs
      v-model:show-join="showJoin"
      v-model:show-create="showCreate"
      v-model:show-edit="showEdit"
      v-model:invite-code="invite.code"
      :create-form="create"
      :edit-form="edit"
      :edit-cover-preview="''"
      :saving-trip="savingTrip"
      @select-create-cover="selectCreateCover"
      @select-edit-cover="() => undefined"
      @remove-edit-cover="() => undefined"
      @join-trip="joinTrip"
      @create-trip="createTrip"
      @save-trip="() => undefined"
      @remove-trip="() => undefined"
    />
  </main>
</template>
