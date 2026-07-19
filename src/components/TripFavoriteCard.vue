<script setup lang="ts">
import { House, Location, MapLocation, MoreFilled, Mug, Rank, ShoppingBag, TopRight } from '@element-plus/icons-vue'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import type { Favorite, FavoriteType, Trip } from '../types'

const props = defineProps<{ trip: Trip; favorites: Favorite[]; currency: string; canEditTrip: boolean; sortingEnabled: boolean; memberName: (memberId: string) => string }>()
const emit = defineEmits<{ add: []; edit: [favorite: Favorite]; remove: [favorite: Favorite]; addToItinerary: [favorite: Favorite]; toggleSorting: []; sort: [payload: { oldIndex: number; newIndex: number }] }>()
const sortableList = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | undefined

function typeLabel(type: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', shop: '商店', cafe: '咖啡廳', stay: '住宿', alternative: '備選行程', other: '其他' } as Record<FavoriteType, string>)[type] }
function typeIcon(type: FavoriteType) { return type === 'restaurant' || type === 'cafe' ? Mug : type === 'shop' ? ShoppingBag : type === 'stay' ? House : type === 'alternative' ? MoreFilled : MapLocation }
function sortedFavorites() {
  return [...props.favorites].sort((a, b) => {
    const aHasOrder = a.order !== undefined
    const bHasOrder = b.order !== undefined
    if (aHasOrder && bHasOrder) return (a.order || 0) - (b.order || 0)
    if (aHasOrder) return -1
    if (bHasOrder) return 1
    return Number(a.addedToItinerary) - Number(b.addedToItinerary) || b.createdAt - a.createdAt
  })
}
function handleFavoriteAction(command: string | number | object, favorite: Favorite) { if (command === 'add') emit('addToItinerary', favorite); if (command === 'edit') emit('edit', favorite); if (command === 'remove') emit('remove', favorite) }
function destroySortable() { sortableInstance?.destroy(); sortableInstance = undefined }
async function syncSortable() {
  await nextTick()
  destroySortable()
  if (!props.canEditTrip || !props.sortingEnabled || !sortableList.value) return
  sortableInstance = Sortable.create(sortableList.value, {
    animation: 180,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    handle: '.favorite-drag-handle',
    draggable: '.favorite-row',
    delay: 160,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    forceFallback: true,
    fallbackTolerance: 4,
    ghostClass: 'favorite-sort-ghost',
    chosenClass: 'favorite-sort-chosen',
    dragClass: 'favorite-sort-drag',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
      emit('sort', { oldIndex, newIndex })
    },
  })
}
watch(() => [props.canEditTrip, props.sortingEnabled, props.favorites.map((favorite) => `${favorite.id}:${favorite.order}`).join('|')], () => { void syncSortable() }, { immediate: true, flush: 'post' })
onBeforeUnmount(destroySortable)
</script>

<template>
  <section id="favorites" class="trip-detail-card favorite-panel">
    <div class="detail-card-heading">
      <div><p class="section-kicker">SAVED PLACES</p><h2>旅遊收藏</h2></div>
      <div v-if="canEditTrip" class="favorite-heading-actions">
        <el-button class="favorite-sort-toggle" :class="{ 'is-active': sortingEnabled }" :aria-pressed="sortingEnabled" @click="emit('toggleSorting')"><el-icon><Rank /></el-icon><span class="favorite-sort-full">{{ sortingEnabled ? '保存排序' : '調整排序' }}</span><span class="favorite-sort-short">排序</span></el-button>
        <el-button class="favorite-add-button" @click="emit('add')">＋ <span class="favorite-add-full">新增收藏</span><span class="favorite-add-short">新增</span></el-button>
      </div>
      <span v-else class="readonly-chip">唯讀</span>
    </div>
    <div v-if="favorites.length" ref="sortableList" class="favorite-list">
      <article v-for="favorite in sortedFavorites()" :key="favorite.id" class="favorite-row" :class="{ 'is-added': favorite.addedToItinerary, 'is-sortable-enabled': sortingEnabled && canEditTrip }">
        <img v-if="favorite.imageUrl" class="favorite-image" :src="favorite.imageUrl" :alt="`${favorite.name} 圖片`" /><span v-else class="favorite-icon"><el-icon><component :is="typeIcon(favorite.type)" /></el-icon></span>
        <div class="favorite-copy"><div class="favorite-title"><el-tooltip v-if="sortingEnabled && canEditTrip" content="長按並拖曳排序" placement="top"><span class="favorite-drag-handle" aria-hidden="true"><el-icon><Rank /></el-icon></span></el-tooltip><strong>{{ favorite.name }}</strong><span>{{ typeLabel(favorite.type) }}</span><b v-if="favorite.addedToItinerary">已加入行程</b></div><a v-if="favorite.mapUrl" class="favorite-location is-linked" :href="favorite.mapUrl" target="_blank" rel="noopener noreferrer"><el-icon><Location /></el-icon><span>{{ favorite.location || '在 Google Maps 開啟' }}</span><el-icon><TopRight /></el-icon></a><p v-else-if="favorite.location" class="favorite-location"><el-icon><Location /></el-icon>{{ favorite.location }}</p><p v-if="favorite.note" class="favorite-note">{{ favorite.note }}</p><small v-if="favorite.recommendedBy || favorite.estimatedCost"><span v-if="favorite.recommendedBy">推薦：{{ favorite.recommendedBy }}</span><span v-if="favorite.estimatedCost">預估 {{ currency }} {{ favorite.estimatedCost.toLocaleString() }}</span></small></div>
        <div v-if="canEditTrip || favorite.website" class="favorite-tools"><el-dropdown v-if="canEditTrip" class="favorite-actions" trigger="click" @command="handleFavoriteAction($event, favorite)"><el-button class="favorite-more-button" text circle aria-label="更多收藏操作" title="更多收藏操作"><el-icon><MoreFilled /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="add">{{ favorite.addedToItinerary ? '再次加入行程' : '加入行程' }}</el-dropdown-item><el-dropdown-item command="edit">編輯收藏</el-dropdown-item><el-dropdown-item class="favorite-delete-menu-item" command="remove">刪除收藏</el-dropdown-item></el-dropdown-menu></template></el-dropdown><el-tooltip v-if="favorite.website" content="開啟收藏網站" placement="top"><a class="favorite-link" :href="favorite.website" target="_blank" rel="noopener noreferrer" aria-label="開啟收藏網站"><el-icon><TopRight /></el-icon></a></el-tooltip></div>
      </article>
    </div>
    <div v-else class="detail-empty-state"><el-icon><MapLocation /></el-icon><div><strong>還沒有旅遊收藏</strong><p>先把想去的景點、餐廳和備選行程收好，再安排進每日行程。</p></div><el-button v-if="canEditTrip" class="favorite-add-button" @click="emit('add')">新增第一筆收藏</el-button></div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.favorite-panel{align-self:start;padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.favorite-heading-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.favorite-add-button{min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.favorite-add-button:hover,.favorite-add-button:focus-visible{background:#1d5a52;color:#fff}.favorite-sort-toggle{min-height:40px;border-color:#bfd7cd;border-radius:10px;color:#2f7d70;font-weight:700}.favorite-sort-toggle:hover,.favorite-sort-toggle:focus-visible{border-color:#80b4a3;background:#eef5f0;color:#123f3a}.favorite-sort-toggle.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.favorite-sort-toggle .el-icon{margin-right:4px}.favorite-sort-short,.favorite-add-short{display:none}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.favorite-list{display:grid;gap:10px;margin-top:16px}.favorite-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:start;gap:12px;padding:12px;border:1px solid #e3ebe7;border-radius:12px;background:#fbfcfa;transition:border-color .16s,box-shadow .16s}.favorite-row.is-sortable-enabled{cursor:grab}.favorite-row:hover,.favorite-row:focus-within{border-color:#bed8cd;box-shadow:0 4px 12px rgba(18,63,58,.06)}.favorite-row.is-added{background:#f7fbf8}.favorite-image,.favorite-icon{width:48px;height:48px;border-radius:10px;object-fit:cover}.favorite-icon{display:grid;place-items:center;background:#eaf4ef;color:#2f7d70;font-size:21px}.favorite-copy{min-width:0}.favorite-title{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.favorite-title strong{overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}.favorite-title span,.favorite-title b{padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700}.favorite-title span{background:#edf5f0;color:#47776a}.favorite-title b{background:#eaf4ef;color:#2f7d70}.favorite-drag-handle{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:32px;height:32px;margin:-7px -2px -7px -7px;border-radius:8px;color:#4d8d7c;cursor:grab;touch-action:none}.favorite-drag-handle:hover{background:#eaf5ef;color:#155b4b}.favorite-drag-handle:active{cursor:grabbing}.favorite-copy p,.favorite-location{margin:4px 0 0;color:#6b7d78;font-size:12px;line-height:1.45}.favorite-location{display:flex;align-items:flex-start;gap:4px;overflow-wrap:anywhere}.favorite-location .el-icon{flex:0 0 auto;margin-top:2px;font-size:13px}.favorite-location.is-linked{color:#2f7d70;text-decoration:none}.favorite-location.is-linked:hover span{text-decoration:underline}.favorite-note{color:#81908b!important;overflow-wrap:anywhere}.favorite-copy small{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:5px;color:#71827c;font-size:12px}.favorite-tools{display:flex;align-items:flex-start;gap:2px}.favorite-actions{display:inline-flex;opacity:0;transition:opacity .16s}.favorite-row:hover .favorite-actions,.favorite-row:focus-within .favorite-actions{opacity:1}.favorite-more-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}.favorite-more-button:hover,.favorite-more-button:focus-visible{background:#eff6f2;color:#236c59}.favorite-link{display:grid;width:36px;height:36px;place-items:center;border-radius:8px;color:#2f7d70}.favorite-link:hover,.favorite-link:focus-visible{background:#eaf4ef;outline:none}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}:global(.favorite-sort-ghost){opacity:.34}.favorite-row:global(.favorite-sort-ghost){border-color:#89baa9;border-style:dashed;background:#f1f8f4;box-shadow:none}.favorite-row:global(.favorite-sort-chosen){border-color:#4f9e89;box-shadow:0 12px 26px rgba(18,63,58,.14)}:global(.favorite-sort-drag){cursor:grabbing!important}:global(.favorite-sort-drag .favorite-row){border-color:#4f9e89;box-shadow:0 14px 30px rgba(18,63,58,.16)}@media(max-width:720px){.favorite-panel{padding:18px}.favorite-heading-actions{gap:6px}.favorite-sort-full,.favorite-add-full{display:none}.favorite-sort-short,.favorite-add-short{display:inline}.favorite-sort-toggle,.favorite-add-button{min-height:40px;padding:0 11px}.favorite-row{position:relative;grid-template-columns:44px minmax(0,1fr);padding-right:96px}.favorite-image,.favorite-icon{width:44px;height:44px}.favorite-tools{position:absolute;top:6px;right:6px;gap:0}.favorite-actions{opacity:1}.favorite-more-button,.favorite-link{width:40px!important;min-width:40px!important;height:40px!important;margin:0!important}.favorite-drag-handle{width:40px;height:40px;margin:-11px -4px -11px -9px}}@media(max-width:390px){.favorite-panel{padding:16px}.favorite-row{padding:12px 96px 12px 10px}}@media(prefers-reduced-motion:reduce){.favorite-row{transition:none}}
</style>
