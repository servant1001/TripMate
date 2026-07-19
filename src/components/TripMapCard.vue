<script setup lang="ts">
import { Calendar, Location, MapLocation, TopRight } from '@element-plus/icons-vue'
import type { ItineraryItem } from '../types'

interface ItineraryDay { date: string; entries: ItineraryItem[] }

defineProps<{
  days: ItineraryDay[]
  formatDate: (date: string) => string
  mapsUrl: (location: string, mapUrl?: string) => string
}>()
</script>

<template>
  <section id="map" class="trip-detail-card map-panel">
    <div class="map-heading">
      <div>
        <p class="section-kicker">MAP</p>
        <h2>地點地圖</h2>
        <p>依每日行程彙整地點，點擊即可在 Google Maps 開啟。</p>
      </div>
      <span class="map-count"><el-icon><MapLocation /></el-icon>{{ days.reduce((total, day) => total + day.entries.filter((entry) => entry.location || entry.mapUrl).length, 0) }} 個地點</span>
    </div>

    <div v-if="days.some((day) => day.entries.some((entry) => entry.location || entry.mapUrl))" class="map-days">
      <section v-for="day in days" :key="day.date" v-show="day.entries.some((entry) => entry.location || entry.mapUrl)" class="map-day">
        <div class="map-day-heading"><el-icon><Calendar /></el-icon><h3>{{ formatDate(day.date) }}</h3></div>
        <div class="map-location-list">
          <a v-for="(entry, index) in day.entries.filter((item) => item.location || item.mapUrl)" :key="entry.id" class="map-location-card" :href="mapsUrl(entry.location, entry.mapUrl)" target="_blank" rel="noopener noreferrer" :aria-label="`在 Google Maps 開啟 ${entry.location || entry.title}`">
            <span class="map-location-index">{{ index + 1 }}</span>
            <img v-if="entry.imageUrl" :src="entry.imageUrl" :alt="`${entry.title} 圖片`" class="map-location-image" />
            <span v-else class="map-location-icon"><el-icon><Location /></el-icon></span>
            <span class="map-location-copy"><strong>{{ entry.title }}</strong><small>{{ entry.location || '在 Google Maps 開啟' }}</small><time v-if="entry.time">{{ entry.time }}<template v-if="entry.endTime">–{{ entry.endTime }}</template></time></span>
            <el-icon class="map-external"><TopRight /></el-icon>
          </a>
        </div>
      </section>
    </div>

    <div v-else class="map-empty-state">
      <el-icon><MapLocation /></el-icon>
      <div><strong>還沒有可顯示的地點</strong><p>在新增或編輯行程時填入 Google Maps 景點網址，即可在這裡集中查看。</p></div>
    </div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.map-panel{padding:24px}.map-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:18px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.map-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.map-heading p:not(.section-kicker){margin:5px 0 0;color:#6b7d78;font-size:14px;line-height:1.55}.map-count{display:inline-flex;flex:0 0 auto;align-items:center;gap:5px;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:13px;font-weight:800}.map-days{display:grid;gap:24px;margin-top:22px}.map-day-heading{display:flex;align-items:center;gap:7px;margin:0 0 11px;color:#315e55}.map-day-heading .el-icon{color:#2f7d70}.map-day-heading h3{margin:0;font-size:14px;line-height:1.5}.map-location-list{display:grid;gap:9px}.map-location-card{display:grid;grid-template-columns:28px 44px minmax(0,1fr) 24px;align-items:center;gap:10px;min-width:0;padding:11px 12px;border:1px solid #e1e9e4;border-radius:12px;background:#fbfcfa;color:inherit;text-decoration:none;transition:border-color .18s ease,box-shadow .18s ease}.map-location-card:hover,.map-location-card:focus-visible{border-color:#9ec7b8;box-shadow:0 6px 16px rgba(18,63,58,.07);outline:none}.map-location-index{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e8f4ee;color:#287761;font-size:13px;font-weight:800}.map-location-image,.map-location-icon{width:44px;height:44px;border-radius:9px}.map-location-image{border:1px solid rgba(37,86,76,.12);object-fit:cover}.map-location-icon{display:grid;place-items:center;background:#f0f6f3;color:#3d8b76;font-size:19px}.map-location-copy{display:grid;min-width:0;gap:2px}.map-location-copy strong,.map-location-copy small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.map-location-copy strong{color:#173d37;font-size:15px;line-height:1.4}.map-location-copy small{color:#538071;font-size:13px;line-height:1.4}.map-location-copy time{color:#8a9893;font-size:12px;font-variant-numeric:tabular-nums}.map-external{color:#5c8e7f}.map-empty-state{display:grid;place-items:center;gap:10px;padding:44px 16px;text-align:center;color:#6b7d78}.map-empty-state>.el-icon{font-size:32px;color:#9db8ae}.map-empty-state strong{color:#244a43;font-size:16px}.map-empty-state p{max-width:360px;margin:5px 0 0;font-size:14px;line-height:1.55}@media(max-width:600px){.map-panel{padding:18px}.map-heading{gap:12px}.map-heading p:not(.section-kicker){font-size:13px}.map-count{padding:0 8px;font-size:12px}.map-location-card{grid-template-columns:26px 40px minmax(0,1fr) 20px;gap:8px;padding:10px}.map-location-index{width:26px;height:26px}.map-location-image,.map-location-icon{width:40px;height:40px}.map-location-copy strong{white-space:normal}.map-location-copy small{white-space:normal}.map-days{gap:20px}}
</style>
