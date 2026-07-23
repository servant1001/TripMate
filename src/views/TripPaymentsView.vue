<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PaymentToolDialog, { type PaymentToolDraft } from '../components/PaymentToolDialog.vue'
import PaymentRewardRuleDialog, { type RewardRuleDraft } from '../components/PaymentRewardRuleDialog.vue'
import PaymentTransactionDialog, { type PaymentTransactionDraft } from '../components/PaymentTransactionDialog.vue'
import StoredBalanceDialog, { type StoredBalanceDraft } from '../components/StoredBalanceDialog.vue'
import TripPaymentToolsCard from '../components/TripPaymentToolsCard.vue'
import TripPaymentRecommendationCard from '../components/TripPaymentRecommendationCard.vue'
import TripPaymentSharedToolsCard from '../components/TripPaymentSharedToolsCard.vue'
import { useTripStore } from '../stores/trip'
import type {
  PaymentMethod,
  PaymentTool,
  PaymentToolSummary,
  PaymentTransaction,
  RewardRule,
  StoredValueBalance,
  Trip,
} from '../types'
import { calculateTransactionReward, rewardUsage, selectApplicableRule, storedValueBalance } from '../utils/paymentRewards'

const props = defineProps<{
  trip: Trip
  tools: PaymentTool[]
  rules: RewardRule[]
  transactions: PaymentTransaction[]
  balances: StoredValueBalance[]
  summaries: PaymentToolSummary[]
  userId: string
  canEdit: boolean
  memberName: (id: string) => string
}>()

const store = useTripStore()

const showPaymentTool = ref(false)
const showRewardRule = ref(false)
const showPaymentTransaction = ref(false)
const showStoredBalance = ref(false)
const editingPaymentToolId = ref<string | null>(null)
const editingRewardRuleId = ref<string | null>(null)
const editingPaymentTransactionId = ref<string | null>(null)
const balanceToolId = ref('')
const paymentToolImageUrl = ref('')

const ownTools = computed(() =>
  props.tools.filter((item) => item.ownerUserId === (props.userId || props.trip.ownerId)),
)

const paymentTool = reactive<PaymentToolDraft>({
  name: '',
  type: 'credit_card',
  issuer: '',
  lastFourDigits: '',
  settlementCurrency: 'JPY',
  foreignTransactionFeeRatePercent: 0,
  visibility: 'private',
  note: '',
})

const rewardRule = reactive<RewardRuleDraft>({
  paymentToolId: '',
  name: '',
  rewardType: 'cashback',
  baseRatePercent: 0,
  bonusRatePercent: 0,
  rewardCap: 0,
  maximumEligibleSpend: 0,
  minimumSpend: 0,
  capPeriod: 'trip',
  periodStart: '',
  periodEnd: '',
  applicableCurrencies: '',
  applicableCategories: '',
  applicableMerchants: '',
  applicablePaymentMethods: [],
  excludedCategories: '',
  excludedMerchants: '',
  requiresRegistration: false,
  registrationCompleted: false,
  priority: 1,
  note: '',
})

const paymentTransaction = reactive<PaymentTransactionDraft>({
  paymentToolId: '',
  title: '',
  merchant: '',
  category: '購物',
  transactionDate: '',
  transactionTime: '',
  paymentMethod: 'physical_card',
  originalAmount: 0,
  originalCurrency: 'JPY',
  exchangeRate: 1,
  transactionType: 'purchase',
  status: 'posted',
  refundedAmount: 0,
  note: '',
  syncExpense: false,
})

const storedBalance = reactive<StoredBalanceDraft>({
  initialBalance: 0,
  currency: 'JPY',
})

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function splitRewardConditions(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function openPaymentToolForm(tool?: PaymentTool) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看支付資訊。')
  editingPaymentToolId.value = tool?.id || null
  paymentToolImageUrl.value = tool?.imageUrl || ''
  Object.assign(
    paymentTool,
    tool
      ? {
          name: tool.name,
          type: tool.type,
          issuer: tool.issuer || '',
          lastFourDigits: tool.lastFourDigits || '',
          settlementCurrency: tool.settlementCurrency || props.trip.currency || 'JPY',
          foreignTransactionFeeRatePercent: (tool.foreignTransactionFeeRate || 0) * 100,
          visibility: tool.visibility,
          note: tool.note || '',
        }
      : {
          name: '',
          type: 'credit_card',
          issuer: '',
          lastFourDigits: '',
          settlementCurrency: props.trip.currency || 'JPY',
          foreignTransactionFeeRatePercent: 0,
          visibility: 'private',
          note: '',
        },
  )
  showPaymentTool.value = true
}

async function savePaymentTool() {
  if (!paymentTool.name.trim()) return ElMessage.warning('請填寫支付工具名稱。')
  if (paymentTool.lastFourDigits && !/^\d{4}$/.test(paymentTool.lastFourDigits)) {
    return ElMessage.warning('末四碼必須是 4 位數字。')
  }
  const existing = editingPaymentToolId.value
    ? props.tools.find((item) => item.id === editingPaymentToolId.value)
    : undefined
  const ownerUserId = existing?.ownerUserId || props.userId || props.trip.ownerId
  await store.savePaymentTool({
    ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    tripId: props.trip.id,
    ownerUserId,
    type: paymentTool.type,
    name: paymentTool.name.trim(),
    issuer: paymentTool.issuer.trim() || undefined,
    lastFourDigits: paymentTool.lastFourDigits || undefined,
    network: existing?.network || 'visa',
    defaultCurrency: existing?.defaultCurrency || props.trip.currency,
    settlementCurrency: paymentTool.settlementCurrency,
    foreignTransactionFeeRate: Math.max(0, Number(paymentTool.foreignTransactionFeeRatePercent) || 0) / 100,
    imageUrl: paymentToolImageUrl.value.trim() || undefined,
    visibility: paymentTool.visibility,
    isActive: existing?.isActive ?? true,
    note: paymentTool.note.trim() || undefined,
    createdBy: existing?.createdBy || ownerUserId,
  })
  showPaymentTool.value = false
  ElMessage.success('支付工具已儲存。')
}

async function removePaymentTool(tool: PaymentTool) {
  try {
    await ElMessageBox.confirm(`確定刪除「${tool.name}」及其回饋規則嗎？`, '刪除支付工具', {
      type: 'warning',
    })
    await store.deletePaymentTool(tool)
    ElMessage.success('支付工具已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除支付工具。')
  }
}

async function togglePaymentTool(tool: PaymentTool) {
  await store.savePaymentTool({ ...tool, isActive: !tool.isActive })
  ElMessage.success(tool.isActive ? '支付工具已停用。' : '支付工具已啟用。')
}

function openRewardRuleForm(tool?: PaymentTool, rule?: RewardRule) {
  const target = tool || props.tools.find((item) => item.id === rule?.paymentToolId)
  if (!target) return ElMessage.warning('請先建立支付工具。')
  editingRewardRuleId.value = rule?.id || null
  Object.assign(
    rewardRule,
    rule
      ? {
          paymentToolId: rule.paymentToolId,
          name: rule.name,
          rewardType: rule.rewardType,
          baseRatePercent: rule.baseRate * 100,
          bonusRatePercent: (rule.bonusRate || 0) * 100,
          rewardCap: rule.rewardCap || 0,
          maximumEligibleSpend: rule.maximumEligibleSpend || 0,
          minimumSpend: rule.minimumSpend || 0,
          capPeriod: rule.capPeriod,
          periodStart: rule.periodStartAt ? new Date(rule.periodStartAt).toISOString().slice(0, 10) : '',
          periodEnd: rule.periodEndAt ? new Date(rule.periodEndAt).toISOString().slice(0, 10) : '',
          applicableCurrencies: (rule.applicableCurrencies || []).join('、'),
          applicableCategories: (rule.applicableCategories || []).join('、'),
          applicableMerchants: (rule.applicableMerchants || []).join('、'),
          applicablePaymentMethods: rule.applicablePaymentMethods || [],
          excludedCategories: (rule.excludedCategories || []).join('、'),
          excludedMerchants: (rule.excludedMerchants || []).join('、'),
          requiresRegistration: rule.requiresRegistration,
          registrationCompleted: Boolean(rule.registrationCompleted),
          priority: rule.priority,
          note: rule.note || '',
        }
      : {
          paymentToolId: target.id,
          name: '',
          rewardType: 'cashback',
          baseRatePercent: 0,
          bonusRatePercent: 0,
          rewardCap: 0,
          maximumEligibleSpend: 0,
          minimumSpend: 0,
          capPeriod: 'trip',
          periodStart: '',
          periodEnd: '',
          applicableCurrencies: '',
          applicableCategories: '',
          applicableMerchants: '',
          applicablePaymentMethods: [],
          excludedCategories: '',
          excludedMerchants: '',
          requiresRegistration: false,
          registrationCompleted: false,
          priority: 1,
          note: '',
        },
  )
  showRewardRule.value = true
}

async function saveRewardRule() {
  if (!rewardRule.paymentToolId || !rewardRule.name.trim()) {
    return ElMessage.warning('請填寫回饋規則名稱。')
  }
  const start = rewardRule.periodStart ? new Date(`${rewardRule.periodStart}T00:00:00`).getTime() : undefined
  const end = rewardRule.periodEnd ? new Date(`${rewardRule.periodEnd}T23:59:59`).getTime() : undefined
  if (start && end && end < start) return ElMessage.warning('活動結束日期不得早於開始日期。')
  const existing = editingRewardRuleId.value
    ? props.rules.find((item) => item.id === editingRewardRuleId.value)
    : undefined
  const baseRate = Math.max(0, Number(rewardRule.baseRatePercent) || 0) / 100
  const bonusRate = Math.max(0, Number(rewardRule.bonusRatePercent) || 0) / 100
  await store.saveRewardRule({
    ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    tripId: props.trip.id,
    paymentToolId: rewardRule.paymentToolId,
    name: rewardRule.name.trim(),
    rewardType: rewardRule.rewardType,
    baseRate,
    bonusRate,
    totalRate: baseRate + bonusRate,
    rewardCap: Number(rewardRule.rewardCap) || undefined,
    maximumEligibleSpend: Number(rewardRule.maximumEligibleSpend) || undefined,
    minimumSpend: Number(rewardRule.minimumSpend) || undefined,
    applicableCurrencies: splitRewardConditions(rewardRule.applicableCurrencies),
    applicableCategories: splitRewardConditions(rewardRule.applicableCategories),
    applicableMerchants: splitRewardConditions(rewardRule.applicableMerchants),
    applicablePaymentMethods: rewardRule.applicablePaymentMethods,
    excludedCategories: splitRewardConditions(rewardRule.excludedCategories),
    excludedMerchants: splitRewardConditions(rewardRule.excludedMerchants),
    capPeriod: rewardRule.capPeriod,
    periodStartAt: start,
    periodEndAt: end,
    requiresRegistration: rewardRule.requiresRegistration,
    registrationCompleted: rewardRule.registrationCompleted,
    priority: Number(rewardRule.priority) || 1,
    isActive: existing?.isActive ?? true,
    note: rewardRule.note.trim() || undefined,
    createdBy: existing?.createdBy || props.userId || props.trip.ownerId,
  })
  showRewardRule.value = false
  ElMessage.success('回饋規則已儲存。')
}

async function removeRewardRule(rule: RewardRule) {
  try {
    await ElMessageBox.confirm(`確定刪除規則「${rule.name}」嗎？`, '刪除回饋規則', {
      type: 'warning',
    })
    await store.deleteRewardRule(rule)
    ElMessage.success('回饋規則已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除回饋規則。')
  }
}

function openPaymentTransactionForm(tool?: PaymentTool, transaction?: PaymentTransaction) {
  const target =
    tool ||
    props.tools.find((item) => item.id === transaction?.paymentToolId) ||
    ownTools.value[0]
  if (!target) return ElMessage.warning('請先建立自己的支付工具。')
  editingPaymentTransactionId.value = transaction?.id || null
  Object.assign(
    paymentTransaction,
    transaction
      ? {
          paymentToolId: transaction.paymentToolId,
          title: transaction.title,
          merchant: transaction.merchant || '',
          category: transaction.category || '購物',
          transactionDate: transaction.transactionDate,
          transactionTime: transaction.transactionTime || '',
          paymentMethod: transaction.paymentMethod || 'physical_card',
          originalAmount: transaction.originalAmount,
          originalCurrency: transaction.originalCurrency,
          exchangeRate: transaction.exchangeRate || 1,
          transactionType: transaction.transactionType,
          status: transaction.status,
          refundedAmount: transaction.refundedAmount || 0,
          note: transaction.note || '',
          syncExpense: false,
        }
      : {
          paymentToolId: target.id,
          title: '',
          merchant: '',
          category: '購物',
          transactionDate: localDate(),
          transactionTime: '',
          paymentMethod: 'physical_card',
          originalAmount: 0,
          originalCurrency: target.defaultCurrency || props.trip.currency || 'JPY',
          exchangeRate: 1,
          transactionType: 'purchase',
          status: 'posted',
          refundedAmount: 0,
          note: '',
          syncExpense: false,
        },
  )
  showPaymentTransaction.value = true
}

async function savePaymentTransaction() {
  if (
    !paymentTransaction.paymentToolId ||
    !paymentTransaction.title.trim() ||
    Number(paymentTransaction.originalAmount) <= 0 ||
    !paymentTransaction.transactionDate
  ) {
    return ElMessage.warning('請填寫付款工具、消費名稱、金額與日期。')
  }
  if (Number(paymentTransaction.exchangeRate) <= 0) return ElMessage.warning('匯率必須大於 0。')
  const tool = props.tools.find((item) => item.id === paymentTransaction.paymentToolId)
  if (!tool) return
  const existing = editingPaymentTransactionId.value
    ? props.transactions.find((item) => item.id === editingPaymentTransactionId.value)
    : undefined
  const convertedAmount = Number(paymentTransaction.originalAmount) * Number(paymentTransaction.exchangeRate)
  const input = {
    amount: convertedAmount,
    date: paymentTransaction.transactionDate,
    currency: paymentTransaction.originalCurrency,
    category: paymentTransaction.category,
    merchant: paymentTransaction.merchant,
    paymentMethod: paymentTransaction.paymentMethod,
  }
  const rule = selectApplicableRule(
    props.rules.filter((item) => item.paymentToolId === tool.id),
    input,
  )
  const usage = rule
    ? rewardUsage(
        rule,
        props.transactions.filter((transaction) => transaction.id !== existing?.id),
        new Date(`${paymentTransaction.transactionDate}T12:00:00`).getTime(),
      )
    : undefined
  const calculation = calculateTransactionReward({
    amount: convertedAmount,
    rate: rule?.totalRate || 0,
    feeRate: tool.foreignTransactionFeeRate,
    refundedAmount: Number(paymentTransaction.refundedAmount) || 0,
    maximumEligibleAmount: usage?.remainingEligibleSpend,
    maximumRewardAmount: usage?.remainingRewardCap,
  })
  let expenseId = existing?.expenseId || ''
  if (paymentTransaction.syncExpense && !expenseId && paymentTransaction.transactionType === 'purchase') {
    const expense = await store.addExpense({
      tripId: props.trip.id,
      title: paymentTransaction.title.trim(),
      amount: convertedAmount,
      payerId: tool.ownerUserId,
      kind: 'personal',
      participantIds: [tool.ownerUserId],
      splitMode: 'equal',
      shares: {},
      category: paymentTransaction.category,
      date: paymentTransaction.transactionDate,
      note: paymentTransaction.note.trim(),
    })
    expenseId = expense.id
  }
  await store.savePaymentTransaction({
    ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    tripId: props.trip.id,
    paymentToolId: tool.id,
    ownerUserId: tool.ownerUserId,
    title: paymentTransaction.title.trim(),
    merchant: paymentTransaction.merchant.trim() || undefined,
    category: paymentTransaction.category.trim() || undefined,
    transactionDate: paymentTransaction.transactionDate,
    transactionTime: paymentTransaction.transactionTime || undefined,
    transactionType: paymentTransaction.transactionType,
    status: paymentTransaction.status,
    paymentMethod: paymentTransaction.paymentMethod,
    originalAmount: Number(paymentTransaction.originalAmount),
    originalCurrency: paymentTransaction.originalCurrency,
    exchangeRate: Number(paymentTransaction.exchangeRate),
    convertedAmount,
    settlementCurrency: tool.settlementCurrency || props.trip.currency,
    foreignTransactionFeeRate: tool.foreignTransactionFeeRate || 0,
    foreignTransactionFee: calculation.foreignTransactionFee,
    eligibleAmount: calculation.eligibleAmount,
    appliedRewardRuleId: rule?.id,
    estimatedRewardRate: rule?.totalRate || 0,
    estimatedRewardAmount: calculation.estimatedRewardAmount,
    estimatedNetRewardAmount: calculation.estimatedNetRewardAmount,
    estimatedNetRewardRate: calculation.estimatedNetRewardRate,
    refundedAmount: Number(paymentTransaction.refundedAmount) || undefined,
    expenseId: expenseId || undefined,
    note: paymentTransaction.note.trim() || undefined,
    createdBy: existing?.createdBy || props.userId || props.trip.ownerId,
  })
  showPaymentTransaction.value = false
  ElMessage.success('付款紀錄已儲存。')
}

async function removePaymentTransaction(transaction: PaymentTransaction) {
  try {
    await ElMessageBox.confirm(`確定刪除「${transaction.title}」嗎？關聯開銷不會自動刪除。`, '刪除付款紀錄', {
      type: 'warning',
    })
    await store.deletePaymentTransaction(transaction)
    ElMessage.success('付款紀錄已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('無法刪除付款紀錄。')
  }
}

function openStoredBalanceForm(tool: PaymentTool) {
  balanceToolId.value = tool.id
  const balance = props.balances.find((item) => item.paymentToolId === tool.id)
  storedBalance.initialBalance = balance?.initialBalance || 0
  storedBalance.currency = balance?.currency || tool.defaultCurrency || props.trip.currency || 'JPY'
  showStoredBalance.value = true
}

async function saveStoredBalance() {
  const tool = props.tools.find((item) => item.id === balanceToolId.value)
  if (!tool) return
  const balance = storedValueBalance(tool, props.transactions, Number(storedBalance.initialBalance) || 0)
  balance.currency = storedBalance.currency
  await store.saveStoredValueBalance(balance)
  showStoredBalance.value = false
  ElMessage.success('儲值工具餘額已更新。')
}
</script>

<template>
  <section class="trip-payments-view" aria-label="支付與回饋">
    <TripPaymentToolsCard
      :trip="trip"
      :tools="tools"
      :rules="rules"
      :transactions="transactions"
      :balances="balances"
      :user-id="userId"
      :can-edit="canEdit"
      :member-name="memberName"
      @add-tool="openPaymentToolForm()"
      @edit-tool="openPaymentToolForm"
      @remove-tool="removePaymentTool"
      @toggle-tool="togglePaymentTool"
      @add-rule="openRewardRuleForm"
      @edit-rule="openRewardRuleForm(undefined, $event)"
      @remove-rule="removeRewardRule"
      @add-transaction="openPaymentTransactionForm"
      @edit-transaction="openPaymentTransactionForm(undefined, $event)"
      @remove-transaction="removePaymentTransaction"
      @manage-balance="openStoredBalanceForm"
    />
    <TripPaymentRecommendationCard :trip="trip" :tools="tools" :rules="rules" :user-id="userId" />
    <TripPaymentSharedToolsCard :summaries="summaries" :user-id="userId" :member-name="memberName" />

    <PaymentToolDialog
      v-model:open="showPaymentTool"
      v-model:image-url="paymentToolImageUrl"
      :editing="Boolean(editingPaymentToolId)"
      :form="paymentTool"
      @save="savePaymentTool"
    />
    <PaymentRewardRuleDialog
      v-model:open="showRewardRule"
      :editing="Boolean(editingRewardRuleId)"
      :form="rewardRule"
      :tools="ownTools"
      @save="saveRewardRule"
    />
    <PaymentTransactionDialog
      v-model:open="showPaymentTransaction"
      :editing="Boolean(editingPaymentTransactionId)"
      :form="paymentTransaction"
      :tools="ownTools"
      @save="savePaymentTransaction"
    />
    <StoredBalanceDialog v-model:open="showStoredBalance" :form="storedBalance" @save="saveStoredBalance" />
  </section>
</template>

<style scoped>
.trip-payments-view{display:grid;grid-column:1/-1;gap:20px;min-width:0}
</style>
