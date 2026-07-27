<script setup lang="ts">
import TripPackingView from './TripPackingView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentPackingItems, canEditTrip, userId, memberName } = useTripWorkspaceContext()
</script>

<template>
  <TripPackingView :trip="current!" :items="currentPackingItems" :can-edit="canEditTrip" :user-id="userId" :member-name="memberName" />
</template>
