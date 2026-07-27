<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  PaymentMethod,
  PaymentTool,
  PaymentTransaction,
  RewardCapPeriod,
  RewardRule,
  StoredValueBalance,
  Trip,
} from '../types'
import { rewardUsage, storedValueBalance } from '../utils/paymentRewards'

const props = defineProps<{
  trip: Trip
  tools: PaymentTool[]
  rules: RewardRule[]
  transactions: PaymentTransaction[]
  balances: StoredValueBalance[]
  userId: string
  canEdit: boolean
  memberName: (id: string) => string
}>()

const emit = defineEmits<{
  addTool: []
  editTool: [tool: PaymentTool]
  removeTool: [tool: PaymentTool]
  toggleTool: [tool: PaymentTool]
  addRule: [tool: PaymentTool]
  editRule: [rule: RewardRule]
  removeRule: [rule: RewardRule]
  addTransaction: [tool?: PaymentTool]
  editTransaction: [transaction: PaymentTransaction]
  removeTransaction: [transaction: PaymentTransaction]
  manageBalance: [tool: PaymentTool]
}>()

const labels: Record<PaymentTool['type'], string> = {
  credit_card: '信用卡',
  debit_card: '簽帳金融卡',
  electronic_payment: '電子支付',
  transport_card: '交通卡',
  cash: '現金',
  other: '其他',
}

const capPeriodLabels: Record<RewardCapPeriod, string> = {
  per_transaction: '每筆',
  daily: '每日',
  monthly: '每月',
  billing_cycle: '帳單週期',
  campaign: '活動期間',
  trip: '本趟旅行',
  none: '無上限',
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  physical_card: '實體卡',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  online: '網路付款',
  qr_payment: '掃碼付款',
  transport_card_topup: '交通卡儲值',
  stored_value: '儲值支付',
  other: '其他',
}

const ownTools = computed(() =>
  props.tools.filter((tool) => tool.ownerUserId === props.userId),
)
const activeTransactions = computed(() =>
  props.transactions.filter(
    (item) => item.ownerUserId === props.userId && item.status !== 'cancelled',
  ),
)
const transactionToolFilter = ref('')
const transactionStatusFilter = ref('')
const transactionCategoryFilter = ref('')
const transactionDateRange = ref<string[]>([])
const transactionSort = ref<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'reward_desc'>('date_desc')
const transactionCategories = computed(
  () =>
    [
      ...new Set(
        activeTransactions.value.map((item) => item.category).filter(Boolean),
      ),
    ] as string[],
)
const filteredTransactions = computed(() =>
  activeTransactions.value.filter(
    (item) =>
      (!transactionToolFilter.value ||
        item.paymentToolId === transactionToolFilter.value) &&
      (!transactionStatusFilter.value ||
        item.status === transactionStatusFilter.value) &&
      (!transactionCategoryFilter.value ||
        item.category === transactionCategoryFilter.value) &&
      (!transactionDateRange.value.length ||
        (item.transactionDate >= transactionDateRange.value[0] &&
          item.transactionDate <= transactionDateRange.value[1])),
  ),
)
const sortedFilteredTransactions = computed(() => {
  const items = [...filteredTransactions.value]
  const amountOf = (item: PaymentTransaction) => item.convertedAmount || item.originalAmount
  switch (transactionSort.value) {
    case 'date_asc':
      return items.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
    case 'amount_desc':
      return items.sort((a, b) => amountOf(b) - amountOf(a))
    case 'amount_asc':
      return items.sort((a, b) => amountOf(a) - amountOf(b))
    case 'reward_desc':
      return items.sort((a, b) => (b.estimatedRewardAmount || 0) - (a.estimatedRewardAmount || 0))
    case 'date_desc':
    default:
      return items.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
  }
})
const activeFilterSummary = computed(() => {
  const items: Array<{ key: string; label: string }> = []
  if (transactionToolFilter.value) {
    const tool = ownTools.value.find((item) => item.id === transactionToolFilter.value)
    items.push({ key: 'tool', label: `工具：${tool?.name || '未知工具'}` })
  }
  if (transactionStatusFilter.value) {
    items.push({ key: 'status', label: `狀態：${transactionStatusLabel(transactionStatusFilter.value as PaymentTransaction['status'])}` })
  }
  if (transactionCategoryFilter.value) {
    items.push({ key: 'category', label: `分類：${transactionCategoryFilter.value}` })
  }
  if (transactionDateRange.value.length === 2) {
    items.push({ key: 'date', label: `${transactionDateRange.value[0]} 至 ${transactionDateRange.value[1]}` })
  }
  items.push({
    key: 'sort',
    label:
      {
        date_desc: '排序：最新優先',
        date_asc: '排序：最早優先',
        amount_desc: '排序：金額高到低',
        amount_asc: '排序：金額低到高',
        reward_desc: '排序：回饋高到低',
      }[transactionSort.value],
  })
  return items
})
const totals = computed(() =>
  activeTransactions.value.reduce(
    (sum, item) => ({
      amount:
        sum.amount +
        (item.transactionType === 'purchase'
          ? item.convertedAmount || item.originalAmount
          : 0),
      reward: sum.reward + (item.estimatedRewardAmount || 0),
      fee: sum.fee + (item.foreignTransactionFee || 0),
      net: sum.net + (item.estimatedNetRewardAmount || 0),
    }),
    { amount: 0, reward: 0, fee: 0, net: 0 },
  ),
)

const toolRules = (tool: PaymentTool) =>
  props.rules.filter((rule) => rule.paymentToolId === tool.id)
const toolTransactions = (tool: PaymentTool) =>
  activeTransactions.value.filter((item) => item.paymentToolId === tool.id)
const balance = (tool: PaymentTool) =>
  props.balances.find((item) => item.paymentToolId === tool.id) ||
  storedValueBalance(tool, toolTransactions(tool), 0)
const stored = (tool: PaymentTool) =>
  tool.type === 'electronic_payment' || tool.type === 'transport_card'

function toolStatusLabel(tool: PaymentTool) {
  return tool.isActive ? '使用中' : '已停用'
}

function foreignFeeLabel(tool: PaymentTool) {
  if (!tool.foreignTransactionFeeRate) return '免海外手續費'
  return `海外手續費 ${(tool.foreignTransactionFeeRate * 100).toFixed(1)}%`
}

const reminders = computed(() => {
  const now = Date.now()
  const sevenDays = now + 7 * 86400000
  const rows: string[] = []
  ownTools.value.forEach((tool) => {
    toolRules(tool)
      .filter((rule) => rule.isActive)
      .forEach((rule) => {
        const usage = rewardUsage(rule, toolTransactions(tool), now)
        if (rule.requiresRegistration && !rule.registrationCompleted) {
          rows.push(`${tool.name}：${rule.name} 尚未完成活動登錄`)
        }
        if (rule.bonusRewardCap && usage.usedBonusRewardAmount / rule.bonusRewardCap >= 0.8) {
          rows.push(
            `${tool.name}：${rule.name} 加碼回饋額度已使用 ${Math.round((usage.usedBonusRewardAmount / rule.bonusRewardCap) * 100)}%`,
          )
        }
        if (rule.baseRewardCap && usage.usedBaseRewardAmount / rule.baseRewardCap >= 0.8) {
          rows.push(
            `${tool.name}：${rule.name} 基礎回饋額度已使用 ${Math.round((usage.usedBaseRewardAmount / rule.baseRewardCap) * 100)}%`,
          )
        }
        if (rule.rewardCap && usage.usedRewardAmount / rule.rewardCap >= 0.8) {
          rows.push(
            `${tool.name}：${rule.name} 總回饋額度已使用 ${Math.round((usage.usedRewardAmount / rule.rewardCap) * 100)}%`,
          )
        }
        if (rule.periodEndAt && rule.periodEndAt >= now && rule.periodEndAt <= sevenDays) {
          rows.push(`${tool.name}：${rule.name} 即將於 7 天內結束`)
        }
      })
    if (stored(tool) && balance(tool).currentBalance < 0) {
      rows.push(`${tool.name}：目前餘額不足`)
    }
  })
  return rows
})

function action(command: string, tool: PaymentTool) {
  if (command === 'transaction') emit('addTransaction', tool)
  if (command === 'rule') emit('addRule', tool)
  if (command === 'edit') emit('editTool', tool)
  if (command === 'toggle') emit('toggleTool', tool)
  if (command === 'remove') emit('removeTool', tool)
  if (command === 'balance') emit('manageBalance', tool)
}

function ruleAction(command: string, rule: RewardRule) {
  if (command === 'edit') emit('editRule', rule)
  if (command === 'remove') emit('removeRule', rule)
}

function transactionAction(command: string, transaction: PaymentTransaction) {
  if (command === 'edit') emit('editTransaction', transaction)
  if (command === 'remove') emit('removeTransaction', transaction)
}

function formatPeriod(rule: RewardRule) {
  if (!rule.periodStartAt && !rule.periodEndAt) return capPeriodLabels[rule.capPeriod]
  const start = rule.periodStartAt
    ? new Date(rule.periodStartAt).toISOString().slice(0, 10)
    : '不限'
  const end = rule.periodEndAt
    ? new Date(rule.periodEndAt).toISOString().slice(0, 10)
    : '不限'
  return `${start}－${end}`
}

function formatRuleSummary(rule: RewardRule) {
  const parts = [
    {
      key: 'base',
      label: '基礎',
      rate: `${(rule.baseRate * 100).toFixed(1)}%`,
      cap: rule.baseRewardCap
        ? `上限 ${props.trip.currency} ${rule.baseRewardCap.toLocaleString()}`
        : '無上限',
    },
  ]
  if (rule.bonusRate) {
    parts.push({
      key: 'bonus',
      label: '加碼',
      rate: `${(rule.bonusRate * 100).toFixed(1)}%`,
      cap: rule.bonusRewardCap
        ? `上限 ${props.trip.currency} ${rule.bonusRewardCap.toLocaleString()}`
        : '無上限',
    })
  }
  return parts
}

function formatRuleCaps(rule: RewardRule) {
  const parts: string[] = []
  if (rule.minimumSpend) {
    parts.push(`門檻 ${props.trip.currency} ${rule.minimumSpend.toLocaleString()}`)
  }
  if (rule.rewardCap) {
    parts.push(`總上限 ${props.trip.currency} ${rule.rewardCap.toLocaleString()}`)
  }
  if (rule.maximumEligibleSpend) {
    parts.push(`可回饋消費上限 ${props.trip.currency} ${rule.maximumEligibleSpend.toLocaleString()}`)
  }
  return parts.join('・')
}

function formatRuleUsage(rule: RewardRule, tool: PaymentTool) {
  const usage = rewardUsage(rule, toolTransactions(tool))
  const parts: Array<{ key: string; label: string; used: string; cap: string }> = []
  if (rule.baseRewardCap) {
    parts.push({
      key: 'base',
      label: '基礎已用',
      used: usage.usedBaseRewardAmount.toLocaleString(),
      cap: rule.baseRewardCap.toLocaleString(),
    })
  }
  if (rule.bonusRewardCap) {
    parts.push({
      key: 'bonus',
      label: '加碼已用',
      used: usage.usedBonusRewardAmount.toLocaleString(),
      cap: rule.bonusRewardCap.toLocaleString(),
    })
  }
  if (rule.rewardCap) {
    parts.push({
      key: 'total',
      label: '總回饋已用',
      used: usage.usedRewardAmount.toLocaleString(),
      cap: rule.rewardCap.toLocaleString(),
    })
  }
  return parts
}

function formatRuleConditions(rule: RewardRule) {
  const parts: string[] = []
  if (rule.applicableCategories?.length) {
    parts.push(`分類：${rule.applicableCategories.slice(0, 2).join('、')}${rule.applicableCategories.length > 2 ? '…' : ''}`)
  }
  if (rule.applicableCurrencies?.length) {
    parts.push(`幣別：${rule.applicableCurrencies.join('、')}`)
  }
  if (rule.applicablePaymentMethods?.length) {
    parts.push(
      `付款：${rule.applicablePaymentMethods
        .slice(0, 2)
        .map((method) => paymentMethodLabels[method] || method)
        .join('、')}${rule.applicablePaymentMethods.length > 2 ? '…' : ''}`,
    )
  }
  if (rule.applicableMerchants?.length) {
    parts.push(`商店：${rule.applicableMerchants.slice(0, 2).join('、')}${rule.applicableMerchants.length > 2 ? '…' : ''}`)
  }
  return parts
}

function transactionStatusLabel(status: PaymentTransaction['status']) {
  return (
    {
      posted: '已入帳',
      pending: '待入帳',
      refunded: '已退款',
      partially_refunded: '部分退款',
      cancelled: '已取消',
    }[status] || status
  )
}

function transactionStatusClass(status: PaymentTransaction['status']) {
  return `is-${status}`
}

function transactionRewardLabel(transaction: PaymentTransaction) {
  if (transaction.estimatedRewardAmount && transaction.estimatedRewardAmount > 0) {
    return `預估回饋 ${props.trip.currency} ${transaction.estimatedRewardAmount.toLocaleString()}`
  }
  if (transaction.foreignTransactionFee && transaction.foreignTransactionFee > 0) {
    return `海外手續費 ${props.trip.currency} ${transaction.foreignTransactionFee.toLocaleString()}`
  }
  return '尚無回饋試算'
}

function clearTransactionFilters() {
  transactionToolFilter.value = ''
  transactionStatusFilter.value = ''
  transactionCategoryFilter.value = ''
  transactionDateRange.value = []
  transactionSort.value = 'date_desc'
}
</script>

<template>
  <section class="payment-page panel">
    <header class="payment-heading">
      <div>
        <p>PAYMENTS</p>
        <h2>支付與回饋</h2>
        <span>追蹤旅行付款、海外手續費與回饋額度。</span>
      </div>
      <div>
        <el-button v-if="canEdit" @click="emit('addTransaction')">＋ 新增消費</el-button>
        <el-button v-if="canEdit" type="primary" @click="emit('addTool')">＋ 新增支付工具</el-button>
      </div>
    </header>

    <div class="payment-summary">
      <article
        v-for="row in [
          { label: '本趟付款總額', value: totals.amount },
          { label: '預估回饋', value: totals.reward },
          { label: '海外手續費', value: totals.fee },
          { label: '預估淨回饋', value: totals.net },
        ]"
        :key="row.label"
      >
        <span>{{ row.label }}</span>
        <strong>{{ trip.currency }} {{ row.value.toLocaleString() }}</strong>
      </article>
    </div>

    <section>
      <div class="payment-section-title">
        <h3>我的支付工具</h3>
        <span>{{ ownTools.length }} 項</span>
      </div>

      <div v-if="ownTools.length" class="tool-grid">
        <article
          v-for="tool in ownTools"
          :key="tool.id"
          class="tool-card"
          :class="{ 'is-inactive': !tool.isActive }"
        >
          <div class="tool-card-top">
            <span class="tool-type">{{ labels[tool.type] }}</span>
            <el-dropdown v-if="canEdit" trigger="click" @command="action($event, tool)">
              <button
                type="button"
                class="tool-more"
                :aria-label="`${tool.name} 更多操作`"
                title="更多操作"
              >
                ⋯
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="transaction">新增消費</el-dropdown-item>
                  <el-dropdown-item command="rule">新增回饋規則</el-dropdown-item>
                  <el-dropdown-item v-if="stored(tool)" command="balance">設定初始餘額</el-dropdown-item>
                  <el-dropdown-item command="edit">編輯工具</el-dropdown-item>
                  <el-dropdown-item command="toggle">{{ tool.isActive ? '停用工具' : '啟用工具' }}</el-dropdown-item>
                  <el-dropdown-item divided command="remove">刪除工具</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div class="tool-name">
            <img
              v-if="tool.imageUrl"
              :src="tool.imageUrl"
              :alt="`${tool.name} 圖片`"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            >
            <h4>{{ tool.name }}</h4>
          </div>

          <p>
            {{ tool.issuer || labels[tool.type] }}
            <template v-if="tool.lastFourDigits">・末四碼 {{ tool.lastFourDigits }}</template>
          </p>
          <div class="tool-meta-row">
            <small>持有人：{{ memberName(tool.ownerUserId) }}</small>
            <span class="tool-status-pill" :class="{ 'is-inactive': !tool.isActive }">
              {{ toolStatusLabel(tool) }}
            </span>
          </div>
          <div class="tool-meta-row">
            <small>結算幣別：{{ tool.settlementCurrency || trip.currency }}</small>
            <small>{{ foreignFeeLabel(tool) }}</small>
          </div>

          <div class="tool-metrics">
            <span>
              已刷
              <b>
                {{ trip.currency }}
                {{
                  toolTransactions(tool)
                    .filter((item) => item.transactionType === 'purchase')
                    .reduce((sum, item) => sum + (item.convertedAmount || item.originalAmount), 0)
                    .toLocaleString()
                }}
              </b>
            </span>
            <span>
              回饋
              <b>
                {{ trip.currency }}
                {{
                  toolTransactions(tool)
                    .reduce((sum, item) => sum + (item.estimatedRewardAmount || 0), 0)
                    .toLocaleString()
                }}
              </b>
            </span>
          </div>

          <div
            v-for="rule in toolRules(tool).filter((item) => item.isActive)"
            :key="rule.id"
            class="rule"
          >
            <div class="rule-top">
              <div class="rule-heading">
                <strong>{{ rule.name }}</strong>
                <span class="rule-rate">{{ (rule.totalRate * 100).toFixed(1) }}%</span>
              </div>
              <el-dropdown v-if="canEdit" trigger="click" @command="ruleAction($event, rule)">
                <button
                  type="button"
                  class="tool-more rule-more"
                  :aria-label="`${rule.name} 更多操作`"
                  title="更多操作"
                >
                  ⋯
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">編輯規則</el-dropdown-item>
                    <el-dropdown-item divided command="remove">刪除規則</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <div class="rule-statuses">
              <span class="rule-pill">{{ formatPeriod(rule) }}</span>
              <span
                v-if="rule.requiresRegistration"
                class="rule-pill"
                :class="rule.registrationCompleted ? 'is-good' : 'is-warning'"
              >
                {{ rule.registrationCompleted ? '已完成登錄' : '需活動登錄' }}
              </span>
              <span v-if="rule.priority > 1" class="rule-pill">優先序 {{ rule.priority }}</span>
            </div>

            <div class="rule-summary-list">
              <div
                v-for="summary in formatRuleSummary(rule)"
                :key="summary.key"
                class="rule-summary-item"
              >
                <span class="rule-summary-main">{{ summary.label }} {{ summary.rate }}</span>
                <span class="rule-summary-cap">（{{ summary.cap }}）</span>
              </div>
            </div>

            <p v-if="formatRuleCaps(rule)" class="rule-meta">
              {{ formatRuleCaps(rule) }}
            </p>

            <div v-if="formatRuleConditions(rule).length" class="rule-tags">
              <span
                v-for="condition in formatRuleConditions(rule)"
                :key="condition"
                class="rule-tag"
              >
                {{ condition }}
              </span>
            </div>

            <div v-if="formatRuleUsage(rule, tool).length" class="rule-usage-list">
              <small
                v-for="usage in formatRuleUsage(rule, tool)"
                :key="usage.key"
                class="rule-usage"
              >
                <span class="rule-usage-label">{{ usage.label }}</span>
                <span class="rule-usage-value">{{ usage.used }} / {{ usage.cap }}</span>
              </small>
            </div>
          </div>

          <div v-if="stored(tool)" class="balance">
            目前餘額
            <strong>{{ balance(tool).currency }} {{ balance(tool).currentBalance.toLocaleString() }}</strong>
          </div>
        </article>
      </div>

      <div v-else class="payment-empty">尚未建立支付工具</div>
    </section>

    <section v-if="reminders.length" class="payment-reminders">
      <div class="payment-section-title">
        <h3>提醒</h3>
        <span>{{ reminders.length }} 項</span>
      </div>
      <ul>
        <li v-for="reminder in reminders" :key="reminder">{{ reminder }}</li>
      </ul>
    </section>

    <section>
      <div class="payment-section-title">
        <h3>付款明細</h3>
        <span>{{ sortedFilteredTransactions.length }}／{{ activeTransactions.length }} 筆</span>
      </div>

      <div v-if="activeTransactions.length" class="transaction-filters">
        <el-select v-model="transactionToolFilter" clearable placeholder="全部工具">
          <el-option
            v-for="tool in ownTools"
            :key="tool.id"
            :label="tool.name"
            :value="tool.id"
          />
        </el-select>
        <el-select v-model="transactionStatusFilter" clearable placeholder="全部狀態">
          <el-option label="已入帳" value="posted" />
          <el-option label="待入帳" value="pending" />
          <el-option label="部分退款" value="partially_refunded" />
          <el-option label="已退款" value="refunded" />
        </el-select>
        <el-select v-model="transactionCategoryFilter" clearable placeholder="全部分類">
          <el-option
            v-for="category in transactionCategories"
            :key="category"
            :label="category"
            :value="category"
          />
        </el-select>
        <el-select v-model="transactionSort" placeholder="排序方式">
          <el-option label="最新優先" value="date_desc" />
          <el-option label="最早優先" value="date_asc" />
          <el-option label="金額高到低" value="amount_desc" />
          <el-option label="金額低到高" value="amount_asc" />
          <el-option label="回饋高到低" value="reward_desc" />
        </el-select>
        <el-date-picker
          v-model="transactionDateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
        />
      </div>

      <div v-if="activeTransactions.length" class="transaction-filter-summary">
        <div class="filter-chip-list">
          <span
            v-for="item in activeFilterSummary"
            :key="item.key"
            class="filter-chip"
          >
            {{ item.label }}
          </span>
        </div>
        <el-button
          v-if="transactionToolFilter || transactionStatusFilter || transactionCategoryFilter || transactionDateRange.length || transactionSort !== 'date_desc'"
          text
          class="filter-reset"
          @click="clearTransactionFilters"
        >
          重設
        </el-button>
      </div>

      <div v-if="sortedFilteredTransactions.length" class="transaction-list">
        <article
          v-for="transaction in sortedFilteredTransactions"
          :key="transaction.id"
          class="transaction-row"
        >
          <div class="transaction-main">
            <div class="transaction-title-row">
              <strong>{{ transaction.title }}</strong>
              <span
                class="transaction-status-pill"
                :class="transactionStatusClass(transaction.status)"
              >
                {{ transactionStatusLabel(transaction.status) }}
              </span>
            </div>
            <p>
              {{ transaction.transactionDate }}・{{
                tools.find((item) => item.id === transaction.paymentToolId)?.name ||
                '已移除工具'
              }}
            </p>
            <div class="transaction-meta-row">
              <span v-if="transaction.category">{{ transaction.category }}</span>
              <span v-if="transaction.merchant">{{ transaction.merchant }}</span>
              <span>{{ transactionRewardLabel(transaction) }}</span>
            </div>
          </div>
          <div class="transaction-amount">
            <b>{{ transaction.originalCurrency }} {{ transaction.originalAmount.toLocaleString() }}</b>
            <small v-if="transaction.convertedAmount && transaction.originalCurrency !== trip.currency">
              約 {{ trip.currency }} {{ transaction.convertedAmount.toLocaleString() }}
            </small>
          </div>
          <el-dropdown
            v-if="canEdit"
            trigger="click"
            @command="transactionAction($event, transaction)"
          >
            <button class="tool-more" type="button">⋯</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">編輯交易／退款</el-dropdown-item>
                <el-dropdown-item divided command="remove">刪除交易</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </article>
      </div>
      <div v-else class="payment-empty">找不到符合篩選條件的付款紀錄</div>
    </section>
  </section>
</template>

<style scoped>
.payment-page{grid-column:1/-1;padding:24px}
.payment-heading,.payment-heading>div:last-child,.payment-section-title,.tool-card-top,.tool-name,.balance,.rule-top,.rule-heading,.tool-meta-row,.transaction-title-row,.transaction-meta-row{display:flex;align-items:center}
.payment-heading,.payment-section-title,.tool-card-top,.rule-top,.balance{justify-content:space-between}
.payment-heading{gap:16px;padding-bottom:18px;border-bottom:1px solid #e1e8e3}
.payment-heading p{margin:0;color:#df765f;font-size:11px;font-weight:800;letter-spacing:1px}
.payment-heading h2{margin:3px 0;color:#163b37}
.payment-heading>div:last-child{gap:8px;flex-wrap:wrap}
.payment-summary,.tool-grid{display:grid;gap:10px}
.payment-summary{grid-template-columns:repeat(4,1fr);margin:18px 0}
.payment-summary article,.tool-card,.transaction-list,.payment-empty{border:1px solid #e1e8e3;border-radius:12px;background:#fff}
.payment-summary article{padding:12px}
.payment-summary span,.tool-card p,.tool-card small,.transaction-row p,.rule-meta,.rule-summary-list{color:#6b7d78;font-size:12px}
.payment-section-title{margin:20px 0 10px}
.payment-section-title h3{margin:0}
.tool-grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.tool-card{display:grid;gap:8px;padding:15px}
.tool-card.is-inactive{opacity:.6}
.tool-type{padding:3px 7px;border-radius:99px;background:#eaf4ef;color:#35725f;font-size:11px}
.tool-more{width:36px;height:36px;border:0;border-radius:9px;background:transparent;font-size:20px;cursor:pointer}
.tool-name{gap:9px;min-width:0}
.tool-name img{width:40px;height:40px;border-radius:9px;object-fit:cover;flex:0 0 auto}
.tool-name h4{margin:0;color:#163b37;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tool-card p,.rule-meta,.rule-summary-list{margin:0}
.tool-meta-row{justify-content:space-between;gap:8px;flex-wrap:wrap}
.tool-status-pill{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e8f4ec;color:#2f7d70;font-size:11px;font-weight:700;line-height:1.2}
.tool-status-pill.is-inactive{background:#f3f6f4;color:#7b8d87}
.tool-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px;background:#f4f8f5;border-radius:9px;font-size:12px}
.rule,.balance{padding:10px;border-radius:10px;background:#f9fbfa;font-size:12px}
.rule{display:grid;gap:8px;border:1px solid #edf2ee}
.rule-top{gap:8px;align-items:flex-start}
.rule-heading{min-width:0;flex:1;gap:8px;align-items:flex-start}
.rule-heading strong{min-width:0;flex:1;color:#163b37;line-height:1.45}
.rule-rate{flex:0 0 auto;color:#123f3a;font-size:13px;font-weight:700}
.rule-more{width:32px;height:32px;flex:0 0 32px;font-size:18px}
.rule-statuses,.rule-tags{display:flex;flex-wrap:wrap;gap:6px}
.rule-pill,.rule-tag{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;line-height:1.2}
.rule-pill{background:#eef5f0;color:#2f7d70}
.rule-pill.is-warning{background:#fff4d9;color:#9b6a17}
.rule-pill.is-good{background:#e8f4ec;color:#2f7d70}
.rule-summary-list{display:grid;gap:4px}
.rule-summary-item{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:baseline}
.rule-summary-main{color:#2d5e54;font-weight:700}
.rule-summary-cap{color:#6b7d78}
.rule-meta{line-height:1.5}
.rule-tag{background:#f3f6f4;color:#58736b}
.rule-usage-list{display:grid;gap:4px}
.rule-usage{display:flex;flex-wrap:wrap;gap:4px 8px;color:#6b7d78;line-height:1.5}
.rule-usage-label{color:#58736b}
.rule-usage-value{color:#163b37;font-weight:600}
.balance{background:#eef6f1}
.payment-empty{padding:24px;text-align:center;color:#6b7d78}
.transaction-list{overflow:hidden}
.transaction-row{display:grid;grid-template-columns:minmax(0,1fr) auto 36px;align-items:center;gap:12px;padding:12px;border-radius:0;border-width:0 0 1px}
.transaction-row:last-child{border:0}
.transaction-row p{margin:3px 0 0}
.transaction-main{min-width:0;display:grid;gap:4px}
.transaction-title-row{justify-content:space-between;gap:8px}
.transaction-title-row strong{min-width:0;color:#163b37;font-size:15px;line-height:1.45}
.transaction-meta-row{gap:6px;flex-wrap:wrap;color:#6b7d78;font-size:12px}
.transaction-meta-row span{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f3f6f4;line-height:1.2}
.transaction-status-pill{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;line-height:1.2;white-space:nowrap}
.transaction-status-pill.is-posted{background:#e8f4ec;color:#2f7d70}
.transaction-status-pill.is-pending{background:#fff4d9;color:#9b6a17}
.transaction-status-pill.is-refunded,.transaction-status-pill.is-partially_refunded{background:#eef5f0;color:#2f7d70}
.transaction-status-pill.is-cancelled{background:#f7ecea;color:#b55b55}
.transaction-amount{display:grid;justify-items:end;gap:3px;min-width:110px}
.transaction-amount b{color:#163b37;font-size:15px}
.transaction-amount small{color:#6b7d78;font-size:11px}
.transaction-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 10px}
.transaction-filter-summary{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin:0 0 12px}
.filter-chip-list{display:flex;flex-wrap:wrap;gap:6px}
.filter-chip{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:12px;line-height:1.2}
.filter-reset{padding:0 2px;flex:0 0 auto}
@media(max-width:600px){
  .payment-page{padding:16px}
  .payment-heading{align-items:stretch;flex-direction:column}
  .payment-heading>div:last-child>*{flex:1 1 calc(50% - 4px)}
  .payment-summary{grid-template-columns:repeat(2,1fr)}
  .tool-grid,.transaction-filters{grid-template-columns:1fr}
  .payment-section-title{align-items:flex-start;gap:8px;flex-direction:column}
  .transaction-filter-summary{flex-direction:column}
  .transaction-row{grid-template-columns:minmax(0,1fr) 36px;align-items:start}
  .transaction-amount{justify-items:start;min-width:0}
  .transaction-title-row{align-items:flex-start;flex-direction:column}
  .transaction-status-pill{align-self:flex-start}
}
</style>
