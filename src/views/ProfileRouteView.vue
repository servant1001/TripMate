<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { firebaseEnabled } from '../services/firebase'
import { useTripmateSession } from '../composables/useTripmateSession'

const route = useRoute()
const router = useRouter()

const {
  user,
  authResolving,
  profile,
  initSession,
  saveProfile,
  signOutUser,
  userDisplayName,
  userInitial,
} = useTripmateSession()

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

    <section v-else class="page profile-page">
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
  </main>
</template>
