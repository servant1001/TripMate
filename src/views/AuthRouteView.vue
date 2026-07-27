<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripStore } from '../stores/trip'
import { firebaseEnabled } from '../services/firebase'
import { useTripmateSession } from '../composables/useTripmateSession'

const route = useRoute()
const router = useRouter()
const store = useTripStore()

const {
  user,
  authResolving,
  login,
  authMode,
  authSubmitting,
  authFormError,
  initSession,
  submitEmailLogin,
  submitEmailRegistration,
  submitGoogleLogin,
  resetPassword,
} = useTripmateSession()

function goTrips() {
  void router.push({ name: 'trips' })
}

async function useDemo() {
  await store.load()
  goTrips()
}

watch(
  () => route.name,
  (name) => {
    authMode.value = name === 'register' ? 'register' : 'login'
    authFormError.value = ''
  },
  { immediate: true },
)

watch(
  [authResolving, user, () => route.query.redirect],
  ([resolving, signedInUser, redirect]) => {
    if (resolving || !signedInUser) return
    const target = typeof redirect === 'string' ? redirect : '/trips'
    void router.replace(target)
  },
  { immediate: true },
)

onMounted(() => {
  void initSession()
})
</script>

<template>
  <section v-if="authResolving" class="auth-loading" aria-live="polite">
    <div>
      <strong>TripMate</strong>
      <p>正在確認登入狀態…</p>
    </div>
  </section>

  <section v-else class="auth-page">
    <div class="auth-shell">
      <aside class="auth-brand-panel">
        <button class="auth-logo" @click="goTrips" aria-label="TripMate 首頁">
          Trip<span>Mate</span>
        </button>
        <div class="auth-brand-copy">
          <p class="auth-kicker">TRAVEL TOGETHER</p>
          <h1>和旅伴一起，<br />安排每一段旅程</h1>
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
        <button class="mobile-auth-logo" @click="goTrips" aria-label="TripMate 首頁">
          Trip<span>Mate</span>
        </button>
        <div class="auth-card">
          <div class="auth-card-heading">
            <h2>{{ authMode === 'login' ? '歡迎回來' : '建立你的帳號' }}</h2>
            <p>
              {{
                authMode === 'login'
                  ? '登入 TripMate，繼續規劃下一段旅程。'
                  : '加入 TripMate，和旅伴一起開始規劃。'
              }}
            </p>
          </div>

          <form
            class="auth-form"
            @submit.prevent="
              authMode === 'login'
                ? submitEmailLogin()
                : submitEmailRegistration()
            "
          >
            <div class="auth-field">
              <label for="tripmate-email">Email</label>
              <el-input
                id="tripmate-email"
                v-model="login.email"
                type="email"
                placeholder="name@example.com"
                autocomplete="email"
                :disabled="authSubmitting"
              />
            </div>

            <div class="auth-field">
              <div class="auth-field-label">
                <label for="tripmate-password">密碼</label>
                <button
                  v-if="firebaseEnabled && authMode === 'login'"
                  type="button"
                  class="forgot-password"
                  @click="resetPassword"
                >
                  忘記密碼？
                </button>
              </div>
              <el-input
                id="tripmate-password"
                v-model="login.password"
                type="password"
                placeholder="輸入密碼"
                show-password
                :autocomplete="
                  authMode === 'login' ? 'current-password' : 'new-password'
                "
                :disabled="authSubmitting"
              />
            </div>

            <p v-if="authFormError" class="auth-form-error" role="alert">
              {{ authFormError }}
            </p>
            <el-button
              class="auth-primary-button"
              native-type="submit"
              :loading="authSubmitting"
              :disabled="authSubmitting"
            >
              {{ authMode === 'login' ? '登入' : '免費註冊' }}
            </el-button>
          </form>

          <template v-if="firebaseEnabled">
            <div class="auth-divider"><span>或繼續使用</span></div>
            <el-button
              class="google-auth-button"
              :loading="authSubmitting"
              :disabled="authSubmitting"
              @click="submitGoogleLogin"
            >
              <span class="google-mark" aria-hidden="true">G</span>使用 Google 登入
            </el-button>
            <p class="auth-switch">
              {{ authMode === 'login' ? '還沒有帳號？' : '已經有帳號？' }}
              <button
                type="button"
                @click="
                  authMode = authMode === 'login' ? 'register' : 'login';
                  authFormError = ''
                "
              >
                {{ authMode === 'login' ? '免費註冊' : '回到登入' }}
              </button>
            </p>
          </template>

          <button v-else type="button" class="auth-demo-button" @click="useDemo">
            以示範帳號繼續
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
