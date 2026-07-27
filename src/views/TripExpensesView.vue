<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripExpenseCard from '../components/TripExpenseCard.vue'
import ExpenseDialog, { type ExpenseDraft } from '../components/ExpenseDialog.vue'
import { uploadTripImage } from '../services/cloudinary'
import { useTripStore } from '../stores/trip'
import type { Expense, Trip } from '../types'
import { expenseKindParticipants, participantsForExpense, payerSharesForExpense } from '../utils/expenseSplit'

const props = defineProps<{
  trip: Trip
  expenses: Expense[]
  total: number
  myPaid: number
  myBalance: number
  personalBudget: number
  personalSpent: number
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

const emit = defineEmits<{
  setPersonalBudget: []
  manageCategoryBudgets: []
  manageDailyBudget: []
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
const expenseNote = ref('')

const expenseShares = reactive<Record<string, number>>({})
const expenseRatios = reactive<Record<string, number>>({})
const expenseSplitUnits = reactive<Record<string, number>>({})
const expensePayerShares = reactive<Record<string, number>>({})

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
  const amount = ids.length ? Number((expense.amount / ids.length).toFixed(2)) : 0
  ids.forEach((id) => {
    expensePayerShares[id] = amount
  })
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
  clearExpenseReceiptPreview()
  expenseReceiptFile.value = undefined
  expenseReceiptUrl.value = existing?.receiptUrl || ''
  expenseReceiptPreview.value = existing?.receiptUrl || ''
  expenseSourceCurrency.value = existing?.sourceCurrency || props.trip.currency || 'JPY'
  expenseSourceAmount.value = Number(existing?.sourceAmount ?? existing?.amount ?? 0)
  expenseExchangeRate.value = Number(existing?.exchangeRate || 1)
  expenseNote.value = existing?.note || ''
  showExpense.value = true
}

async function saveExpense() {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看開銷，無法修改。')
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
      sourceCurrency: expenseSourceCurrency.value.trim() || props.trip.currency,
      sourceAmount: Math.max(0, Number(expenseSourceAmount.value) || 0),
      exchangeRate: Math.max(0, Number(expenseExchangeRate.value) || 0),
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
      :my-balance="myBalance"
      :personal-budget="personalBudget"
      :personal-spent="personalSpent"
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
      @set-personal-budget="emit('setPersonalBudget')"
      @manage-category-budgets="emit('manageCategoryBudgets')"
      @manage-daily-budget="emit('manageDailyBudget')"
      @edit="openExpenseForm"
      @remove="removeExpense"
    />

    <ExpenseDialog
      v-model="showExpense"
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
      :note="expenseNote"
      :receipt-preview="expenseReceiptPreview"
      :receipt-url="expenseReceiptUrl"
      @update:participant-ids="expenseParticipantIds = $event"
      @update:payer-ids="expensePayerIds = $event"
      @update:source-currency="expenseSourceCurrency = $event"
      @update:source-amount="expenseSourceAmount = $event"
      @update:exchange-rate="expenseExchangeRate = $event"
      @update:note="expenseNote = $event"
      @select-receipt="selectExpenseReceipt"
      @remove-receipt="removeExpenseReceipt"
      @sync-payers="syncExpensePayers"
      @sync-participants="syncExpenseParticipants"
      @reset-split-values="resetExpenseSplitValues()"
      @save="saveExpense"
      @closed="resetExpenseForm"
    />
  </section>
</template>

<style scoped>
.trip-expenses-view{display:grid;min-width:0}
</style>
