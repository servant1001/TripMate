<script setup lang="ts">
import type { PaymentMethod, PaymentTool, PaymentTransaction } from '../types'

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
  open: boolean
  editing: boolean
  form: PaymentTransactionDraft
  tools: PaymentTool[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
}>()
</script>

<template>
  <el-dialog
    :model-value="props.open"
    :title="props.editing ? '編輯付款紀錄' : '新增付款紀錄'"
    width="min(94vw, 680px)"
    @update:model-value="emit('update:open', $event)"
  >
    <el-form label-position="top">
      <div class="two-col">
        <el-form-item label="支付工具" required>
          <el-select v-model="props.form.paymentToolId">
            <el-option v-for="tool in props.tools" :key="tool.id" :label="tool.name" :value="tool.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="消費名稱" required>
          <el-input v-model="props.form.title" />
        </el-form-item>
        <el-form-item label="店家">
          <el-input v-model="props.form.merchant" />
        </el-form-item>
        <el-form-item label="分類">
          <el-input v-model="props.form.category" />
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="props.form.transactionDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="props.form.paymentMethod">
            <el-option label="實體卡" value="physical_card" />
            <el-option label="Apple Pay" value="apple_pay" />
            <el-option label="Google Pay" value="google_pay" />
            <el-option label="網路付款" value="online" />
            <el-option label="掃碼付款" value="qr_payment" />
            <el-option label="交通卡儲值" value="transport_card_topup" />
            <el-option label="儲值支付" value="stored_value" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="原始金額" required>
          <el-input-number v-model="props.form.originalAmount" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="原始幣別">
          <el-input v-model="props.form.originalCurrency" />
        </el-form-item>
        <el-form-item label="匯率">
          <el-input-number v-model="props.form.exchangeRate" :min="0.000001" :precision="6" controls-position="right" />
        </el-form-item>
        <el-form-item label="交易類型">
          <el-select v-model="props.form.transactionType">
            <el-option label="消費" value="purchase" />
            <el-option label="儲值" value="top_up" />
            <el-option label="退款" value="refund" />
            <el-option label="調整" value="adjustment" />
          </el-select>
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="props.form.status">
            <el-option label="已入帳" value="posted" />
            <el-option label="待入帳" value="pending" />
            <el-option label="部分退款" value="partially_refunded" />
            <el-option label="已退款" value="refunded" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="退款金額（選填）">
        <el-input-number v-model="props.form.refundedAmount" :min="0" :max="props.form.originalAmount" controls-position="right" />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="props.form.syncExpense">同步建立個人旅行開銷（僅新交易）</el-checkbox>
      </el-form-item>
      <el-form-item label="備註">
        <el-input v-model="props.form.note" type="textarea" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:open', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">儲存付款紀錄</el-button>
    </template>
  </el-dialog>
</template>
