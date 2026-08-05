<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripBookingCard from '../components/TripBookingCard.vue'
import type { Booking, FlightDirection, Trip } from '../types'
import { useTripStore } from '../stores/trip'

const props = defineProps<{
  trip: Trip
  bookings: Booking[]
  canEdit: boolean
  userId: string
  memberName: (id: string) => string
}>()

const store = useTripStore()
const open = ref(false)
const editingId = ref<string | null>(null)

const emptyForm = () => ({
  type: 'ticket' as Booking['type'],
  title: '',
  startDate: '',
  endDate: '',
  location: '',
  bookingNumber: '',
  bookedBy: '',
  contact: '',
  website: '',
  note: '',
  flightDirection: 'outbound' as FlightDirection,
  airline: '',
  flightNumber: '',
  departureAirport: '',
  arrivalAirport: '',
  boardingTime: '',
  departureTime: '',
  arrivalTime: '',
})

const form = reactive(emptyForm())
const isFlight = computed(() => form.type === 'flight')

function resetForm(existing?: Booking) {
  Object.assign(form, existing ? {
    ...emptyForm(),
    type: existing.type,
    title: existing.title,
    startDate: existing.startDate,
    endDate: existing.endDate || '',
    location: existing.location || '',
    bookingNumber: existing.bookingNumber || '',
    bookedBy: existing.bookedBy || '',
    contact: existing.contact || '',
    website: existing.website || '',
    note: existing.note || '',
    flightDirection: existing.flightDirection || 'outbound',
    airline: existing.airline || '',
    flightNumber: existing.flightNumber || '',
    departureAirport: existing.departureAirport || '',
    arrivalAirport: existing.arrivalAirport || '',
    boardingTime: existing.boardingTime || '',
    departureTime: existing.departureTime || '',
    arrivalTime: existing.arrivalTime || '',
  } : emptyForm())
}

function openForm(existing?: Booking) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看票券與預訂，無法修改。')
    return
  }
  editingId.value = existing?.id || null
  resetForm(existing)
  open.value = true
}

function normalizedUrl(value: string) {
  const raw = value.trim()
  return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
}

async function save() {
  if (!form.title.trim() || !form.startDate) {
    ElMessage.warning('請填寫名稱與使用／出發日期。')
    return
  }

  try {
    const payload = {
      tripId: props.trip.id,
      type: form.type,
      title: form.title.trim(),
      startDate: form.startDate,
      endDate: form.endDate || '',
      location: form.location.trim(),
      bookingNumber: form.bookingNumber.trim(),
      bookedBy: form.bookedBy || '',
      contact: form.contact.trim(),
      website: normalizedUrl(form.website),
      note: form.note.trim(),
      createdBy: props.userId || props.trip.ownerId,
      ...(isFlight.value ? {
        flightDirection: form.flightDirection,
        airline: form.airline.trim(),
        flightNumber: form.flightNumber.trim(),
        departureAirport: form.departureAirport.trim(),
        arrivalAirport: form.arrivalAirport.trim(),
        boardingTime: form.boardingTime,
        departureTime: form.departureTime,
        arrivalTime: form.arrivalTime,
      } : {}),
    }
    const existing = editingId.value ? props.bookings.find((entry) => entry.id === editingId.value) : undefined
    if (existing) await store.updateBooking({ ...existing, ...payload })
    else await store.addBooking(payload)
    open.value = false
    ElMessage.success('票券與預訂已儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存票券與預訂。')
  }
}

async function remove(booking: Booking) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看票券與預訂，無法修改。')
    return
  }
  try {
    await ElMessageBox.confirm(
      `確定刪除「${booking.title}」嗎？`,
      '刪除票券與預訂',
      { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' },
    )
    await store.deleteBooking(booking)
    ElMessage.success('票券與預訂已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除票券與預訂。')
    }
  }
}
</script>

<template>
  <section class="trip-bookings-view" aria-label="票券與預訂管理">
    <TripBookingCard
      :trip="trip"
      :bookings="bookings"
      :can-edit-trip="canEdit"
      :member-name="memberName"
      @add="openForm()"
      @edit="openForm"
      @remove="remove"
    />

    <el-dialog v-model="open" :title="editingId ? '編輯票券與預訂' : '新增票券與預訂'" width="min(92vw, 640px)" class="booking-form-dialog">
      <el-form label-position="top">
        <div class="two-col">
          <el-form-item label="類型">
            <el-select v-model="form.type">
              <el-option label="去／回程機票" value="flight" />
              <el-option label="餐廳訂位" value="restaurant" />
              <el-option label="景點／遊樂園票券" value="ticket" />
              <el-option label="住宿" value="hotel" />
              <el-option label="其他交通票券" value="transport" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item label="名稱">
            <el-input v-model="form.title" placeholder="例如：東京迪士尼一日票、去程班機" />
          </el-form-item>
        </div>

        <template v-if="isFlight">
          <div class="flight-form-heading">
            <strong>航班資訊</strong>
            <span>只有機票會顯示此區塊</span>
          </div>
          <div class="two-col">
            <el-form-item label="行程方向">
              <el-radio-group v-model="form.flightDirection" class="flight-direction-group">
                <el-radio-button label="outbound">去程</el-radio-button>
                <el-radio-button label="return">回程</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="航空公司（選填）">
              <el-input v-model="form.airline" placeholder="例如：中華航空" />
            </el-form-item>
          </div>
          <div class="two-col">
            <el-form-item label="航班號（選填）">
              <el-input v-model="form.flightNumber" placeholder="例如：CI100" />
            </el-form-item>
            <el-form-item label="訂位代號（選填）">
              <el-input v-model="form.bookingNumber" placeholder="例如：ABC123" />
            </el-form-item>
          </div>
          <div class="two-col">
            <el-form-item label="出發機場（選填）">
              <el-input v-model="form.departureAirport" placeholder="例如：桃園國際機場 TPE" />
            </el-form-item>
            <el-form-item label="抵達機場（選填）">
              <el-input v-model="form.arrivalAirport" placeholder="例如：成田國際機場 NRT" />
            </el-form-item>
          </div>
          <div class="three-col">
            <el-form-item label="登機時間（選填）"><el-time-picker v-model="form.boardingTime" value-format="HH:mm" format="HH:mm" /></el-form-item>
            <el-form-item label="起飛時間（選填）"><el-time-picker v-model="form.departureTime" value-format="HH:mm" format="HH:mm" /></el-form-item>
            <el-form-item label="抵達時間（選填）"><el-time-picker v-model="form.arrivalTime" value-format="HH:mm" format="HH:mm" /></el-form-item>
          </div>
        </template>

        <div class="two-col">
          <el-form-item :label="isFlight ? '出發日期' : '使用／開始日期'">
            <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item :label="isFlight ? '抵達日期（選填）' : '結束日期（選填）'">
            <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" />
          </el-form-item>
        </div>
        <el-form-item :label="isFlight ? '集合地點／航廈（選填）' : '地點／店家（選填）'">
          <el-input v-model="form.location" placeholder="例如：第一航廈、店家地址或集合點" />
        </el-form-item>
        <div class="two-col">
          <el-form-item v-if="!isFlight" label="訂位／票券編號（選填）"><el-input v-model="form.bookingNumber" /></el-form-item>
          <el-form-item label="預訂人（選填）"><el-select v-model="form.bookedBy" clearable><el-option v-for="member in trip.members" :key="member.id" :label="member.name" :value="member.id" /></el-select></el-form-item>
          <el-form-item label="聯絡方式（選填）"><el-input v-model="form.contact" /></el-form-item>
        </div>
        <el-form-item label="票券／預訂網站（選填）"><el-input v-model="form.website" placeholder="可填入訂位頁、電子票券或航空公司訂單網址" /></el-form-item>
        <el-form-item label="備註（選填）"><el-input v-model="form.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save">儲存紀錄</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-bookings-view { display: grid; grid-column: 1 / -1; min-width: 0; }
.two-col, .three-col { display: grid; gap: 12px; }
.two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.three-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.flight-form-heading { display: flex; align-items: baseline; gap: 8px; margin: 4px 0 14px; padding: 10px 12px; border-left: 3px solid #2f7d70; border-radius: 0 10px 10px 0; background: #eef5f0; }
.flight-form-heading strong { color: #163b37; font-size: 14px; }
.flight-form-heading span { color: #6b7d78; font-size: 12px; }
.flight-direction-group { display: flex; width: 100%; }
.flight-direction-group :deep(.el-radio-button) { flex: 1; }
.flight-direction-group :deep(.el-radio-button__inner) { width: 100%; }
@media (max-width: 600px) {
  .two-col, .three-col { grid-template-columns: 1fr; gap: 0; }
  .flight-form-heading { align-items: flex-start; flex-direction: column; gap: 2px; }
}
</style>
