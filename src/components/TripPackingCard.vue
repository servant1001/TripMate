<script setup lang="ts">
import { Box, Goods, MoreFilled, Rank, User } from '@element-plus/icons-vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import type { PackingItem, Trip } from '../types'

type PackingGroup = 'shared' | 'personal'

const props = defineProps<{ trip: Trip; items: PackingItem[]; canEditTrip: boolean; sortingEnabled: boolean; memberName: (memberId: string) => string }>()
const emit = defineEmits<{
  add: []
  toggle: [item: PackingItem]
  edit: [item: PackingItem]
  remove: [item: PackingItem]
  toggleSorting: []
  sort: [payload: { group: PackingGroup; oldIndex: number; newIndex: number; itemIds: string[] }]
}>()

const activeCategory = ref('all')
const sortableLists = new Map<PackingGroup, HTMLElement>()
const sortableInstances = new Map<PackingGroup, Sortable>()
const categories = computed(() => [...new Set(props.items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const isVisible = (item: PackingItem) => activeCategory.value === 'all' || item.category === activeCategory.value
const orderedItems = (isShared: boolean) => props.items.filter((item) => item.isShared === isShared && isVisible(item)).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.createdAt - b.createdAt)
const sharedItems = () => orderedItems(true)
const personalItems = () => orderedItems(false)
const completeCount = () => props.items.filter((item) => item.completed).length
const categoryLabel = computed(() => activeCategory.value === 'all' ? '全部類型' : activeCategory.value)
const emptyMessage = (isShared: boolean) => activeCategory.value === 'all' ? `尚未加入${isShared ? '共用' : '個人'}物品。` : `「${activeCategory.value}」尚未加入${isShared ? '共用' : '個人'}物品。`
const categoryClass = (category: string) => ({ 衣物: 'is-clothing', 盥洗用品: 'is-toiletries', 電子用品: 'is-electronics', 證件: 'is-documents', 藥品: 'is-medicine' } as Record<string, string>)[category] || 'is-other'

function itemsForGroup(group: PackingGroup) { return group === 'shared' ? sharedItems() : personalItems() }
function registerSortableList(group: PackingGroup, element: Element | null) {
  if (element instanceof HTMLElement) sortableLists.set(group, element)
  else sortableLists.delete(group)
}
function destroySortables() {
  sortableInstances.forEach((instance) => instance.destroy())
  sortableInstances.clear()
}
async function syncSortables() {
  await nextTick()
  destroySortables()
  if (!props.canEditTrip || !props.sortingEnabled) return
  ;(['shared', 'personal'] as PackingGroup[]).forEach((group) => {
    const list = sortableLists.get(group)
    const itemIds = itemsForGroup(group).map((item) => item.id)
    if (!list || !itemIds.length) return
    sortableInstances.set(group, Sortable.create(list, {
      animation: 180,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      handle: '.packing-drag-handle',
      draggable: '.packing-row',
      delay: 160,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      forceFallback: true,
      fallbackTolerance: 4,
      ghostClass: 'packing-sort-ghost',
      chosenClass: 'packing-sort-chosen',
      dragClass: 'packing-sort-drag',
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
        emit('sort', { group, oldIndex, newIndex, itemIds })
      },
    }))
  })
}
function handlePackingAction(command: string | number | object, item: PackingItem) {
  if (command === 'edit') emit('edit', item)
  if (command === 'remove') emit('remove', item)
}

watch(
  () => [props.canEditTrip, props.sortingEnabled, activeCategory.value, props.items.map((item) => `${item.id}:${item.order}`).join('|')],
  () => { void syncSortables() },
  { immediate: true, flush: 'post' },
)
onBeforeUnmount(destroySortables)
</script>

<template>
  <section id="packing" class="trip-detail-card packing-panel">
    <div class="detail-card-heading">
      <div><p class="section-kicker">PACKING</p><h2>行李清單</h2></div>
      <div v-if="canEditTrip" class="packing-heading-actions"><el-button class="packing-add-button" @click="emit('add')">＋ <span class="packing-add-full">新增物品</span><span class="packing-add-short">新增</span></el-button></div>
      <span v-else class="readonly-chip">唯讀</span>
    </div>
    <div v-if="items.length" class="packing-summary"><span><b>{{ items.length - completeCount() }}</b> 項待準備</span><span>{{ completeCount() }}/{{ items.length }} 已完成</span></div>
    <div v-if="items.length" class="packing-filter"><label for="packing-category-filter">顯示類型</label><el-select id="packing-category-filter" v-model="activeCategory" size="small" aria-label="依行李類型篩選"><el-option label="全部類型" value="all" /><el-option v-for="category in categories" :key="category" :label="category" :value="category" /></el-select><span>{{ categoryLabel }}</span></div>
    <div v-if="items.length" class="packing-groups">
      <section class="packing-group">
        <div class="packing-group-heading"><div><strong>共用物品</strong><span>旅伴一起準備</span></div><div class="packing-group-heading-actions"><b>{{ sharedItems().length }}</b><el-button v-if="canEditTrip" class="packing-sort-toggle" :class="{ 'is-active': sortingEnabled }" :aria-pressed="sortingEnabled" @click="emit('toggleSorting')"><el-icon><Rank /></el-icon>{{ sortingEnabled ? '保存排序' : '調整排序' }}</el-button></div></div>
        <div v-if="sharedItems().length" class="packing-list" :ref="(element) => registerSortableList('shared', element as Element | null)">
          <article v-for="item in sharedItems()" :key="item.id" class="packing-row" :class="{ 'is-completed': item.completed, 'is-sortable-enabled': sortingEnabled && canEditTrip }">
            <el-checkbox :model-value="item.completed" :disabled="!canEditTrip" :aria-label="`${item.completed ? '標示未完成' : '標示完成'}：${item.name}`" @change="emit('toggle', item)" />
            <div class="packing-copy"><div class="packing-title-row"><el-tooltip v-if="sortingEnabled && canEditTrip" content="長按並拖曳排序" placement="top"><span class="packing-drag-handle" aria-hidden="true"><el-icon><Rank /></el-icon></span></el-tooltip><strong>{{ item.name }}</strong><span class="packing-quantity">× {{ item.quantity }}</span></div><p><span class="packing-category" :class="categoryClass(item.category)"><el-icon><Goods /></el-icon>{{ item.category }}</span><span v-if="item.assignedTo"><el-icon><User /></el-icon>{{ memberName(item.assignedTo) }}</span><span v-if="item.note">{{ item.note }}</span></p></div>
            <el-dropdown v-if="canEditTrip" class="packing-actions" trigger="click" @command="handlePackingAction($event, item)"><el-button class="packing-more-button" text circle aria-label="更多物品操作" title="更多物品操作"><el-icon><MoreFilled /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="edit">編輯物品</el-dropdown-item><el-dropdown-item class="packing-delete-menu-item" command="remove">刪除物品</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
          </article>
        </div>
        <p v-else class="packing-group-empty">{{ emptyMessage(true) }}</p>
      </section>
      <section class="packing-group">
        <div class="packing-group-heading"><div><strong>個人物品</strong><span>各自負責的行李</span></div><div class="packing-group-heading-actions"><b>{{ personalItems().length }}</b><el-button v-if="canEditTrip" class="packing-sort-toggle" :class="{ 'is-active': sortingEnabled }" :aria-pressed="sortingEnabled" @click="emit('toggleSorting')"><el-icon><Rank /></el-icon>{{ sortingEnabled ? '保存排序' : '調整排序' }}</el-button></div></div>
        <div v-if="personalItems().length" class="packing-list" :ref="(element) => registerSortableList('personal', element as Element | null)">
          <article v-for="item in personalItems()" :key="item.id" class="packing-row is-personal" :class="{ 'is-completed': item.completed, 'is-sortable-enabled': sortingEnabled && canEditTrip }">
            <el-checkbox :model-value="item.completed" :disabled="!canEditTrip" :aria-label="`${item.completed ? '標示未完成' : '標示完成'}：${item.name}`" @change="emit('toggle', item)" />
            <div class="packing-copy"><div class="packing-title-row"><el-tooltip v-if="sortingEnabled && canEditTrip" content="長按並拖曳排序" placement="top"><span class="packing-drag-handle" aria-hidden="true"><el-icon><Rank /></el-icon></span></el-tooltip><strong>{{ item.name }}</strong><span class="packing-quantity">× {{ item.quantity }}</span></div><p><span class="packing-category" :class="categoryClass(item.category)"><el-icon><Goods /></el-icon>{{ item.category }}</span><span v-if="item.assignedTo" class="packing-assignee"><el-icon><User /></el-icon>{{ memberName(item.assignedTo) }}</span><span v-if="item.note">{{ item.note }}</span></p></div>
            <el-dropdown v-if="canEditTrip" class="packing-actions" trigger="click" @command="handlePackingAction($event, item)"><el-button class="packing-more-button" text circle aria-label="更多物品操作" title="更多物品操作"><el-icon><MoreFilled /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="edit">編輯物品</el-dropdown-item><el-dropdown-item class="packing-delete-menu-item" command="remove">刪除物品</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
          </article>
        </div>
        <p v-else class="packing-group-empty">{{ emptyMessage(false) }}</p>
      </section>
    </div>
    <div v-else class="detail-empty-state"><el-icon><Box /></el-icon><div><strong>還沒有行李清單</strong><p>先列下要帶的東西，出發前就不怕遺漏。</p></div><el-button v-if="canEditTrip" class="packing-add-button" @click="emit('add')">新增第一項物品</el-button></div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.packing-panel{align-self:start;padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.packing-heading-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.packing-add-button{min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.packing-add-button:hover,.packing-add-button:focus-visible{background:#1d5a52;color:#fff}.packing-sort-toggle{min-height:40px;border-color:#bfd7cd;border-radius:10px;color:#2f7d70;font-weight:700}.packing-sort-toggle:hover,.packing-sort-toggle:focus-visible{border-color:#80b4a3;background:#eef5f0;color:#123f3a}.packing-sort-toggle.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.packing-sort-toggle .el-icon{margin-right:4px}.packing-sort-short,.packing-add-short{display:none}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.packing-summary{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding:10px 12px;border-radius:10px;background:#eef5f0;color:#658078;font-size:13px}.packing-summary b{color:#123f3a;font-size:15px}.packing-filter{display:flex;align-items:center;gap:9px;margin-top:14px;color:#58736b;font-size:13px}.packing-filter label{font-weight:700}.packing-filter :deep(.el-select){width:150px}.packing-filter>span{color:#8a9893;font-size:12px}.packing-groups{display:grid;gap:16px;margin-top:16px}.packing-group{padding:13px 14px;border:1px solid #e3ebe6;border-radius:12px;background:#fbfcfa}.packing-group-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid #e9efeb}.packing-group-heading>div{display:grid;gap:1px}.packing-group-heading strong{color:#244a43;font-size:14px}.packing-group-heading span{color:#71827c;font-size:12px}.packing-group-heading>b{display:grid;min-width:25px;height:25px;place-items:center;border-radius:999px;background:#e5f1eb;color:#2f7d70;font-size:12px}.packing-list{display:grid;gap:8px;padding-top:9px}.packing-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:start;gap:9px;padding:11px 10px;border:1px solid #e5ece7;border-radius:10px;background:#fff;transition:border-color .18s ease,box-shadow .18s ease,opacity .18s ease}.packing-row.is-sortable-enabled{cursor:grab}.packing-row.is-personal{border-left:3px solid #78ae9e;padding-left:7px}.packing-row .el-checkbox{margin-top:3px}.packing-copy{min-width:0;padding-top:1px}.packing-title-row{display:flex;align-items:baseline;gap:7px;min-width:0}.packing-copy strong{min-width:0;overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}.packing-quantity{color:#6c827a;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}.packing-drag-handle{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:32px;height:32px;margin:-7px -1px -7px -7px;border-radius:8px;color:#4d8d7c;cursor:grab;touch-action:none}.packing-drag-handle:hover{background:#eaf5ef;color:#155b4b}.packing-drag-handle:active{cursor:grabbing}.packing-copy p{display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0 0;color:#6b7d78;font-size:12px;line-height:1.45}.packing-copy p span{display:inline-flex;align-items:center;gap:3px}.packing-copy .el-icon{font-size:13px}.packing-category{padding:2px 6px;border-radius:999px;background:#eef5f0;color:#47776a}.packing-assignee{color:#2f7d70;font-weight:700}.packing-group-empty{margin:12px 0 2px;color:#87958f;font-size:13px}.packing-row.is-completed{opacity:.68}.packing-row.is-completed strong{text-decoration:line-through}.packing-actions{display:inline-flex;opacity:0;transition:opacity .16s ease}.packing-row:hover .packing-actions,.packing-row:focus-within .packing-actions{opacity:1}.packing-more-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}.packing-more-button:hover,.packing-more-button:focus-visible{background:#eff6f2;color:#236c59}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}.packing-category.is-clothing{background:#fff0ed;color:#b75a4b}.packing-category.is-toiletries{background:#fff4d9;color:#9b6d22}.packing-category.is-electronics{background:#e8f1f4;color:#3c7180}.packing-category.is-documents{background:#efe9f7;color:#755f91}.packing-category.is-medicine{background:#fde9e9;color:#a95252}.packing-category.is-other{background:#e3f2ec;color:#2f7d70}:global(.packing-sort-ghost){opacity:.34}.packing-row:global(.packing-sort-ghost){border-color:#89baa9;border-style:dashed;background:#f1f8f4;box-shadow:none}.packing-row:global(.packing-sort-chosen){border-color:#4f9e89;box-shadow:0 12px 26px rgba(18,63,58,.14)}:global(.packing-sort-drag){cursor:grabbing!important}:global(.packing-sort-drag .packing-row){border-color:#4f9e89;box-shadow:0 14px 30px rgba(18,63,58,.16)}@media(max-width:720px){.packing-panel{padding:18px}.packing-heading-actions{gap:6px}.packing-sort-full,.packing-add-full{display:none}.packing-sort-short,.packing-add-short{display:inline}.packing-sort-toggle,.packing-add-button{min-height:40px;padding:0 11px}.packing-filter{flex-wrap:wrap}.packing-filter :deep(.el-select){flex:1;min-width:132px}.packing-filter>span{display:none}.packing-actions{position:absolute;top:8px;right:7px;opacity:1}.packing-row{position:relative;grid-template-columns:34px minmax(0,1fr);min-height:76px;padding:11px 54px 11px 9px}.packing-row.is-personal{padding-left:7px}.packing-more-button{width:40px!important;min-width:40px!important;height:40px!important}.packing-drag-handle{width:40px;height:40px;margin:-11px -3px -11px -9px}}@media(max-width:390px){.packing-panel{padding:16px}.packing-group{padding:12px}.packing-row{grid-template-columns:32px minmax(0,1fr);padding-right:54px}.packing-summary{font-size:12px}}@media(prefers-reduced-motion:reduce){.packing-row{transition:none}}
.packing-group-heading>.packing-group-heading-actions{display:flex;align-items:center;gap:8px}.packing-group-heading>.packing-group-heading-actions .packing-sort-toggle{min-height:36px;padding:0 10px;white-space:nowrap}.packing-group-heading>.packing-group-heading-actions .packing-sort-toggle .el-icon{margin-right:4px}@media(max-width:720px){.packing-group-heading>.packing-group-heading-actions{gap:6px}.packing-group-heading>.packing-group-heading-actions .packing-sort-toggle{min-height:40px;padding:0 9px;font-size:12px}}
</style>
