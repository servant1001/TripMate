<script setup lang="ts">
import TripBookingCard from '../components/TripBookingCard.vue'
import type { Booking, Trip } from '../types'

defineProps<{ trip: Trip; bookings: Booking[]; canEdit: boolean; memberName: (id: string) => string }>()
const emit = defineEmits<{ add: []; edit: [booking: Booking]; remove: [booking: Booking] }>()
</script>

<template><section class="trip-bookings-view" aria-label="旅行預訂"><TripBookingCard :trip="trip" :bookings="bookings" :can-edit-trip="canEdit" :member-name="memberName" @add="emit('add')" @edit="emit('edit', $event)" @remove="emit('remove', $event)" /></section></template>
<style scoped>.trip-bookings-view{display:grid;grid-column:1/-1;min-width:0}</style>
