<script setup lang="ts">
import TripMembersView from './TripMembersView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, balances, settlementSuggestions, currentSettlements, currentExpenses, canManageMembers, canEditTrip, memberManagerRequested, memberName, accountingCurrency, accountingRate, toTripCurrencyAmount, payerAmountInAccounting } = useTripWorkspaceContext()
</script>

<template>
  <TripMembersView
    v-model:open-manager="memberManagerRequested"
    :trip="current!"
    :balances="balances"
    :suggestions="settlementSuggestions"
    :settlements="currentSettlements"
    :expenses="currentExpenses"
    :can-manage="canManageMembers"
    :can-edit="canEditTrip"
    :member-name="memberName"
    :accounting-currency="accountingCurrency"
    :accounting-rate="accountingRate"
    :to-trip-currency-amount="toTripCurrencyAmount"
    :payer-amount-in-accounting="payerAmountInAccounting"
  />
</template>
