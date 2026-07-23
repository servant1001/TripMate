<script setup lang="ts">
import type { PaymentToolType, PaymentToolVisibility } from '../types'

export type PaymentToolDraft = {
  name: string
  type: PaymentToolType
  issuer: string
  lastFourDigits: string
  settlementCurrency: string
  foreignTransactionFeeRatePercent: number
  visibility: PaymentToolVisibility
  note: string
}

const props = defineProps<{ open: boolean; editing: boolean; form: PaymentToolDraft; imageUrl: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; 'update:imageUrl': [value: string]; save: [] }>()
</script>

<template>
  <el-dialog :model-value="props.open" :title="props.editing ? '編輯支付工具' : '新增支付工具'" width="min(94vw, 620px)" @update:model-value="emit('update:open', $event)">
    <el-form label-position="top">
      <div class="two-col">
        <el-form-item label="工具名稱" required><el-input v-model="props.form.name" placeholder="例如：富邦 J 卡、Suica" /></el-form-item>
        <el-form-item label="類型"><el-select v-model="props.form.type"><el-option label="信用卡" value="credit_card"/><el-option label="簽帳金融卡" value="debit_card"/><el-option label="電子支付" value="electronic_payment"/><el-option label="交通卡" value="transport_card"/><el-option label="現金" value="cash"/><el-option label="其他" value="other"/></el-select></el-form-item>
        <el-form-item label="發卡／服務單位"><el-input v-model="props.form.issuer" /></el-form-item>
        <el-form-item label="末四碼（選填）"><el-input v-model="props.form.lastFourDigits" maxlength="4" inputmode="numeric" /></el-form-item>
        <el-form-item label="結算幣別"><el-input v-model="props.form.settlementCurrency" /></el-form-item>
        <el-form-item label="海外手續費（%）"><el-input-number v-model="props.form.foreignTransactionFeeRatePercent" :min="0" :precision="2" controls-position="right" /></el-form-item>
      </div>
      <el-form-item label="工具圖片網址（選填）"><el-input :model-value="props.imageUrl" placeholder="https://example.com/card-image.png" @update:model-value="emit('update:imageUrl', $event)" /><p class="payment-image-hint">支援可公開存取的圖片網址；儲存後會顯示在工具名稱旁。</p><img v-if="props.imageUrl" :src="props.imageUrl" class="payment-image-preview" alt="支付工具圖片預覽" /></el-form-item>
      <el-form-item label="可見性"><el-radio-group v-model="props.form.visibility"><el-radio-button label="private">僅自己</el-radio-button><el-radio-button label="summary">成員看摘要</el-radio-button><el-radio-button label="trip_members">旅行成員</el-radio-button></el-radio-group></el-form-item>
      <el-form-item label="備註"><el-input v-model="props.form.note" type="textarea" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="emit('update:open', false)">取消</el-button><el-button type="primary" @click="emit('save')">儲存工具</el-button></template>
  </el-dialog>
</template>

<style scoped>
.payment-image-hint{margin:6px 0 0;color:#6b7d78;font-size:12px;line-height:1.5}.payment-image-preview{display:block;width:72px;height:72px;margin-top:8px;border:1px solid #dbe8e1;border-radius:10px;object-fit:cover}
</style>
