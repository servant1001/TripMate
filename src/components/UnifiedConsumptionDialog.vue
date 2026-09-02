<script setup lang="ts">
import { computed } from 'vue'
import type { ExpenseKind, ExpenseSplitMode, PaymentMethod, PaymentTool, PaymentTransaction, Trip } from '../types'

export type UnifiedConsumptionMode = 'expense' | 'payment'

export type ExpenseDraft = {
  title: string
  amount: number
  payerId: string
  kind: ExpenseKind
  splitMode: ExpenseSplitMode
  category: string
  date: string
}

export type PaymentTransactionDraft = {
  paymentToolId: string
  title: string
  merchant: string
  category: string
  transactionDate: string
  transactionTime: string
  paymentMethod: PaymentMethod
  originalAmount: number
  originalCurrency: string
  exchangeRate: number
  transactionType: PaymentTransaction['transactionType']
  status: PaymentTransaction['status']
  refundedAmount: number
  note: string
  syncExpense: boolean
}

const props = defineProps<{
  modelValue: boolean
  mode: UnifiedConsumptionMode
  editing: boolean
  saving?: boolean
  form: ExpenseDraft | PaymentTransactionDraft
  trip: Trip
  tools?: PaymentTool[]
  paymentToolId?: string
  participantIds?: string[]
  payerIds?: string[]
  shares?: Record<string, number>
  ratios?: Record<string, number>
  splitUnits?: Record<string, number>
  payerShares?: Record<string, number>
  customShareTotal?: number
  ratioTotal?: number
  splitUnitTotal?: number
  payerTotal?: number
  sourceCurrency?: string
  sourceAmount?: number
  exchangeRate?: number
  rateLoading?: boolean
  rateDate?: string
  sourceConversionActive?: boolean
  note?: string
  receiptPreview?: string
  receiptUrl?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:participantIds': [value: string[]]
  'update:payerIds': [value: string[]]
  'update:sourceCurrency': [value: string]
  'update:sourceAmount': [value: number]
  'update:exchangeRate': [value: number]
  'update:paymentToolId': [value: string]
  refreshRate: []
  'update:note': [value: string]
  selectReceipt: [event: Event]
  removeReceipt: []
  syncPayers: []
  syncParticipants: []
  resetSplitValues: []
  save: []
  closed: []
}>()

const expenseForm = computed(() => props.form as ExpenseDraft)
const paymentForm = computed(() => props.form as PaymentTransactionDraft)
const participantIds = computed(() => props.participantIds || [])
const payerIds = computed(() => props.payerIds || [])
const shares = computed(() => props.shares || {})
const ratios = computed(() => props.ratios || {})
const splitUnits = computed(() => props.splitUnits || {})
const payerShares = computed(() => props.payerShares || {})
const members = computed(() => props.trip.members || [])

function memberName(memberId: string) {
  return members.value.find((member) => member.id === memberId)?.name || '未知成員'
}

const currencyOptions = computed(() => {
  const current = paymentForm.value.originalCurrency?.trim().toUpperCase()
  return [...new Set(['JPY', 'TWD', current].filter(Boolean))] as string[]
})

const expenseCurrencyOptions = computed(() => {
  const common = [
    { code: 'TWD', name: '新台幣' },
    { code: 'JPY', name: '日圓' },
    { code: 'USD', name: '美元' },
    { code: 'EUR', name: '歐元' },
    { code: 'CNY', name: '人民幣' },
    { code: 'KRW', name: '韓元' },
    { code: 'HKD', name: '港幣' },
    { code: 'SGD', name: '新加坡幣' },
    { code: 'THB', name: '泰銖' },
    { code: 'GBP', name: '英鎊' },
    { code: 'AUD', name: '澳幣' },
  ]
  const tripCurrency = props.trip.currency?.trim().toUpperCase()
  if (tripCurrency && !common.some((item) => item.code === tripCurrency)) {
    common.unshift({ code: tripCurrency, name: '旅行幣別' })
  } else if (tripCurrency) {
    common.sort((left, right) => (left.code === tripCurrency ? -1 : right.code === tripCurrency ? 1 : 0))
  }
  return common
})

const convertedAmountPreview = computed(() => {
  const from = props.sourceCurrency?.trim().toUpperCase()
  const to = props.trip.currency?.trim().toUpperCase()
  const amount = Number(props.sourceAmount) || 0
  const rate = Number(props.exchangeRate) || 0
  if (!from || !to || from === to || amount <= 0 || rate <= 0) return ''
  return `${to} ${(amount * rate).toFixed(2)}`
})

const payerIdsModel = computed({
  get: () => payerIds.value,
  set: (value: string[]) => emit('update:payerIds', value),
})
const participantIdsModel = computed({
  get: () => participantIds.value,
  set: (value: string[]) => emit('update:participantIds', value),
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? (mode === 'expense' ? '編輯旅行開銷' : '編輯付款紀錄') : '新增消費'"
    class="unified-consumption-dialog"
    width="min(94vw, 680px)"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <el-form v-if="mode === 'expense'" label-position="top">
      <el-form-item label="項目" required>
        <el-input v-model="expenseForm.title" />
      </el-form-item>

      <div class="two-col">
        <el-form-item :label="`記帳金額（${trip.currency}）`" required>
          <el-input-number v-model="expenseForm.amount" :min="0" controls-position="right" :disabled="sourceConversionActive" />
          <small v-if="sourceConversionActive">已鎖定，會依原始金額與匯率自動換算。</small>
          <small v-else>以旅行幣別 {{ trip.currency }} 記帳與結算。</small>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="expenseForm.date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </div>

      <div class="three-col expense-source-fields">
        <el-form-item label="原始幣別（選填）">
          <el-select
            :model-value="sourceCurrency"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="選擇原始幣別"
            @update:model-value="emit('update:sourceCurrency', $event || '')"
          >
            <el-option v-for="currency in expenseCurrencyOptions" :key="currency.code" :label="`${currency.code} ${currency.name}`" :value="currency.code" />
          </el-select>
        </el-form-item>
        <el-form-item :label="sourceConversionActive ? '原始金額' : '原始金額（選填）'">
          <el-input-number :model-value="sourceAmount" :min="0" :precision="2" controls-position="right" @update:model-value="emit('update:sourceAmount', $event || 0)" />
        </el-form-item>
        <el-form-item :label="sourceConversionActive ? '換算匯率' : '換算匯率（選填）'">
          <el-input-number :model-value="exchangeRate" :min="0" :precision="6" controls-position="right" @update:model-value="emit('update:exchangeRate', $event || 0)" />
          <el-button class="expense-rate-button" size="small" :loading="rateLoading" :disabled="!sourceCurrency || sourceCurrency === trip.currency" @click="emit('refreshRate')">更新匯率</el-button>
        </el-form-item>
      </div>
      <p class="hint">原始幣別不同於旅行幣別時，儲存會以原始金額 × 匯率換算為 {{ trip.currency }} 結算金額。<span v-if="rateDate">（匯率日期 {{ rateDate }}）</span></p>
      <div v-if="convertedAmountPreview" class="conversion-preview">換算後記帳金額：<strong>{{ convertedAmountPreview }}</strong></div>

      <el-form-item label="付款人" required>
        <el-select v-model="payerIdsModel" multiple collapse-tags collapse-tags-tooltip placeholder="選擇付款旅伴" @change="emit('syncPayers')">
          <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
        </el-select>
        <small>個人支出只能選擇一位付款人；共同分攤可設定多人付款。</small>
      </el-form-item>
      <el-form-item label="付款方式（同步至支付與回饋）">
        <el-select
          :model-value="paymentToolId || ''"
          clearable
          placeholder="選擇支付工具或現金"
          @update:model-value="emit('update:paymentToolId', $event || '')"
        >
          <el-option label="現金" value="cash" />
          <el-option
            v-for="tool in tools || []"
            :key="tool.id"
            :label="tool.name"
            :value="tool.id"
          />
        </el-select>
        <small>儲存後會在「支付與回饋」建立對應付款紀錄；留白則只保存旅行開銷。</small>
      </el-form-item>
      <el-form-item v-if="payerIds.length" :label="payerIds.length > 1 ? '各自付款金額' : '付款金額'">
        <div class="custom-shares">
          <div v-for="memberId in payerIds" :key="memberId"><span>{{ memberName(memberId) }}</span><el-input-number v-model="payerShares[memberId]" :min="0" :precision="2" :disabled="payerIds.length === 1" controls-position="right" /></div>
        </div>
        <small :class="{ 'share-total-error': Math.abs((payerTotal || 0) - expenseForm.amount) > 0.01 }">付款合計 {{ (payerTotal || 0).toFixed(2) }}／支出 {{ expenseForm.amount.toFixed(2) }}</small>
      </el-form-item>

      <div class="two-col">
        <el-form-item label="類型"><el-select v-model="expenseForm.kind" @change="emit('syncParticipants')"><el-option label="共同分攤" value="shared" /><el-option label="個人支出" value="personal" /></el-select></el-form-item>
        <el-form-item label="分類"><el-select v-model="expenseForm.category"><el-option v-for="category in ['餐飲', '交通', '住宿', '購物', '伴手禮', '其他']" :key="category" :label="category" :value="category" /></el-select></el-form-item>
      </div>
      <el-form-item v-if="expenseForm.kind === 'shared'" label="分攤方式"><el-radio-group v-model="expenseForm.splitMode" @change="emit('resetSplitValues')"><el-radio value="equal">平均分攤</el-radio><el-radio value="custom">自訂金額</el-radio><el-radio value="ratio">比例分攤</el-radio><el-radio value="shares">份數分攤</el-radio></el-radio-group></el-form-item>
      <el-form-item v-if="expenseForm.kind === 'shared'" label="分攤成員"><el-checkbox-group v-model="participantIdsModel" class="participants" @change="emit('syncParticipants')"><el-checkbox v-for="member in members" :key="member.id" :label="member.id">{{ member.name }}</el-checkbox></el-checkbox-group></el-form-item>
      <el-form-item v-if="expenseForm.kind === 'shared' && expenseForm.splitMode === 'custom'" label="各自分攤金額"><div class="custom-shares"><div v-for="memberId in participantIds" :key="memberId"><span>{{ memberName(memberId) }}</span><el-input-number v-model="shares[memberId]" :min="0" :precision="2" controls-position="right" /></div></div><small :class="{ 'share-total-error': Math.abs((customShareTotal || 0) - expenseForm.amount) > 0.01 }">合計 {{ (customShareTotal || 0).toFixed(2) }}／支出 {{ expenseForm.amount.toFixed(2) }}</small></el-form-item>
      <el-form-item v-else-if="expenseForm.kind === 'shared' && expenseForm.splitMode === 'ratio'" label="各自分攤比例"><div class="custom-shares"><div v-for="memberId in participantIds" :key="memberId"><span>{{ memberName(memberId) }}</span><el-input-number v-model="ratios[memberId]" :min="0" :max="100" :precision="2" controls-position="right" /><em>%</em></div></div><small :class="{ 'share-total-error': Math.abs((ratioTotal || 0) - 100) > 0.01 }">合計 {{ (ratioTotal || 0).toFixed(2) }}％／必須為 100％</small></el-form-item>
      <el-form-item v-else-if="expenseForm.kind === 'shared' && expenseForm.splitMode === 'shares'" label="各自分攤份數"><div class="custom-shares"><div v-for="memberId in participantIds" :key="memberId"><span>{{ memberName(memberId) }}</span><el-input-number v-model="splitUnits[memberId]" :min="0" :precision="2" controls-position="right" /><em>份</em></div></div><small>總份數 {{ (splitUnitTotal || 0).toFixed(2) }}；系統將依份數比例計算每人應付。</small></el-form-item>
      <el-form-item v-else label="分攤成員"><el-input :model-value="memberName(expenseForm.payerId)" disabled /><small>個人支出僅計入付款人，不會影響其他成員結算。</small></el-form-item>
      <el-form-item label="收據／付款證明（選填）"><div class="receipt-field"><input type="file" accept="image/*" aria-label="上傳收據或付款證明圖片" @change="emit('selectReceipt', $event)" /><div v-if="receiptPreview || receiptUrl" class="receipt-preview"><img :src="receiptPreview || receiptUrl" alt="收據預覽" /><el-button text type="danger" @click="emit('removeReceipt')">移除圖片</el-button></div></div></el-form-item>
      <el-form-item label="備註（選填）"><el-input :model-value="note" type="textarea" :rows="2" maxlength="240" show-word-limit @update:model-value="emit('update:note', $event)" /></el-form-item>
    </el-form>

    <el-form v-else label-position="top">
      <div class="two-col">
        <el-form-item label="支付工具" required><el-select v-model="paymentForm.paymentToolId"><el-option v-for="tool in tools || []" :key="tool.id" :label="tool.name" :value="tool.id" /></el-select></el-form-item>
        <el-form-item label="消費名稱" required><el-input v-model="paymentForm.title" /></el-form-item>
        <el-form-item label="店家"><el-input v-model="paymentForm.merchant" /></el-form-item>
        <el-form-item label="分類"><el-input v-model="paymentForm.category" /></el-form-item>
        <el-form-item label="日期" required><el-date-picker v-model="paymentForm.transactionDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="付款方式"><el-select v-model="paymentForm.paymentMethod"><el-option label="實體卡" value="physical_card" /><el-option label="Apple Pay" value="apple_pay" /><el-option label="Google Pay" value="google_pay" /><el-option label="網路付款" value="online" /><el-option label="掃碼付款" value="qr_payment" /><el-option label="交通卡儲值" value="transport_card_topup" /><el-option label="儲值支付" value="stored_value" /><el-option label="其他" value="other" /></el-select></el-form-item>
        <el-form-item label="原始金額" required><el-input-number v-model="paymentForm.originalAmount" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="原始幣別"><el-select v-model="paymentForm.originalCurrency" filterable><el-option v-for="currency in currencyOptions" :key="currency" :label="currency" :value="currency" /></el-select></el-form-item>
        <el-form-item label="匯率"><el-input-number v-model="paymentForm.exchangeRate" :min="0.000001" :precision="6" controls-position="right" /></el-form-item>
        <el-form-item label="交易類型"><el-select v-model="paymentForm.transactionType"><el-option label="消費" value="purchase" /><el-option label="儲值" value="top_up" /><el-option label="退款" value="refund" /><el-option label="調整" value="adjustment" /></el-select></el-form-item>
        <el-form-item label="狀態"><el-select v-model="paymentForm.status"><el-option label="已入帳" value="posted" /><el-option label="待入帳" value="pending" /><el-option label="部分退款" value="partially_refunded" /><el-option label="已退款" value="refunded" /><el-option label="已取消" value="cancelled" /></el-select></el-form-item>
      </div>
      <el-form-item label="退款金額（選填）"><el-input-number v-model="paymentForm.refundedAmount" :min="0" :max="paymentForm.originalAmount" controls-position="right" /></el-form-item>
      <el-form-item>
        <el-checkbox v-model="paymentForm.syncExpense">同步建立個人旅行開銷（僅新交易）</el-checkbox>
        <small class="sync-hint">勾選後會用同一筆金額與日期建立開銷，不需要再重複輸入。</small>
      </el-form-item>
      <el-form-item label="備註"><el-input v-model="paymentForm.note" type="textarea" /></el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="saving" @click="emit('save')">{{ mode === 'expense' ? '儲存支出' : '儲存付款紀錄' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.two-col :deep(.el-input-number),.two-col :deep(.el-date-editor),.two-col :deep(.el-select),.three-col :deep(.el-input-number),.three-col :deep(.el-select){width:100%}.hint{margin:-8px 0 12px;color:#6b7d78;font-size:12px;line-height:1.5}.conversion-preview{margin:-4px 0 14px;padding:8px 10px;border-radius:8px;background:#eef5f0;color:#35665b;font-size:12px;line-height:1.4}.conversion-preview strong{color:#123f3a;font-size:13px}.expense-rate-button{margin-top:6px}.sync-hint{display:block;margin-top:4px;color:#6b7d78;font-size:12px}.participants{display:flex;flex-wrap:wrap;gap:7px 12px}.participants :deep(.el-checkbox){margin-right:0}.custom-shares{display:grid;gap:8px}.custom-shares>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,160px) auto;align-items:center;gap:10px}.custom-shares span{min-width:0;color:#244a43;font-size:13px;font-weight:700}.custom-shares em{color:#6b7d78;font-size:12px;font-style:normal}.share-total-error{color:#d9544d!important}.receipt-field{display:grid;gap:10px}.receipt-preview{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #dbe8e1;border-radius:10px;background:#f7fbf8}.receipt-preview img{width:64px;height:64px;border-radius:8px;object-fit:cover}.receipt-preview .el-button{margin-left:auto}@media(max-width:600px){.two-col,.three-col{grid-template-columns:1fr}.unified-consumption-dialog :deep(.el-dialog__body){padding:16px}.unified-consumption-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}.custom-shares>div{grid-template-columns:minmax(0,1fr)}}
</style>
