<script setup lang="ts">
import TripInsuranceView from './TripInsuranceView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentInsurances, currentInsuranceStatuses, userId, memberName, canEditTrip } = useTripWorkspaceContext()
</script>

<template>
  <TripInsuranceView :trip="current!" :insurances="currentInsurances" :statuses="currentInsuranceStatuses" :user-id="userId" :member-name="memberName" :can-edit="canEditTrip" />
</template>
