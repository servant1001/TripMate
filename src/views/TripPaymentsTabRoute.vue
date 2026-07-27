<script setup lang="ts">
import TripPaymentsView from './TripPaymentsView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  currentPaymentTools,
  currentRewardRules,
  currentPaymentTransactions,
  currentStoredBalances,
  currentPaymentToolSummaries,
  canEditTrip,
  userId,
  memberName,
} = useTripWorkspaceContext()
</script>

<template>
  <TripPaymentsView
    :trip="current!"
    :tools="currentPaymentTools"
    :rules="currentRewardRules"
    :transactions="currentPaymentTransactions"
    :balances="currentStoredBalances"
    :summaries="currentPaymentToolSummaries"
    :user-id="userId"
    :can-edit="canEditTrip"
    :member-name="memberName"
  />
</template>
