<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripFavoriteCard from '../components/TripFavoriteCard.vue'
import type { Favorite, FavoriteType, Trip } from '../types'
import { useTripStore } from '../stores/trip'

const props = defineProps<{ trip: Trip; favorites: Favorite[]; currency: string; canEdit: boolean; userId: string; actorName: string; memberName: (id: string) => string }>()
const emit = defineEmits<{ addToItinerary: [favorite: Favorite] }>()
const store = useTripStore()
const open = ref(false)
const editingId = ref<string | null>(null)
const sortingEnabled = ref(false)
const form = reactive({ name: '', type: 'attraction' as FavoriteType, location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' })
const editingFavorite = computed(() => editingId.value ? props.favorites.find((entry) => entry.id === editingId.value) : undefined)
const creatorName = computed(() => editingFavorite.value ? props.memberName(editingFavorite.value.createdBy) : props.actorName)
const modifierName = computed(() => editingFavorite.value ? props.memberName(editingFavorite.value.updatedBy || editingFavorite.value.createdBy) : props.actorName)

function normalizeType(type: FavoriteType): FavoriteType { return type === 'cafe' ? 'restaurant' : type === 'alternative' || type === 'other' ? 'attraction' : type }
function normalizeGoogleMapsUrl(value: string) { const raw = value.trim(); if (!raw) return ''; const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; try { const hostname = new URL(normalized).hostname.toLowerCase(); if (!/(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') throw new Error(); return normalized } catch { throw new Error('請貼上有效的 Google Maps 景點網址。') } }
function normalizeUrl(value: string) { const raw = value.trim(); return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw }

function openForm(existing?: Favorite) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
  editingId.value = existing?.id || null
  Object.assign(form, existing ? { name: existing.name, type: normalizeType(existing.type), location: existing.location || '', mapUrl: existing.mapUrl || '', website: existing.website || '', imageUrl: existing.imageUrl || '', estimatedCost: existing.estimatedCost || 0, recommendedBy: existing.recommendedBy || '', note: existing.note || '' } : { name: '', type: 'attraction', location: '', mapUrl: '', website: '', imageUrl: '', estimatedCost: 0, recommendedBy: '', note: '' })
  open.value = true
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('請填寫收藏名稱。')
  try {
    const actorId = props.userId || props.trip.ownerId
    const payload = { tripId: props.trip.id, name: form.name.trim(), type: form.type, location: form.location.trim(), mapUrl: normalizeGoogleMapsUrl(form.mapUrl), website: normalizeUrl(form.website), imageUrl: normalizeUrl(form.imageUrl), estimatedCost: Math.max(0, Number(form.estimatedCost) || 0), recommendedBy: form.recommendedBy.trim(), note: form.note.trim(), createdBy: actorId, updatedBy: actorId, updatedAt: Date.now() }
    const existing = editingId.value ? props.favorites.find((entry) => entry.id === editingId.value) : undefined
    if (existing) await store.updateFavorite({ ...existing, ...payload, createdBy: existing.createdBy })
    else await store.addFavorite(payload)
    open.value = false
    editingId.value = null
    ElMessage.success('旅遊收藏已儲存。')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅遊收藏。') }
}

async function remove(item: Favorite) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
  try { await ElMessageBox.confirm(`確定刪除收藏「${item.name}」嗎？`, '刪除旅遊收藏', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteFavorite(item); ElMessage.success('旅遊收藏已刪除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅遊收藏。') }
}

async function duplicate(item: Favorite) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
  try { const actorId = props.userId || props.trip.ownerId; await store.addFavorite({ tripId: props.trip.id, name: `${item.name}（副本）`, type: item.type, location: item.location || '', mapUrl: item.mapUrl || '', website: item.website || '', imageUrl: item.imageUrl || '', estimatedCost: item.estimatedCost || 0, recommendedBy: item.recommendedBy || '', note: item.note || '', order: Date.now(), createdBy: actorId, updatedBy: actorId, updatedAt: Date.now() }); ElMessage.success('已複製收藏，可再編輯副本。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法複製旅遊收藏。') }
}

function toggleSorting() { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。'); sortingEnabled.value = !sortingEnabled.value; ElMessage.info(sortingEnabled.value ? '已啟用排序：長按拖曳把手可調整收藏順序。' : '收藏排序已保存。') }
async function sort({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
  if (!props.canEdit || !sortingEnabled.value || oldIndex === newIndex) return
  const favorites = [...props.favorites].sort((a, b) => { const aHasOrder = a.order !== undefined; const bHasOrder = b.order !== undefined; if (aHasOrder && bHasOrder) return (a.order || 0) - (b.order || 0); if (aHasOrder) return -1; if (bHasOrder) return 1; return Number(a.addedToItinerary) - Number(b.addedToItinerary) || b.createdAt - a.createdAt })
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= favorites.length || newIndex >= favorites.length) return
  const [moved] = favorites.splice(oldIndex, 1)
  if (!moved) return
  favorites.splice(newIndex, 0, moved)
  try { await store.reorderFavorites(favorites) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法更新收藏排序。') }
}
</script>

<template>
  <section class="trip-favorites-view" aria-label="旅遊收藏">
    <TripFavoriteCard :trip="trip" :favorites="favorites" :currency="currency" :can-edit-trip="canEdit" :sorting-enabled="sortingEnabled" :member-name="memberName" @add="openForm()" @edit="openForm" @duplicate="duplicate" @remove="remove" @add-to-itinerary="emit('addToItinerary', $event)" @toggle-sorting="toggleSorting" @sort="sort" />
    <el-dialog v-model="open" :title="editingId ? '編輯旅遊收藏' : '新增旅遊收藏'" width="min(92vw, 560px)">
      <el-form label-position="top">
        <div class="two-col favorite-audit-fields"><el-form-item label="建立人"><el-input :model-value="creatorName" readonly aria-label="建立人" /></el-form-item><el-form-item label="修改人"><el-input :model-value="modifierName" readonly aria-label="修改人" /></el-form-item></div>
        <div class="two-col"><el-form-item label="收藏類型"><el-select v-model="form.type"><el-option label="景點" value="attraction" /><el-option label="餐廳" value="restaurant" /><el-option label="交通" value="transport" /><el-option label="住宿" value="stay" /><el-option label="商店" value="shop" /></el-select><small>類型與每日行程一致，加入行程時會直接帶入。</small></el-form-item><el-form-item label="名稱"><el-input v-model="form.name" placeholder="例如：淺草寺" /></el-form-item></div>
        <el-form-item label="Google Maps 景點網址（選填）"><el-input v-model="form.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>收藏帶入行程時，這個網址會一併帶入。</small></el-form-item>
        <div class="two-col"><el-form-item label="網站（選填）"><el-input v-model="form.website" placeholder="https://example.com" /></el-form-item><el-form-item label="預估費用（選填）"><el-input-number v-model="form.estimatedCost" :min="0" :step="100" controls-position="right" /></el-form-item></div>
        <div class="two-col"><el-form-item label="推薦人（選填）"><el-input v-model="form.recommendedBy" placeholder="例如：林恩威、旅遊文章" /></el-form-item><el-form-item label="圖片網址（選填）"><el-input v-model="form.imageUrl" placeholder="https://..." /></el-form-item></div>
        <el-form-item label="備註（選填）"><el-input v-model="form.note" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="想去的原因、開放時間或注意事項" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" @click="save">儲存收藏</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>.trip-favorites-view{display:grid;grid-column:1/-1;min-width:0}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.favorite-audit-fields :deep(.el-input.is-disabled .el-input__wrapper),.favorite-audit-fields :deep(.el-input__wrapper){background:#f7faf8}@media(max-width:560px){.two-col{grid-template-columns:1fr}}</style>
