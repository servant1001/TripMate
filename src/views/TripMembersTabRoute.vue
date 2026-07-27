<script setup lang="ts">
import TripMembersView from './TripMembersView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, balances, settlementSuggestions, currentSettlements, currentExpenses, canManageMembers, canEditTrip, memberManagerRequested, memberName } = useTripWorkspaceContext()
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
  />
</template>
