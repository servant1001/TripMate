<script setup lang="ts">
import { ArrowDown, Menu } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    signedIn?: boolean
    userDisplayName?: string
    userInitial?: string
    showTripMenuButton?: boolean
  }>(),
  {
    signedIn: false,
    userDisplayName: '',
    userInitial: '',
    showTripMenuButton: false,
  },
)

const emit = defineEmits<{
  goTrips: []
  goProfile: []
  goLogin: []
  signOut: []
  openTripMenu: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="header-brand-area">
      <el-button
        v-if="showTripMenuButton"
        class="mobile-trip-header-menu"
        text
        circle
        aria-label="開啟旅行內容選單"
        title="開啟旅行內容選單"
        @click="emit('openTripMenu')"
      >
        <el-icon><Menu /></el-icon>
      </el-button>
      <button class="brand" @click="emit('goTrips')" aria-label="TripMate 我的旅行">
        Trip<span>Mate</span>
      </button>
    </div>
    <div class="header-actions">
      <el-dropdown v-if="signedIn" trigger="click">
        <button class="user-menu-trigger" type="button" aria-label="開啟帳號選單">
          <span class="user-avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="user-display-name">{{ userDisplayName }}</span>
          <el-icon class="user-menu-caret" aria-hidden="true"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="emit('goProfile')">個人資料</el-dropdown-item>
            <el-dropdown-item divided @click="emit('signOut')">登出</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button v-else class="header-login-button" @click="emit('goLogin')">
        登入
      </el-button>
    </div>
  </header>
</template>
