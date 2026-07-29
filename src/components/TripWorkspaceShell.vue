<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import AppHeader from './AppHeader.vue'
import TripHeroHeader from './TripHeroHeader.vue'
import type { Trip } from '../types'
import type { TripTab } from '../router/tripWorkspaceTabs'

defineProps<{
  signedIn: boolean
  userDisplayName: string
  userInitial: string
  trip: Trip
  dateRange: string
  duration: string
  exchangeRateText?: string
  exchangeRateDate?: string
  exchangeRateLoading?: boolean
  exchangeRateError?: string
  activeTripTab: TripTab
  tripTabLabels: Record<TripTab, string>
  tripTabOptions: TripTab[]
  canEditTripSettings: boolean
  canManageMembers: boolean
  roleLabel: string
  mobileTripMenuOpen: boolean
}>()

const emit = defineEmits<{
  goTrips: []
  goProfile: []
  goLogin: []
  signOut: []
  openTripMenu: []
  closeTripMenu: []
  selectTab: [tab: TripTab]
  back: []
  editTrip: []
  removeTrip: []
  openMemberManager: []
  refreshExchangeRate: []
  'update:mobileTripMenuOpen': [value: boolean]
}>()
</script>

<template>
  <main class="app-shell">
    <AppHeader
      :signed-in="signedIn"
      :user-display-name="userDisplayName"
      :user-initial="userInitial"
      :show-trip-menu-button="Boolean(trip)"
      @go-trips="emit('goTrips')"
      @go-profile="emit('goProfile')"
      @go-login="emit('goLogin')"
      @sign-out="emit('signOut')"
      @open-trip-menu="emit('openTripMenu')"
    />

    <section class="page trip-detail-page">
      <TripHeroHeader
        :trip="trip"
        :date-range="dateRange"
        :duration="duration"
        :exchange-rate-text="exchangeRateText"
        :exchange-rate-date="exchangeRateDate"
        :exchange-rate-loading="exchangeRateLoading"
        :exchange-rate-error="exchangeRateError"
        :can-edit-settings="canEditTripSettings"
        :can-manage-members="canManageMembers"
        :open-member-manager="() => emit('openMemberManager')"
        :role-label="roleLabel"
        :refresh-exchange-rate="() => emit('refreshExchangeRate')"
        @back="emit('back')"
        @edit="emit('editTrip')"
        @remove="emit('removeTrip')"
      />

      <el-drawer
        :model-value="mobileTripMenuOpen"
        class="mobile-trip-drawer"
        direction="ltr"
        size="min(82vw, 300px)"
        :with-header="false"
        @update:model-value="emit('update:mobileTripMenuOpen', $event)"
      >
        <div class="mobile-trip-drawer-heading">
          <div><span>TRIPMATE</span><strong>旅行內容</strong></div>
          <el-button
            text
            circle
            aria-label="關閉內容選單"
            title="關閉內容選單"
            @click="emit('closeTripMenu')"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <nav class="mobile-trip-drawer-nav" aria-label="旅行內容導覽">
          <button
            v-for="tab in tripTabOptions"
            :key="tab"
            type="button"
            :class="{ 'is-active': activeTripTab === tab }"
            @click="emit('selectTab', tab)"
          >
            {{ tripTabLabels[tab] }}
          </button>
        </nav>
      </el-drawer>

      <nav class="trip-tabs" aria-label="旅行內容導覽" role="tablist">
        <button
          v-for="tab in tripTabOptions"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTripTab === tab"
          :class="{ 'is-active': activeTripTab === tab }"
          @click="emit('selectTab', tab)"
        >
          {{ tripTabLabels[tab] }}
        </button>
      </nav>

      <div
        class="trip-detail-layout"
        :class="{ 'is-single-detail': activeTripTab !== 'overview' }"
        role="tabpanel"
        :aria-label="tripTabLabels[activeTripTab]"
      >
        <slot />
      </div>
    </section>
  </main>
</template>
