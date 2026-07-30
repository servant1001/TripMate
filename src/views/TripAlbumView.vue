<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripAlbumCard from '../components/TripAlbumCard.vue'
import type { AlbumFolder, AlbumPhoto, ItineraryItem, Trip } from '../types'
import { useTripStore } from '../stores/trip'
import { uploadTripImage } from '../services/cloudinary'

const props = defineProps<{
  trip: Trip
  folders: AlbumFolder[]
  photos: AlbumPhoto[]
  items: ItineraryItem[]
  canEdit: boolean
  userId: string
  memberName: (id: string) => string
  formatDate: (date: string) => string
}>()

const store = useTripStore()

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const file = ref<File>()
const preview = ref('')
const form = reactive({
  caption: '',
  tripDate: '',
  itineraryItemId: '',
  folderId: '',
})

const folderOpen = ref(false)
const folderSaving = ref(false)
const editingFolderId = ref<string | null>(null)
const folderForm = reactive({ name: '' })

const selectionMode = ref(false)
const selectedPhotoIds = ref<string[]>([])

const sortedFolders = computed(() =>
  [...props.folders].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt - b.createdAt,
  ),
)

const folderOptions = computed(() => [
  { id: '', name: '未分類' },
  ...sortedFolders.value.map((folder) => ({ id: folder.id, name: folder.name })),
])

function clearPreview() {
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  preview.value = ''
}

function resetForm() {
  clearPreview()
  file.value = undefined
  editingId.value = null
  Object.assign(form, {
    caption: '',
    tripDate: '',
    itineraryItemId: '',
    folderId: '',
  })
}

function resetFolderForm() {
  editingFolderId.value = null
  folderForm.name = ''
}

function selectPhoto(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  if (!selected.type.startsWith('image/')) {
    ElMessage.warning('請選擇圖片檔案。')
    return
  }
  if (selected.size > 10 * 1024 * 1024) {
    ElMessage.warning('圖片大小請控制在 10 MB 以內。')
    return
  }
  clearPreview()
  file.value = selected
  preview.value = URL.createObjectURL(selected)
}

function openForm(existing?: AlbumPhoto, folderId?: string) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  resetForm()
  editingId.value = existing?.id || null
  Object.assign(
    form,
    existing
      ? {
          caption: existing.caption || '',
          tripDate: existing.tripDate || '',
          itineraryItemId: existing.itineraryItemId || '',
          folderId: existing.folderId || '',
        }
      : {
          caption: '',
          tripDate: '',
          itineraryItemId: '',
          folderId: folderId || '',
        },
  )
  preview.value = existing?.imageUrl || ''
  open.value = true
}

async function save() {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  const existing = editingId.value
    ? props.photos.find((entry) => entry.id === editingId.value)
    : undefined
  if (!existing && !file.value) {
    ElMessage.warning('請選擇要上傳的照片。')
    return
  }

  saving.value = true
  try {
    const imageUrl = file.value
      ? await uploadTripImage(file.value, 'album', props.trip.id)
      : existing?.imageUrl || ''
    const payload = {
      tripId: props.trip.id,
      imageUrl,
      caption: form.caption.trim(),
      tripDate: form.tripDate || '',
      itineraryItemId: form.itineraryItemId || '',
      folderId: form.folderId || undefined,
      uploadedBy: props.userId || props.trip.ownerId,
      order: existing?.order ?? Date.now(),
    }
    if (existing) await store.updateAlbumPhoto({ ...existing, ...payload })
    else await store.addAlbumPhoto(payload)
    open.value = false
    resetForm()
    ElMessage.success(existing ? '相片資訊已更新。' : '照片已加入旅行相簿。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存旅行相片。')
  } finally {
    saving.value = false
  }
}

function openFolderForm(existing?: AlbumFolder) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  resetFolderForm()
  editingFolderId.value = existing?.id || null
  folderForm.name = existing?.name || ''
  folderOpen.value = true
}

async function saveFolder() {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  const name = folderForm.name.trim()
  if (!name) {
    ElMessage.warning('請輸入資料夾名稱。')
    return
  }

  const existing = editingFolderId.value
    ? props.folders.find((folder) => folder.id === editingFolderId.value)
    : undefined

  folderSaving.value = true
  try {
    if (existing) {
      await store.updateAlbumFolder({ ...existing, name })
    } else {
      await store.addAlbumFolder({
        tripId: props.trip.id,
        name,
        order: props.folders.length,
        createdBy: props.userId || props.trip.ownerId,
      })
    }
    folderOpen.value = false
    resetFolderForm()
    ElMessage.success(existing ? '資料夾名稱已更新。' : '已建立新資料夾。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存資料夾。')
  } finally {
    folderSaving.value = false
  }
}

async function remove(photo: AlbumPhoto) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  try {
    await ElMessageBox.confirm('確定從旅行相簿移除這張照片嗎？', '刪除旅行相片', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.deleteAlbumPhoto(photo)
    selectedPhotoIds.value = selectedPhotoIds.value.filter((id) => id !== photo.id)
    ElMessage.success('相片已從相簿移除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行相片。')
    }
  }
}

async function removeFolder(folder: AlbumFolder) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行相簿，無法修改。')
    return
  }
  try {
    await ElMessageBox.confirm(
      `確定刪除「${folder.name}」嗎？資料夾內的照片不會被刪除，會自動移回未分類。`,
      '刪除資料夾',
      {
        confirmButtonText: '刪除資料夾',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await store.deleteAlbumFolder(folder)
    ElMessage.success('資料夾已刪除，照片已移回未分類。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除資料夾。')
    }
  }
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) selectedPhotoIds.value = []
}

function togglePhotoSelection(photoId: string, selected: boolean) {
  if (selected) {
    if (!selectedPhotoIds.value.includes(photoId)) {
      selectedPhotoIds.value = [...selectedPhotoIds.value, photoId]
    }
  } else {
    selectedPhotoIds.value = selectedPhotoIds.value.filter((id) => id !== photoId)
  }
}

function selectAllPhotos() {
  selectedPhotoIds.value = props.photos.map((photo) => photo.id)
}

function clearSelection() {
  selectedPhotoIds.value = []
}

async function moveSelectedToFolder(folderId?: string) {
  if (!selectedPhotoIds.value.length) {
    ElMessage.warning('請先選擇要移動的照片。')
    return
  }
  const targets = props.photos.filter((photo) => selectedPhotoIds.value.includes(photo.id))
  try {
    await Promise.all(
      targets.map((photo, index) =>
        store.updateAlbumPhoto({
          ...photo,
          folderId: folderId || undefined,
          order: index,
        }),
      ),
    )
    const label =
      sortedFolders.value.find((folder) => folder.id === folderId)?.name || '未分類'
    selectedPhotoIds.value = []
    selectionMode.value = false
    ElMessage.success(`已將 ${targets.length} 張照片移到「${label}」。`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法移動所選照片。')
  }
}

async function deleteSelectedPhotos() {
  if (!selectedPhotoIds.value.length) {
    ElMessage.warning('請先選擇要刪除的照片。')
    return
  }
  try {
    await ElMessageBox.confirm(
      `確定刪除已選的 ${selectedPhotoIds.value.length} 張照片嗎？`,
      '刪除所選照片',
      {
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const targets = props.photos.filter((photo) => selectedPhotoIds.value.includes(photo.id))
    await Promise.all(targets.map((photo) => store.deleteAlbumPhoto(photo)))
    selectedPhotoIds.value = []
    selectionMode.value = false
    ElMessage.success(`已刪除 ${targets.length} 張照片。`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除所選照片。')
    }
  }
}

async function reorderFolders(folders: AlbumFolder[]) {
  try {
    await store.reorderAlbumFolders(folders)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新資料夾順序。')
  }
}

async function reorderPhotos(photos: AlbumPhoto[]) {
  try {
    await store.reorderAlbumPhotos(photos)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新照片順序。')
  }
}

watch(
  () => props.photos.map((photo) => photo.id).join('|'),
  () => {
    selectedPhotoIds.value = selectedPhotoIds.value.filter((id) =>
      props.photos.some((photo) => photo.id === id),
    )
  },
)

onBeforeUnmount(clearPreview)
</script>

<template>
  <section class="trip-album-view" aria-label="旅行相簿">
    <TripAlbumCard
      :trip="trip"
      :folders="folders"
      :photos="photos"
      :can-edit-trip="canEdit"
      :selection-mode="selectionMode"
      :selected-photo-ids="selectedPhotoIds"
      :member-name="memberName"
      :format-date="formatDate"
      @add="openForm(undefined, $event)"
      @edit="openForm"
      @remove="remove"
      @create-folder="openFolderForm()"
      @rename-folder="openFolderForm"
      @delete-folder="removeFolder"
      @toggle-selection-mode="toggleSelectionMode"
      @toggle-photo-selection="togglePhotoSelection"
      @select-all="selectAllPhotos"
      @clear-selection="clearSelection"
      @bulk-move="moveSelectedToFolder"
      @bulk-delete="deleteSelectedPhotos"
      @reorder-folders="reorderFolders"
      @reorder-photos="reorderPhotos"
    />

    <el-dialog
      v-model="open"
      :title="editingId ? '編輯旅行相片' : '上傳旅行相片'"
      class="album-dialog"
      width="min(92vw, 560px)"
      @closed="resetForm"
    >
      <el-form label-position="top">
        <el-form-item label="照片">
          <div class="album-upload-control">
            <img v-if="preview" :src="preview" alt="旅行相片預覽" />
            <div v-else class="album-upload-placeholder" aria-hidden="true">✦</div>
            <div class="album-upload-actions">
              <label class="album-upload-file-button" for="album-photo-file">
                {{ preview ? '更換照片' : '選擇照片' }}
              </label>
              <input id="album-photo-file" type="file" accept="image/*" @change="selectPhoto" />
              <small>支援圖片檔，大小上限 10 MB；儲存時會安全地上傳到 Cloudinary。</small>
            </div>
          </div>
        </el-form-item>

        <div class="two-col">
          <el-form-item label="所屬資料夾（選填）">
            <el-select v-model="form.folderId" placeholder="選擇資料夾">
              <el-option
                v-for="option in folderOptions"
                :key="option.id || 'root'"
                :label="option.name"
                :value="option.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="旅行日期（選填）">
            <el-date-picker
              v-model="form.tripDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="選擇拍攝日期"
            />
          </el-form-item>
        </div>

        <el-form-item label="關聯行程（選填）">
          <el-select v-model="form.itineraryItemId" clearable placeholder="選擇行程">
            <el-option
              v-for="entry in items"
              :key="entry.id"
              :label="`${entry.date}・${entry.title}`"
              :value="entry.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="相片說明（選填）">
          <el-input
            v-model="form.caption"
            type="textarea"
            :rows="3"
            maxlength="160"
            show-word-limit
            placeholder="例如：築地市場早餐、晴空塔夜景、旅伴合照"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="open = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="saving" @click="save">
          {{ editingId ? '儲存變更' : '上傳照片' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="folderOpen"
      :title="editingFolderId ? '重新命名資料夾' : '建立相簿資料夾'"
      class="album-dialog"
      width="min(92vw, 420px)"
      @closed="resetFolderForm"
    >
      <el-form label-position="top">
        <el-form-item label="資料夾名稱">
          <el-input
            v-model="folderForm.name"
            maxlength="40"
            show-word-limit
            placeholder="例如：築地市場、東京車站、旅伴合照"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="folderSaving" @click="folderOpen = false">取消</el-button>
        <el-button type="primary" :loading="folderSaving" :disabled="folderSaving" @click="saveFolder">
          {{ editingFolderId ? '儲存名稱' : '建立資料夾' }}
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-album-view{display:grid;grid-column:1/-1;min-width:0}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.album-upload-control{display:flex;gap:14px;align-items:center}
.album-upload-control img,.album-upload-placeholder{width:88px;height:88px;flex:0 0 88px;border-radius:12px;object-fit:cover}
.album-upload-placeholder{display:grid;place-items:center;background:#eef5f0;color:#2f7d70;font-size:26px}
.album-upload-actions{display:grid;gap:7px;min-width:0}
.album-upload-actions input{position:absolute;width:1px;height:1px;opacity:0}
.album-upload-file-button{display:inline-flex;width:max-content;min-height:40px;align-items:center;padding:0 13px;border:1px solid #bfd7cd;border-radius:10px;color:#236c59;font-weight:700;cursor:pointer}
.album-upload-actions small{color:#6b7d78;line-height:1.5}
@media(max-width:560px){
  .two-col{grid-template-columns:1fr}
  .album-upload-control{align-items:flex-start}
  .album-upload-control img,.album-upload-placeholder{width:74px;height:74px;flex-basis:74px}
}
</style>
