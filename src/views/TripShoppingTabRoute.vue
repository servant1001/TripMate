<script setup lang="ts">
import TripShoppingView from './TripShoppingView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentShoppingItems, currentItems, canEditTrip, userId, memberName, formatItineraryDate } = useTripWorkspaceContext()
</script>

<template>
  <TripShoppingView :trip="current!" :items="currentShoppingItems" :itineraries="currentItems" :can-edit="canEditTrip" :user-id="userId" :member-name="memberName" :format-date="formatItineraryDate" />
</template>
