<script setup lang="ts">
import TripAlbumCard from '../components/TripAlbumCard.vue'
import type { AlbumPhoto, Trip } from '../types'
defineProps<{ trip: Trip; photos: AlbumPhoto[]; canEdit: boolean; memberName: (id: string) => string; formatDate: (date: string) => string }>()
const emit = defineEmits<{ add: []; edit: [photo: AlbumPhoto]; remove: [photo: AlbumPhoto] }>()
</script>
<template><section class="trip-album-view" aria-label="旅行相簿"><TripAlbumCard :trip="trip" :photos="photos" :can-edit-trip="canEdit" :member-name="memberName" :format-date="formatDate" @add="emit('add')" @edit="emit('edit', $event)" @remove="emit('remove', $event)" /></section></template>
<style scoped>.trip-album-view{display:grid;grid-column:1/-1;min-width:0}</style>
