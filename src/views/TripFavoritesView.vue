<script setup lang="ts">
import TripFavoriteCard from '../components/TripFavoriteCard.vue'
import type { Favorite, Trip } from '../types'

defineProps<{ trip: Trip; favorites: Favorite[]; currency: string; canEdit: boolean; sortingEnabled: boolean; memberName: (id: string) => string }>()
const emit = defineEmits<{ add: []; edit: [favorite: Favorite]; duplicate: [favorite: Favorite]; remove: [favorite: Favorite]; addToItinerary: [favorite: Favorite]; toggleSorting: []; sort: [payload: { oldIndex: number; newIndex: number }] }>()
</script>

<template><section class="trip-favorites-view" aria-label="旅遊收藏"><TripFavoriteCard :trip="trip" :favorites="favorites" :currency="currency" :can-edit-trip="canEdit" :sorting-enabled="sortingEnabled" :member-name="memberName" @add="emit('add')" @edit="emit('edit', $event)" @duplicate="emit('duplicate', $event)" @remove="emit('remove', $event)" @add-to-itinerary="emit('addToItinerary', $event)" @toggle-sorting="emit('toggleSorting')" @sort="emit('sort', $event)" /></section></template>
<style scoped>.trip-favorites-view{display:grid;grid-column:1/-1;min-width:0}</style>
