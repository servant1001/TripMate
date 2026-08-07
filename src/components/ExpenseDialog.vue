<script setup lang="ts">
import { computed } from 'vue'
import type { ExpenseKind, ExpenseSplitMode, Trip } from '../types'

export type ExpenseDraft = {
  title: string
  amount: number
  payerId: string
  kind: ExpenseKind
  splitMode: ExpenseSplitMode
  category: string
  date: string
}

const props = defineProps<{
  modelValue: boolean
  editing: boolean
  saving: boolean
  form: ExpenseDraft
  trip: Trip
  participantIds: string[]
  payerIds: string[]
  shares: Record<string, number>
  ratios: Record<string, number>
  splitUnits: Record<string, number>
  payerShares: Record<string, number>
  customShareTotal: number
  ratioTotal: number
  splitUnitTotal: number
  payerTotal: number
  sourceCurrency: string
  sourceAmount: number
  exchangeRate: number
  rateLoading: boolean
  rateDate: string
  sourceConversionActive: boolean
  note: string
  receiptPreview: string
  receiptUrl: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:participantIds': [value: string[]]
  'update:payerIds': [value: string[]]
  'update:sourceCurrency': [value: string]
  'update:sourceAmount': [value: number]
  'update:exchangeRate': [value: number]
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

const payerIdsModel = computed({
  get: () => props.payerIds,
  set: (value: string[]) => emit('update:payerIds', value),
})

const participantIdsModel = computed({
  get: () => props.participantIds,
  set: (value: string[]) => emit('update:participantIds', value),
})

const currencyOptions = computed(() => {
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

function memberName(memberId: string) {
  return props.trip.members.find((member) => member.id === memberId)?.name || '未知成員'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? '編輯支出' : '新增支出'"
    class="expense-dialog"
    width="min(92vw, 460px)"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <el-form label-position="top">
      <el-form-item label="項目">
        <el-input v-model="form.title" />
      </el-form-item>

      <div class="two-col">
        <el-form-item :label="`記帳金額（${trip.currency}）`">
          <el-input-number v-model="form.amount" :min="0" :disabled="sourceConversionActive" />
          <small v-if="sourceConversionActive">已鎖定，會依原始金額與匯率自動換算。</small>
          <small v-else>以旅行幣別 {{ trip.currency }} 記帳與結算。</small>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" />
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
            <el-option
              v-for="option in currencyOptions"
              :key="option.code"
              :label="`${option.code} ${option.name}`"
              :value="option.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="sourceConversionActive ? '原始金額' : '原始金額（選填）'">
          <el-input-number
            :model-value="sourceAmount"
            :min="0"
            :precision="2"
            controls-position="right"
            @update:model-value="emit('update:sourceAmount', $event || 0)"
          />
        </el-form-item>
        <el-form-item :label="sourceConversionActive ? '換算匯率' : '換算匯率（選填）'">
          <el-input-number
            :model-value="exchangeRate"
            :min="0"
            :precision="6"
            controls-position="right"
            @update:model-value="emit('update:exchangeRate', $event || 0)"
          />
          <el-button
            class="expense-rate-button"
            size="small"
            :loading="rateLoading"
            :disabled="!sourceCurrency || sourceCurrency === trip.currency"
            @click="emit('refreshRate')"
          >
            更新匯率
          </el-button>
        </el-form-item>
      </div>

      <p class="expense-source-hint">
        原始幣別不同於旅行幣別時，儲存會以原始金額 × 匯率換算為 {{ trip.currency }} 結算金額。匯率表示 1 原始幣別可換得多少旅行幣別。
        <span v-if="rateDate">（匯率日期 {{ rateDate }}）</span>
      </p>
      <div v-if="convertedAmountPreview" class="expense-conversion-preview">
        換算後記帳金額：<strong>{{ convertedAmountPreview }}</strong>
      </div>

      <el-form-item label="付款人">
        <el-select
          v-model="payerIdsModel"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="選擇付款旅伴"
          @change="emit('syncPayers')"
        >
          <el-option
            v-for="member in trip.members"
            :key="member.id"
            :label="member.name"
            :value="member.id"
          />
        </el-select>
        <small>
          {{
            form.kind === 'shared'
              ? '通常只需選一位付款人，付款金額會自動等於支出金額；多人付款時再分別填寫。'
              : '個人支出只能選擇一位付款人。'
          }}
        </small>
      </el-form-item>

      <el-form-item v-if="payerIds.length" :label="payerIds.length > 1 ? '各自付款金額' : '付款金額'">
        <div class="custom-shares">
          <div v-for="memberId in payerIds" :key="memberId">
            <span>{{ memberName(memberId) }}</span>
            <el-input-number
              v-model="payerShares[memberId]"
              :min="0"
              :precision="2"
              :disabled="payerIds.length === 1"
              controls-position="right"
            />
          </div>
        </div>
        <small :class="{ 'share-total-error': Math.abs(payerTotal - form.amount) > 0.01 }">
          付款合計 {{ payerTotal.toFixed(2) }}／支出 {{ form.amount.toFixed(2) }}
        </small>
      </el-form-item>

      <div class="two-col">
        <el-form-item label="類型">
          <el-select v-model="form.kind" @change="emit('syncParticipants')">
            <el-option label="共同分攤" value="shared" />
            <el-option label="個人支出" value="personal" />
          </el-select>
        </el-form-item>
        <el-form-item label="分類">
          <el-select v-model="form.category">
            <el-option label="餐飲" value="餐飲" />
            <el-option label="交通" value="交通" />
            <el-option label="住宿" value="住宿" />
            <el-option label="購物" value="購物" />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item v-if="form.kind === 'shared'" label="分攤方式">
        <el-radio-group v-model="form.splitMode" @change="emit('resetSplitValues')">
          <el-radio value="equal">平均分攤</el-radio>
          <el-radio value="custom">自訂金額</el-radio>
          <el-radio value="ratio">比例分攤</el-radio>
          <el-radio value="shares">份數分攤</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.kind === 'shared'" label="分攤成員">
        <el-checkbox-group
          v-model="participantIdsModel"
          class="expense-participants"
          @change="emit('syncParticipants')"
        >
          <el-checkbox v-for="member in trip.members" :key="member.id" :label="member.id">
            {{ member.name }}
          </el-checkbox>
        </el-checkbox-group>
        <small>
          {{
            form.splitMode === 'custom'
              ? '請為每位已選成員填入分攤金額。'
              : form.splitMode === 'ratio'
                ? '輸入每位旅伴的百分比，合計必須為 100%。'
                : form.splitMode === 'shares'
                  ? '輸入每位旅伴的份數，例如 2、1、1。'
                  : '將由已選成員平均分攤本筆支出。'
          }}
        </small>
      </el-form-item>

      <el-form-item v-if="form.kind === 'shared' && form.splitMode === 'custom'" label="各自分攤金額">
        <div class="custom-shares">
          <div v-for="memberId in participantIds" :key="memberId">
            <span>{{ memberName(memberId) }}</span>
            <el-input-number
              v-model="shares[memberId]"
              :min="0"
              :precision="2"
              controls-position="right"
            />
          </div>
        </div>
        <small :class="{ 'share-total-error': Math.abs(customShareTotal - form.amount) > 0.01 }">
          合計 {{ customShareTotal.toFixed(2) }}／支出 {{ form.amount.toFixed(2) }}
        </small>
      </el-form-item>

      <el-form-item v-else-if="form.kind === 'shared' && form.splitMode === 'ratio'" label="各自分攤比例">
        <div class="custom-shares">
          <div v-for="memberId in participantIds" :key="memberId">
            <span>{{ memberName(memberId) }}</span>
            <el-input-number
              v-model="ratios[memberId]"
              :min="0"
              :max="100"
              :precision="2"
              controls-position="right"
            />
            <em>%</em>
          </div>
        </div>
        <small :class="{ 'share-total-error': Math.abs(ratioTotal - 100) > 0.01 }">
          合計 {{ ratioTotal.toFixed(2) }}％／必須為 100％
        </small>
      </el-form-item>

      <el-form-item v-else-if="form.kind === 'shared' && form.splitMode === 'shares'" label="各自分攤份數">
        <div class="custom-shares">
          <div v-for="memberId in participantIds" :key="memberId">
            <span>{{ memberName(memberId) }}</span>
            <el-input-number
              v-model="splitUnits[memberId]"
              :min="0"
              :precision="2"
              controls-position="right"
            />
            <em>份</em>
          </div>
        </div>
        <small :class="{ 'share-total-error': splitUnitTotal <= 0 }">
          總份數 {{ splitUnitTotal.toFixed(2) }}；系統將依份數比例計算每人應付。
        </small>
      </el-form-item>

      <el-form-item v-else label="分攤成員">
        <el-input :model-value="memberName(form.payerId)" disabled />
        <small>個人支出僅計入付款人，不會影響其他成員結算。</small>
      </el-form-item>

      <el-form-item label="收據／付款證明（選填）">
        <div class="expense-receipt-field">
          <input
            type="file"
            accept="image/*"
            aria-label="上傳收據或付款證明圖片"
            @change="emit('selectReceipt', $event)"
          />
          <div v-if="receiptPreview || receiptUrl" class="expense-receipt-preview">
            <img :src="receiptPreview || receiptUrl" alt="收據預覽" />
            <el-button text type="danger" @click="emit('removeReceipt')">移除圖片</el-button>
          </div>
        </div>
        <small>支援圖片格式；收據會安全儲存於本旅行的檔案空間。</small>
      </el-form-item>

      <el-form-item label="備註（選填）">
        <el-input
          :model-value="note"
          type="textarea"
          :rows="2"
          maxlength="240"
          show-word-limit
          placeholder="例如：付款方式、訂單編號或匯率來源"
          @update:model-value="emit('update:note', $event)"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="saving" @click="emit('save')">
        儲存支出
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.three-col :deep(.el-input-number),
.three-col :deep(.el-date-editor),
.three-col :deep(.el-select),
.two-col :deep(.el-input-number),
.two-col :deep(.el-date-editor),
.two-col :deep(.el-select){width:100%}
.expense-rate-button{margin-top:6px}
.expense-source-hint{margin:-8px 0 12px;color:#71827c;font-size:12px;line-height:1.5}
.expense-conversion-preview{margin:-4px 0 14px;padding:8px 10px;border-radius:8px;background:#eef5f0;color:#35665b;font-size:12px;line-height:1.4}
.expense-conversion-preview strong{color:#123f3a;font-size:13px}
.expense-participants{display:flex;flex-wrap:wrap;gap:7px 12px}
.expense-participants :deep(.el-checkbox){margin-right:0}
.custom-shares{display:grid;gap:8px}
.custom-shares>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,160px) auto;align-items:center;gap:10px}
.custom-shares span{min-width:0;color:#244a43;font-size:13px;font-weight:700}
.custom-shares em{color:#6b7d78;font-size:12px;font-style:normal}
.share-total-error{color:#d9544d!important}
.expense-receipt-field{display:grid;gap:10px}
.expense-receipt-preview{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #dbe8e1;border-radius:10px;background:#f7fbf8}
.expense-receipt-preview img{width:64px;height:64px;border-radius:8px;object-fit:cover}
.expense-receipt-preview .el-button{margin-left:auto}
@media(max-width:600px){
  .two-col,.three-col{grid-template-columns:1fr}
  .expense-dialog :deep(.el-dialog__body){padding:16px}
  .expense-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}
  .custom-shares>div{grid-template-columns:minmax(0,1fr)}
}
</style>
