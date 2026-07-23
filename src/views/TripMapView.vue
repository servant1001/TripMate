<script setup lang="ts">
import TripMapCard from '../components/TripMapCard.vue'
import type { ItineraryItem } from '../types'
defineProps<{ days: { date: string; entries: ItineraryItem[] }[]; formatDate: (date: string) => string; mapsUrl: (location: string, mapUrl?: string) => string }>()
</script>
<template><section class="trip-map-view" aria-label="地點地圖"><TripMapCard :days="days" :format-date="formatDate" :maps-url="mapsUrl" /></section></template>
<style scoped>.trip-map-view{display:grid;grid-column:1/-1;min-width:0}</style>
