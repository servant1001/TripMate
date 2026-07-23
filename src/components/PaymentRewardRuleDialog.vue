<script setup lang="ts">
import type { PaymentMethod, PaymentTool, RewardCapPeriod, RewardType } from '../types'

export type RewardRuleDraft = {
  paymentToolId: string
  name: string
  rewardType: RewardType
  baseRatePercent: number
  bonusRatePercent: number
  rewardCap: number
  maximumEligibleSpend: number
  minimumSpend: number
  capPeriod: RewardCapPeriod
  periodStart: string
  periodEnd: string
  applicableCurrencies: string
  applicableCategories: string
  applicableMerchants: string
  applicablePaymentMethods: PaymentMethod[]
  excludedCategories: string
  excludedMerchants: string
  requiresRegistration: boolean
  registrationCompleted: boolean
  priority: number
  note: string
}

const props = defineProps<{
  open: boolean
  editing: boolean
  form: RewardRuleDraft
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
    :title="props.editing ? '編輯回饋規則' : '新增回饋規則'"
    width="min(94vw, 720px)"
    @update:model-value="emit('update:open', $event)"
  >
    <el-form label-position="top">
      <div class="two-col">
        <el-form-item label="回饋規則名稱" required>
          <el-input v-model="props.form.name" placeholder="例如：日本餐廳加碼回饋" />
        </el-form-item>
        <el-form-item label="支付工具">
          <el-select v-model="props.form.paymentToolId">
            <el-option v-for="tool in props.tools" :key="tool.id" :label="tool.name" :value="tool.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="回饋類型">
          <el-select v-model="props.form.rewardType">
            <el-option label="現金回饋" value="cashback" />
            <el-option label="點數" value="points" />
            <el-option label="里程" value="miles" />
            <el-option label="折抵金" value="statement_credit" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="規則優先順序">
          <el-input-number v-model="props.form.priority" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="基本回饋（%）">
          <el-input-number v-model="props.form.baseRatePercent" :min="0" :precision="2" controls-position="right" />
        </el-form-item>
        <el-form-item label="加碼回饋（%）">
          <el-input-number v-model="props.form.bonusRatePercent" :min="0" :precision="2" controls-position="right" />
        </el-form-item>
        <el-form-item label="最低消費門檻">
          <el-input-number v-model="props.form.minimumSpend" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="回饋金額上限">
          <el-input-number v-model="props.form.rewardCap" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="符合回饋消費上限">
          <el-input-number v-model="props.form.maximumEligibleSpend" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="上限計算期間">
          <el-select v-model="props.form.capPeriod">
            <el-option label="本次旅行" value="trip" />
            <el-option label="自訂活動期間" value="custom" />
            <el-option label="每月" value="monthly" />
            <el-option label="帳單週期" value="billing_cycle" />
          </el-select>
        </el-form-item>
        <el-form-item label="活動開始">
          <el-date-picker v-model="props.form.periodStart" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="活動結束">
          <el-date-picker v-model="props.form.periodEnd" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </div>

      <el-divider content-position="left">適用條件（留空代表不限）</el-divider>

      <div class="two-col">
        <el-form-item label="適用幣別">
          <el-input v-model="props.form.applicableCurrencies" placeholder="例如：JPY、TWD" />
        </el-form-item>
        <el-form-item label="適用消費分類">
          <el-input v-model="props.form.applicableCategories" placeholder="例如：餐廳、交通" />
        </el-form-item>
        <el-form-item label="適用商店／品牌">
          <el-input v-model="props.form.applicableMerchants" placeholder="例如：LAWSON、唐吉訶德" />
        </el-form-item>
        <el-form-item label="適用付款方式">
          <el-checkbox-group v-model="props.form.applicablePaymentMethods" class="payment-method-checks">
            <el-checkbox label="physical_card">實體卡</el-checkbox>
            <el-checkbox label="apple_pay">Apple Pay</el-checkbox>
            <el-checkbox label="google_pay">Google Pay</el-checkbox>
            <el-checkbox label="online">網路付款</el-checkbox>
            <el-checkbox label="qr_payment">掃碼付款</el-checkbox>
            <el-checkbox label="transport_card_topup">交通卡儲值</el-checkbox>
            <el-checkbox label="stored_value">儲值支付</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="排除消費分類">
          <el-input v-model="props.form.excludedCategories" placeholder="例如：保險、稅金" />
        </el-form-item>
        <el-form-item label="排除商店／品牌">
          <el-input v-model="props.form.excludedMerchants" placeholder="例如：指定排除商家" />
        </el-form-item>
      </div>

      <p class="payment-rule-condition-hint">多個條件可用逗號或頓號分隔；商店名稱以消費紀錄中的商店欄位比對。</p>

      <el-form-item>
        <el-checkbox v-model="props.form.requiresRegistration">需要活動登錄</el-checkbox>
        <el-checkbox v-if="props.form.requiresRegistration" v-model="props.form.registrationCompleted">已完成登錄</el-checkbox>
      </el-form-item>
      <el-form-item label="備註">
        <el-input v-model="props.form.note" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:open', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">儲存規則</el-button>
    </template>
  </el-dialog>
</template>
