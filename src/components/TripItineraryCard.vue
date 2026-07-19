<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Calendar, Location, MoreFilled, Plus, Rank, ShoppingCart, TopRight, WarningFilled } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { ItineraryItem, ShoppingItem } from '../types'

interface ItineraryDay { date: string; entries: ItineraryItem[] }

const props = defineProps<{
  days: ItineraryDay[]
  shoppingItems: ShoppingItem[]
  canEditTrip: boolean
  sortingEnabled: boolean
  formatDate: (date: string) => string
  duration: (entry: ItineraryItem) => string
  timeWarning: (entries: ItineraryItem[], index: number) => string
  mapsUrl: (location: string, mapUrl?: string) => string
}>()

const shoppingPreviewEntry = ref<ItineraryItem | null>(null)
const showShoppingPreview = ref(false)
const shoppingPreviewItems = computed(() => shoppingPreviewEntry.value ? shoppingItemsFor(shoppingPreviewEntry.value) : [])

const emit = defineEmits<{
  add: []
  addAfter: [entry: ItineraryItem]
  toggle: [entry: ItineraryItem]
  edit: [entry: ItineraryItem]
  remove: [entry: ItineraryItem]
  move: [entry: ItineraryItem, direction: -1 | 1]
  toggleSorting: []
  sort: [payload: { date: string; oldIndex: number; newIndex: number }]
}>()

const sortableLists = new Map<string, HTMLElement>()
const sortableInstances = new Map<string, Sortable>()

function registerSortableList(date: string, element: Element | null) {
  if (element instanceof HTMLElement) sortableLists.set(date, element)
  else sortableLists.delete(date)
}

function destroySortables() {
  sortableInstances.forEach((instance) => instance.destroy())
  sortableInstances.clear()
}

async function syncSortables() {
  await nextTick()
  destroySortables()
  if (!props.canEditTrip || !props.sortingEnabled) return

  props.days.forEach((day) => {
    const list = sortableLists.get(day.date)
    if (!list) return
    sortableInstances.set(day.date, Sortable.create(list, {
      animation: 180,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      handle: '.itinerary-drag-handle',
      draggable: '.itinerary-entry',
      delay: 160,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      forceFallback: true,
      fallbackTolerance: 4,
      ghostClass: 'itinerary-sort-ghost',
      chosenClass: 'itinerary-sort-chosen',
      dragClass: 'itinerary-sort-drag',
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
        emit('sort', { date: day.date, oldIndex, newIndex })
      },
    }))
  })
}

watch(
  () => [props.canEditTrip, props.sortingEnabled, props.days.map((day) => `${day.date}:${day.entries.map((entry) => entry.id).join(',')}`).join('|')],
  () => { void syncSortables() },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(destroySortables)

function itineraryTypeClass(type: string) {
  return ({ 景點: 'is-type-attraction', 餐廳: 'is-type-food', 交通: 'is-type-transport', 住宿: 'is-type-stay' } as Record<string, string>)[type] || 'is-type-default'
}

function shoppingItemsFor(entry: ItineraryItem) {
  return props.shoppingItems.filter((item) => item.itineraryItemId === entry.id)
}

function openShoppingPreview(entry: ItineraryItem) {
  shoppingPreviewEntry.value = entry
  showShoppingPreview.value = true
}

function shoppingStatusLabel(status: ShoppingItem['status']) {
  return ({ wishlist: '想買', planned: '預計購買', purchased: '已購買', unavailable: '暫時缺貨', cancelled: '已取消' } as Record<ShoppingItem['status'], string>)[status]
}

function handleMobileAction(command: string | number | object, entry: ItineraryItem) {
  if (command === 'add-after') emit('addAfter', entry)
  if (command === 'edit') emit('edit', entry)
  if (command === 'remove') emit('remove', entry)
}
</script>

<template>
  <section id="itinerary" class="trip-detail-card itinerary-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">ITINERARY</p>
        <h2>每日行程</h2>
      </div>
      <div v-if="canEditTrip" class="itinerary-heading-actions">
        <el-button class="itinerary-sort-toggle" :class="{ 'is-active': sortingEnabled }" :aria-pressed="sortingEnabled" @click="emit('toggleSorting')">
          <el-icon><Rank /></el-icon>
          <span class="itinerary-sort-full">{{ sortingEnabled ? '保存排序' : '調整排序' }}</span>
          <span class="itinerary-sort-short">排序</span>
        </el-button>
        <el-button class="coral-button itinerary-add" @click="emit('add')">
          <el-icon><Plus /></el-icon>
          <span class="itinerary-add-full">新增行程</span>
          <span class="itinerary-add-short">新增</span>
        </el-button>
      </div>
      <span v-else class="readonly-chip">唯讀</span>
    </div>

    <div v-if="days.length" class="itinerary-timeline">
      <section v-for="(day, dayIndex) in days" :key="day.date" class="itinerary-day" :aria-label="formatDate(day.date)">
        <div class="day-heading">
          <span>DAY {{ dayIndex + 1 }}</span>
          <h3>{{ formatDate(day.date) }}</h3>
        </div>
        <div class="itinerary-list" :ref="(element) => registerSortableList(day.date, element as Element | null)">
          <article v-for="(entry, entryIndex) in day.entries" :key="entry.id" class="itinerary-entry" :class="{ 'is-completed': entry.completed, 'is-sortable-enabled': sortingEnabled && canEditTrip }">
            <div class="itinerary-checkbox">
              <el-checkbox :model-value="entry.completed" :disabled="!canEditTrip" :aria-label="`將「${entry.title}」標示為${entry.completed ? '未完成' : '已完成'}`" @change="emit('toggle', entry)" />
            </div>
            <div class="itinerary-time" :aria-label="entry.endTime ? `${entry.time} 至 ${entry.endTime}` : entry.time || '未設定時間'">
              <time>{{ entry.time || '未排時間' }}</time>
              <time v-if="entry.endTime" class="itinerary-end-time">{{ entry.endTime }}</time>
            </div>
            <div class="itinerary-connector" aria-hidden="true"><span class="itinerary-dot"></span></div>
            <div class="itinerary-card" :class="itineraryTypeClass(entry.type)">
              <div class="itinerary-card-header">
                <img v-if="entry.imageUrl" class="itinerary-card-image" :src="entry.imageUrl" :alt="`${entry.title} 圖片`" />
                <div class="itinerary-card-heading">
                  <el-tooltip v-if="sortingEnabled && canEditTrip" content="長按並拖曳排序" placement="top"><span class="itinerary-drag-handle" aria-hidden="true"><el-icon><Rank /></el-icon></span></el-tooltip>
                  <strong>{{ entry.title }}</strong>
                </div>
                <el-dropdown v-if="canEditTrip" class="itinerary-mobile-actions" trigger="click" @command="handleMobileAction($event, entry)">
                  <el-button class="itinerary-mobile-more-button" text circle aria-label="更多行程操作" title="更多行程操作"><el-icon><MoreFilled /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="add-after">在此後新增行程</el-dropdown-item>
                      <el-dropdown-item command="edit">編輯行程</el-dropdown-item>
                      <el-dropdown-item class="itinerary-delete-menu-item" command="remove">刪除行程</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <p v-if="entry.type || duration(entry)" class="itinerary-card-meta"><span v-if="entry.type" class="itinerary-type-chip" :class="itineraryTypeClass(entry.type)">{{ entry.type }}</span><span v-if="entry.type && duration(entry)" aria-hidden="true">·</span><span v-if="duration(entry)">{{ duration(entry) }}</span></p>
              <p v-if="timeWarning(day.entries, entryIndex)" class="itinerary-time-warning"><el-icon><WarningFilled /></el-icon>{{ timeWarning(day.entries, entryIndex) }}</p>
              <p v-if="entry.note" class="itinerary-note">{{ entry.note }}</p>
              <el-button v-if="shoppingItemsFor(entry).length" class="itinerary-shopping-button" text @click.stop="openShoppingPreview(entry)">
                <el-icon><ShoppingCart /></el-icon>
                採購清單 {{ shoppingItemsFor(entry).length }} 項
              </el-button>
              <a v-if="entry.mapUrl || entry.location" class="itinerary-location is-linked" :href="mapsUrl(entry.location, entry.mapUrl)" target="_blank" rel="noopener" :title="`在地圖中開啟：${entry.location || entry.title}`"><el-icon><Location /></el-icon><span>{{ entry.location || '在 Google Maps 開啟' }}</span><el-icon class="itinerary-external-icon"><TopRight /></el-icon></a>
              <p v-else class="itinerary-location is-empty"><el-icon><Location /></el-icon><span>尚未設定地點</span></p>
              <div v-if="canEditTrip && sortingEnabled" class="itinerary-mobile-reorder" aria-label="調整行程順序"><el-button :disabled="entryIndex === 0" text size="small" @click="emit('move', entry, -1)"><el-icon><ArrowUp /></el-icon>上移</el-button><el-button :disabled="entryIndex === day.entries.length - 1" text size="small" @click="emit('move', entry, 1)"><el-icon><ArrowDown /></el-icon>下移</el-button></div>
            </div>
          </article>
        </div>
      </section>
    </div>
    <div v-else class="detail-empty-state">
      <el-icon><Calendar /></el-icon>
      <div><strong>這趟旅行還沒有行程</strong><p>從抵達日的第一站開始安排吧。</p></div>
      <el-button v-if="canEditTrip" class="coral-button" @click="emit('add')">新增第一個行程</el-button>
    </div>
    <el-dialog v-model="showShoppingPreview" class="itinerary-shopping-dialog" width="min(92vw, 480px)" :title="shoppingPreviewEntry ? `「${shoppingPreviewEntry.title}」的採購清單` : '採購清單'">
      <p class="shopping-dialog-intro">這些商品已關聯至此行程。</p>
      <ul class="itinerary-shopping-list" aria-label="關聯購物項目">
        <li v-for="shoppingItem in shoppingPreviewItems" :key="shoppingItem.id" class="itinerary-shopping-item">
          <img v-if="shoppingItem.imageUrl" :src="shoppingItem.imageUrl" :alt="`${shoppingItem.name} 圖片`" />
          <el-icon v-else class="itinerary-shopping-item-icon"><ShoppingCart /></el-icon>
          <div>
            <strong>{{ shoppingItem.name }}</strong>
            <p>{{ shoppingItem.category }}・{{ shoppingItem.quantity }} {{ shoppingItem.unit || '件' }}</p>
            <p v-if="shoppingItem.storeName" class="itinerary-shopping-store">{{ shoppingItem.storeName }}{{ shoppingItem.storeBranch ? `・${shoppingItem.storeBranch}` : '' }}</p>
          </div>
          <span class="itinerary-shopping-status" :class="`is-${shoppingItem.status}`">{{ shoppingStatusLabel(shoppingItem.status) }}</span>
        </li>
      </ul>
      <template #footer><el-button @click="showShoppingPreview = false">關閉</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.itinerary-panel{padding:24px;overflow:visible}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.coral-button{min-height:42px;border:0;border-radius:10px;background:#ff735c;color:#fff;font-weight:700}.coral-button:hover,.coral-button:focus-visible{background:#e7644e;color:#fff}.itinerary-heading-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.itinerary-sort-toggle{min-height:42px;border-color:#bfd7cd;border-radius:10px;color:#2f7d70;font-weight:700}.itinerary-sort-toggle:hover,.itinerary-sort-toggle:focus-visible{border-color:#80b4a3;background:#eef5f0;color:#123f3a}.itinerary-sort-toggle.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.itinerary-sort-toggle .el-icon{margin-right:4px}.itinerary-sort-short{display:none}.itinerary-add .el-icon{margin-right:5px}.itinerary-add-short{display:none}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.itinerary-timeline{display:grid;gap:26px;margin-top:21px}.day-heading{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}.day-heading span{padding:4px 7px;border-radius:6px;background:#eef5f0;color:#2f7d70;font-size:11px;font-weight:800;letter-spacing:.7px}.day-heading h3{margin:0;color:#315e55;font-size:14px;line-height:1.5}.itinerary-list{display:grid;gap:11px}.itinerary-entry{position:relative;display:grid;grid-template-columns:34px 76px 20px minmax(0,1fr);min-width:0}.itinerary-entry.is-sortable-enabled{cursor:grab}.itinerary-checkbox{display:flex;padding-top:16px}.itinerary-checkbox :deep(.el-checkbox){width:32px;height:32px;margin:-6px 0 0 -6px}.itinerary-checkbox :deep(.el-checkbox__inner){width:17px;height:17px;border-color:#b8cac2}.itinerary-time{display:grid;align-content:start;gap:3px;padding:16px 8px 0 0;color:#84948f;font-size:13px;font-variant-numeric:tabular-nums;line-height:1.3}.itinerary-time time:first-child{color:#2c6659;font-weight:800}.itinerary-end-time{color:#91a19b}.itinerary-connector{position:relative;display:flex;justify-content:center}.itinerary-connector::after{position:absolute;top:22px;bottom:-16px;width:1px;background:#dce8e2;content:''}.itinerary-entry:last-child .itinerary-connector::after{display:none}.itinerary-dot{position:relative;z-index:1;width:10px;height:10px;margin-top:18px;border:2px solid #4f9e89;border-radius:50%;background:#fff;box-shadow:0 0 0 4px #fff}.is-completed .itinerary-dot{border-color:#2f7d70;background:#2f7d70}.itinerary-card{position:relative;min-width:0;padding:14px 15px;border:1px solid #e1e9e4;border-radius:12px;background:#fbfcfa;transition:border-color .18s ease,box-shadow .18s ease,opacity .18s ease}.itinerary-card:hover{border-color:#abcfc1;box-shadow:0 6px 16px rgba(18,63,58,.07)}.is-completed .itinerary-card{opacity:.65}.itinerary-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.itinerary-card-image{width:52px;height:52px;flex:0 0 52px;border:1px solid rgba(37,86,76,.12);border-radius:9px;object-fit:cover}.itinerary-card-heading{display:flex;min-width:0;flex:1;align-items:flex-start}.itinerary-card-heading strong{display:block;min-width:0;overflow-wrap:anywhere;color:#173d37;font-size:16px;font-weight:700;line-height:1.45}.is-completed .itinerary-card-heading strong{text-decoration:line-through}.itinerary-drag-handle{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:32px;height:32px;margin:-6px 5px 0 -7px;border-radius:8px;color:#4d8d7c;cursor:grab;touch-action:none}.itinerary-drag-handle:hover{background:#eaf5ef;color:#155b4b}.itinerary-drag-handle:active{cursor:grabbing}.itinerary-card-actions{display:flex;flex:0 0 auto;gap:2px;opacity:0;transition:opacity .16s ease}.itinerary-entry:hover .itinerary-card-actions,.itinerary-entry:focus-within .itinerary-card-actions{opacity:1}.itinerary-action-button{width:36px!important;min-width:36px!important;height:36px!important;margin:-5px -4px 0 0;padding:0!important;color:#69847b}.itinerary-action-button:hover,.itinerary-action-button:focus-visible{background:#eff6f2;color:#236c59}.itinerary-action-button.is-danger{color:#c36358}.itinerary-action-button.is-danger:hover,.itinerary-action-button.is-danger:focus-visible{background:#fdf0ed;color:#b64237}.itinerary-mobile-actions{display:none}.itinerary-mobile-more-button{width:36px!important;min-width:36px!important;height:36px!important;padding:0!important;color:#69847b}.itinerary-mobile-more-button:hover,.itinerary-mobile-more-button:focus-visible{background:#eff6f2;color:#236c59}.itinerary-card-meta{display:flex;flex-wrap:wrap;gap:5px;margin:5px 0 7px;color:#7f918b;font-size:13px;line-height:1.4}.itinerary-time-warning{display:flex;align-items:center;gap:4px;margin:6px 0;color:#a86821;font-size:12px;line-height:1.4}.itinerary-location{display:flex;align-items:flex-start;min-width:0;gap:5px;margin:0;font-size:13px;line-height:1.45}.itinerary-location .el-icon{flex:0 0 auto;margin-top:1px;font-size:15px}.itinerary-location span{min-width:0;overflow-wrap:anywhere}.itinerary-location.is-linked{color:#287761;text-decoration:none}.itinerary-location.is-linked:hover span{text-decoration:underline}.itinerary-external-icon{margin-left:1px;font-size:13px!important}.itinerary-location.is-empty{color:#9aa7a2;font-style:italic}.itinerary-mobile-reorder{display:none}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:42px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}@media(max-width:720px){.itinerary-panel{padding:18px}.itinerary-heading-actions{gap:6px}.itinerary-sort-full,.itinerary-add-full{display:none}.itinerary-sort-short,.itinerary-add-short{display:inline}.itinerary-sort-toggle,.coral-button{min-height:40px;padding:0 11px}.itinerary-entry{grid-template-columns:32px 59px 16px minmax(0,1fr)}.itinerary-time{padding-top:14px;font-size:12px}.itinerary-checkbox{padding-top:14px}.itinerary-dot{margin-top:16px}.itinerary-connector::after{top:19px}.itinerary-card{padding:12px}.itinerary-card-image{width:44px;height:44px;flex-basis:44px}.itinerary-card-heading strong{font-size:15px}.itinerary-card-actions{display:none}.itinerary-mobile-actions{display:inline-flex;flex:0 0 40px}.itinerary-mobile-more-button{width:40px!important;min-width:40px!important;height:40px!important;margin:-3px -5px 0 0}.itinerary-drag-handle{width:40px;height:40px;margin:-9px 4px 0 -8px}.itinerary-mobile-reorder{display:flex;gap:2px;margin:7px -5px -6px}.itinerary-mobile-reorder .el-button+.el-button{margin-left:0}.itinerary-mobile-reorder :deep(.el-button){min-height:32px;color:#3a7567;font-size:12px}}@media(max-width:390px){.itinerary-panel{padding:16px}.itinerary-entry{grid-template-columns:30px 53px 14px minmax(0,1fr)}.day-heading{gap:7px}.day-heading h3{font-size:13px}.itinerary-card{padding:11px}.itinerary-card-meta,.itinerary-location{font-size:12px}}
.itinerary-card.is-type-attraction{border-color:#cfe5da;background:#f2f8f4}.itinerary-card.is-type-food{border-color:#f0d8d0;background:#fff6f3}.itinerary-card.is-type-transport{border-color:#d4e3e9;background:#f3f8fa}.itinerary-card.is-type-stay{border-color:#e1d8ec;background:#f8f5fb}.itinerary-type-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:5px;font-size:11px;font-weight:800;line-height:1.35}.itinerary-type-chip.is-type-attraction{background:#dceee3;color:#26705d}.itinerary-type-chip.is-type-food{background:#fde4dd;color:#aa594b}.itinerary-type-chip.is-type-transport{background:#dcebf1;color:#397487}.itinerary-type-chip.is-type-stay{background:#ebe3f4;color:#775f94}@media(max-width:720px){.itinerary-type-chip{font-size:10px}}
@media(max-width:720px){.itinerary-entry{grid-template-columns:28px max-content 14px minmax(0,1fr)}.itinerary-time{padding-right:4px}}@media(max-width:390px){.itinerary-entry{grid-template-columns:28px max-content 12px minmax(0,1fr)}}.itinerary-checkbox :deep(.el-checkbox){margin:-6px 0 0 0!important}@media(min-width:721px){.itinerary-mobile-actions{display:inline-flex;flex:0 0 36px}}
.itinerary-shopping-button{min-height:32px;margin:0 0 7px -6px;padding:0 7px;color:#26705d;font-weight:700}.itinerary-shopping-button .el-icon{margin-right:4px}.itinerary-shopping-button:hover,.itinerary-shopping-button:focus-visible{background:#eaf5ef;color:#155b4b}.shopping-dialog-intro{margin:0 0 14px;color:#6b7d78;font-size:14px}.itinerary-shopping-list{display:grid;gap:9px;padding:0;margin:0;list-style:none}.itinerary-shopping-item{display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid #e1e9e4;border-radius:10px;background:#fbfcfa}.itinerary-shopping-item>img,.itinerary-shopping-item-icon{display:grid;width:38px;height:38px;flex:0 0 38px;place-items:center;border-radius:8px;object-fit:cover;background:#eef5f0;color:#2f7d70}.itinerary-shopping-item>div{min-width:0;flex:1}.itinerary-shopping-item strong{display:block;overflow-wrap:anywhere;color:#163b37;font-size:14px;line-height:1.4}.itinerary-shopping-item p{margin:2px 0 0;color:#6b7d78;font-size:12px;line-height:1.4}.itinerary-shopping-item .itinerary-shopping-store{color:#2f7d70}.itinerary-shopping-status{flex:0 0 auto;padding:3px 6px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:11px;font-weight:700}.itinerary-shopping-status.is-purchased{background:#e3f2e9;color:#28725b}.itinerary-shopping-status.is-unavailable,.itinerary-shopping-status.is-cancelled{background:#f4efed;color:#806b63}@media(max-width:390px){.itinerary-shopping-button{font-size:12px}.itinerary-shopping-item{align-items:flex-start}.itinerary-shopping-status{margin-top:2px}}
:global(.itinerary-sort-ghost){opacity:.34}.itinerary-entry:global(.itinerary-sort-ghost) .itinerary-card{border-color:#89baa9;border-style:dashed;background:#f1f8f4;box-shadow:none}.itinerary-entry:global(.itinerary-sort-chosen) .itinerary-card{border-color:#4f9e89;box-shadow:0 12px 26px rgba(18,63,58,.14)}:global(.itinerary-sort-drag){cursor:grabbing!important}:global(.itinerary-sort-drag .itinerary-card){border-color:#4f9e89;box-shadow:0 14px 30px rgba(18,63,58,.16)}@media(prefers-reduced-motion:reduce){.itinerary-card{transition:none}}
.itinerary-note{margin:6px 0;color:#6b7d78;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
</style>
