<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripPackingCard from '../components/TripPackingCard.vue'
import type { PackingItem, Trip } from '../types'
import { useTripStore } from '../stores/trip'

type PackingGroup = 'shared' | 'personal'

const props = defineProps<{ trip: Trip; items: PackingItem[]; canEdit: boolean; userId: string; memberName: (id: string) => string }>()
const store = useTripStore()
const open = ref(false)
const editingId = ref<string | null>(null)
const sortingEnabled = ref(false)
const form = reactive({ name: '', category: '衣物', quantity: 1, assignedTo: '', isShared: false, note: '' })

function openForm(existing?: PackingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。')
  editingId.value = existing?.id || null
  Object.assign(form, existing ? { name: existing.name, category: existing.category, quantity: existing.quantity, assignedTo: existing.assignedTo || '', isShared: existing.isShared, note: existing.note || '' } : { name: '', category: '衣物', quantity: 1, assignedTo: '', isShared: false, note: '' })
  open.value = true
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('請填寫物品名稱。')
  try {
    const payload = { tripId: props.trip.id, name: form.name.trim(), category: form.category, quantity: Math.max(1, Number(form.quantity) || 1), assignedTo: form.assignedTo || '', isShared: form.isShared, note: form.note.trim(), createdBy: props.userId || props.trip.ownerId }
    const existing = editingId.value ? props.items.find((entry) => entry.id === editingId.value) : undefined
    if (existing) await store.updatePackingItem({ ...existing, ...payload })
    else await store.addPackingItem({ ...payload, order: props.items.filter((entry) => entry.isShared === form.isShared).length })
    open.value = false
    editingId.value = null
    ElMessage.success('行李物品已儲存。')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存行李物品。') }
}

async function toggle(item: PackingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。')
  try { await store.togglePackingItem(item) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行李狀態。') }
}

function toggleSorting() {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。')
  sortingEnabled.value = !sortingEnabled.value
  ElMessage.info(sortingEnabled.value ? '已啟用排序：長按拖曳把手可調整行李順序。' : '行李排序已保存。')
}

async function sort({ group, oldIndex, newIndex, itemIds }: { group: PackingGroup; oldIndex: number; newIndex: number; itemIds: string[] }) {
  if (!props.canEdit || !sortingEnabled.value || oldIndex === newIndex) return
  const isShared = group === 'shared'
  const allItems = props.items.filter((entry) => entry.isShared === isShared).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.createdAt - b.createdAt)
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= itemIds.length || newIndex >= itemIds.length) return
  const reorderedVisibleIds = [...itemIds]
  const [movedId] = reorderedVisibleIds.splice(oldIndex, 1)
  if (!movedId) return
  reorderedVisibleIds.splice(newIndex, 0, movedId)
  const itemsById = new Map(allItems.map((entry) => [entry.id, entry]))
  let visibleIndex = 0
  const reordered = allItems.map((entry) => itemIds.includes(entry.id) ? itemsById.get(reorderedVisibleIds[visibleIndex++]) || entry : entry)
  try { await store.reorderPackingItems(reordered) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新行李排序。') }
}

async function remove(item: PackingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行李清單，無法修改。')
  try {
    await ElMessageBox.confirm(`確定刪除物品「${item.name}」嗎？`, '刪除行李物品', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' })
    await store.deletePackingItem(item)
    ElMessage.success('行李物品已刪除。')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除行李物品。') }
}
</script>

<template>
  <section class="trip-packing-view" aria-label="行李清單">
    <TripPackingCard :trip="trip" :items="items" :can-edit-trip="canEdit" :sorting-enabled="sortingEnabled" :member-name="memberName" @add="openForm()" @toggle="toggle" @toggle-sorting="toggleSorting" @sort="sort" @edit="openForm" @remove="remove" />
    <el-dialog v-model="open" :title="editingId ? '編輯行李物品' : '新增行李物品'" width="min(92vw, 500px)">
      <el-form label-position="top">
        <el-form-item label="物品名稱"><el-input v-model="form.name" placeholder="例如：行動電源" /></el-form-item>
        <div class="two-col"><el-form-item label="分類"><el-select v-model="form.category"><el-option label="衣物" value="衣物" /><el-option label="盥洗用品" value="盥洗用品" /><el-option label="電子用品" value="電子用品" /><el-option label="證件" value="證件" /><el-option label="藥品" value="藥品" /><el-option label="其他" value="其他" /></el-select></el-form-item><el-form-item label="數量"><el-input-number v-model="form.quantity" :min="1" :max="99" controls-position="right" /></el-form-item></div>
        <el-form-item label="物品類型"><el-radio-group v-model="form.isShared"><el-radio :value="false">個人物品</el-radio><el-radio :value="true">共用物品</el-radio></el-radio-group><small>{{ form.isShared ? '共用物品會顯示在全體旅伴一起準備的清單。' : '個人物品可指定一位負責旅伴。' }}</small></el-form-item>
        <el-form-item label="負責旅伴（選填）"><el-select v-model="form.assignedTo" clearable placeholder="尚未指派"><el-option v-for="member in trip.members" :key="member.id" :label="member.name" :value="member.id" /></el-select></el-form-item>
        <el-form-item label="備註（選填）"><el-input v-model="form.note" maxlength="80" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" @click="save">儲存物品</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>.trip-packing-view{display:grid;grid-column:1/-1;min-width:0}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.two-col{grid-template-columns:1fr}}</style>
