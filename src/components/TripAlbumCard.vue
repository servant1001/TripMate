<script setup lang="ts">
import { Calendar, Delete, Edit, Picture, Plus, User } from '@element-plus/icons-vue'
import type { AlbumPhoto, Trip } from '../types'

const props = defineProps<{ trip: Trip; photos: AlbumPhoto[]; canEditTrip: boolean; memberName: (memberId: string) => string; formatDate: (date: string) => string }>()
const emit = defineEmits<{ add: []; edit: [photo: AlbumPhoto]; remove: [photo: AlbumPhoto] }>()

const sortedPhotos = () => [...props.photos].sort((a, b) => (b.tripDate || '').localeCompare(a.tripDate || '') || b.createdAt - a.createdAt)
const imageUrls = () => sortedPhotos().map((photo) => photo.imageUrl)
</script>

<template>
  <section id="album" class="trip-detail-card album-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">MEMORIES</p>
        <h2>旅行相簿</h2>
        <p class="album-summary">把旅程中的每個片刻收藏起來。</p>
      </div>
      <el-button v-if="canEditTrip" class="album-add-button" @click="emit('add')"><el-icon><Plus /></el-icon>上傳照片</el-button>
      <span v-else class="readonly-chip">唯讀</span>
    </div>

    <div v-if="photos.length" class="album-grid">
      <article v-for="(photo, index) in sortedPhotos()" :key="photo.id" class="album-photo-card">
        <el-image class="album-image" :src="photo.imageUrl" :alt="photo.caption || '旅行相片'" fit="cover" :preview-src-list="imageUrls()" :initial-index="index" preview-teleported>
          <template #error><span class="album-image-error"><el-icon><Picture /></el-icon>無法顯示照片</span></template>
        </el-image>
        <div class="album-photo-content">
          <p v-if="photo.caption" class="album-caption">{{ photo.caption }}</p>
          <p v-else class="album-caption is-empty">尚未加入相片說明</p>
          <div class="album-meta">
            <span v-if="photo.tripDate"><el-icon><Calendar /></el-icon>{{ formatDate(photo.tripDate) }}</span>
            <span><el-icon><User /></el-icon>{{ memberName(photo.uploadedBy) }}</span>
          </div>
        </div>
        <div v-if="canEditTrip" class="album-actions">
          <el-tooltip content="編輯相片資訊" placement="top"><el-button class="album-action-button" text circle aria-label="編輯相片資訊" @click="emit('edit', photo)"><el-icon><Edit /></el-icon></el-button></el-tooltip>
          <el-tooltip content="刪除相片" placement="top"><el-button class="album-action-button is-danger" text circle aria-label="刪除相片" @click="emit('remove', photo)"><el-icon><Delete /></el-icon></el-button></el-tooltip>
        </div>
      </article>
    </div>

    <div v-else class="detail-empty-state album-empty-state">
      <el-icon><Picture /></el-icon>
      <div><strong>還沒有旅行相片</strong><p>上傳第一張照片，將行程裡的美好瞬間留在這趟旅行中。</p></div>
      <el-button v-if="canEditTrip" class="album-add-button" @click="emit('add')">上傳第一張照片</el-button>
    </div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.album-panel{padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.album-summary{margin:4px 0 0;color:#6b7d78;font-size:13px;line-height:1.5}.album-add-button{display:inline-flex;gap:6px;min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.album-add-button:hover,.album-add-button:focus-visible{background:#1d5a52;color:#fff}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.album-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-top:18px}.album-photo-card{position:relative;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px;background:#fbfcfa;transition:border-color .16s,box-shadow .16s}.album-photo-card:hover,.album-photo-card:focus-within{border-color:#bed8cd;box-shadow:0 6px 16px rgba(18,63,58,.08)}.album-image{display:block;width:100%;height:150px;background:#eef5f0}.album-image :deep(img){transition:transform .2s ease}.album-photo-card:hover .album-image :deep(img){transform:scale(1.025)}.album-image-error{display:grid;width:100%;height:100%;place-items:center;gap:5px;background:#eef5f0;color:#7d928a;font-size:12px}.album-image-error .el-icon{font-size:22px}.album-photo-content{display:grid;gap:7px;padding:11px 12px}.album-caption{display:-webkit-box;min-height:22px;margin:0;overflow:hidden;color:#244a43;font-size:14px;font-weight:700;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}.album-caption.is-empty{color:#82928c;font-weight:500}.album-meta{display:flex;flex-wrap:wrap;gap:4px 9px;color:#71827c;font-size:12px;line-height:1.45}.album-meta span{display:inline-flex;min-width:0;align-items:center;gap:4px}.album-meta .el-icon{flex:0 0 auto;color:#5e9b8b;font-size:13px}.album-actions{position:absolute;top:7px;right:7px;display:flex;gap:2px;opacity:0;transition:opacity .16s}.album-photo-card:hover .album-actions,.album-photo-card:focus-within .album-actions{opacity:1}.album-action-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0!important;border:1px solid rgba(255,255,255,.9)!important;background:rgba(255,255,255,.94)!important;color:#52756b;box-shadow:0 2px 7px rgba(18,63,58,.12)}.album-action-button:hover,.album-action-button:focus-visible{background:#eff6f2!important;color:#236c59}.album-action-button.is-danger{color:#bd5a50}.album-action-button.is-danger:hover,.album-action-button.is-danger:focus-visible{background:#fdf0ed!important;color:#b64237}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}@media(max-width:600px){.album-panel{padding:18px}.detail-card-heading{gap:10px}.album-add-button{min-height:40px;padding:0 12px}.album-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.album-image{height:128px}.album-photo-content{padding:9px 10px}.album-caption{font-size:13px}.album-meta{font-size:11px}.album-actions{opacity:1}.album-action-button{width:40px!important;min-width:40px!important;height:40px!important}}@media(max-width:390px){.album-panel{padding:16px}.detail-card-heading{align-items:start;flex-direction:column}.album-add-button{align-self:stretch;justify-content:center}.album-image{height:116px}.album-actions{top:4px;right:4px;gap:0}.album-action-button{width:36px!important;min-width:36px!important;height:36px!important}}
</style>
