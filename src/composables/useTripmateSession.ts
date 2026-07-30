import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { User } from 'firebase/auth'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { useTripStore } from '../stores/trip'
import {
  auth,
  ensureUserProfile,
  firebaseEnabled,
  logOut,
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  updateUserSettings,
} from '../services/firebase'

const user = ref<User | null>(null)
const authResolving = ref(firebaseEnabled && Boolean(auth))
const login = reactive({ email: '', password: '' })
const authMode = ref<'login' | 'register'>('login')
const authSubmitting = ref(false)
const authFormError = ref('')
const profile = reactive({
  displayName: '',
  defaultCurrency: 'JPY',
  timezone: 'Asia/Taipei',
})

let initialized = false
let initPromise: Promise<void> | null = null

function authErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : ''
  if (code === 'auth/unauthorized-domain')
    return '此網站尚未加入 Firebase Authentication 的授權網域。'
  if (code === 'auth/operation-not-allowed')
    return 'Firebase 尚未啟用 Google 登入方式。'
  if (code === 'auth/account-exists-with-different-credential')
    return '此 Email 已用其他登入方式註冊，請改用原本的方式登入。'
  return error instanceof Error
    ? error.message
    : 'Google 登入未完成，請再試一次。'
}

function patchEmptyStore(store: ReturnType<typeof useTripStore>) {
  store.$patch({
    trips: [],
    itinerary: [],
    expenses: [],
    settlements: [],
    todos: [],
    packingItems: [],
    bookings: [],
    favorites: [],
    albumFolders: [],
    albumPhotos: [],
    shoppingItems: [],
    categoryBudgets: {},
    dailyBudgets: {},
    insurances: [],
    insuranceStatuses: {},
    paymentTools: [],
    paymentToolSummaries: [],
    rewardRules: [],
    paymentTransactions: [],
    storedValueBalances: [],
  })
}

function syncProfileFromUser(signedInUser: User | null) {
  profile.displayName =
    signedInUser?.displayName || signedInUser?.email?.split('@')[0] || ''
}

export function useTripmateSession() {
  const store = useTripStore()
  const activeAuth = auth

  async function initSession() {
    if (initialized) {
      await initPromise
      return
    }

    initialized = true

    if (!firebaseEnabled || !activeAuth) {
      await store.load()
      authResolving.value = false
      syncProfileFromUser(null)
      return
    }

    try {
      await getRedirectResult(activeAuth)
    } catch (error) {
      ElMessage.error(authErrorMessage(error))
    }

    initPromise = new Promise((resolve) => {
      let firstResolved = false

      onAuthStateChanged(activeAuth, async (signedInUser) => {
        try {
          user.value = signedInUser
          syncProfileFromUser(signedInUser)

          if (signedInUser) {
            await ensureUserProfile(signedInUser)
            await store.load(signedInUser.uid)
          } else {
            patchEmptyStore(store)
          }
        } catch (error) {
          ElMessage.error(
            error instanceof Error ? error.message : '無法載入登入資料。',
          )
        } finally {
          authResolving.value = false
          if (!firstResolved) {
            firstResolved = true
            resolve()
          }
        }
      })
    })

    await initPromise
  }

  async function submitEmailLogin() {
    authFormError.value = ''
    authSubmitting.value = true
    try {
      await signInWithEmail(login.email, login.password)
    } catch (error) {
      authFormError.value =
        error instanceof Error ? error.message : '登入失敗，請確認 Email 與密碼。'
    } finally {
      authSubmitting.value = false
    }
  }

  async function submitEmailRegistration() {
    authFormError.value = ''
    if (login.password.length < 6) {
      authFormError.value = '密碼至少需要 6 個字元。'
      return
    }
    authSubmitting.value = true
    try {
      await registerWithEmail(login.email, login.password)
    } catch (error) {
      authFormError.value =
        error instanceof Error ? error.message : '註冊失敗，請稍後再試。'
    } finally {
      authSubmitting.value = false
    }
  }

  async function submitGoogleLogin() {
    authFormError.value = ''
    authSubmitting.value = true
    try {
      await signInWithGoogle()
    } catch (error) {
      authFormError.value = authErrorMessage(error)
    } finally {
      authSubmitting.value = false
    }
  }

  async function resetPassword() {
    authFormError.value = ''
    if (!login.email) {
      authFormError.value = '請先輸入要重設的 Email。'
      return
    }
    try {
      await requestPasswordReset(login.email)
      ElMessage.success('重設密碼信已寄出。')
    } catch (error) {
      authFormError.value =
        error instanceof Error ? error.message : '無法寄出重設密碼信。'
    }
  }

  async function saveProfile() {
    if (!user.value) return
    try {
      await updateUserSettings(user.value, profile)
      user.value = auth?.currentUser || user.value
      syncProfileFromUser(user.value)
      ElMessage.success('個人資料已更新。')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '無法更新個人資料。')
    }
  }

  async function signOutUser() {
    await logOut()
    ElMessage.success('已登出。')
  }

  const userDisplayName = computed(
    () => user.value?.displayName || user.value?.email?.split('@')[0] || '旅伴',
  )
  const userInitial = computed(() => userDisplayName.value.slice(0, 1).toUpperCase())

  return {
    user,
    authResolving,
    login,
    authMode,
    authSubmitting,
    authFormError,
    profile,
    userDisplayName,
    userInitial,
    initSession,
    submitEmailLogin,
    submitEmailRegistration,
    submitGoogleLogin,
    resetPassword,
    saveProfile,
    signOutUser,
  }
}
