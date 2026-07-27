<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripItineraryCard from '../components/TripItineraryCard.vue'
import { useTripStore } from '../stores/trip'
import type { ItineraryItem, ShoppingItem, Trip } from '../types'

type Day = { date: string; entries: ItineraryItem[] }

const props = defineProps<{
  trip: Trip
  items: ItineraryItem[]
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
  add: []
  addAfter: [entry: ItineraryItem]
  addPersonal: [group: ItineraryItem]
  toggle: [entry: ItineraryItem]
  edit: [entry: ItineraryItem]
  remove: [entry: ItineraryItem]
  toggleSorting: []
  sort: [payload: { date: string; oldIndex: number; newIndex: number }]
  sortPersonal: [payload: { parentId: string; oldIndex: number; newIndex: number }]
  sortGroup: [payload: { groupId: string; oldIndex: number; newIndex: number }]
  move: [payload: { itemId: string; from: string; to: string; oldIndex: number; newIndex: number }]
}>()

const store = useTripStore()
const showGroupForm = ref(false)
const editingGroupId = ref<string | null>(null)
const groupMemberIds = ref<string[]>([])
const itineraryGroup = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', note: '' })

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
      @add="emit('add')"
      @add-after="emit('addAfter', $event)"
      @add-personal="emit('addPersonal', $event)"
      @toggle="emit('toggle', $event)"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
      @create-group="openGroupForm($event.entries)"
      @edit-group="openGroupForm([], $event)"
      @dissolve-group="dissolveGroup"
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
  </section>
</template>

<style scoped>
.trip-itinerary-view{display:grid;min-width:0}.two-col,.three-col{display:grid;gap:12px}.two-col{grid-template-columns:repeat(2,minmax(0,1fr))}.three-col{grid-template-columns:repeat(3,minmax(0,1fr))}.three-col :deep(.el-date-editor),.three-col :deep(.el-time-picker){width:100%}.itinerary-group-member-selector{display:grid;gap:7px}.itinerary-group-member-selector :deep(.el-checkbox){height:auto;margin-right:0;white-space:normal}.itinerary-group-member-selector small{display:block;margin:2px 0 0;color:#71827c;font-size:12px}@media(max-width:600px){.two-col,.three-col{grid-template-columns:1fr}.itinerary-group-dialog :deep(.el-dialog__body){padding:16px}.itinerary-group-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}}
</style>
