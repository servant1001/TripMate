<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripAlbumCard from '../components/TripAlbumCard.vue'
import type { AlbumPhoto, ItineraryItem, Trip } from '../types'
import { useTripStore } from '../stores/trip'
import { uploadTripImage } from '../services/cloudinary'

const props = defineProps<{ trip: Trip; photos: AlbumPhoto[]; items: ItineraryItem[]; canEdit: boolean; userId: string; memberName: (id: string) => string; formatDate: (date: string) => string }>()
const store = useTripStore()
const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const file = ref<File>()
const preview = ref('')
const form = reactive({ caption: '', tripDate: '', itineraryItemId: '' })

function clearPreview() { if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value); preview.value = '' }
function resetForm() { clearPreview(); file.value = undefined; editingId.value = null; Object.assign(form, { caption: '', tripDate: '', itineraryItemId: '' }) }
function selectPhoto(event: Event) { const selected = (event.target as HTMLInputElement).files?.[0]; if (!selected) return; if (!selected.type.startsWith('image/')) return ElMessage.warning('請選擇圖片檔案。'); if (selected.size > 10 * 1024 * 1024) return ElMessage.warning('圖片大小請控制在 10 MB 以內。'); clearPreview(); file.value = selected; preview.value = URL.createObjectURL(selected) }
function openForm(existing?: AlbumPhoto) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); resetForm(); editingId.value = existing?.id || null; Object.assign(form, existing ? { caption: existing.caption || '', tripDate: existing.tripDate || '', itineraryItemId: existing.itineraryItemId || '' } : { caption: '', tripDate: '', itineraryItemId: '' }); preview.value = existing?.imageUrl || ''; open.value = true }
async function save() {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
  const existing = editingId.value ? props.photos.find((entry) => entry.id === editingId.value) : undefined
  if (!existing && !file.value) return ElMessage.warning('請選擇要上傳的照片。')
  saving.value = true
  try { const imageUrl = file.value ? await uploadTripImage(file.value, 'album', props.trip.id) : existing?.imageUrl || ''; const payload = { tripId: props.trip.id, imageUrl, caption: form.caption.trim(), tripDate: form.tripDate || '', itineraryItemId: form.itineraryItemId || '', uploadedBy: props.userId || props.trip.ownerId }; if (existing) await store.updateAlbumPhoto({ ...existing, ...payload }); else await store.addAlbumPhoto(payload); open.value = false; resetForm(); ElMessage.success(existing ? '相片資訊已更新。' : '照片已加入旅行相簿。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存旅行相片。') } finally { saving.value = false }
}
async function remove(photo: AlbumPhoto) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。'); try { await ElMessageBox.confirm('確定從旅行相簿移除這張照片嗎？', '刪除旅行相片', { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }); await store.deleteAlbumPhoto(photo); ElMessage.success('相片已從相簿移除。') } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行相片。') } }
onBeforeUnmount(clearPreview)
</script>

<template>
  <section class="trip-album-view" aria-label="旅行相簿">
    <TripAlbumCard :trip="trip" :photos="photos" :can-edit-trip="canEdit" :member-name="memberName" :format-date="formatDate" @add="openForm()" @edit="openForm" @remove="remove" />
    <el-dialog v-model="open" :title="editingId ? '編輯旅行相片' : '上傳旅行相片'" class="album-dialog" width="min(92vw, 520px)" @closed="resetForm">
      <el-form label-position="top">
        <el-form-item label="照片"><div class="album-upload-control"><img v-if="preview" :src="preview" alt="旅行相片預覽" /><div v-else class="album-upload-placeholder" aria-hidden="true">✦</div><div class="album-upload-actions"><label class="album-upload-file-button" for="album-photo-file">{{ preview ? '更換照片' : '選擇照片' }}</label><input id="album-photo-file" type="file" accept="image/*" @change="selectPhoto" /><small>支援圖片檔，大小上限 10 MB；儲存時會安全地上傳到 Cloudinary。</small></div></div></el-form-item>
        <div class="two-col"><el-form-item label="旅行日期（選填）"><el-date-picker v-model="form.tripDate" type="date" value-format="YYYY-MM-DD" placeholder="選擇拍攝日期" /></el-form-item><el-form-item label="關聯行程（選填）"><el-select v-model="form.itineraryItemId" clearable placeholder="選擇行程"><el-option v-for="entry in items" :key="entry.id" :label="`${entry.date}・${entry.title}`" :value="entry.id" /></el-select></el-form-item></div>
        <el-form-item label="相片說明（選填）"><el-input v-model="form.caption" type="textarea" :rows="3" maxlength="160" show-word-limit placeholder="例如：淺草寺傍晚的天空" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="open = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="saving" @click="save">{{ editingId ? '儲存變更' : '上傳照片' }}</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>.trip-album-view{display:grid;grid-column:1/-1;min-width:0}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.album-upload-control{display:flex;gap:14px;align-items:center}.album-upload-control img,.album-upload-placeholder{width:88px;height:88px;flex:0 0 88px;border-radius:12px;object-fit:cover}.album-upload-placeholder{display:grid;place-items:center;background:#eef5f0;color:#2f7d70;font-size:26px}.album-upload-actions{display:grid;gap:7px;min-width:0}.album-upload-actions input{position:absolute;width:1px;height:1px;opacity:0}.album-upload-file-button{display:inline-flex;width:max-content;min-height:40px;align-items:center;padding:0 13px;border:1px solid #bfd7cd;border-radius:10px;color:#236c59;font-weight:700;cursor:pointer}.album-upload-actions small{color:#6b7d78;line-height:1.5}@media(max-width:560px){.two-col{grid-template-columns:1fr}.album-upload-control{align-items:flex-start}.album-upload-control img,.album-upload-placeholder{width:74px;height:74px;flex-basis:74px}}</style>
