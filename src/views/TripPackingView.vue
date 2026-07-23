<script setup lang="ts">
import TripPackingCard from '../components/TripPackingCard.vue'
import type { PackingItem, Trip } from '../types'

defineProps<{ trip: Trip; items: PackingItem[]; canEdit: boolean; sortingEnabled: boolean; memberName: (id: string) => string }>()
const emit = defineEmits<{ add: []; toggle: [item: PackingItem]; edit: [item: PackingItem]; remove: [item: PackingItem]; toggleSorting: []; sort: [payload: { group: 'shared' | 'personal'; oldIndex: number; newIndex: number; itemIds: string[] }] }>()
</script>

<template>
  <section class="trip-packing-view" aria-label="行李清單"><TripPackingCard :trip="trip" :items="items" :can-edit-trip="canEdit" :sorting-enabled="sortingEnabled" :member-name="memberName" @add="emit('add')" @toggle="emit('toggle', $event)" @toggle-sorting="emit('toggleSorting')" @sort="emit('sort', $event)" @edit="emit('edit', $event)" @remove="emit('remove', $event)" /></section>
</template>

<style scoped>.trip-packing-view{display:grid;grid-column:1/-1;min-width:0}</style>
