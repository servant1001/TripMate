<script setup lang="ts">
import { ArrowLeft, Edit, MoreFilled, RefreshRight, UserFilled } from '@element-plus/icons-vue'
import type { Trip } from '../types'

defineProps<{
  trip: Trip
  dateRange: string
  duration: string
  exchangeRateText?: string
  exchangeRateDate?: string
  exchangeRateLoading?: boolean
  exchangeRateError?: string
  canEditSettings: boolean
  canManageMembers: boolean
  openMemberManager: () => void
  refreshExchangeRate?: () => void
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
          <span class="trip-fact-date">{{ dateRange }}</span>
          <span class="trip-fact-duration">{{ duration }}</span>
          <span class="trip-fact-budget">預算 {{ trip.currency }} {{ trip.budget.toLocaleString() }}</span>
          <span
            v-if="exchangeRateText || exchangeRateLoading || exchangeRateError"
            class="trip-fact-rate-wrap"
          >
            <span
              class="trip-fact-rate"
              :class="{ 'is-error': exchangeRateError }"
              :title="exchangeRateDate ? `匯率日期 ${exchangeRateDate}` : undefined"
            >
              {{ exchangeRateError || exchangeRateText || '今日匯率讀取中…' }}
            </span>
            <el-button
              v-if="refreshExchangeRate"
              class="trip-rate-refresh-button"
              text
              size="small"
              :loading="exchangeRateLoading"
              @click="refreshExchangeRate()"
            >
              <el-icon><RefreshRight /></el-icon>
              更新匯率
            </el-button>
          </span>
        </div>
      </div>

      <div class="trip-hero-actions">
        <el-button v-if="canManageMembers" class="trip-secondary-button" @click.stop="openMemberManager">
          <el-icon><UserFilled /></el-icon>
          旅伴
        </el-button>
        <el-button v-if="canEditSettings" class="trip-secondary-button trip-edit-button" @click="emit('edit')">
          <el-icon><Edit /></el-icon>
          編輯旅行
        </el-button>
        <el-dropdown v-if="canManageMembers || canEditSettings" trigger="click">
          <el-button class="trip-more-button" aria-label="更多旅行操作">
            <el-icon><MoreFilled /></el-icon>
            更多
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="canEditSettings" class="trip-mobile-edit-menu-item" @click="emit('edit')">編輯旅行</el-dropdown-item>
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
.trip-hero-header{padding:4px 0 30px}.trip-back-link{display:inline-flex;align-items:center;gap:5px;padding:6px 0;border:0;background:transparent;color:#2f7d70;font-size:14px;font-weight:700}.trip-back-link:hover{text-decoration:underline}.trip-back-link:focus-visible{outline:3px solid rgba(47,125,112,.22);outline-offset:4px}.trip-hero-content{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-top:18px}.trip-destination{display:inline-flex;margin:0 0 10px;padding:5px 9px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:13px;font-weight:700}.trip-hero-copy h1{margin:0;color:#163b37;font-size:clamp(28px,3vw,36px);line-height:1.2;letter-spacing:-1px}.trip-facts{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:13px;color:#6b7d78;font-size:14px;line-height:1.55}.trip-facts span+span{position:relative}.trip-facts span+span::before{position:absolute;top:50%;left:-11px;width:4px;height:4px;border-radius:50%;background:#a9bcb4;content:''}.trip-fact-rate-wrap{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}.trip-fact-rate-wrap::before{display:none}.trip-fact-rate{display:inline-flex;align-items:center;color:#2f7d70;font-weight:700}.trip-fact-rate.is-error{color:#b55d54;font-weight:600}.trip-rate-refresh-button{padding:0;color:#2f7d70;font-weight:700}.trip-rate-refresh-button:hover,.trip-rate-refresh-button:focus-visible{color:#123f3a}.trip-rate-refresh-button .el-icon{margin-right:4px}.trip-hero-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}.trip-secondary-button,.trip-more-button{min-height:42px;border-color:#d5e2dc;border-radius:10px;background:#fff;color:#214f47;font-weight:700}.trip-secondary-button:hover,.trip-secondary-button:focus-visible,.trip-more-button:hover,.trip-more-button:focus-visible{border-color:#9dc1b4;background:#eef5f0;color:#123f3a}.trip-secondary-button .el-icon,.trip-more-button .el-icon{margin-right:5px}.trip-more-button{padding:0 14px}.trip-role-badge{display:inline-flex;align-items:center;min-height:34px;padding:0 11px;border:1px solid #dbe7e2;border-radius:999px;background:#f3f6f4;color:#62766f;font-size:13px;font-weight:700}.trip-delete-menu-item{color:#d9544d}@media(max-width:600px){.trip-hero-header{padding-bottom:22px}.trip-hero-content{align-items:flex-start;flex-direction:column;gap:18px;margin-top:14px}.trip-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;font-size:13px}.trip-facts span+span::before{display:none}.trip-fact-budget,.trip-fact-rate-wrap{grid-column:1/-1}.trip-fact-rate-wrap{gap:6px}.trip-hero-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;width:100%;justify-content:stretch}.trip-edit-button{display:none}.trip-secondary-button,.trip-more-button{width:100%;min-width:0;height:var(--tripmate-mobile-page-button-height);min-height:var(--tripmate-mobile-page-button-height)}.trip-more-button{padding:0 12px;white-space:nowrap}}@media(min-width:601px){.trip-mobile-edit-menu-item{display:none}}
</style>
