<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import Sortable from 'sortablejs'
import type { SortableEvent } from 'sortablejs'
import {
  Calendar,
  Delete,
  Folder,
  FolderAdd,
  MoreFilled,
  Picture,
  Plus,
  Rank,
  Select,
  Upload,
  User,
} from '@element-plus/icons-vue'
import type { AlbumFolder, AlbumPhoto, Trip } from '../types'

const props = defineProps<{
  trip: Trip
  folders: AlbumFolder[]
  photos: AlbumPhoto[]
  canEditTrip: boolean
  selectionMode: boolean
  selectedPhotoIds: string[]
  memberName: (memberId: string) => string
  formatDate: (date: string) => string
}>()

const emit = defineEmits<{
  add: [folderId?: string]
  edit: [photo: AlbumPhoto]
  remove: [photo: AlbumPhoto]
  createFolder: []
  renameFolder: [folder: AlbumFolder]
  deleteFolder: [folder: AlbumFolder]
  toggleSelectionMode: []
  togglePhotoSelection: [photoId: string, selected: boolean]
  selectAll: []
  clearSelection: []
  bulkMove: [folderId?: string]
  bulkDelete: []
  reorderFolders: [folders: AlbumFolder[]]
  reorderPhotos: [photos: AlbumPhoto[]]
}>()

const sortableElements = new Map<string, HTMLElement>()
const folderStackElement = computedRootRef()
const sortableInstances = new Map<string, Sortable>()
let folderSortableInstance: Sortable | undefined

function computedRootRef() {
  let element: HTMLElement | null = null
  return computed({
    get: () => element,
    set: (value: HTMLElement | null) => {
      element = value
    },
  })
}

function normalizeFolderId(folderId?: string | null) {
  return folderId || undefined
}

const sortedFolders = computed(() =>
  [...props.folders].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt - b.createdAt,
  ),
)

function orderedPhotos(folderId?: string) {
  return [...props.photos]
    .filter((photo) => normalizeFolderId(photo.folderId) === normalizeFolderId(folderId))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (b.tripDate || '').localeCompare(a.tripDate || '') ||
        b.createdAt - a.createdAt,
    )
}

const allPhotosOrdered = computed(() => [
  ...orderedPhotos(undefined),
  ...sortedFolders.value.flatMap((folder) => orderedPhotos(folder.id)),
])

const imageUrls = computed(() => allPhotosOrdered.value.map((photo) => photo.imageUrl))
const imageIndexMap = computed(
  () => new Map(allPhotosOrdered.value.map((photo, index) => [photo.id, index])),
)

const selectedCount = computed(() => props.selectedPhotoIds.length)

function handlePhotoCommand(command: string, photo: AlbumPhoto) {
  if (command === 'edit') emit('edit', photo)
  if (command === 'remove') emit('remove', photo)
}

function handleFolderCommand(command: string, folder: AlbumFolder) {
  if (command === 'rename') emit('renameFolder', folder)
  if (command === 'delete') emit('deleteFolder', folder)
}

function folderPhotoCount(folderId?: string) {
  return orderedPhotos(folderId).length
}

function isPhotoSelected(photoId: string) {
  return props.selectedPhotoIds.includes(photoId)
}

function registerSortableList(key: string, element: Element | null) {
  if (element instanceof HTMLElement) sortableElements.set(key, element)
  else sortableElements.delete(key)
}

function registerFolderStack(element: Element | null) {
  folderStackElement.value = element instanceof HTMLElement ? element : null
}

function destroySortables() {
  sortableInstances.forEach((instance) => instance.destroy())
  sortableInstances.clear()
  folderSortableInstance?.destroy()
  folderSortableInstance = undefined
}

function handleSortableEnd(event: SortableEvent) {
  const draggedId = (event.item as HTMLElement | null)?.dataset.photoId
  if (!draggedId && event.oldIndex == null && event.newIndex == null) return
  if (!draggedId || event.oldIndex == null || event.newIndex == null) return

  const movingPhoto = props.photos.find((photo) => photo.id === draggedId)
  if (!movingPhoto) return

  const fromFolderId = normalizeFolderId((event.from as HTMLElement).dataset.folderId)
  const toFolderId = normalizeFolderId((event.to as HTMLElement).dataset.folderId)

  if (fromFolderId === toFolderId && event.oldIndex === event.newIndex) return

  const sourcePhotos = orderedPhotos(fromFolderId)
    .filter((photo) => photo.id !== draggedId)
    .map((photo) => ({ ...photo }))

  if (fromFolderId === toFolderId) {
    const reordered = sourcePhotos
    reordered.splice(event.newIndex, 0, { ...movingPhoto, folderId: toFolderId })
    emit(
      'reorderPhotos',
      reordered.map((photo, index) => ({
        ...photo,
        folderId: toFolderId,
        order: index,
      })),
    )
    return
  }

  const targetPhotos = orderedPhotos(toFolderId)
    .filter((photo) => photo.id !== draggedId)
    .map((photo) => ({ ...photo }))
  targetPhotos.splice(event.newIndex, 0, { ...movingPhoto, folderId: toFolderId })

  emit('reorderPhotos', [
    ...sourcePhotos.map((photo, index) => ({
      ...photo,
      folderId: fromFolderId,
      order: index,
    })),
    ...targetPhotos.map((photo, index) => ({
      ...photo,
      folderId: toFolderId,
      order: index,
    })),
  ])
}

function handleFolderSortableEnd(event: SortableEvent) {
  if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex) return
  const reordered = [...sortedFolders.value]
  const [moved] = reordered.splice(event.oldIndex, 1)
  if (!moved) return
  reordered.splice(event.newIndex, 0, moved)
  emit(
    'reorderFolders',
    reordered.map((folder, index) => ({
      ...folder,
      order: index,
    })),
  )
}

async function syncSortables() {
  await nextTick()
  destroySortables()
  if (!props.canEditTrip || props.selectionMode) return

  sortableElements.forEach((element, key) => {
    sortableInstances.set(
      key,
      Sortable.create(element, {
        animation: 180,
        group: 'trip-album-folders',
        draggable: '.album-photo-card',
        ghostClass: 'album-photo-card-ghost',
        chosenClass: 'album-photo-card-chosen',
        dragClass: 'album-photo-card-dragging',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onEnd: handleSortableEnd,
      }),
    )
  })

  if (folderStackElement.value) {
    folderSortableInstance = Sortable.create(folderStackElement.value, {
      animation: 180,
      draggable: '.album-folder-section.is-draggable',
      handle: '.album-folder-drag-handle',
      ghostClass: 'album-folder-section-ghost',
      chosenClass: 'album-folder-section-chosen',
      dragClass: 'album-folder-section-dragging',
      fallbackOnBody: true,
      onEnd: handleFolderSortableEnd,
    })
  }
}

watch(
  () => [
    props.canEditTrip,
    props.selectionMode,
    props.photos.map((photo) => `${photo.id}:${photo.folderId || 'root'}:${photo.order ?? ''}`).join('|'),
    props.folders.map((folder) => `${folder.id}:${folder.order ?? ''}`).join('|'),
  ],
  () => {
    void syncSortables()
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(destroySortables)
</script>

<template>
  <section id="album" class="trip-detail-card album-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">MEMORIES</p>
        <h2>旅行相簿</h2>
        <p class="album-summary">把旅程中的每個片刻收藏起來，也能用資料夾整理不同地點或主題。</p>
      </div>
      <div class="album-panel-actions">
        <template v-if="canEditTrip">
          <el-button class="album-secondary-button" @click="emit('toggleSelectionMode')">
            <el-icon><Select /></el-icon>
            {{ selectionMode ? '取消多選' : '多選加入' }}
          </el-button>
          <el-button class="album-secondary-button" @click="emit('createFolder')">
            <el-icon><FolderAdd /></el-icon>建立資料夾
          </el-button>
          <el-button class="album-add-button" @click="emit('add')">
            <el-icon><Plus /></el-icon>上傳照片
          </el-button>
        </template>
        <span v-else class="readonly-chip">唯讀</span>
      </div>
    </div>

    <div v-if="selectionMode && canEditTrip" class="album-selection-toolbar">
      <div class="album-selection-copy">
        <strong>已選 {{ selectedCount }} 張照片</strong>
        <span>可一次加入資料夾、移回未分類或刪除所選照片。</span>
      </div>
      <div class="album-selection-actions">
        <el-button text @click="emit('selectAll')">全選</el-button>
        <el-button class="album-secondary-button" :disabled="selectedCount === 0" @click="emit('bulkMove', undefined)">
          移回未分類
        </el-button>
        <el-dropdown trigger="click" @command="emit('bulkMove', $event || undefined)">
          <el-button class="album-secondary-button">
            加入資料夾
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="selectedCount === 0" command="">移回未分類</el-dropdown-item>
              <el-dropdown-item
                v-for="folder in sortedFolders"
                :key="folder.id"
                :disabled="selectedCount === 0"
                :command="folder.id"
              >
                {{ folder.name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button class="album-danger-button" :disabled="selectedCount === 0" @click="emit('bulkDelete')">
          <el-icon><Delete /></el-icon>刪除所選
        </el-button>
        <el-button text @click="emit('clearSelection')">清空選取</el-button>
      </div>
    </div>

    <div v-if="photos.length || folders.length" class="album-sections">
      <section class="album-folder-section is-root">
        <div class="album-folder-header">
          <div class="album-folder-copy">
            <div class="album-folder-label-row">
              <span class="album-folder-chip">未分類</span>
            </div>
            <h3>尚未放入資料夾</h3>
            <p>{{ folderPhotoCount(undefined) }} 張照片 · 可直接拖曳到下方資料夾整理。</p>
          </div>
          <div class="album-folder-actions">
            <el-button
              v-if="canEditTrip"
              class="album-folder-upload-button"
              @click="emit('add', undefined)"
            >
              <el-icon><Upload /></el-icon>上傳照片
            </el-button>
          </div>
        </div>
        <div
          class="album-grid album-folder-grid"
          data-folder-id=""
          :ref="(element) => registerSortableList('root', element as Element | null)"
        >
          <article
            v-for="photo in orderedPhotos(undefined)"
            :key="photo.id"
            class="album-photo-card"
            :data-photo-id="photo.id"
          >
            <label v-if="selectionMode" class="album-photo-select">
              <el-checkbox
                :model-value="isPhotoSelected(photo.id)"
                :aria-label="`選取相片「${photo.caption || '未命名相片'}」`"
                @change="emit('togglePhotoSelection', photo.id, Boolean($event))"
              />
            </label>
            <el-image
              class="album-image"
              :src="photo.imageUrl"
              :alt="photo.caption || '旅行相片'"
              fit="cover"
              :preview-src-list="imageUrls"
              :initial-index="imageIndexMap.get(photo.id) || 0"
              preview-teleported
            >
              <template #error>
                <span class="album-image-error"><el-icon><Picture /></el-icon>無法顯示照片</span>
              </template>
            </el-image>
            <div class="album-photo-content">
              <p v-if="photo.caption" class="album-caption">{{ photo.caption }}</p>
              <p v-else class="album-caption is-empty">尚未加入相片說明</p>
              <div class="album-meta">
                <span v-if="photo.tripDate"><el-icon><Calendar /></el-icon>{{ formatDate(photo.tripDate) }}</span>
                <span><el-icon><User /></el-icon>{{ memberName(photo.uploadedBy) }}</span>
              </div>
            </div>
            <el-dropdown
              v-if="canEditTrip && !selectionMode"
              class="album-actions"
              trigger="click"
              @command="(command: string) => handlePhotoCommand(command, photo)"
            >
              <el-button class="album-action-button" text circle aria-label="更多相片操作" title="更多相片操作">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">編輯相片資訊</el-dropdown-item>
                  <el-dropdown-item command="remove" divided class="album-delete-menu-item">刪除相片</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </article>
          <div v-if="!orderedPhotos(undefined).length" class="album-folder-empty">
            <el-icon><Folder /></el-icon>
            <p>未分類區目前沒有照片。</p>
          </div>
        </div>
      </section>

      <div class="album-folder-stack" :ref="(element) => registerFolderStack(element as Element | null)">
      <section
        v-for="folder in sortedFolders"
        :key="folder.id"
        class="album-folder-section is-draggable"
      >
        <div class="album-folder-header">
          <div class="album-folder-copy">
            <div class="album-folder-label-row">
              <span class="album-folder-chip is-folder"><el-icon><Folder /></el-icon>資料夾</span>
            </div>
            <h3>{{ folder.name }}</h3>
            <p>{{ folderPhotoCount(folder.id) }} 張照片 · 可把照片拖曳到這裡，或直接在資料夾內上傳。</p>
          </div>
          <div class="album-folder-actions">
            <el-button
              v-if="canEditTrip && !selectionMode"
              class="album-action-button album-folder-drag-handle"
              text
              circle
              aria-label="拖曳排序資料夾"
              title="拖曳排序資料夾"
            >
              <el-icon><Rank /></el-icon>
            </el-button>
            <el-button
              v-if="canEditTrip"
              class="album-folder-upload-button"
              @click="emit('add', folder.id)"
            >
              <el-icon><Upload /></el-icon>資料夾內上傳
            </el-button>
            <el-dropdown
              v-if="canEditTrip"
              trigger="click"
              @command="(command: string) => handleFolderCommand(command, folder)"
            >
              <el-button
                class="album-action-button is-folder-action"
                text
                circle
                aria-label="更多資料夾操作"
                title="更多資料夾操作"
              >
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重新命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided class="album-delete-menu-item">刪除資料夾</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div
          class="album-grid album-folder-grid"
          :data-folder-id="folder.id"
          :ref="(element) => registerSortableList(`folder:${folder.id}`, element as Element | null)"
        >
          <article
            v-for="photo in orderedPhotos(folder.id)"
            :key="photo.id"
            class="album-photo-card"
            :data-photo-id="photo.id"
          >
            <label v-if="selectionMode" class="album-photo-select">
              <el-checkbox
                :model-value="isPhotoSelected(photo.id)"
                :aria-label="`選取相片「${photo.caption || '未命名相片'}」`"
                @change="emit('togglePhotoSelection', photo.id, Boolean($event))"
              />
            </label>
            <el-image
              class="album-image"
              :src="photo.imageUrl"
              :alt="photo.caption || '旅行相片'"
              fit="cover"
              :preview-src-list="imageUrls"
              :initial-index="imageIndexMap.get(photo.id) || 0"
              preview-teleported
            >
              <template #error>
                <span class="album-image-error"><el-icon><Picture /></el-icon>無法顯示照片</span>
              </template>
            </el-image>
            <div class="album-photo-content">
              <p v-if="photo.caption" class="album-caption">{{ photo.caption }}</p>
              <p v-else class="album-caption is-empty">尚未加入相片說明</p>
              <div class="album-meta">
                <span v-if="photo.tripDate"><el-icon><Calendar /></el-icon>{{ formatDate(photo.tripDate) }}</span>
                <span><el-icon><User /></el-icon>{{ memberName(photo.uploadedBy) }}</span>
              </div>
            </div>
            <el-dropdown
              v-if="canEditTrip && !selectionMode"
              class="album-actions"
              trigger="click"
              @command="(command: string) => handlePhotoCommand(command, photo)"
            >
              <el-button class="album-action-button" text circle aria-label="更多相片操作" title="更多相片操作">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">編輯相片資訊</el-dropdown-item>
                  <el-dropdown-item command="remove" divided class="album-delete-menu-item">刪除相片</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </article>

          <div v-if="!orderedPhotos(folder.id).length" class="album-folder-empty">
            <el-icon><Folder /></el-icon>
            <p>把照片拖曳進來，或直接在這個資料夾內上傳。</p>
          </div>
        </div>
      </section>
      </div>
    </div>

    <div v-else class="detail-empty-state album-empty-state">
      <el-icon><Picture /></el-icon>
      <div>
        <strong>還沒有旅行相片</strong>
        <p>上傳第一張照片，或先建立資料夾，把不同地點與回憶整理得更清楚。</p>
      </div>
      <div class="album-empty-actions" v-if="canEditTrip">
        <el-button class="album-secondary-button" @click="emit('createFolder')">建立資料夾</el-button>
        <el-button class="album-add-button" @click="emit('add')">上傳第一張照片</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}
.album-panel{padding:24px}
.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}
.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}
.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}
.album-summary{margin:4px 0 0;color:#6b7d78;font-size:13px;line-height:1.5}
.album-panel-actions,.album-selection-actions,.album-folder-actions,.album-empty-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.album-panel-actions :deep(.el-button + .el-button),.album-empty-actions :deep(.el-button + .el-button),.album-folder-actions :deep(.el-button + .el-button),.album-selection-actions :deep(.el-button + .el-button){margin-left:0}
.album-secondary-button,.album-folder-upload-button{display:inline-flex;gap:6px;min-height:40px;border:1px solid #cfe0d7;border-radius:10px;background:#fff;color:#24584d;font-weight:700}
.album-secondary-button:hover,.album-folder-upload-button:hover,.album-secondary-button:focus-visible,.album-folder-upload-button:focus-visible{border-color:#9dc4b6;background:#f8fbf9;color:#1a5348}
.album-add-button{display:inline-flex;gap:6px;min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}
.album-add-button:hover,.album-add-button:focus-visible{background:#1d5a52;color:#fff}
.album-danger-button{display:inline-flex;gap:6px;min-height:40px;border:1px solid #f0c4be;border-radius:10px;background:#fff7f6;color:#c75144;font-weight:700}
.album-danger-button:hover,.album-danger-button:focus-visible{border-color:#e39a90;background:#fff1ef;color:#b83f34}
.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}
.album-selection-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0 4px}
.album-selection-copy{display:grid;gap:2px}
.album-selection-copy strong{color:#163b37;font-size:14px}
.album-selection-copy span{color:#6b7d78;font-size:12px}
.album-sections{display:grid;gap:18px;margin-top:18px}
.album-folder-stack{display:grid;gap:18px}
.album-folder-section{border:1px solid #dfe9e3;border-radius:16px;background:#fbfcfa;padding:18px}
.album-folder-section.is-root{background:#f7faf8}
.album-folder-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #e7efea}
.album-folder-copy{display:grid;gap:5px;min-width:0}
.album-folder-copy h3{margin:0;color:#163b37;font-size:18px;line-height:1.35}
.album-folder-copy p{margin:0;color:#6b7d78;font-size:13px;line-height:1.6}
.album-folder-label-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.album-folder-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:12px;font-weight:700}
.album-folder-chip.is-folder{background:#edf5ff;color:#3b7892}
.album-folder-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-top:14px;min-height:96px}
.album-photo-card{position:relative;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px;background:#fff;transition:border-color .16s,box-shadow .16s}
.album-photo-card:hover,.album-photo-card:focus-within{border-color:#bed8cd;box-shadow:0 6px 16px rgba(18,63,58,.08)}
.album-image{display:block;width:100%;height:150px;background:#eef5f0}
.album-image :deep(img){transition:transform .2s ease}
.album-photo-card:hover .album-image :deep(img){transform:scale(1.025)}
.album-image-error{display:grid;width:100%;height:100%;place-items:center;gap:5px;background:#eef5f0;color:#7d928a;font-size:12px}
.album-image-error .el-icon{font-size:22px}
.album-photo-content{display:grid;gap:7px;padding:11px 12px}
.album-caption{display:-webkit-box;min-height:22px;margin:0;overflow:hidden;color:#244a43;font-size:14px;font-weight:700;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}
.album-caption.is-empty{color:#82928c;font-weight:500}
.album-meta{display:flex;flex-wrap:wrap;gap:4px 9px;color:#71827c;font-size:12px;line-height:1.45}
.album-meta span{display:inline-flex;min-width:0;align-items:center;gap:4px}
.album-meta .el-icon{flex:0 0 auto;color:#5e9b8b;font-size:13px}
.album-actions{position:absolute;top:7px;right:7px;opacity:0;transition:opacity .16s}
.album-photo-card:hover .album-actions,.album-photo-card:focus-within .album-actions{opacity:1}
.album-action-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0!important;border:1px solid rgba(255,255,255,.92)!important;background:rgba(255,255,255,.96)!important;color:#52756b;box-shadow:0 2px 7px rgba(18,63,58,.12)}
.album-action-button:hover,.album-action-button:focus-visible{background:#eff6f2!important;color:#236c59}
.album-action-button.is-folder-action{position:static}
.album-folder-drag-handle{cursor:grab}
.album-folder-drag-handle:active{cursor:grabbing}
.album-photo-select{position:absolute;top:8px;left:8px;z-index:2;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.94);box-shadow:0 4px 10px rgba(18,63,58,.12)}
.album-photo-select :deep(.el-checkbox){margin-right:0}
.album-folder-empty{display:grid;place-items:center;gap:8px;min-height:96px;padding:16px;border:1px dashed #d5e2dc;border-radius:12px;background:#f7faf8;color:#6f827b;text-align:center}
.album-folder-empty .el-icon{font-size:22px;color:#7fa397}
.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}
.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}
.detail-empty-state strong{color:#244a43;font-size:16px}
.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}
:deep(.album-photo-card-ghost){opacity:.45}
:deep(.album-photo-card-chosen){border-color:#8ec0ae!important;box-shadow:0 10px 24px rgba(18,63,58,.12)!important}
:deep(.album-photo-card-dragging){transform:rotate(1.5deg)}
:deep(.album-folder-section-ghost){opacity:.45}
:deep(.album-folder-section-chosen){box-shadow:0 12px 24px rgba(18,63,58,.12)!important}
:deep(.album-folder-section-dragging){transform:scale(.995)}
@media(max-width:760px){
  .detail-card-heading,.album-selection-toolbar,.album-folder-header{flex-direction:column;align-items:stretch}
  .album-panel-actions{justify-content:stretch}
  .album-panel-actions>.el-button,.album-selection-actions>.el-button,.album-selection-actions>.el-dropdown,.album-selection-actions>.el-dropdown>.el-tooltip__trigger,.album-folder-actions>.el-button{width:100%;margin-left:0!important}
  .album-selection-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
}
@media(max-width:600px){
  .album-panel{padding:18px}
  .album-sections{gap:14px;margin-top:14px}
  .album-folder-section{padding:14px}
  .album-folder-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .album-image{height:128px}
  .album-photo-content{padding:9px 10px}
  .album-caption{font-size:13px}
  .album-meta{font-size:11px}
  .album-actions{opacity:1}
  .album-action-button{width:40px!important;min-width:40px!important;height:40px!important}
}
@media(max-width:390px){
  .album-panel{padding:16px}
  .album-selection-actions{grid-template-columns:1fr}
  .album-folder-grid{grid-template-columns:1fr 1fr}
  .album-image{height:116px}
  .album-actions{top:4px;right:4px}
  .album-action-button{width:36px!important;min-width:36px!important;height:36px!important}
}
</style>
