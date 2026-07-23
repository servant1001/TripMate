<script setup lang="ts">
import TripInsuranceCard from '../components/TripInsuranceCard.vue'
import type { InsuranceAttachment, InsuranceStatusSummary, TravelInsurance, Trip } from '../types'

type InsuranceSavePayload = Omit<TravelInsurance, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TravelInsurance, 'createdAt'>>

defineProps<{
  trip: Trip
  insurance?: TravelInsurance
  statuses: Record<string, InsuranceStatusSummary>
  userId: string
  canEdit: boolean
  saving: boolean
  memberName: (id: string) => string
}>()

const emit = defineEmits<{
  save: [payload: InsuranceSavePayload, files: File[]]
  remove: [insurance: TravelInsurance]
  openAttachment: [attachment: InsuranceAttachment]
}>()
</script>

<template>
  <section class="trip-insurance-view" aria-label="旅行保險">
    <TripInsuranceCard :trip="trip" :insurance="insurance" :statuses="statuses" :user-id="userId" :member-name="memberName" :can-edit="canEdit" :saving="saving" @save="(payload, files) => emit('save', payload, files)" @remove="emit('remove', $event)" @open-attachment="emit('openAttachment', $event)" />
  </section>
</template>

<style scoped>
.trip-insurance-view{display:grid;grid-column:1/-1;min-width:0}
</style>
