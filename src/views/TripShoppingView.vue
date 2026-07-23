<script setup lang="ts">
import TripShoppingCard from '../components/TripShoppingCard.vue'
import type { ShoppingItem, ShoppingStatus, Trip } from '../types'

defineProps<{
  trip: Trip
  items: ShoppingItem[]
  canEdit: boolean
  memberName: (id: string) => string
}>()

const emit = defineEmits<{
  add: []
  edit: [item: ShoppingItem]
  duplicate: [item: ShoppingItem]
  remove: [item: ShoppingItem]
  status: [item: ShoppingItem, status: ShoppingStatus]
  convert: [item: ShoppingItem]
  batchLink: []
}>()
</script>

<template>
  <section class="trip-shopping-view" aria-label="購物清單">
    <TripShoppingCard :trip="trip" :items="items" :can-edit-trip="canEdit" :member-name="memberName" @add="emit('add')" @edit="emit('edit', $event)" @duplicate="emit('duplicate', $event)" @remove="emit('remove', $event)" @status="(item, status) => emit('status', item, status)" @convert="emit('convert', $event)" @batch-link="emit('batchLink')" />
  </section>
</template>

<style scoped>
.trip-shopping-view{display:grid;grid-column:1/-1;min-width:0}
</style>
