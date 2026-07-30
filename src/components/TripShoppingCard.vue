<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Location, MoreFilled, Picture, Plus, Rank, Search, ShoppingBag, Switch, TopRight, User } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { SortableEvent } from 'sortablejs'
import type { ShoppingItem, ShoppingPriority, ShoppingStatus, ShoppingType, Trip } from '../types'
import type { ExchangeRateQuote } from '../services/exchangeRates'

type ShoppingDisplayGroup = { key: string; name: string; items: ShoppingItem[] }

const props = defineProps<{
  trip: Trip
  items: ShoppingItem[]
  exchangeRates?: Record<string, ExchangeRateQuote>
  exchangeRateError?: string
  canEditTrip: boolean
  memberName: (memberId: string) => string
}>()

const emit = defineEmits<{
  add: []
  edit: [item: ShoppingItem]
  duplicate: [item: ShoppingItem]
  remove: [item: ShoppingItem]
  status: [item: ShoppingItem, status: ShoppingStatus]
  convert: [item: ShoppingItem]
  reorder: [items: ShoppingItem[]]
  'batch-link': [items: ShoppingItem[]]
}>()

const statusFilter = ref<'all' | ShoppingStatus>('all')
const typeFilter = ref<'all' | ShoppingType>('all')
const categoryFilter = ref('all')
const assigneeFilter = ref('all')
const storeFilter = ref('all')
const keywordFilter = ref('')
const storeMode = ref(false)
const groupByStore = ref(true)
const selectionMode = ref(false)
const sortingEnabled = ref(false)
const selectedItemIds = ref<string[]>([])

const sortableElements = new Map<string, HTMLElement>()
const sortableInstances = new Map<string, Sortable>()

const statusLabels: Record<ShoppingStatus, string> = {
  wishlist: '想買',
  planned: '已規劃',
  purchased: '已購買',
  unavailable: '缺貨',
  cancelled: '已取消',
}
const typeLabels: Record<ShoppingType, string> = {
  personal: '個人購物',
  proxy: '代購',
  shared: '共同採買',
  gift: '伴手禮',
}
const priorityLabels: Record<ShoppingPriority, string> = {
  high: '高優先',
  medium: '一般',
  low: '低優先',
}

const categories = computed(() =>
  [...new Set(props.items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
)
const stores = computed(() =>
  [...new Set(props.items.map((item) => item.storeName?.trim()).filter((store): store is string => Boolean(store)))].sort((a, b) =>
    a.localeCompare(b, 'zh-Hant'),
  ),
)

const sortedItems = computed(() =>
  [...props.items].sort((a, b) => {
    const aOrder = Number.isFinite(a.order) ? Number(a.order) : null
    const bOrder = Number.isFinite(b.order) ? Number(b.order) : null
    if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder
    if (aOrder !== null && bOrder === null) return -1
    if (aOrder === null && bOrder !== null) return 1

    const statusOrder: Record<ShoppingStatus, number> = {
      planned: 0,
      wishlist: 1,
      unavailable: 2,
      cancelled: 3,
      purchased: 4,
    }
    const priorityOrder: Record<ShoppingPriority, number> = { high: 0, medium: 1, low: 2 }
    return (
      statusOrder[a.status] - statusOrder[b.status] ||
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      (a.plannedDate || '9999-12-31').localeCompare(b.plannedDate || '9999-12-31') ||
      b.createdAt - a.createdAt
    )
  }),
)

function itemMatchesKeyword(item: ShoppingItem) {
  const keyword = keywordFilter.value.trim().toLocaleLowerCase()
  if (!keyword) return true
  return [
    item.name,
    item.description,
    item.category,
    item.storeName,
    item.storeBranch,
    item.location,
    item.address,
    item.note,
    item.requestedBy,
    item.giftRecipient,
    item.assignedTo ? props.memberName(item.assignedTo) : '',
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase().includes(keyword))
}

const filteredItems = computed(() =>
  sortedItems.value.filter(
    (item) =>
      itemMatchesKeyword(item) &&
      (statusFilter.value === 'all' || item.status === statusFilter.value) &&
      (typeFilter.value === 'all' || item.shoppingType === typeFilter.value) &&
      (categoryFilter.value === 'all' || item.category === categoryFilter.value) &&
      (assigneeFilter.value === 'all' ||
        (assigneeFilter.value === 'unassigned' ? !item.assignedTo : item.assignedTo === assigneeFilter.value)) &&
      (storeFilter.value === 'all' || item.storeName === storeFilter.value),
  ),
)

const storeModeAllItems = computed(() =>
  storeFilter.value === 'all'
    ? []
    : props.items.filter(
        (item) => itemMatchesKeyword(item) && item.storeName?.trim() === storeFilter.value && item.status !== 'cancelled',
      ),
)
const storeModePendingItems = computed(() => storeModeAllItems.value.filter((item) => item.status !== 'purchased'))
const storeModePurchasedCount = computed(() => storeModeAllItems.value.filter((item) => item.status === 'purchased').length)
const storeModeEstimatedTotal = computed(() =>
  storeModePendingItems.value.reduce(
    (sum, item) => sum + (Number(item.estimatedTotalPrice) || (Number(item.estimatedUnitPrice) || 0) * item.quantity),
    0,
  ),
)
const storeModeProgress = computed(() =>
  storeModeAllItems.value.length ? Math.round((storeModePurchasedCount.value / storeModeAllItems.value.length) * 100) : 0,
)
const summaryItems = computed(() => (storeMode.value ? storeModeAllItems.value : filteredItems.value))
const visibleItems = computed(() =>
  storeMode.value
    ? sortedItems.value.filter(
        (item) => item.storeName?.trim() === storeFilter.value && item.status !== 'purchased' && item.status !== 'cancelled',
      )
    : filteredItems.value,
)
const displayGroups = computed<ShoppingDisplayGroup[]>(() => {
  if (!groupByStore.value) return [{ key: 'all', name: '', items: visibleItems.value }]
  const groups = new Map<string, ShoppingItem[]>()
  visibleItems.value.forEach((item) => {
    const name = item.storeName?.trim() || '尚未指定店家'
    ;(groups.get(name) || groups.set(name, []).get(name)!).push(item)
  })
  return [...groups.entries()].map(([name, items]) => ({ key: `store:${name}`, name, items }))
})
const filteredItemCount = computed(() => summaryItems.value.length)
const purchasedCount = computed(() => summaryItems.value.filter((item) => item.status === 'purchased').length)
const outstandingCount = computed(() => summaryItems.value.filter((item) => item.status === 'wishlist' || item.status === 'planned').length)
const estimateTotal = computed(() =>
  summaryItems.value
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => sum + (Number(item.estimatedTotalPrice) || (Number(item.estimatedUnitPrice) || 0) * item.quantity), 0),
)
const actualTotal = computed(() =>
  summaryItems.value
    .filter((item) => item.status === 'purchased')
    .reduce(
      (sum, item) =>
        sum + (Number(item.actualTotalPrice) || (Number(item.actualUnitPrice) || 0) * item.quantity || Number(item.estimatedTotalPrice) || 0),
      0,
    ),
)

function amount(item: ShoppingItem, actual = false) {
  const total = actual
    ? Number(item.actualTotalPrice) || (Number(item.actualUnitPrice) || 0) * item.quantity
    : Number(item.estimatedTotalPrice) || (Number(item.estimatedUnitPrice) || 0) * item.quantity
  return total > 0 ? `${item.currency} ${total.toLocaleString()}` : ''
}

function numberLabel(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: value % 1 ? 2 : 0 })
}

function unitAmount(item: ShoppingItem, actual = false) {
  const amount = Math.max(0, Number(actual ? item.actualUnitPrice : item.estimatedUnitPrice) || 0)
  return amount > 0 ? `${item.currency} ${amount.toLocaleString()}` : ''
}

function unitAmountValue(item: ShoppingItem, actual = false) {
  return Math.max(0, Number(actual ? item.actualUnitPrice : item.estimatedUnitPrice) || 0)
}

function showActualUnit(item: ShoppingItem) {
  return !!unitAmount(item, true) && (item.status === 'purchased' || !!unitAmount(item, false))
}

function showEstimatedUnit(item: ShoppingItem) {
  return !!unitAmount(item) && (item.status !== 'purchased' || !!unitAmount(item, true))
}

function unitLabel(item: ShoppingItem, actual = false) {
  const amount = unitAmount(item, actual)
  return amount ? `${actual ? '實際單價' : '預估單價'} ${amount} × ${item.quantity} ${item.unit || '件'}` : ''
}

function taiwanPriceAmount(item: ShoppingItem) {
  const total = Math.max(0, Number(item.taiwanPrice) || 0)
  return total > 0 ? `TWD ${total.toLocaleString()}` : ''
}

function comparisonBaseAmount(item: ShoppingItem) {
  return Math.max(
    0,
    Number(item.status === 'purchased' ? item.actualTotalPrice : item.estimatedTotalPrice) ||
      (Number(item.status === 'purchased' ? item.actualUnitPrice : item.estimatedUnitPrice) || 0) * item.quantity,
  )
}

function currencyRate(item: ShoppingItem) {
  const code = item.currency?.trim().toUpperCase() || ''
  return code === 'TWD'
    ? { from: 'TWD', to: 'TWD', rate: 1, date: new Date().toISOString().slice(0, 10), provider: 'TripMate local cache', cached: true }
    : props.exchangeRates?.[code]
}

function convertedAmountTwd(item: ShoppingItem) {
  const base = comparisonBaseAmount(item)
  const quote = currencyRate(item)
  return base > 0 && quote?.rate ? Math.round(base * quote.rate * 100) / 100 : 0
}

function unitConvertedAmountTwd(item: ShoppingItem, actual = false) {
  const base = unitAmountValue(item, actual)
  const quote = currencyRate(item)
  return base > 0 && quote?.rate && item.currency?.trim().toUpperCase() !== 'TWD'
    ? Math.round(base * quote.rate * 100) / 100
    : 0
}

function unitConvertedLabel(item: ShoppingItem, actual = false) {
  const total = unitConvertedAmountTwd(item, actual)
  return total > 0 ? `約 TWD ${numberLabel(total)}` : ''
}

function exchangeRateDate(item: ShoppingItem) {
  return currencyRate(item)?.date || ''
}

function exchangeRateLabel(item: ShoppingItem) {
  const quote = currencyRate(item)
  return quote && item.currency?.trim().toUpperCase() !== 'TWD'
    ? `1 ${quote.from} ≈ TWD ${quote.rate.toLocaleString(undefined, {
        minimumFractionDigits: quote.rate >= 1 ? 2 : 4,
        maximumFractionDigits: quote.rate >= 10 ? 2 : quote.rate >= 1 ? 3 : 4,
      })}`
    : ''
}

function canCompareTaiwanPrice(item: ShoppingItem) {
  return Math.max(0, Number(item.taiwanPrice) || 0) > 0 && convertedAmountTwd(item) > 0
}

function taiwanCompareKind(item: ShoppingItem) {
  if (!canCompareTaiwanPrice(item)) return ''
  const local = convertedAmountTwd(item)
  const taiwan = Math.max(0, Number(item.taiwanPrice) || 0)
  if (local < taiwan) return 'local-cheaper'
  if (local > taiwan) return 'taiwan-cheaper'
  return 'same'
}

function taiwanCompareSummary(item: ShoppingItem) {
  const kind = taiwanCompareKind(item)
  if (kind === 'local-cheaper') return '當地較便宜'
  if (kind === 'taiwan-cheaper') return '台灣較便宜'
  if (kind === 'same') return '售價相同'
  return ''
}

function taiwanCompareAmount(item: ShoppingItem) {
  if (!canCompareTaiwanPrice(item)) return ''
  const diff = Math.abs(convertedAmountTwd(item) - Math.max(0, Number(item.taiwanPrice) || 0))
  if (!diff) return ''
  return `便宜 TWD ${numberLabel(diff)}`
}

function needsTaiwanCompareHint(item: ShoppingItem) {
  return !!taiwanPriceAmount(item) && item.currency?.trim().toUpperCase() !== 'TWD' && !currencyRate(item)
}

function mapsUrl(item: ShoppingItem) {
  if (item.mapUrl) return item.mapUrl
  const query = item.address || item.location || [item.storeName, item.storeBranch].filter(Boolean).join(' ')
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

function summaryTwdAmount(items: ShoppingItem[], mode: 'estimated' | 'actual') {
  if (!items.length) return 0
  return (
    Math.round(
      items.reduce((sum, item) => {
        const quote = currencyRate(item)
        if (!quote?.rate) return sum
        const base =
          mode === 'actual'
            ? Math.max(
                0,
                Number(item.actualTotalPrice) ||
                  (Number(item.actualUnitPrice) || 0) * item.quantity ||
                  Number(item.estimatedTotalPrice) ||
                  0,
              )
            : Math.max(0, Number(item.estimatedTotalPrice) || (Number(item.estimatedUnitPrice) || 0) * item.quantity)
        return sum + base * quote.rate
      }, 0) * 100,
    ) / 100
  )
}

function canShowSummaryTwd(items: ShoppingItem[], mode: 'estimated' | 'actual') {
  const relevant = items.filter((item) => {
    const base =
      mode === 'actual'
        ? Math.max(
            0,
            Number(item.actualTotalPrice) ||
              (Number(item.actualUnitPrice) || 0) * item.quantity ||
              Number(item.estimatedTotalPrice) ||
              0,
          )
        : Math.max(0, Number(item.estimatedTotalPrice) || (Number(item.estimatedUnitPrice) || 0) * item.quantity)
    return base > 0
  })
  return relevant.length > 0 && relevant.every((item) => Boolean(currencyRate(item)?.rate))
}

const estimateTotalTwd = computed(() => (canShowSummaryTwd(summaryItems.value, 'estimated') ? summaryTwdAmount(summaryItems.value, 'estimated') : 0))
const actualTotalTwd = computed(() => (canShowSummaryTwd(summaryItems.value, 'actual') ? summaryTwdAmount(summaryItems.value, 'actual') : 0))

function toggleStoreMode() {
  if (sortingEnabled.value) return
  if (!storeMode.value && !stores.value.length) return
  storeMode.value = !storeMode.value
  if (storeMode.value && (storeFilter.value === 'all' || !stores.value.includes(storeFilter.value))) storeFilter.value = stores.value[0]
  if (!storeMode.value) storeFilter.value = 'all'
}

function changeStore(offset: number) {
  if (!stores.value.length || sortingEnabled.value) return
  const currentIndex = Math.max(0, stores.value.indexOf(storeFilter.value))
  storeFilter.value = stores.value[(currentIndex + offset + stores.value.length) % stores.value.length]
}

function handleItemAction(command: 'edit' | 'duplicate' | 'remove', item: ShoppingItem) {
  if (command === 'edit') emit('edit', item)
  if (command === 'duplicate') emit('duplicate', item)
  if (command === 'remove') emit('remove', item)
}

function toggleSelectionMode() {
  if (sortingEnabled.value) sortingEnabled.value = false
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) selectedItemIds.value = []
}

function toggleSortingMode() {
  if (selectionMode.value) {
    selectionMode.value = false
    selectedItemIds.value = []
  }
  sortingEnabled.value = !sortingEnabled.value
}

function toggleItemSelection(item: ShoppingItem, checked: boolean) {
  const selected = new Set(selectedItemIds.value)
  if (checked) selected.add(item.id)
  else selected.delete(item.id)
  selectedItemIds.value = [...selected]
}

function linkSelectedItems() {
  const selected = props.items.filter((item) => selectedItemIds.value.includes(item.id))
  if (!selected.length) return
  emit('batch-link', selected)
  selectionMode.value = false
  selectedItemIds.value = []
}

function primaryAmount(item: ShoppingItem) {
  return amount(item, item.status === 'purchased') || amount(item)
}

function primaryAmountLabel(item: ShoppingItem) {
  return item.status === 'purchased' ? '實際' : amount(item) ? '預估' : ''
}

function registerSortableList(key: string, element: Element | null) {
  if (element instanceof HTMLElement) sortableElements.set(key, element)
  else sortableElements.delete(key)
}

function destroySortables() {
  sortableInstances.forEach((instance) => instance.destroy())
  sortableInstances.clear()
}

function handleSortableEnd(key: string, event: SortableEvent) {
  if (event.oldIndex === undefined || event.newIndex === undefined || event.oldIndex === event.newIndex) return
  const group = displayGroups.value.find((entry) => entry.key === key)
  if (!group?.items.length) return

  const reorderedGroup = [...group.items]
  const [moved] = reorderedGroup.splice(event.oldIndex, 1)
  if (!moved) return
  reorderedGroup.splice(event.newIndex, 0, moved)

  const fullOrder = [...sortedItems.value]
  const groupIds = new Set(group.items.map((item) => item.id))
  const groupPositions = fullOrder
    .map((item, index) => (groupIds.has(item.id) ? index : -1))
    .filter((index) => index >= 0)

  groupPositions.forEach((position, index) => {
    fullOrder[position] = reorderedGroup[index]
  })

  emit(
    'reorder',
    fullOrder.map((item, index) => ({
      ...item,
      order: index,
    })),
  )
}

async function syncSortables() {
  await nextTick()
  destroySortables()
  if (!props.canEditTrip || !sortingEnabled.value || selectionMode.value) return

  sortableElements.forEach((element, key) => {
    sortableInstances.set(
      key,
      Sortable.create(element, {
        animation: 180,
        handle: '.shopping-drag-handle',
        draggable: '.shopping-row',
        ghostClass: 'shopping-sort-ghost',
        chosenClass: 'shopping-sort-chosen',
        dragClass: 'shopping-sort-drag',
        forceFallback: false,
        fallbackOnBody: true,
        onEnd: (event) => handleSortableEnd(key, event),
      }),
    )
  })
}

watch(
  () => [
    props.canEditTrip,
    sortingEnabled.value,
    selectionMode.value,
    groupByStore.value,
    storeMode.value,
    statusFilter.value,
    typeFilter.value,
    categoryFilter.value,
    assigneeFilter.value,
    storeFilter.value,
    keywordFilter.value,
    props.items.map((item) => `${item.id}:${item.order ?? ''}:${item.status}:${item.storeName ?? ''}`).join('|'),
  ],
  () => {
    void syncSortables()
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(destroySortables)
</script>

<template>
  <section id="shopping" class="trip-detail-card shopping-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">SHOPPING</p>
        <h2>購物清單</h2>
        <p>集中記下想買、代購與旅伴共同採買的商品。</p>
      </div>
      <div class="shopping-heading-actions">
        <el-button
          class="shopping-store-mode"
          :class="{ 'is-active': storeMode }"
          :disabled="sortingEnabled || (!storeMode && !stores.length)"
          title="在店內只顯示該店尚未完成的採買項目"
          @click="toggleStoreMode"
        >
          <el-icon><Location /></el-icon>{{ storeMode ? '離開到店模式' : '到店採買' }}
        </el-button>
        <el-button
          v-if="canEditTrip"
          class="shopping-sort-toggle"
          :class="{ 'is-active': sortingEnabled }"
          :aria-pressed="sortingEnabled"
          @click="toggleSortingMode"
        >
          <el-icon><Rank /></el-icon>
          <span class="shopping-sort-full">{{ sortingEnabled ? '保存排序' : '調整排序' }}</span>
          <span class="shopping-sort-short">{{ sortingEnabled ? '保存' : '排序' }}</span>
        </el-button>
        <el-button
          v-if="canEditTrip"
          class="shopping-select-button"
          :class="{ 'is-active': selectionMode }"
          :disabled="sortingEnabled"
          @click="toggleSelectionMode"
        >
          {{ selectionMode ? '取消選取' : '選取商品' }}
        </el-button>
        <el-button v-if="canEditTrip" class="shopping-add-button" @click="emit('add')">
          <el-icon><Plus /></el-icon>
          <span class="shopping-add-full">新增商品</span>
          <span class="shopping-add-short">新增</span>
        </el-button>
        <span v-else class="readonly-chip">唯讀</span>
      </div>
    </div>

    <div class="shopping-summary">
      <div>
        <span>商品總數</span>
        <strong>{{ filteredItemCount }}</strong>
      </div>
      <div>
        <span>尚待購買</span>
        <strong>{{ outstandingCount }}</strong>
      </div>
      <div>
        <span>已購買</span>
        <strong>{{ purchasedCount }}</strong>
      </div>
      <div>
        <span>預估總額</span>
        <strong>{{ trip.currency }} {{ estimateTotal.toLocaleString() }}</strong>
        <small v-if="estimateTotalTwd > 0" class="shopping-summary-twd">約 TWD {{ numberLabel(estimateTotalTwd) }}</small>
      </div>
      <div>
        <span>實際已花</span>
        <strong>{{ trip.currency }} {{ actualTotal.toLocaleString() }}</strong>
        <small v-if="actualTotalTwd > 0" class="shopping-summary-twd">約 TWD {{ numberLabel(actualTotalTwd) }}</small>
      </div>
    </div>

    <div class="shopping-search-bar">
      <el-input
        v-model="keywordFilter"
        :disabled="sortingEnabled"
        clearable
        placeholder="搜尋商品名稱、店家、分類、地點或備註"
        aria-label="搜尋購物商品"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <p v-if="sortingEnabled" class="shopping-sort-hint">
      排序啟用中，拖曳商品卡片即可調整順序；按下「保存排序」後可繼續使用篩選與到店模式。
    </p>

    <div v-if="storeMode" class="shopping-store-mode-panel">
      <div class="shopping-store-mode-top">
        <div>
          <span>目前店家</span>
          <strong>{{ storeFilter }}</strong>
          <small>只顯示尚未完成的採買項目</small>
        </div>
        <div class="shopping-store-switch">
          <el-button text circle aria-label="上一間店" title="上一間店" :disabled="sortingEnabled" @click="changeStore(-1)">‹</el-button>
          <el-select v-model="storeFilter" :disabled="sortingEnabled" aria-label="選擇到店店家">
            <el-option v-for="store in stores" :key="store" :label="store" :value="store" />
          </el-select>
          <el-button text circle aria-label="下一間店" title="下一間店" :disabled="sortingEnabled" @click="changeStore(1)">›</el-button>
        </div>
      </div>
      <div class="shopping-store-progress">
        <div>
          <span>採買進度</span>
          <strong>{{ storeModePurchasedCount }} / {{ storeModeAllItems.length }} 已購買</strong>
        </div>
        <el-progress :percentage="storeModeProgress" :stroke-width="8" :show-text="false" />
        <p>
          <span>尚待購買 {{ storeModePendingItems.length }} 項</span>
          <strong>{{ trip.currency }} {{ storeModeEstimatedTotal.toLocaleString() }}</strong>
        </p>
      </div>
    </div>

    <div v-else class="shopping-filters">
      <el-select v-model="statusFilter" :disabled="sortingEnabled" aria-label="依狀態篩選">
        <el-option label="全部狀態" value="all" />
        <el-option v-for="(label, status) in statusLabels" :key="status" :label="label" :value="status" />
      </el-select>
      <el-select v-model="typeFilter" :disabled="sortingEnabled" aria-label="依購物類型篩選">
        <el-option label="全部類型" value="all" />
        <el-option v-for="(label, type) in typeLabels" :key="type" :label="label" :value="type" />
      </el-select>
      <el-select v-model="categoryFilter" :disabled="sortingEnabled" aria-label="依分類篩選">
        <el-option label="全部分類" value="all" />
        <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
      </el-select>
      <el-select v-model="assigneeFilter" :disabled="sortingEnabled" aria-label="依負責人篩選">
        <el-option label="全部負責人" value="all" />
        <el-option label="尚未分派" value="unassigned" />
        <el-option v-for="member in trip.members" :key="member.id" :label="member.name" :value="member.id" />
      </el-select>
      <el-select v-if="stores.length" v-model="storeFilter" :disabled="sortingEnabled" aria-label="依店家篩選">
        <el-option label="全部店家" value="all" />
        <el-option v-for="store in stores" :key="store" :label="store" :value="store" />
      </el-select>
      <el-button class="shopping-group-button" text :disabled="sortingEnabled" @click="groupByStore = !groupByStore">
        {{ groupByStore ? '依店家顯示中' : '依清單顯示中' }}
      </el-button>
    </div>

    <div v-if="selectionMode" class="shopping-selection-bar">
      <span>已選取 {{ selectedItemIds.length }} 項商品</span>
      <el-button type="primary" :disabled="!selectedItemIds.length" @click="linkSelectedItems">加入關聯行程</el-button>
    </div>

    <div v-if="visibleItems.length" class="shopping-groups" :class="{ 'is-store-mode': storeMode }">
      <section v-for="group in displayGroups" :key="group.key" class="shopping-store-group">
        <div v-if="groupByStore" class="shopping-store-heading">
          <div>
            <el-icon><Location /></el-icon>
            <strong>{{ group.name }}</strong>
          </div>
          <span>{{ group.items.filter((item) => item.status !== 'purchased').length }} 件待購買</span>
        </div>
        <div class="shopping-list" :ref="(element) => registerSortableList(group.key, element as Element | null)">
          <article
            v-for="item in group.items"
            :key="item.id"
            class="shopping-row"
            :class="[`is-${item.status}`, `is-${item.priority}`, { 'is-selecting': selectionMode, 'is-sortable-enabled': sortingEnabled && canEditTrip }]"
          >
            <el-checkbox
              v-if="selectionMode"
              class="shopping-select-checkbox"
              :model-value="selectedItemIds.includes(item.id)"
              :aria-label="`選取 ${item.name}`"
              @change="(checked: boolean) => toggleItemSelection(item, checked)"
            />
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="`${item.name} 商品圖片`" class="shopping-image" />
            <span v-else class="shopping-image shopping-image-placeholder"><el-icon><ShoppingBag /></el-icon></span>
            <div class="shopping-copy">
              <div class="shopping-title">
                <el-tooltip v-if="sortingEnabled && canEditTrip" content="長按並拖曳排序" placement="top">
                  <span class="shopping-drag-handle" aria-hidden="true">
                    <el-icon><Rank /></el-icon>
                  </span>
                </el-tooltip>
                <strong>{{ item.name }}</strong>
                <span :class="['shopping-status-badge', `is-${item.status}`]">{{ statusLabels[item.status] }}</span>
                <span :class="['shopping-priority-badge', `is-${item.priority}`]">{{ priorityLabels[item.priority] }}</span>
              </div>
              <p class="shopping-tags">
                <span>{{ typeLabels[item.shoppingType] }}</span>
                <span>{{ item.category }}</span>
                <span v-if="item.quantity > 1">{{ item.quantity }} {{ item.unit || '件' }}</span>
              </p>
              <p v-if="item.storeName || item.assignedTo || item.requestedBy || item.giftRecipient" class="shopping-meta">
                <span v-if="item.storeName"><el-icon><Location /></el-icon>{{ item.storeName }}{{ item.storeBranch ? `・${item.storeBranch}` : '' }}</span>
                <span v-if="item.assignedTo"><el-icon><User /></el-icon>{{ memberName(item.assignedTo) }} 負責</span>
                <span v-if="item.requestedBy">委託：{{ item.requestedBy }}</span>
                <span v-if="item.giftRecipient">送給：{{ item.giftRecipient }}</span>
              </p>
              <p v-if="item.note" class="shopping-note">{{ item.note }}</p>
            </div>
            <div class="shopping-price">
              <div v-if="primaryAmount(item)" class="shopping-price-main" :class="item.status === 'purchased' ? 'is-actual' : 'is-estimated'">
                <span v-if="primaryAmountLabel(item)" class="shopping-price-main-label">{{ primaryAmountLabel(item) }}</span>
                <strong>{{ primaryAmount(item) }}</strong>
              </div>
              <div v-if="showActualUnit(item)" class="shopping-unit-row is-actual">
                <small class="shopping-unit-price is-actual">{{ unitLabel(item, true) }}</small>
                <small v-if="unitConvertedLabel(item, true)" class="shopping-converted-price">{{ unitConvertedLabel(item, true) }}</small>
              </div>
              <div v-if="showEstimatedUnit(item)" class="shopping-unit-row is-estimated">
                <small class="shopping-unit-price is-estimated">{{ unitLabel(item) }}</small>
                <small v-if="unitConvertedLabel(item)" class="shopping-converted-price">{{ unitConvertedLabel(item) }}</small>
              </div>
              <div v-if="exchangeRateLabel(item) || exchangeRateDate(item)" class="shopping-rate-row">
                <small v-if="exchangeRateLabel(item)" class="shopping-rate-current">{{ exchangeRateLabel(item) }}</small>
                <small v-if="exchangeRateDate(item)" class="shopping-rate-date">{{ exchangeRateDate(item) }}</small>
              </div>
              <small v-if="taiwanPriceAmount(item)" class="shopping-taiwan-price">台灣售價 {{ taiwanPriceAmount(item) }}</small>
              <div v-if="taiwanCompareSummary(item)" class="shopping-compare-row" :class="`is-${taiwanCompareKind(item)}`">
                <span class="shopping-compare-badge" :class="`is-${taiwanCompareKind(item)}`">{{ taiwanCompareSummary(item) }}</span>
                <small v-if="taiwanCompareAmount(item)" class="shopping-compare-detail">{{ taiwanCompareAmount(item) }}</small>
              </div>
              <small v-else-if="needsTaiwanCompareHint(item)" class="shopping-compare-hint">
                {{ exchangeRateError || `尚未取得 ${item.currency} → TWD 最新匯率` }}
              </small>
            </div>
            <div class="shopping-tools">
              <el-tooltip v-if="mapsUrl(item)" content="在 Google Maps 開啟店家" placement="top">
                <a class="shopping-tool-button" :href="mapsUrl(item)" target="_blank" rel="noopener noreferrer" aria-label="在 Google Maps 開啟店家">
                  <el-icon><TopRight /></el-icon>
                </a>
              </el-tooltip>
              <el-tooltip v-if="sortingEnabled && canEditTrip" content="拖曳排序" placement="top">
                <span class="shopping-tool-button shopping-drag-handle shopping-drag-button" aria-hidden="true">
                  <el-icon><Rank /></el-icon>
                </span>
              </el-tooltip>
              <el-tooltip
                v-if="canEditTrip && item.status !== 'purchased' && item.status !== 'cancelled'"
                content="標記為已購買"
                placement="top"
              >
                <el-button class="shopping-tool-button is-purchase" text circle :aria-label="`標記 ${item.name} 為已購買`" @click="emit('status', item, 'purchased')">✓</el-button>
              </el-tooltip>
              <el-dropdown v-if="canEditTrip" trigger="click" @command="(status: ShoppingStatus) => emit('status', item, status)">
                <el-button class="shopping-tool-button is-status" text circle aria-label="變更商品狀態" title="變更商品狀態">
                  <el-icon><Switch /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="(label, status) in statusLabels" :key="status" :command="status" :disabled="item.status === status">
                      {{ label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip v-if="canEditTrip && item.status === 'purchased' && !item.expenseId" content="建立旅行開銷" placement="top">
                <el-button class="shopping-tool-button is-expense" text circle aria-label="建立旅行開銷" @click="emit('convert', item)">¥</el-button>
              </el-tooltip>
              <el-dropdown v-if="canEditTrip" trigger="click" @command="(command: 'edit' | 'duplicate' | 'remove') => handleItemAction(command, item)">
                <el-button class="shopping-tool-button is-more" text circle aria-label="更多商品操作" title="更多商品操作">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">編輯商品</el-dropdown-item>
                    <el-dropdown-item command="duplicate">複製商品</el-dropdown-item>
                    <el-dropdown-item command="remove" divided class="shopping-delete-action">刪除商品</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div v-else class="detail-empty-state shopping-empty">
      <el-icon><Picture /></el-icon>
      <div>
        <strong>{{ items.length ? '沒有符合篩選條件的商品' : '還沒有購物項目' }}</strong>
        <p>{{ items.length ? '調整篩選條件，或新增新的購物項目。' : '把想買的伴手禮、代購或共同採買商品先記下來。' }}</p>
      </div>
      <el-button v-if="canEditTrip" class="shopping-add-button" @click="emit('add')">新增第一個商品</el-button>
    </div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}
.shopping-panel{align-self:start;padding:24px}
.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}
.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}
.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}
.detail-card-heading p:not(.section-kicker){margin:4px 0 0;color:#6b7d78;font-size:13px;line-height:1.5}
.shopping-heading-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.shopping-add-button,.shopping-store-mode,.shopping-sort-toggle{display:inline-flex;gap:6px;min-height:40px;border-radius:10px;font-weight:700}
.shopping-add-button{border:0;background:#123f3a;color:#fff}
.shopping-add-button:hover,.shopping-add-button:focus-visible{background:#1d5a52;color:#fff}
.shopping-store-mode,.shopping-sort-toggle{border-color:#c8ded4;background:#fff;color:#2f7d70}
.shopping-store-mode:hover,.shopping-store-mode.is-active,.shopping-sort-toggle:hover,.shopping-sort-toggle:focus-visible{border-color:#84b6a5;background:#eef5f0;color:#123f3a}
.shopping-sort-toggle.is-active{border-color:#123f3a;background:#123f3a;color:#fff}
.shopping-sort-toggle .el-icon{margin-right:4px}
.shopping-sort-short,.shopping-add-short{display:none}
.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}
.shopping-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:16px}
.shopping-summary>div{display:grid;gap:3px;padding:10px 11px;border:1px solid #e2ebe5;border-radius:10px;background:#fbfcfa}
.shopping-summary span{color:#71827c;font-size:12px}
.shopping-summary strong{overflow:hidden;color:#173d37;font-size:14px;text-overflow:ellipsis;white-space:nowrap}
.shopping-summary-twd{color:#9aa9a3;font-size:11px;font-weight:700;line-height:1.4}
.shopping-search-bar{margin-top:14px}
.shopping-search-bar :deep(.el-input__wrapper){min-height:42px;border-radius:10px;box-shadow:0 0 0 1px #d7e4de inset}
.shopping-search-bar :deep(.el-input__wrapper.is-focus){box-shadow:0 0 0 1px #8db8aa inset}
.shopping-sort-hint{margin:10px 2px 0;color:#71827c;font-size:12px;line-height:1.55}
.shopping-filters{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.shopping-filters :deep(.el-select){width:145px}
.shopping-group-button{min-height:36px;color:#2f7d70;font-weight:700}
.shopping-groups{display:grid;gap:15px;margin-top:17px}
.shopping-store-group{overflow:hidden;border:1px solid #e2ebe6;border-radius:12px;background:#fbfcfa}
.shopping-store-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border-bottom:1px solid #e7eeea;background:#f1f7f3}
.shopping-store-heading>div{display:flex;align-items:center;gap:6px;color:#1c5148}
.shopping-store-heading strong{font-size:14px}
.shopping-store-heading span{color:#668078;font-size:12px}
.shopping-list{display:grid;gap:8px;padding:9px}
.shopping-row{display:grid;grid-template-columns:58px minmax(0,1fr) minmax(82px,auto) auto;align-items:start;gap:11px;padding:10px;border:1px solid #e3ebe7;border-radius:10px;background:#fff;transition:border-color .16s,box-shadow .16s}
.shopping-row.is-sortable-enabled{cursor:grab}
.shopping-row:hover,.shopping-row:focus-within{border-color:#bed8cd;box-shadow:0 4px 12px rgba(18,63,58,.06)}
.shopping-row.is-purchased{opacity:.72}
.shopping-row.is-purchased .shopping-title strong{text-decoration:line-through}
.shopping-row.is-high{border-left:3px solid #ff927c;padding-left:8px}
.shopping-image{width:58px;height:58px;border-radius:9px;object-fit:cover}
.shopping-image-placeholder{display:grid;place-items:center;background:#edf5f0;color:#4d917f;font-size:23px}
.shopping-copy{min-width:0}
.shopping-title{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.shopping-title strong{overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}
.shopping-status-badge,.shopping-priority-badge,.shopping-tags span{padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.shopping-status-badge.is-wishlist{background:#eef5f0;color:#48796d}
.shopping-status-badge.is-planned{background:#e8f1f4;color:#3a7380}
.shopping-status-badge.is-purchased{background:#e4f2eb;color:#267160}
.shopping-status-badge.is-unavailable{background:#fff4d9;color:#926a21}
.shopping-status-badge.is-cancelled{background:#f0f2f1;color:#7c8d87}
.shopping-priority-badge.is-high{background:#fce9e7;color:#b64237}
.shopping-priority-badge.is-medium{background:#fff4d9;color:#8a641c}
.shopping-priority-badge.is-low{background:#eef2f0;color:#71827c}
.shopping-tags,.shopping-meta,.shopping-note{display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0 0;color:#71827c;font-size:12px;line-height:1.45}
.shopping-tags span{background:#f0f5f2;color:#5b7770;font-weight:600}
.shopping-meta span{display:inline-flex;align-items:center;gap:3px}
.shopping-meta .el-icon{color:#4b907e;font-size:13px}
.shopping-note{color:#84938d;overflow-wrap:anywhere}
.shopping-price{display:grid;justify-items:end;gap:4px;padding-top:2px;color:#71827c;font-size:11px;text-align:right}
.shopping-price strong{color:#173d37;font-size:14px;white-space:nowrap}
.shopping-price-main,.shopping-unit-row,.shopping-rate-row,.shopping-compare-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;max-width:100%}
.shopping-price-main{padding:2px 0}
.shopping-price-main.is-actual strong{color:#1f5f4f}
.shopping-price-main.is-estimated strong{color:#7a5b22}
.shopping-price-main-label{color:#7b8b86;font-size:11px;font-weight:700;white-space:nowrap}
.shopping-price-main.is-actual .shopping-price-main-label{color:#2f7d70}
.shopping-price-main.is-estimated .shopping-price-main-label{color:#9a7230}
.shopping-unit-price,.shopping-converted-price,.shopping-rate-current,.shopping-rate-date,.shopping-taiwan-price{display:block;color:#58736b;font-size:11px;font-weight:700;line-height:1.45}
.shopping-unit-price.is-actual{color:#4f6e66}
.shopping-unit-price.is-estimated{color:#748681;font-weight:600}
.shopping-unit-row.is-actual .shopping-converted-price{color:#2f7d70}
.shopping-unit-row.is-estimated .shopping-converted-price{color:#8b6a2a}
.shopping-converted-price,.shopping-rate-current{color:#6d7e79}
.shopping-rate-date{color:#8a9993;font-weight:600}
.shopping-compare-badge{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:800;line-height:1.2;white-space:nowrap}
.shopping-compare-badge.is-local-cheaper{background:#e7f5ee;color:#28715f}
.shopping-compare-badge.is-taiwan-cheaper{background:#fff1ec;color:#c45c4d}
.shopping-compare-badge.is-same{background:#eef2f0;color:#657872}
.shopping-compare-detail,.shopping-compare-hint{display:block;max-width:156px;color:#6d7e79;font-size:11px;line-height:1.45}
.shopping-compare-detail{white-space:nowrap}
.shopping-compare-row.is-local-cheaper .shopping-compare-detail{color:#28715f;font-weight:700}
.shopping-compare-row.is-taiwan-cheaper .shopping-compare-detail{color:#c45c4d;font-weight:700}
.shopping-compare-row.is-same .shopping-compare-detail{color:#657872;font-weight:700}
.shopping-compare-hint{color:#86958f}
.shopping-tools{display:flex;align-items:flex-start;gap:0}
.shopping-tool-button{display:grid;width:36px!important;min-width:36px!important;height:36px!important;place-items:center;margin:0 -3px 0 0!important;padding:0!important;border-radius:8px;color:#638077;text-decoration:none}
.shopping-tool-button:hover,.shopping-tool-button:focus-visible{background:#eef5f0;color:#236c59}
.shopping-tool-button.is-purchase{color:#2f7d70;font-size:17px;font-weight:800}
.shopping-tool-button.is-expense{color:#89641b;font-weight:800}
.shopping-tool-button.is-more{color:#52796f}
.shopping-tool-button.is-more:hover,.shopping-tool-button.is-more:focus-visible{background:#eef5f0;color:#123f3a}
.shopping-drag-handle{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:32px;height:32px;margin:-7px -1px -7px -7px;border-radius:8px;color:#4d8d7c;cursor:grab;touch-action:none}
.shopping-drag-handle:hover{background:#eaf5ef;color:#155b4b}
.shopping-drag-handle:active{cursor:grabbing}
.shopping-drag-button{margin:0 -3px 0 0!important}
:global(.shopping-delete-action){color:#c36358}
.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}
.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}
.detail-empty-state strong{color:#244a43;font-size:16px}
.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}
.shopping-select-button{min-height:40px;border-color:#c8ded4;border-radius:10px;color:#2f7d70;font-weight:700}
.shopping-select-button:hover,.shopping-select-button.is-active{border-color:#2f7d70;background:#eef5f0;color:#123f3a}
.shopping-selection-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 12px;border:1px solid #cfe2d9;border-radius:10px;background:#eef7f2;color:#315e55;font-size:13px;font-weight:700}
.shopping-selection-bar .el-button{min-height:38px;border:0;border-radius:9px;background:#123f3a;color:#fff;font-weight:700}
.shopping-selection-bar .el-button:hover,.shopping-selection-bar .el-button:focus-visible{background:#1d5a52;color:#fff}
.shopping-row.is-selecting{grid-template-columns:24px 58px minmax(0,1fr) minmax(82px,auto) auto}
.shopping-select-checkbox{align-self:center;margin:0}
.shopping-select-checkbox :deep(.el-checkbox__inner){width:18px;height:18px}
.shopping-store-mode-panel{display:grid;gap:13px;margin-top:16px;padding:14px;border:1px solid #cfe2d9;border-radius:12px;background:#f1f8f4}
.shopping-store-mode-top{display:flex;align-items:center;justify-content:space-between;gap:14px}
.shopping-store-mode-top>div:first-child{display:grid;min-width:0;gap:1px}
.shopping-store-mode-top span,.shopping-store-mode-top small{color:#668078;font-size:12px}
.shopping-store-mode-top strong{overflow:hidden;color:#173d37;font-size:16px;text-overflow:ellipsis;white-space:nowrap}
.shopping-store-switch{display:flex;align-items:center;gap:3px;min-width:236px}
.shopping-store-switch .el-select{width:174px}
.shopping-store-switch .el-button{width:36px;height:36px;margin:0;padding:0;color:#2f7d70;font-size:23px}
.shopping-store-progress{display:grid;gap:8px}
.shopping-store-progress>div,.shopping-store-progress p{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0;color:#59756c;font-size:12px}
.shopping-store-progress>div strong,.shopping-store-progress p strong{color:#1e554a;font-size:13px}
.shopping-store-progress :deep(.el-progress-bar__outer){background:#dbece3}
.shopping-store-progress :deep(.el-progress-bar__inner){background:#2f7d70}
.shopping-store-progress p strong{white-space:nowrap}
:global(.shopping-sort-ghost){opacity:.34}
.shopping-row:global(.shopping-sort-ghost){border-color:#89baa9;border-style:dashed;background:#f1f8f4;box-shadow:none}
.shopping-row:global(.shopping-sort-chosen){border-color:#4f9e89;box-shadow:0 12px 26px rgba(18,63,58,.14)}
:global(.shopping-sort-drag){cursor:grabbing!important}
:global(.shopping-sort-drag .shopping-row){border-color:#4f9e89;box-shadow:0 14px 30px rgba(18,63,58,.16)}

@media(max-width:820px){
  .shopping-summary{grid-template-columns:repeat(3,minmax(0,1fr))}
  .shopping-row{grid-template-columns:54px minmax(0,1fr) auto}
  .shopping-price{grid-column:2;justify-items:start;padding:0;text-align:left}
  .shopping-price-main,.shopping-unit-row,.shopping-rate-row,.shopping-compare-row{justify-content:flex-start}
  .shopping-compare-detail,.shopping-compare-hint{max-width:none}
  .shopping-tools{grid-column:3;grid-row:1/3;flex-direction:column;gap:0}
  .shopping-tool-button{margin:0!important}
  .shopping-row.is-selecting{grid-template-columns:24px 54px minmax(0,1fr) auto}
}

@media(max-width:600px){
  .shopping-panel{padding:18px}
  .detail-card-heading{flex-direction:column}
  .shopping-heading-actions{width:100%;justify-content:stretch}
  .shopping-heading-actions .el-button{flex:1}
  .shopping-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  .shopping-search-bar{margin-top:12px}
  .shopping-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
  .shopping-filters :deep(.el-select){width:100%}
  .shopping-group-button{grid-column:1/-1}
  .shopping-row{grid-template-columns:48px minmax(0,1fr);gap:10px;padding:10px}
  .shopping-image{width:48px;height:48px}
  .shopping-copy{grid-column:2;grid-row:1;min-width:0}
  .shopping-price{grid-column:2;grid-row:2;justify-items:start;min-height:24px;padding:1px 0 0;text-align:left}
  .shopping-price strong{font-size:15px}
  .shopping-price-main,.shopping-unit-row,.shopping-rate-row,.shopping-compare-row{justify-content:flex-start}
  .shopping-tools{grid-column:1/-1;grid-row:3;display:flex;flex-direction:row;justify-content:flex-end;gap:2px;margin-top:2px;padding-top:7px;border-top:1px solid #edf1ee}
  .shopping-tool-button{width:40px!important;min-width:40px!important;height:40px!important;margin:0!important}
  .shopping-title{padding-right:0}
  .shopping-meta{gap:4px 7px}
  .shopping-note{margin-top:5px}
  .shopping-selection-bar{align-items:stretch;flex-direction:column}
  .shopping-selection-bar .el-button{width:100%;min-height:42px}
  .shopping-row.is-selecting{grid-template-columns:24px 48px minmax(0,1fr);gap:8px}
  .shopping-row.is-selecting .shopping-copy{grid-column:3}
  .shopping-row.is-selecting .shopping-price{grid-column:3}
  .shopping-row.is-selecting .shopping-tools{grid-column:1/-1}
  .shopping-select-checkbox{align-self:start;padding-top:3px}
  .shopping-store-heading{padding:9px 10px}
  .shopping-list{padding:7px}
  .shopping-store-mode,.shopping-sort-toggle{font-size:12px}
  .shopping-store-mode-panel{padding:12px}
  .shopping-store-mode-top{align-items:stretch;flex-direction:column}
  .shopping-store-switch{min-width:0;width:100%}
  .shopping-store-switch .el-select{width:auto;flex:1}
  .shopping-store-switch .el-button{width:40px;height:40px}
  .shopping-store-progress>div,.shopping-store-progress p{align-items:flex-start;flex-direction:column;gap:2px}
  .shopping-store-progress p{align-items:center;flex-direction:row}
  .shopping-store-progress p strong{font-size:14px}
  .shopping-drag-handle{width:40px;height:40px;margin:-11px -4px -11px -9px}
}

@media(max-width:390px){
  .shopping-panel{padding:16px}
  .shopping-filters{grid-template-columns:1fr}
  .shopping-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
  .shopping-summary>div:last-child{grid-column:1/-1}
  .shopping-row{padding:9px}
  .shopping-title strong{font-size:14px}
  .shopping-tools{justify-content:flex-start}
  .shopping-sort-full,.shopping-add-full{display:none}
  .shopping-sort-short,.shopping-add-short{display:inline}
}

@media(prefers-reduced-motion:reduce){
  .shopping-row{transition:none}
}
</style>
