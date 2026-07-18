<script setup lang="ts">
import { ArrowLeft, Edit, MoreFilled, UserFilled } from '@element-plus/icons-vue'
import type { Trip } from '../types'

defineProps<{
  trip: Trip
  dateRange: string
  duration: string
  canEditSettings: boolean
  canManageMembers: boolean
  roleLabel?: string
}>()

const emit = defineEmits<{
  back: []
  edit: []
  manageMembers: []
  remove: []
}>()
</script>

<template>
  <section class="trip-hero-header">
    <button class="trip-back-link" type="button" @click="emit('back')">
      <el-icon><ArrowLeft /></el-icon>
      所有旅行
    </button>

    <div class="trip-hero-content">
      <div class="trip-hero-copy">
        <p class="trip-destination">{{ trip.country }}・{{ trip.city }}</p>
        <h1>{{ trip.name }}</h1>
        <div class="trip-facts" aria-label="旅行資訊">
          <span>{{ dateRange }}</span>
          <span>{{ duration }}</span>
          <span>預算 {{ trip.currency }} {{ trip.budget.toLocaleString() }}</span>
        </div>
      </div>

      <div class="trip-hero-actions">
        <el-button v-if="canManageMembers" class="trip-secondary-button" @click="emit('manageMembers')">
          <el-icon><UserFilled /></el-icon>
          成員管理
        </el-button>
        <el-button v-if="canEditSettings" class="trip-secondary-button" @click="emit('edit')">
          <el-icon><Edit /></el-icon>
          編輯旅行
        </el-button>
        <el-dropdown v-if="canManageMembers" trigger="click">
          <el-button class="trip-more-button" circle aria-label="更多旅行操作">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item class="trip-delete-menu-item" @click="emit('remove')">刪除旅行</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span v-else class="trip-role-badge">{{ roleLabel }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trip-hero-header{padding:4px 0 30px}.trip-back-link{display:inline-flex;align-items:center;gap:5px;padding:6px 0;border:0;background:transparent;color:#2f7d70;font-size:14px;font-weight:700}.trip-back-link:hover{text-decoration:underline}.trip-back-link:focus-visible{outline:3px solid rgba(47,125,112,.22);outline-offset:4px}.trip-hero-content{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-top:18px}.trip-destination{display:inline-flex;margin:0 0 10px;padding:5px 9px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:13px;font-weight:700}.trip-hero-copy h1{margin:0;color:#163b37;font-size:clamp(28px,3vw,36px);line-height:1.2;letter-spacing:-1px}.trip-facts{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:13px;color:#6b7d78;font-size:14px;line-height:1.55}.trip-facts span+span{position:relative}.trip-facts span+span::before{position:absolute;top:50%;left:-11px;width:4px;height:4px;border-radius:50%;background:#a9bcb4;content:''}.trip-hero-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}.trip-secondary-button{min-height:42px;border-color:#d5e2dc;border-radius:10px;background:#fff;color:#214f47;font-weight:700}.trip-secondary-button:hover,.trip-secondary-button:focus-visible{border-color:#9dc1b4;background:#eef5f0;color:#123f3a}.trip-secondary-button .el-icon{margin-right:5px}.trip-more-button{width:42px;height:42px;border-color:#d5e2dc;color:#315d54}.trip-more-button:hover,.trip-more-button:focus-visible{border-color:#9dc1b4;background:#eef5f0;color:#123f3a}.trip-role-badge{display:inline-flex;align-items:center;min-height:34px;padding:0 11px;border:1px solid #dbe7e2;border-radius:999px;background:#f3f6f4;color:#62766f;font-size:13px;font-weight:700}.trip-delete-menu-item{color:#d9544d}@media(max-width:600px){.trip-hero-header{padding-bottom:22px}.trip-hero-content{align-items:flex-start;flex-direction:column;gap:18px;margin-top:14px}.trip-facts{gap:5px 14px;font-size:13px}.trip-hero-actions{width:100%;justify-content:flex-start}.trip-secondary-button{flex:1;min-width:0}.trip-more-button{flex:0 0 42px}}
</style>
