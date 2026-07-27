<script setup lang="ts">
import TripMapView from './TripMapView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { itineraryDays, formatItineraryDate, mapsUrl } = useTripWorkspaceContext()
</script>

<template>
  <TripMapView :days="itineraryDays" :format-date="formatItineraryDate" :maps-url="mapsUrl" />
</template>
