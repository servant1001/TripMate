<script setup lang="ts">
import TripPaymentToolsCard from '../components/TripPaymentToolsCard.vue'
import TripPaymentRecommendationCard from '../components/TripPaymentRecommendationCard.vue'
import TripPaymentSharedToolsCard from '../components/TripPaymentSharedToolsCard.vue'
import type { PaymentTool, PaymentToolSummary, PaymentTransaction, RewardRule, StoredValueBalance, Trip } from '../types'

defineProps<{
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
</script>

<template>
  <section class="trip-payments-view" aria-label="支付與回饋">
    <TripPaymentToolsCard :trip="trip" :tools="tools" :rules="rules" :transactions="transactions" :balances="balances" :user-id="userId" :can-edit="canEdit" :member-name="memberName" @add-tool="emit('addTool')" @edit-tool="emit('editTool', $event)" @remove-tool="emit('removeTool', $event)" @toggle-tool="emit('toggleTool', $event)" @add-rule="emit('addRule', $event)" @edit-rule="emit('editRule', $event)" @remove-rule="emit('removeRule', $event)" @add-transaction="emit('addTransaction', $event)" @edit-transaction="emit('editTransaction', $event)" @remove-transaction="emit('removeTransaction', $event)" @manage-balance="emit('manageBalance', $event)" />
    <TripPaymentRecommendationCard :trip="trip" :tools="tools" :rules="rules" :user-id="userId" />
    <TripPaymentSharedToolsCard :summaries="summaries" :user-id="userId" :member-name="memberName" />
  </section>
</template>

<style scoped>
.trip-payments-view{display:grid;grid-column:1/-1;gap:20px;min-width:0}
</style>
