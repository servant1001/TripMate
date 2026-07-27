import { reactive, ref, type ComputedRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { uploadTripCover } from '../services/cloudinary'
import type { Trip } from '../types'
import { useTripStore } from '../stores/trip'

export function useTripWorkspaceTripEditor({
  store,
  current,
  currentUserId,
  onDeleted,
}: {
  store: ReturnType<typeof useTripStore>
  current: ComputedRef<Trip | undefined>
  currentUserId: ComputedRef<string | undefined>
  onDeleted: () => void
}) {
  const showEdit = ref(false)
  const showJoin = ref(false)
  const showCreate = ref(false)
  const savingTrip = ref(false)
  const editCoverFile = ref<File>()
  const editCoverPreview = ref('')
  const invite = reactive({ code: '' })
  const create = reactive({
    name: '',
    country: '日本',
    city: '東京',
    startDate: '',
    endDate: '',
    currency: 'JPY',
    budget: 0,
    coverUrl: '',
  })
  const edit = reactive({
    name: '',
    country: '',
    city: '',
    startDate: '',
    endDate: '',
    currency: 'JPY',
    budget: 0,
    coverUrl: '',
  })

  function clearEditCoverPreview() {
    if (editCoverPreview.value.startsWith('blob:')) {
      URL.revokeObjectURL(editCoverPreview.value)
    }
    editCoverPreview.value = ''
  }

  function selectEditCover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    clearEditCoverPreview()
    editCoverFile.value = file
    editCoverPreview.value = URL.createObjectURL(file)
  }

  function removeEditCover() {
    clearEditCoverPreview()
    editCoverFile.value = undefined
    edit.coverUrl = ''
  }

  function startEditTrip() {
    if (!current.value) return false
    if (current.value.ownerId !== currentUserId.value) {
      ElMessage.warning('只有旅行建立者可以編輯旅行設定。')
      return false
    }
    clearEditCoverPreview()
    editCoverFile.value = undefined
    Object.assign(edit, {
      name: current.value.name,
      country: current.value.country,
      city: current.value.city,
      startDate: current.value.startDate,
      endDate: current.value.endDate,
      currency: current.value.currency,
      budget: current.value.budget,
      coverUrl: current.value.coverUrl || '',
    })
    showEdit.value = true
    return true
  }

  async function saveTrip() {
    if (!current.value || !edit.name || !edit.startDate || !edit.endDate) {
      ElMessage.warning('請填寫旅行名稱與日期。')
      return
    }
    savingTrip.value = true
    try {
      if (editCoverFile.value) {
        edit.coverUrl = await uploadTripCover(editCoverFile.value, current.value.id)
      }
      await store.updateTrip({ ...current.value, ...edit })
      clearEditCoverPreview()
      editCoverFile.value = undefined
      showEdit.value = false
      ElMessage.success('旅行設定已更新。')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '無法更新旅行。')
    } finally {
      savingTrip.value = false
    }
  }

  async function removeTrip() {
    if (!current.value || current.value.ownerId !== currentUserId.value) {
      ElMessage.warning('只有旅行建立者可以刪除旅行。')
      return
    }
    try {
      await ElMessageBox.confirm(
        `確定要刪除「${current.value.name}」嗎？行程與開銷資料也會一併移除。`,
        '刪除旅行',
        { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' },
      )
      await store.deleteTrip(current.value)
      onDeleted()
      ElMessage.success('旅行已刪除。')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error instanceof Error ? error.message : '無法刪除旅行。')
      }
    }
  }

  return {
    showEdit,
    showJoin,
    showCreate,
    savingTrip,
    editCoverPreview,
    invite,
    create,
    edit,
    clearEditCoverPreview,
    selectEditCover,
    removeEditCover,
    startEditTrip,
    saveTrip,
    removeTrip,
  }
}
