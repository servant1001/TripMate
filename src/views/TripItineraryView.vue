<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripItineraryCard from '../components/TripItineraryCard.vue'
import { useTripStore } from '../stores/trip'
import type { Favorite, FavoriteType, ItineraryActivityKind, ItineraryItem, ShoppingItem, Trip } from '../types'

type Day = { date: string; entries: ItineraryItem[] }

const props = defineProps<{
  trip: Trip
  items: ItineraryItem[]
  favorites: Favorite[]
  userId: string
  favoriteRequestId?: string
  days: Day[]
  personalItems: ItineraryItem[]
  shoppingItems: ShoppingItem[]
  canEdit: boolean
  sortingEnabled: boolean
  formatDate: (date: string) => string
  duration: (entry: ItineraryItem) => string
  timeWarning: (entries: ItineraryItem[], index: number) => string
  mapsUrl: (location: string, mapUrl?: string) => string
}>()

const emit = defineEmits<{
  toggle: [entry: ItineraryItem]
  edit: [entry: ItineraryItem]
  remove: [entry: ItineraryItem]
  toggleSorting: []
  sort: [payload: { date: string; oldIndex: number; newIndex: number }]
  sortPersonal: [payload: { parentId: string; oldIndex: number; newIndex: number }]
  sortGroup: [payload: { groupId: string; oldIndex: number; newIndex: number }]
  move: [payload: { itemId: string; from: string; to: string; oldIndex: number; newIndex: number }]
  favoriteRequestConsumed: []
}>()

const store = useTripStore()
const showGroupForm = ref(false)
const editingGroupId = ref<string | null>(null)
const groupMemberIds = ref<string[]>([])
const itineraryGroup = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', note: '' })
const showItem = ref(false)
const savingItem = ref(false)
const editingItemId = ref<string | null>(null)
const itemActivityKind = ref<ItineraryActivityKind>('shared')
const personalActivityParentId = ref('')
const insertAfterItemId = ref<string | null>(null)
const pendingFavoriteId = ref<string | null>(null)
const itemFavoriteId = ref('')
const itemItineraryGroupId = ref('')
const showFavoritePicker = ref(false)
const favoritePickerTarget = ref<'source' | 'destination'>('source')
const favoritePickerSearch = ref('')
const favoritePickerType = ref<FavoriteType | 'all'>('all')
const item = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', note: '', type: '景點', transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' })
const favoritePickerOptions: Array<{ value: FavoriteType | 'all'; label: string }> = [{ value: 'all', label: '全部' }, { value: 'attraction', label: '景點' }, { value: 'restaurant', label: '餐廳' }, { value: 'transport', label: '交通' }, { value: 'stay', label: '住宿' }, { value: 'shop', label: '商店' }]
const itineraryGroupsForItem = computed(() => props.items.filter((entry) => entry.activityKind === 'group' && entry.date === item.date))
const filteredFavoritesForPicker = computed(() => { const keyword = favoritePickerSearch.value.trim().toLowerCase(); return props.favorites.filter((entry) => { const matchesType = favoritePickerType.value === 'all' || normalizeFavoriteType(entry.type) === favoritePickerType.value; const matchesSearch = !keyword || [entry.name, entry.location, entry.note].some((value) => value?.toLowerCase().includes(keyword)); return matchesType && matchesSearch }) })

function normalizeGoogleMapsUrl(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    if (!/(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') {
      throw new Error()
    }
    return normalized
  } catch {
    throw new Error('請貼上有效的 Google Maps 景點網址。')
  }
}

function normalizeFavoriteType(type: FavoriteType): FavoriteType { return type === 'cafe' ? 'restaurant' : type === 'alternative' || type === 'other' ? 'attraction' : type }
function favoriteToItineraryType(type: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', transport: '交通', stay: '住宿', shop: '商店', cafe: '餐廳', alternative: '景點', other: '景點' } as Record<FavoriteType, string>)[type] }
function favoriteTypeLabel(type: FavoriteType) { return favoriteToItineraryType(type) }
function resetItem(entry?: ItineraryItem, favoriteId?: string) { const linkedFavoriteId = favoriteId || entry?.favoriteId || ''; pendingFavoriteId.value = linkedFavoriteId || null; itemFavoriteId.value = linkedFavoriteId; itemItineraryGroupId.value = entry?.itineraryGroupId || ''; editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, endTime: entry.endTime || '', title: entry.title, location: entry.location, mapUrl: entry.mapUrl || '', imageUrl: entry.imageUrl || '', note: entry.note || '', type: entry.type, transportDestinationFavoriteId: entry.transportDestinationFavoriteId || '', transportDestinationName: entry.transportDestinationName || '', transportDestinationLocation: entry.transportDestinationLocation || '', transportDestinationMapUrl: entry.transportDestinationMapUrl || '' } : { date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', imageUrl: '', note: '', type: '景點', transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }) }
function openNewItemForm() { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'shared'; personalActivityParentId.value = ''; insertAfterItemId.value = null; resetItem(); showItem.value = true }
function openItemFormForEdit(entry: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = entry.activityKind || 'shared'; personalActivityParentId.value = entry.parentFreeActivityId || ''; insertAfterItemId.value = null; resetItem(entry); showItem.value = true }
function openPersonalItemForm(group: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'personal'; personalActivityParentId.value = group.id; insertAfterItemId.value = null; resetItem(); item.date = group.date; item.type = '個人行程'; showItem.value = true }
function openItemFormAfter(entry: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'shared'; personalActivityParentId.value = ''; insertAfterItemId.value = entry.id; resetItem(); itemItineraryGroupId.value = entry.itineraryGroupId || ''; item.date = entry.date; showItem.value = true }
function openFavoritePicker(target: 'source' | 'destination' = 'source') { favoritePickerTarget.value = target; favoritePickerSearch.value = ''; favoritePickerType.value = 'all'; showFavoritePicker.value = true }
function applyFavoriteToItem(favoriteId: string) { const selected = props.favorites.find((entry) => entry.id === favoriteId); if (!selected) return; const type = favoriteToItineraryType(selected.type); itemFavoriteId.value = selected.id; pendingFavoriteId.value = selected.id; Object.assign(item, { title: selected.name, location: selected.location || '', mapUrl: selected.mapUrl || '', imageUrl: selected.imageUrl || '', type }); if (type !== '交通') Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }) }
function selectFavoriteForItem(favoriteId: string) { const selected = props.favorites.find((entry) => entry.id === favoriteId); if (!selected) return; if (favoritePickerTarget.value === 'destination') Object.assign(item, { transportDestinationFavoriteId: selected.id, transportDestinationName: selected.name, transportDestinationLocation: selected.location || '', transportDestinationMapUrl: selected.mapUrl || '' }); else applyFavoriteToItem(favoriteId); showFavoritePicker.value = false }
async function saveItem() { if (savingItem.value) return; if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); if (!item.title.trim() || !item.date) return ElMessage.warning('請填寫行程名稱與日期。'); if (item.endTime && item.time && item.endTime <= item.time) return ElMessage.warning('結束時間必須晚於開始時間。'); const kind = itemActivityKind.value; if (kind === 'personal' && !personalActivityParentId.value) return ElMessage.warning('請從自由活動群組新增個人行程。'); const sameLevelItems = kind === 'personal' ? props.personalItems.filter((entry) => entry.parentFreeActivityId === personalActivityParentId.value) : props.items.filter((entry) => (entry.activityKind || 'shared') !== 'personal'); const conflict = sameLevelItems.some((entry) => entry.id !== editingItemId.value && entry.date === item.date && item.time && entry.time && entry.time < (item.endTime || item.time) && (entry.endTime || entry.time) > item.time); if (conflict) return ElMessage.warning('此時段與既有行程重疊，請調整時間。'); savingItem.value = true; try { const isFree = kind === 'free'; const isPersonal = kind === 'personal'; const existing = editingItemId.value ? props.items.find((entry) => entry.id === editingItemId.value) : undefined; const rawImage = item.imageUrl.trim(); const payload = { ...item, title: item.title.trim(), type: isFree ? '自由活動' : item.type, location: isFree ? '' : item.location.trim(), mapUrl: isFree ? '' : normalizeGoogleMapsUrl(item.mapUrl), imageUrl: isFree ? '' : rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : rawImage, note: item.note.trim(), activityKind: kind, parentFreeActivityId: isPersonal ? personalActivityParentId.value : '', itineraryGroupId: !isFree && !isPersonal ? itemItineraryGroupId.value : '', ownerId: isPersonal ? (props.userId || props.trip.ownerId) : '', favoriteId: !isFree ? pendingFavoriteId.value || existing?.favoriteId || '' : '', transportDestinationMapUrl: !isFree && item.type === '交通' ? normalizeGoogleMapsUrl(item.transportDestinationMapUrl) : '', transportDestinationFavoriteId: !isFree && item.type === '交通' ? item.transportDestinationFavoriteId : '', transportDestinationName: !isFree && item.type === '交通' ? item.transportDestinationName.trim() : '', transportDestinationLocation: !isFree && item.type === '交通' ? item.transportDestinationLocation.trim() : '' }; if (existing) await store.updateItem({ ...existing, ...payload }); else { const ordered = sameLevelItems.filter((entry) => entry.date === item.date).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || '')); const afterIndex = !isPersonal && insertAfterItemId.value ? ordered.findIndex((entry) => entry.id === insertAfterItemId.value) : -1; const insertIndex = afterIndex >= 0 ? afterIndex + 1 : ordered.length; const added = await store.addItem({ tripId: props.trip.id, ...payload, order: insertIndex }); if (afterIndex >= 0) { const reordered = [...ordered]; reordered.splice(insertIndex, 0, added); await store.reorderItems(reordered) } const savedFavorite = !isFree && !isPersonal && pendingFavoriteId.value ? props.favorites.find((entry) => entry.id === pendingFavoriteId.value) : undefined; if (savedFavorite) await store.updateFavorite({ ...savedFavorite, addedToItinerary: true }) } showItem.value = false; editingItemId.value = null; insertAfterItemId.value = null; pendingFavoriteId.value = null; personalActivityParentId.value = ''; itemActivityKind.value = 'shared' } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。') } finally { savingItem.value = false } }
watch(() => props.favoriteRequestId, (favoriteId) => { if (!favoriteId) return; openNewItemForm(); item.date = props.trip.startDate; applyFavoriteToItem(favoriteId); emit('favoriteRequestConsumed') })

function openGroupForm(entries: ItineraryItem[] = [], existing?: ItineraryItem) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  editingGroupId.value = existing?.id || null
  groupMemberIds.value = existing
    ? props.items.filter((item) => item.itineraryGroupId === existing.id).map((item) => item.id)
    : entries.map((item) => item.id)
  const first = entries[0] || existing
  Object.assign(
    itineraryGroup,
    existing
      ? {
          date: existing.date,
          time: existing.time || '',
          endTime: existing.endTime || '',
          title: existing.title,
          location: existing.location || '',
          mapUrl: existing.mapUrl || '',
          note: existing.note || '',
        }
      : {
          date: first?.date || props.trip.startDate || '',
          time: '',
          endTime: '',
          title: '',
          location: first?.location || '',
          mapUrl: first?.mapUrl || '',
          note: '',
        },
  )
  showGroupForm.value = true
}

async function saveGroup() {
  if (!itineraryGroup.title.trim() || !itineraryGroup.date) {
    ElMessage.warning('請填寫群組名稱與日期。')
    return
  }
  if (itineraryGroup.endTime && itineraryGroup.time && itineraryGroup.endTime <= itineraryGroup.time) {
    ElMessage.warning('群組結束時間必須晚於開始時間。')
    return
  }

  try {
    const existing = editingGroupId.value ? props.items.find((item) => item.id === editingGroupId.value) : undefined
    const payload = {
      tripId: props.trip.id,
      date: itineraryGroup.date,
      time: itineraryGroup.time || '',
      endTime: itineraryGroup.endTime || '',
      title: itineraryGroup.title.trim(),
      location: itineraryGroup.location.trim(),
      mapUrl: normalizeGoogleMapsUrl(itineraryGroup.mapUrl),
      imageUrl: '',
      note: itineraryGroup.note.trim(),
      type: '地點群組',
      activityKind: 'group' as const,
      parentFreeActivityId: '',
      ownerId: '',
    }
    const group = existing
      ? { ...existing, ...payload }
      : await store.addItem({
          ...payload,
          order: props.items.filter((item) => item.date === itineraryGroup.date && !item.itineraryGroupId).length,
        })

    if (existing) await store.updateItem(group)

    const selected = new Set(groupMemberIds.value)
    await Promise.all(
      props.items
        .filter(
          (item) =>
            item.date === itineraryGroup.date &&
            item.id !== group.id &&
            (item.activityKind || 'shared') === 'shared' &&
            (item.itineraryGroupId === group.id || selected.has(item.id)),
        )
        .map((item) => store.updateItem({ ...item, itineraryGroupId: selected.has(item.id) ? group.id : '' })),
    )
    showGroupForm.value = false
    editingGroupId.value = null
    groupMemberIds.value = []
    ElMessage.success(existing ? '地點群組已更新。' : '已建立地點群組。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存地點群組。')
  }
}

async function dissolveGroup(group: ItineraryItem) {
  if (!props.canEdit) return
  try {
    await ElMessageBox.confirm(`解散「${group.title}」後，群組內行程會保留為一般行程。`, '解散地點群組', {
      confirmButtonText: '解散群組',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await Promise.all(
      props.items
        .filter((item) => item.itineraryGroupId === group.id)
        .map((item) => store.updateItem({ ...item, itineraryGroupId: '' })),
    )
    await store.deleteItem(group)
    ElMessage.success('地點群組已解散，原行程已保留。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法解散地點群組。')
    }
  }
}

async function deleteGroup(group: ItineraryItem) {
  if (!props.canEdit) return
  const members = props.items.filter((item) => item.itineraryGroupId === group.id)
  try {
    await ElMessageBox.confirm(
      `確定刪除地點群組「${group.title}」嗎？群組內 ${members.length} 筆行程也會一併刪除。`,
      '刪除地點群組',
      {
        confirmButtonText: '刪除群組',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await Promise.all(members.map((item) => store.deleteItem(item)))
    await store.deleteItem(group)
    ElMessage.success('地點群組與群組內行程已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除地點群組。')
    }
  }
}

async function bulkRemoveEntries(entries: ItineraryItem[]) {
  if (!props.canEdit) return
  const uniqueEntries = entries.filter(
    (entry, index, source) => source.findIndex((item) => item.id === entry.id) === index,
  )
  if (!uniqueEntries.length) return
  try {
    await ElMessageBox.confirm(
      `確定刪除已選取的 ${uniqueEntries.length} 筆行程嗎？此操作無法復原。`,
      '批次刪除行程',
      {
        confirmButtonText: '刪除所選行程',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await Promise.all(uniqueEntries.map((entry) => store.deleteItem(entry)))
    ElMessage.success(`已刪除 ${uniqueEntries.length} 筆行程。`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法批次刪除行程。')
    }
  }
}
</script>

<template>
  <section class="trip-itinerary-view" aria-label="每日行程">
    <TripItineraryCard
      :days="days"
      :personal-items="personalItems"
      :shopping-items="shoppingItems"
      :can-edit-trip="canEdit"
      :sorting-enabled="sortingEnabled"
      :format-date="formatDate"
      :duration="duration"
      :time-warning="timeWarning"
      :maps-url="mapsUrl"
      @add="openNewItemForm"
      @add-after="openItemFormAfter"
      @add-personal="openPersonalItemForm"
      @toggle="emit('toggle', $event)"
      @edit="openItemFormForEdit"
      @remove="emit('remove', $event)"
      @create-group="openGroupForm($event.entries)"
      @edit-group="openGroupForm([], $event)"
      @dissolve-group="dissolveGroup"
      @delete-group="deleteGroup"
      @bulk-remove="bulkRemoveEntries"
      @toggle-sorting="emit('toggleSorting')"
      @sort="emit('sort', $event)"
      @sort-group="emit('sortGroup', $event)"
      @sort-personal="emit('sortPersonal', $event)"
      @move="emit('move', $event)"
    />

    <el-dialog v-model="showGroupForm" :title="editingGroupId ? '編輯地點群組' : '建立地點群組'" class="itinerary-group-dialog" width="min(92vw, 560px)">
      <el-form label-position="top">
        <div class="two-col">
          <el-form-item label="群組名稱"><el-input v-model="itineraryGroup.title" placeholder="例如：築地市場探索" /></el-form-item>
          <el-form-item label="區域／地點"><el-input v-model="itineraryGroup.location" placeholder="例如：築地市場" /></el-form-item>
        </div>
        <div class="three-col">
          <el-form-item label="日期"><el-date-picker v-model="itineraryGroup.date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="固定開始時間（選填）"><el-time-picker v-model="itineraryGroup.time" value-format="HH:mm" format="HH:mm" placeholder="未排時間" /></el-form-item>
          <el-form-item label="結束時間（選填）"><el-time-picker v-model="itineraryGroup.endTime" value-format="HH:mm" format="HH:mm" placeholder="選填" /></el-form-item>
        </div>
        <el-form-item label="Google Maps 區域連結（選填）"><el-input v-model="itineraryGroup.mapUrl" placeholder="貼上 Google Maps 區域或地點網址" /></el-form-item>
        <el-form-item label="群組備註（選填）"><el-input v-model="itineraryGroup.note" type="textarea" :rows="2" maxlength="200" show-word-limit /></el-form-item>
        <el-form-item label="群組內行程">
          <el-checkbox-group v-model="groupMemberIds" class="itinerary-group-member-selector">
            <el-checkbox v-for="entry in items.filter((entry) => entry.date === itineraryGroup.date && (entry.activityKind || 'shared') === 'shared')" :key="entry.id" :label="entry.id">
              {{ entry.title }}<small>{{ entry.time || '未排時間' }}・{{ entry.type }}</small>
            </el-checkbox>
          </el-checkbox-group>
          <small>可勾選或取消行程，儲存後會移入或移出這個群組。</small>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="showGroupForm = false">取消</el-button><el-button type="primary" @click="saveGroup">儲存群組</el-button></template>
    </el-dialog>

    <el-dialog v-model="showItem" :title="editingItemId ? `編輯${itemActivityKind === 'free' ? '自由活動' : itemActivityKind === 'personal' ? '我的行程' : '行程'}` : itemActivityKind === 'personal' ? '新增我的行程' : '新增行程'" class="itinerary-dialog" width="min(92vw, 520px)">
      <el-form class="itinerary-form" label-position="top">
        <el-form-item v-if="!editingItemId && itemActivityKind !== 'personal'" label="行程安排方式">
          <el-radio-group v-model="itemActivityKind" class="itinerary-activity-kind"><el-radio-button label="shared">共用行程</el-radio-button><el-radio-button label="free">自由活動</el-radio-button></el-radio-group>
          <small>{{ itemActivityKind === 'free' ? '自由活動會建立一張所有旅伴都看得到的群組卡片；每位旅伴可在其中安排自己的個人行程。' : '共用行程會顯示給所有旅伴，並可從旅遊收藏快速帶入。' }}</small>
        </el-form-item>
        <el-form-item v-if="favorites.length && itemActivityKind !== 'free'" label="從旅遊收藏快速帶入">
          <div class="itinerary-favorite-picker-control"><div class="itinerary-favorite-picker-copy"><strong>{{ itemFavoriteId ? '已選擇旅遊收藏' : '尚未選擇收藏' }}</strong><span>{{ itemFavoriteId ? (favorites.find((entry) => entry.id === itemFavoriteId)?.name || '已選擇項目') : '可從收藏清單帶入名稱、類型、地點與圖片' }}</span></div><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker()">{{ itemFavoriteId ? '更換收藏' : '選擇收藏' }}</el-button></div>
          <small>{{ itemActivityKind === 'personal' ? '會帶入收藏的名稱、地點、Google Maps 與圖片；日期已依自由活動群組設定。' : '日期與時間不會自動設定，請依實際行程選擇。' }}</small>
        </el-form-item>
        <el-form-item :label="itemActivityKind === 'free' ? '自由活動名稱' : '行程名稱'"><el-input v-model="item.title" :placeholder="itemActivityKind === 'free' ? '例如：下午自由活動、分組逛街' : itemActivityKind === 'personal' ? '例如：前往秋葉原' : ''" /></el-form-item>
        <el-form-item v-if="itemActivityKind !== 'personal'" label="日期"><el-date-picker v-model="item.date" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item>
        <el-form-item v-if="itemActivityKind === 'shared' && itineraryGroupsForItem.length" label="加入地點群組（選填）"><el-select v-model="itemItineraryGroupId" clearable placeholder="不加入群組"><el-option v-for="group in itineraryGroupsForItem" :key="group.id" :label="`${group.title}・${group.location || '未設定區域'}`" :value="group.id" /></el-select><small>可將這筆行程加入當日既有群組；留白則維持一般共用行程。</small></el-form-item>
        <div class="itinerary-time-grid"><el-form-item label="開始時間"><el-time-picker v-model="item.time" value-format="HH:mm" format="HH:mm" placeholder="選擇開始時間" /></el-form-item><el-form-item label="結束時間"><el-time-picker v-model="item.endTime" value-format="HH:mm" format="HH:mm" placeholder="選擇結束時間（選填）" /></el-form-item></div>
        <el-form-item v-if="itemActivityKind !== 'free'" label="類型"><el-select v-model="item.type"><el-option label="景點" value="景點" /><el-option label="餐廳" value="餐廳" /><el-option label="交通" value="交通" /><el-option label="住宿" value="住宿" /><el-option label="商店" value="商店" /></el-select></el-form-item>
        <el-form-item v-if="itemActivityKind !== 'free' && item.type === '交通'" label="抵達站／目的地（選填）"><div class="itinerary-favorite-picker-control transport-destination-control"><div class="itinerary-favorite-picker-copy"><strong>{{ item.transportDestinationName || '尚未選擇抵達站' }}</strong><span>{{ item.transportDestinationLocation || (item.transportDestinationMapUrl ? '已設定 Google Maps 連結' : '從旅遊收藏選擇下車站或目的地') }}</span></div><div class="transport-destination-actions"><el-button v-if="item.transportDestinationName" text class="transport-destination-clear" aria-label="清除抵達站" @click="Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' })">清除</el-button><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker('destination')">{{ item.transportDestinationName ? '更換抵達站' : '選擇抵達站' }}</el-button></div></div><small>可選交通站、景點、住宿等任何收藏項目；設定後行程卡片會顯示出發站 → 抵達站。</small></el-form-item>
        <el-form-item v-if="itemActivityKind !== 'free'" label="Google Maps 景點網址（選填）"><el-input v-model="item.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>行程卡片會直接開啟此景點；既有的地點文字資料會保留。</small></el-form-item>
        <el-form-item v-if="itemActivityKind !== 'free'" label="行程圖片網址（選填）"><el-input v-model="item.imageUrl" placeholder="貼上圖片網址，例如 https://..." /><div v-if="item.imageUrl" class="itinerary-form-image-preview"><img :src="item.imageUrl" alt="行程圖片預覽" /><div><strong>行程圖片預覽</strong><span>從旅遊收藏帶入或使用此網址顯示</span></div></div><small>圖片會以縮圖顯示在每日行程卡片；從旅遊收藏帶入時會自動填入。</small></el-form-item>
        <el-form-item label="備註（選填）"><el-input v-model="item.note" type="textarea" :rows="3" maxlength="240" show-word-limit placeholder="例如：預約資訊、集合地點或注意事項" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="savingItem" @click="showItem = false">取消</el-button><el-button type="primary" :loading="savingItem" :disabled="savingItem" @click="saveItem">儲存行程</el-button></template>
    </el-dialog>

    <el-dialog v-model="showFavoritePicker" :title="favoritePickerTarget === 'destination' ? '選擇抵達站／目的地' : '選擇旅遊收藏'" class="favorite-picker-dialog" width="min(92vw, 660px)" append-to-body>
      <div class="favorite-picker-toolbar"><el-input v-model="favoritePickerSearch" clearable placeholder="搜尋收藏名稱、地點或備註" aria-label="搜尋旅遊收藏" /><div class="favorite-picker-filters" role="group" aria-label="篩選收藏類型"><el-button v-for="option in favoritePickerOptions" :key="option.value" class="favorite-picker-filter" :class="[{ 'is-active': favoritePickerType === option.value }, option.value === 'all' ? '' : `type-${option.value}`]" :aria-pressed="favoritePickerType === option.value" @click="favoritePickerType = option.value">{{ option.label }}<small>{{ option.value === 'all' ? favorites.length : favorites.filter((entry) => normalizeFavoriteType(entry.type) === option.value).length }}</small></el-button></div></div>
      <div v-if="filteredFavoritesForPicker.length" class="favorite-picker-list"><button v-for="savedFavorite in filteredFavoritesForPicker" :key="savedFavorite.id" type="button" class="favorite-picker-row" :class="{ 'is-selected': favoritePickerTarget === 'destination' ? item.transportDestinationFavoriteId === savedFavorite.id : itemFavoriteId === savedFavorite.id }" @click="selectFavoriteForItem(savedFavorite.id)"><img v-if="savedFavorite.imageUrl" :src="savedFavorite.imageUrl" :alt="`${savedFavorite.name} 圖片`" /><span v-else class="favorite-picker-placeholder">{{ favoriteTypeLabel(savedFavorite.type).slice(0, 1) }}</span><span class="favorite-picker-row-copy"><strong>{{ savedFavorite.name }}</strong><span class="favorite-picker-type" :class="`type-${normalizeFavoriteType(savedFavorite.type)}`">{{ favoriteTypeLabel(savedFavorite.type) }}</span><small v-if="savedFavorite.location">{{ savedFavorite.location }}</small><small v-else-if="savedFavorite.mapUrl" class="favorite-picker-map-status">已設定 Google Maps 連結</small><small v-else>未填寫地點名稱或地圖連結</small></span><span class="favorite-picker-select">{{ favoritePickerTarget === 'destination' ? '設為抵達站' : '帶入' }}</span></button></div>
      <div v-else class="favorite-picker-empty"><strong>找不到符合的收藏</strong><p>試試其他關鍵字或類別。</p></div>
      <template #footer><el-button @click="showFavoritePicker = false">取消</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-itinerary-view{display:grid;min-width:0}.two-col,.three-col,.itinerary-time-grid{display:grid;gap:12px}.two-col,.itinerary-time-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.three-col{grid-template-columns:repeat(3,minmax(0,1fr))}.three-col :deep(.el-date-editor),.three-col :deep(.el-time-picker),.itinerary-time-grid :deep(.el-time-picker),.itinerary-form :deep(.el-date-editor),.itinerary-form :deep(.el-select){width:100%}.itinerary-form small{display:block;margin-top:5px;color:#71827c;font-size:12px;line-height:1.5}.itinerary-favorite-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #dce8e2;border-radius:10px;background:#fbfdfc}.itinerary-favorite-picker-copy{display:grid;min-width:0;gap:2px}.itinerary-favorite-picker-copy strong,.itinerary-favorite-picker-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itinerary-favorite-picker-copy strong{color:#244a43;font-size:13px}.itinerary-favorite-picker-copy span{color:#71827c;font-size:12px}.itinerary-favorite-picker-button{flex:0 0 auto;min-height:36px;border-color:#bfd7cd;color:#236c59;font-weight:700}.transport-destination-actions{display:flex;flex:0 0 auto;align-items:center;gap:4px}.transport-destination-clear{color:#a96a50}.itinerary-form-image-preview{display:flex;align-items:center;gap:10px;margin-top:9px;padding:8px;border:1px solid #e1e8e3;border-radius:10px;background:#fbfcfa}.itinerary-form-image-preview img{width:52px;height:52px;border-radius:8px;object-fit:cover}.itinerary-form-image-preview div{display:grid;gap:2px}.itinerary-form-image-preview strong{color:#244a43;font-size:13px}.itinerary-form-image-preview span{color:#71827c;font-size:12px}.itinerary-group-member-selector{display:grid;gap:7px}.itinerary-group-member-selector :deep(.el-checkbox){height:auto;margin-right:0;white-space:normal}.itinerary-group-member-selector small{display:block;margin:2px 0 0;color:#71827c;font-size:12px}.favorite-picker-toolbar{display:grid;gap:12px}.favorite-picker-filters{display:flex;flex-wrap:wrap;gap:7px}.favorite-picker-filter{min-height:34px;margin:0;border-color:#d9e6e0;color:#477168}.favorite-picker-filter.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.favorite-picker-filter small{margin-left:4px;font-size:11px}.favorite-picker-list{display:grid;gap:9px;max-height:52vh;margin-top:14px;overflow:auto}.favorite-picker-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:9px;border:1px solid #e1e8e3;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.favorite-picker-row:hover,.favorite-picker-row.is-selected{border-color:#9fc8b8;background:#f5faf7}.favorite-picker-row img,.favorite-picker-placeholder{display:grid;width:48px;height:48px;place-items:center;border-radius:9px;background:#eef5f0;color:#347965;object-fit:cover;font-weight:800}.favorite-picker-row-copy{display:grid;min-width:0;gap:3px}.favorite-picker-row-copy strong,.favorite-picker-row-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.favorite-picker-row-copy strong{color:#244a43;font-size:14px}.favorite-picker-row-copy small{color:#71827c;font-size:12px}.favorite-picker-type{width:max-content;padding:2px 6px;border-radius:999px;background:#eaf4ef;color:#3b7868;font-size:11px;font-weight:700}.favorite-picker-select{color:#2f7d70;font-size:13px;font-weight:800;white-space:nowrap}.favorite-picker-empty{padding:30px 10px;text-align:center;color:#71827c}.favorite-picker-empty strong{color:#244a43}.favorite-picker-empty p{margin:5px 0 0;font-size:13px}@media(max-width:600px){.two-col,.three-col,.itinerary-time-grid{grid-template-columns:1fr}.itinerary-group-dialog :deep(.el-dialog__body),.itinerary-dialog :deep(.el-dialog__body),.favorite-picker-dialog :deep(.el-dialog__body){padding:16px}.itinerary-group-dialog :deep(.el-dialog__footer),.itinerary-dialog :deep(.el-dialog__footer),.favorite-picker-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}.itinerary-favorite-picker-control{align-items:stretch;flex-direction:column}.itinerary-favorite-picker-button{width:100%}.transport-destination-actions{display:grid;grid-template-columns:1fr 1fr}.favorite-picker-row{grid-template-columns:44px minmax(0,1fr)}.favorite-picker-row img,.favorite-picker-placeholder{width:44px;height:44px}.favorite-picker-select{grid-column:2;justify-self:start}}
</style>
