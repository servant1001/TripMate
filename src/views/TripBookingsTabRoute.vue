<script setup lang="ts">
import TripBookingsView from './TripBookingsView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentBookings, canEditTrip, userId, memberName } = useTripWorkspaceContext()
</script>

<template>
  <TripBookingsView :trip="current!" :bookings="currentBookings" :can-edit="canEditTrip" :user-id="userId" :member-name="memberName" />
</template>
