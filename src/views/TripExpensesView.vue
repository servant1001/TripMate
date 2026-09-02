<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripExpenseCard from '../components/TripExpenseCard.vue'
import UnifiedConsumptionDialog, { type ExpenseDraft } from '../components/UnifiedConsumptionDialog.vue'
import { uploadTripImage } from '../services/cloudinary'
import { getLatestExchangeRate } from '../services/exchangeRates'
import { useTripStore } from '../stores/trip'
import type { Expense, Trip } from '../types'
import { expenseKindParticipants, participantsForExpense, payerSharesForExpense } from '../utils/expenseSplit'

const props = defineProps<{
  trip: Trip
  expenses: Expense[]
  total: number
  myPaid: number
  myPaidInTrip: number
  myBalance: number
  myBalanceInTrip: number
  personalBudgetMemberId?: string
  personalBudget: number
  personalSpent: number
  accountingCurrency: string
  accountingRate: number
  accountingRateDate: string
  expenseAmountInAccounting: (expense: Expense) => number
  toTripCurrencyAmount: (amount: number) => number
  categoryBudgetValues: Record<string, number>
  categoryBudgetOptions: string[]
  categoryBudgets: { category: string; budget: number; spent: number }[]
  dailyBudget: number
  dailyExpenses: { date: string; spent: number }[]
  canSetPersonalBudget: boolean
  canManageCategoryBudgets: boolean
  canEdit: boolean
  userId: string
  payerLabel: (expense: Expense) => string
  splitLabel: (expense: Expense) => string
  participantCount: (expense: Expense) => number
  share: (expense: Expense) => number
}>()

const store = useTripStore()

const showExpense = ref(false)
const savingExpense = ref(false)
const editingExpenseId = ref<string | null>(null)
const expenseParticipantIds = ref<string[]>([])
const expensePayerIds = ref<string[]>([])
const expenseReceiptFile = ref<File>()
const expenseReceiptUrl = ref('')
const expenseReceiptPreview = ref('')
const expenseSourceCurrency = ref('')
const expenseSourceAmount = ref(0)
const expenseExchangeRate = ref(1)
const expenseRateLoading = ref(false)
const expenseRateDate = ref('')
const expenseNote = ref('')

const expenseShares = reactive<Record<string, number>>({})
const expenseRatios = reactive<Record<string, number>>({})
const expenseSplitUnits = reactive<Record<string, number>>({})
const expensePayerShares = reactive<Record<string, number>>({})
const showPersonalBudget = ref(false)
const savingPersonalBudget = ref(false)
const personalBudgetInput = ref(0)
const showCategoryBudgets = ref(false)
const savingCategoryBudgets = ref(false)
const categoryBudgetDraft = reactive<Record<string, number>>({})
const categoryBudgetRate = ref(1)
const categoryBudgetRateDate = ref('')
const categoryBudgetRateLoading = ref(false)
const showDailyBudget = ref(false)
const savingDailyBudget = ref(false)
const dailyBudgetInput = ref(0)

const expense = reactive<ExpenseDraft>({
  title: '',
  amount: 0,
  payerId: '',
  kind: 'shared',
  splitMode: 'equal',
  category: '餐飲',
  date: '',
})

const memberIds = computed(() => props.trip.members.map((member) => member.id))
const sourceConversionActive = computed(() => {
  const source = expenseSourceCurrency.value.trim().toUpperCase()
  const tripCurrency = (props.trip.currency || '').trim().toUpperCase()
  return Boolean(source && tripCurrency && source !== tripCurrency)
})

async function getExpenseDateRate(from: string, to: string, date: string) {
  try {
    return await getLatestExchangeRate(from, to, date ? { date } : undefined)
  } catch (error) {
    if (!date) throw error
    // 未來日期尚未有歷史匯率時，退回最新參考匯率，並以回傳日期標示實際採用的資料日。
    return getLatestExchangeRate(from, to)
  }
}

const customShareTotal = computed(() =>
  expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseShares[id]) || 0), 0),
)
const ratioTotal = computed(() =>
  expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseRatios[id]) || 0), 0),
)
const splitUnitTotal = computed(() =>
  expenseParticipantIds.value.reduce((sum, id) => sum + (Number(expenseSplitUnits[id]) || 0), 0),
)
const payerTotal = computed(() =>
  expensePayerIds.value.reduce((sum, id) => sum + (Number(expensePayerShares[id]) || 0), 0),
)

function localDate() {
  return new Date().toISOString().slice(0, 10)
}

function expenseParticipants(entry: Pick<Expense, 'kind' | 'payerId' | 'participantIds'>) {
  return participantsForExpense(entry, memberIds.value)
}

function resetExpenseSplitValues(ids = expenseParticipantIds.value) {
  const clear = (value: Record<string, number>) => {
    Object.keys(value).forEach((id) => delete value[id])
  }
  clear(expenseShares)
  clear(expenseRatios)
  clear(expenseSplitUnits)
  const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0
  const ratio = ids.length ? Number((100 / ids.length).toFixed(2)) : 0
  ids.forEach((id) => {
    expenseShares[id] = amount
    expenseRatios[id] = ratio
    expenseSplitUnits[id] = 1
  })
}

function resetExpensePayerValues(ids = expensePayerIds.value) {
  Object.keys(expensePayerShares).forEach((id) => delete expensePayerShares[id])
  const amount = ids.length === 1
    ? Number(expense.amount) || 0
    : ids.length
      ? Number((expense.amount / ids.length).toFixed(2))
      : 0
  ids.forEach((id) => {
    expensePayerShares[id] = amount
  })
}

function syncSinglePayerAmount() {
  if (expensePayerIds.value.length !== 1) return
  expensePayerShares[expensePayerIds.value[0]] = Number(expense.amount) || 0
}

function syncExpenseParticipants() {
  expenseParticipantIds.value = expenseKindParticipants(
    expense.kind,
    expense.payerId,
    expenseParticipantIds.value,
    memberIds.value,
  )
  const selected = new Set(expenseParticipantIds.value)
  ;[expenseShares, expenseRatios, expenseSplitUnits].forEach((values) =>
    Object.keys(values).forEach((id) => {
      if (!selected.has(id)) delete values[id]
    }),
  )
  expenseParticipantIds.value.forEach((id) => {
    if (expenseShares[id] === undefined) expenseShares[id] = 0
    if (expenseRatios[id] === undefined) expenseRatios[id] = 0
    if (expenseSplitUnits[id] === undefined) expenseSplitUnits[id] = 1
  })
}

function syncExpensePayers() {
  if (expense.kind === 'personal' && expensePayerIds.value.length > 1) {
    expensePayerIds.value = [expensePayerIds.value[0]]
  }
  const selected = new Set(expensePayerIds.value)
  Object.keys(expensePayerShares).forEach((id) => {
    if (!selected.has(id)) delete expensePayerShares[id]
  })
  expensePayerIds.value.forEach((id) => {
    if (expensePayerShares[id] === undefined) expensePayerShares[id] = 0
  })
  expense.payerId = expensePayerIds.value[0] || ''
  syncSinglePayerAmount()
  if (expense.kind === 'personal') {
    expenseParticipantIds.value = expense.payerId ? [expense.payerId] : []
  }
}

function clearExpenseReceiptPreview() {
  if (expenseReceiptPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(expenseReceiptPreview.value)
  }
  expenseReceiptPreview.value = ''
}

function resetExpenseForm() {
  clearExpenseReceiptPreview()
  expenseReceiptFile.value = undefined
  expenseReceiptUrl.value = ''
  editingExpenseId.value = null
  expenseSourceCurrency.value = props.trip.currency || 'JPY'
  expenseSourceAmount.value = 0
  expenseExchangeRate.value = 1
  expenseRateDate.value = ''
  expenseNote.value = ''
  expenseParticipantIds.value = []
  expensePayerIds.value = []
  ;[expenseShares, expenseRatios, expenseSplitUnits, expensePayerShares].forEach((values) =>
    Object.keys(values).forEach((id) => delete values[id]),
  )
  Object.assign(expense, {
    title: '',
    amount: 0,
    payerId: '',
    kind: 'shared',
    splitMode: 'equal',
    category: '餐飲',
    date: '',
  })
}

async function refreshExpenseExchangeRate(showMessage = false) {
  const from = expenseSourceCurrency.value.trim().toUpperCase()
  const to = (props.trip.currency || '').trim().toUpperCase()
  if (!from || !to || from === to) {
    expenseExchangeRate.value = 1
    expenseRateDate.value = ''
    syncExpenseAmountFromSource()
    return
  }
  expenseRateLoading.value = true
  try {
    const quote = await getExpenseDateRate(from, to, expense.date)
    expenseExchangeRate.value = quote.rate
    expenseRateDate.value = quote.date
    syncExpenseAmountFromSource()
    if (showMessage) ElMessage.success(`已取得 ${from} → ${to} 匯率。`)
  } catch (error) {
    expenseRateDate.value = ''
    syncExpenseAmountFromSource()
    if (showMessage) ElMessage.warning(error instanceof Error ? error.message : '無法取得匯率，請手動填寫。')
  } finally {
    expenseRateLoading.value = false
  }
}

function handleExpenseSourceCurrencyChange(value: string) {
  expenseSourceCurrency.value = value
  const from = value.trim().toUpperCase()
  const to = (props.trip.currency || '').trim().toUpperCase()
  expenseRateDate.value = ''
  if (!from || !to || from === to) {
    expenseExchangeRate.value = 1
    return
  }
  // 使用者先填了金額再選原始幣別時，將該數字帶入原始金額，避免誤把 TWD 當成旅行幣別。
  if (!(Number(expenseSourceAmount.value) > 0) && Number(expense.amount) > 0) {
    expenseSourceAmount.value = Number(expense.amount)
  }
  expenseExchangeRate.value = 0
  syncExpenseAmountFromSource()
  void refreshExpenseExchangeRate()
}

function handleExpenseSourceAmountChange(value: number) {
  expenseSourceAmount.value = Number(value) || 0
  syncExpenseAmountFromSource()
}

function handleExpenseExchangeRateChange(value: number) {
  expenseExchangeRate.value = Number(value) || 0
  syncExpenseAmountFromSource()
}

watch(
  () => expense.date,
  (date, previousDate) => {
    if (!showExpense.value || date === previousDate || !sourceConversionActive.value) return
    void refreshExpenseExchangeRate()
  },
)

watch(
  () => expense.amount,
  () => syncSinglePayerAmount(),
)

function syncExpenseAmountFromSource() {
  if (!sourceConversionActive.value) return
  expense.amount = convertedExpenseAmount()
}

function convertedExpenseAmount() {
  const from = expenseSourceCurrency.value.trim().toUpperCase()
  const to = (props.trip.currency || '').trim().toUpperCase()
  const sourceAmount = Number(expenseSourceAmount.value) || 0
  const rate = Number(expenseExchangeRate.value) || 0
  if (!from || !to || from === to) return Number(expense.amount) || 0
  if (!sourceAmount || !rate) return 0
  return Number((sourceAmount * rate).toFixed(2))
}

function selectExpenseReceipt(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    return ElMessage.warning('請選擇圖片格式的收據。')
  }
  clearExpenseReceiptPreview()
  expenseReceiptFile.value = file
  expenseReceiptPreview.value = URL.createObjectURL(file)
}

function removeExpenseReceipt() {
  clearExpenseReceiptPreview()
  expenseReceiptFile.value = undefined
  expenseReceiptUrl.value = ''
}

function openExpenseForm(existing?: Expense) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。')
  const members = props.trip.members || []
  editingExpenseId.value = existing?.id || null
  Object.assign(
    expense,
    existing
      ? {
          title: existing.title,
          amount: existing.amount,
          payerId: existing.payerId,
          kind: existing.kind,
          splitMode: existing.splitMode || 'equal',
          category: existing.category,
          date: existing.date,
        }
      : {
          title: '',
          amount: 0,
          payerId: props.userId || members[0]?.id || '',
          kind: 'shared',
          splitMode: 'equal',
          category: '餐飲',
          date: localDate(),
        },
  )
  expenseParticipantIds.value = existing ? expenseParticipants(existing) : members.map((member) => member.id)
  expensePayerIds.value = existing ? Object.keys(payerSharesForExpense(existing)) : expense.payerId ? [expense.payerId] : []
  resetExpenseSplitValues()
  resetExpensePayerValues()
  if (existing?.shares) Object.assign(expenseShares, existing.shares)
  if (existing?.ratios) Object.assign(expenseRatios, existing.ratios)
  if (existing?.splitUnits) Object.assign(expenseSplitUnits, existing.splitUnits)
  if (existing?.payerShares) Object.assign(expensePayerShares, existing.payerShares)
  syncSinglePayerAmount()
  clearExpenseReceiptPreview()
  expenseReceiptFile.value = undefined
  expenseReceiptUrl.value = existing?.receiptUrl || ''
  expenseReceiptPreview.value = existing?.receiptUrl || ''
  expenseSourceCurrency.value = existing?.sourceCurrency || props.trip.currency || 'JPY'
  expenseSourceAmount.value = Number(existing?.sourceAmount ?? existing?.amount ?? 0)
  expenseExchangeRate.value = Number(existing?.exchangeRate || 1)
  expenseRateDate.value = existing?.exchangeRateDate || ''
  expenseNote.value = existing?.note || ''
  showExpense.value = true
  if (expenseSourceCurrency.value.trim().toUpperCase() !== (props.trip.currency || '').trim().toUpperCase()) {
    syncExpenseAmountFromSource()
    void refreshExpenseExchangeRate()
  } else if (!expenseRateDate.value) {
    expenseRateDate.value = expense.date
  }
}

async function saveExpense() {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。')
  const sourceCurrency = expenseSourceCurrency.value.trim().toUpperCase()
  const tripCurrency = (props.trip.currency || '').trim().toUpperCase()
  if (sourceCurrency && sourceCurrency !== tripCurrency && Number(expenseSourceAmount.value) > 0) {
    if (expenseRateLoading.value) {
      return ElMessage.info('正在取得匯率，請稍候再儲存。')
    }
    if (!(Number(expenseExchangeRate.value) > 0)) {
      return ElMessage.warning(`請先取得或填寫 ${sourceCurrency} → ${tripCurrency} 匯率。`)
    }
    // 原始幣別不同時，原始金額是實際輸入來源，結算金額必須使用換算後的旅行幣別。
    expense.amount = convertedExpenseAmount()
    resetExpenseSplitValues()
    resetExpensePayerValues()
  }
  if (!expense.title || expense.amount <= 0 || !expense.payerId) {
    return ElMessage.warning('請完整填寫支出資料。')
  }
  const participantIds = expense.kind === 'personal' ? [expense.payerId] : expenseParticipantIds.value
  if (!participantIds.length) return ElMessage.warning('請至少選擇一位分攤成員。')
  if (!expensePayerIds.value.length) return ElMessage.warning('請至少選擇一位付款人。')
  if (expense.kind === 'shared' && expense.splitMode === 'custom' && Math.abs(customShareTotal.value - expense.amount) > 0.01) {
    return ElMessage.warning('自訂分攤總額必須等於支出金額。')
  }
  if (expense.kind === 'shared' && expense.splitMode === 'ratio' && Math.abs(ratioTotal.value - 100) > 0.01) {
    return ElMessage.warning('比例分攤總和必須為 100%。')
  }
  if (expense.kind === 'shared' && expense.splitMode === 'shares' && splitUnitTotal.value <= 0) {
    return ElMessage.warning('份數分攤總份數必須大於 0。')
  }
  if (Math.abs(payerTotal.value - expense.amount) > 0.01) {
    return ElMessage.warning('付款金額合計必須等於支出金額。')
  }

  const existing = editingExpenseId.value
    ? props.expenses.find((item) => item.id === editingExpenseId.value)
    : undefined

  savingExpense.value = true
  try {
    const receiptUrl = expenseReceiptFile.value
      ? await uploadTripImage(expenseReceiptFile.value, 'expense', props.trip.id)
      : expenseReceiptUrl.value
    let accountingRate = 1
    let accountingRateDate = expense.date
    const normalizedTripCurrency = tripCurrency
    if (normalizedTripCurrency !== 'TWD') {
      const accountingQuote = await getExpenseDateRate(normalizedTripCurrency, 'TWD', expense.date)
      accountingRate = accountingQuote.rate
      accountingRateDate = accountingQuote.date
    }
    const payload = {
      tripId: props.trip.id,
      ...expense,
      participantIds,
      payerId: expensePayerIds.value[0],
      payerShares: Object.fromEntries(
        expensePayerIds.value.map((id) => [id, Number(expensePayerShares[id]) || 0]),
      ),
      shares:
        expense.kind === 'shared' && expense.splitMode === 'custom'
          ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseShares[id]) || 0]))
          : {},
      ratios:
        expense.kind === 'shared' && expense.splitMode === 'ratio'
          ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseRatios[id]) || 0]))
          : {},
      splitUnits:
        expense.kind === 'shared' && expense.splitMode === 'shares'
          ? Object.fromEntries(participantIds.map((id) => [id, Number(expenseSplitUnits[id]) || 0]))
          : {},
      sourceCurrency: sourceCurrency || props.trip.currency,
      sourceAmount: Math.max(0, Number(expenseSourceAmount.value) || 0),
      exchangeRate: Math.max(0, Number(expenseExchangeRate.value) || 0),
      exchangeRateDate: expenseRateDate.value || expense.date,
      accountingRate,
      accountingRateDate,
      receiptUrl,
      note: expenseNote.value.trim(),
    }
    if (existing) await store.updateExpense({ ...existing, ...payload })
    else await store.addExpense(payload)
    showExpense.value = false
    resetExpenseForm()
    ElMessage.success('支出已儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存支出。')
  } finally {
    savingExpense.value = false
  }
}

async function removeExpense(expenseItem: Expense) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。')
  try {
    await ElMessageBox.confirm(`確定刪除「${expenseItem.title}」嗎？`, '刪除支出', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.deleteExpense(expenseItem)
    ElMessage.success('支出已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除支出。')
    }
  }
}

function openPersonalBudgetForm() {
  if (!props.canSetPersonalBudget || !props.personalBudgetMemberId) {
    return ElMessage.warning('請先登入後設定個人預算。')
  }
  if (!(props.accountingRate > 0)) {
    return ElMessage.warning('目前尚未取得 TWD 匯率，請稍後再試。')
  }
  personalBudgetInput.value = props.personalBudget
  showPersonalBudget.value = true
}

async function savePersonalBudget() {
  if (!props.personalBudgetMemberId) return
  savingPersonalBudget.value = true
  try {
    await store.updatePersonalBudget(
      props.trip.id,
      props.personalBudgetMemberId,
      Math.max(0, props.toTripCurrencyAmount(Number(personalBudgetInput.value) || 0)),
    )
    showPersonalBudget.value = false
    ElMessage.success('個人預算已儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存個人預算。')
  } finally {
    savingPersonalBudget.value = false
  }
}

async function openCategoryBudgetForm() {
  if (!props.canManageCategoryBudgets) {
    return ElMessage.warning('只有旅行建立者可以設定分類預算。')
  }
  const tripCurrency = (props.trip.currency || '').trim().toUpperCase()
  categoryBudgetRateLoading.value = true
  ElMessage.info('正在取得 TWD 匯率…')
  try {
    if (tripCurrency === 'TWD') {
      categoryBudgetRate.value = 1
      categoryBudgetRateDate.value = ''
    } else {
      const quote = await getLatestExchangeRate(tripCurrency, 'TWD')
      categoryBudgetRate.value = quote.rate
      categoryBudgetRateDate.value = quote.date
    }
  } catch (error) {
    categoryBudgetRate.value = 0
    categoryBudgetRateDate.value = ''
    categoryBudgetRateLoading.value = false
    return ElMessage.error(error instanceof Error ? error.message : '無法取得 TWD 匯率，暫時無法設定分類預算。')
  }
  Object.keys(categoryBudgetDraft).forEach((category) => delete categoryBudgetDraft[category])
  props.categoryBudgetOptions.forEach((category) => {
    categoryBudgetDraft[category] = Number(((Number(props.categoryBudgetValues[category]) || 0) * categoryBudgetRate.value).toFixed(2))
  })
  categoryBudgetRateLoading.value = false
  showCategoryBudgets.value = true
}

async function saveCategoryBudgets() {
  if (!(categoryBudgetRate.value > 0)) {
    return ElMessage.warning('目前沒有可用的 TWD 匯率，請重新開啟設定視窗。')
  }
  savingCategoryBudgets.value = true
  try {
    const tripBudgets = Object.fromEntries(
      Object.entries(categoryBudgetDraft).map(([category, value]) => [
        category,
        Number(((Number(value) || 0) / categoryBudgetRate.value).toFixed(2)),
      ]),
    )
    await store.updateCategoryBudgets(props.trip.id, tripBudgets)
    showCategoryBudgets.value = false
    ElMessage.success('分類預算已儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存分類預算。')
  } finally {
    savingCategoryBudgets.value = false
  }
}

function openDailyBudgetForm() {
  if (!props.canManageCategoryBudgets) {
    return ElMessage.warning('只有旅行建立者可以設定每日預算。')
  }
  dailyBudgetInput.value = props.dailyBudget
  showDailyBudget.value = true
}

async function saveDailyBudget() {
  savingDailyBudget.value = true
  try {
    await store.updateDailyBudget(props.trip.id, Math.max(0, props.toTripCurrencyAmount(Number(dailyBudgetInput.value) || 0)))
    showDailyBudget.value = false
    ElMessage.success('每日預算已儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存每日預算。')
  } finally {
    savingDailyBudget.value = false
  }
}

onUnmounted(() => {
  clearExpenseReceiptPreview()
})
</script>

<template>
  <section class="trip-expenses-view" aria-label="旅行開銷">
    <TripExpenseCard
      :trip="trip"
      :expenses="expenses"
      :total="total"
      :my-paid="myPaid"
      :my-paid-in-trip="myPaidInTrip"
      :my-balance="myBalance"
      :my-balance-in-trip="myBalanceInTrip"
      :personal-budget="personalBudget"
      :personal-spent="personalSpent"
      :accounting-currency="accountingCurrency"
      :accounting-rate="accountingRate"
      :accounting-rate-date="accountingRateDate"
      :expense-amount-in-accounting="expenseAmountInAccounting"
      :category-budgets="categoryBudgets"
      :daily-budget="dailyBudget"
      :daily-expenses="dailyExpenses"
      :can-set-personal-budget="canSetPersonalBudget"
      :can-manage-category-budgets="canManageCategoryBudgets"
      :can-edit-trip="canEdit"
      :payer-label="payerLabel"
      :split-label="splitLabel"
      :participant-count="participantCount"
      :share="share"
      @add="openExpenseForm()"
      @set-personal-budget="openPersonalBudgetForm"
      @manage-category-budgets="openCategoryBudgetForm"
      @manage-daily-budget="openDailyBudgetForm"
      @edit="openExpenseForm"
      @remove="removeExpense"
    />

    <UnifiedConsumptionDialog
      v-model="showExpense"
      mode="expense"
      :editing="Boolean(editingExpenseId)"
      :saving="savingExpense"
      :form="expense"
      :trip="trip"
      :participant-ids="expenseParticipantIds"
      :payer-ids="expensePayerIds"
      :shares="expenseShares"
      :ratios="expenseRatios"
      :split-units="expenseSplitUnits"
      :payer-shares="expensePayerShares"
      :custom-share-total="customShareTotal"
      :ratio-total="ratioTotal"
      :split-unit-total="splitUnitTotal"
      :payer-total="payerTotal"
      :source-currency="expenseSourceCurrency"
      :source-amount="expenseSourceAmount"
      :exchange-rate="expenseExchangeRate"
      :rate-loading="expenseRateLoading"
      :rate-date="expenseRateDate"
      :source-conversion-active="sourceConversionActive"
      :note="expenseNote"
      :receipt-preview="expenseReceiptPreview"
      :receipt-url="expenseReceiptUrl"
      @update:participant-ids="expenseParticipantIds = $event"
      @update:payer-ids="expensePayerIds = $event"
      @update:source-currency="handleExpenseSourceCurrencyChange"
      @update:source-amount="handleExpenseSourceAmountChange"
      @update:exchange-rate="handleExpenseExchangeRateChange"
      @refresh-rate="refreshExpenseExchangeRate(true)"
      @update:note="expenseNote = $event"
      @select-receipt="selectExpenseReceipt"
      @remove-receipt="removeExpenseReceipt"
      @sync-payers="syncExpensePayers"
      @sync-participants="syncExpenseParticipants"
      @reset-split-values="resetExpenseSplitValues()"
      @save="saveExpense"
      @closed="resetExpenseForm"
    />

    <el-dialog v-model="showPersonalBudget" :title="`設定個人預算（${accountingCurrency}）`" width="min(92vw, 420px)">
      <p class="muted">請以 {{ accountingCurrency }} 填寫；此預算僅供你自己查看，會依你實際分攤到的開銷計算使用率。</p>
      <p v-if="accountingRateDate && trip.currency !== accountingCurrency" class="category-budget-rate-hint">儲存時會依匯率 1 {{ trip.currency }} = {{ accountingRate.toFixed(4) }} {{ accountingCurrency }} 自動換算回旅行幣別。</p>
      <el-form label-position="top">
        <el-form-item :label="`個人預算（${accountingCurrency}）`">
          <el-input-number v-model="personalBudgetInput" :min="0" :step="1000" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="savingPersonalBudget" @click="showPersonalBudget = false">取消</el-button>
        <el-button type="primary" :loading="savingPersonalBudget" :disabled="savingPersonalBudget" @click="savePersonalBudget">儲存個人預算</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCategoryBudgets" title="設定分類預算（TWD）" width="min(92vw, 520px)">
      <p class="muted">請以 TWD 填寫分類預算；儲存時會自動換算成旅行幣別 {{ trip.currency }}，再用於預算進度計算。</p>
      <p v-if="categoryBudgetRateDate" class="category-budget-rate-hint">換算匯率：1 {{ trip.currency }} = {{ categoryBudgetRate.toFixed(4) }} TWD・{{ categoryBudgetRateDate }}</p>
      <el-form class="category-budget-form" label-position="top">
        <el-form-item v-for="category in categoryBudgetOptions" :key="category" :label="`${category}（TWD）`">
          <el-input-number v-model="categoryBudgetDraft[category]" :min="0" :step="1000" controls-position="right" :disabled="categoryBudgetRateLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="savingCategoryBudgets" @click="showCategoryBudgets = false">取消</el-button>
        <el-button type="primary" :loading="savingCategoryBudgets || categoryBudgetRateLoading" :disabled="savingCategoryBudgets || categoryBudgetRateLoading" @click="saveCategoryBudgets">儲存分類預算</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDailyBudget" :title="`設定每日預算（${accountingCurrency}）`" width="min(92vw, 420px)">
      <p class="muted">每日預算會以 {{ accountingCurrency }} 填寫，依支出的日期統計；填入 0 可關閉每日預算提醒。</p>
      <el-form label-position="top">
        <el-form-item :label="`每日預算（${accountingCurrency}）`">
          <el-input-number v-model="dailyBudgetInput" :min="0" :step="1000" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="savingDailyBudget" @click="showDailyBudget = false">取消</el-button>
        <el-button type="primary" :loading="savingDailyBudget" :disabled="savingDailyBudget" @click="saveDailyBudget">儲存每日預算</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-expenses-view{display:grid;min-width:0}
.category-budget-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.category-budget-form :deep(.el-input-number){width:100%}
.category-budget-rate-hint{margin:-4px 0 14px;color:#6b7d78;font-size:12px;line-height:1.45}
@media(max-width:600px){.category-budget-form{grid-template-columns:1fr}}
</style>
