<script setup lang="ts">
import { Calendar, House, Location, MoreFilled, Promotion, Ticket, TopRight, Van } from '@element-plus/icons-vue'
import type { Booking, BookingType, Trip } from '../types'

const props = defineProps<{
  trip: Trip
  bookings: Booking[]
  canEditTrip: boolean
  memberName: (memberId: string) => string
}>()
const emit = defineEmits<{ add: []; edit: [booking: Booking]; remove: [booking: Booking] }>()

function typeLabel(type: BookingType) {
  return ({ flight: '機票', hotel: '住宿', transport: '交通票券', ticket: '票券', restaurant: '餐廳訂位', other: '其他' } as Record<BookingType, string>)[type]
}
function typeIcon(type: BookingType) {
  return type === 'flight' ? Promotion : type === 'hotel' ? House : type === 'transport' ? Van : Ticket
}
function dateLabel(booking: Booking) {
  if (!booking.startDate) return '未設定日期'
  const start = new Date(`${booking.startDate}T00:00:00`)
  const format = (date: Date) => `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  if (Number.isNaN(start.getTime())) return booking.startDate
  if (!booking.endDate || booking.endDate === booking.startDate) return format(start)
  const end = new Date(`${booking.endDate}T00:00:00`)
  return Number.isNaN(end.getTime()) ? format(start) : `${format(start)}－${format(end)}`
}
function flightDirectionLabel(booking: Booking) {
  return booking.flightDirection === 'return' ? '回程' : '去程'
}
function flightTimeLabel(booking: Booking) {
  const parts = [
    booking.boardingTime ? `登機 ${booking.boardingTime}` : '',
    booking.departureTime ? `起飛 ${booking.departureTime}` : '',
    booking.arrivalTime ? `抵達 ${booking.arrivalTime}` : '',
  ].filter(Boolean)
  return parts.join(' ・ ')
}
function hasFlightRoute(booking: Booking) {
  return Boolean(booking.departureAirport || booking.arrivalAirport)
}
const sortedBookings = () => [...props.bookings].sort((a, b) => a.startDate.localeCompare(b.startDate))
function handleBookingAction(command: string | number | object, booking: Booking) {
  if (command === 'edit') emit('edit', booking)
  if (command === 'remove') emit('remove', booking)
}
</script>

<template>
  <section id="bookings" class="trip-detail-card booking-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">TICKETS &amp; BOOKINGS</p>
        <h2>票券與預訂管理</h2>
        <p class="booking-heading-copy">集中管理餐廳訂位、景點票券與去回程機票。</p>
      </div>
      <el-button v-if="canEditTrip" class="booking-add-button" @click="emit('add')">＋ 新增紀錄</el-button>
      <span v-else class="readonly-chip">唯讀</span>
    </div>

    <div v-if="bookings.length" class="booking-list">
      <article v-for="booking in sortedBookings()" :key="booking.id" class="booking-row" :class="{ 'is-flight': booking.type === 'flight' }">
        <span class="booking-type-icon"><el-icon><component :is="typeIcon(booking.type)" /></el-icon></span>
        <div class="booking-copy">
          <div class="booking-title">
            <strong>{{ booking.title }}</strong>
            <span>{{ typeLabel(booking.type) }}</span>
            <span v-if="booking.type === 'flight'" class="booking-flight-direction">{{ flightDirectionLabel(booking) }}</span>
          </div>
          <p class="booking-primary-meta"><span><el-icon><Calendar /></el-icon>{{ dateLabel(booking) }}</span><span v-if="booking.location"><el-icon><Location /></el-icon>{{ booking.location }}</span></p>

          <template v-if="booking.type === 'flight'">
            <div v-if="hasFlightRoute(booking)" class="booking-flight-route">
              <span>{{ booking.departureAirport || '出發機場待補' }}</span><b>→</b><span>{{ booking.arrivalAirport || '抵達機場待補' }}</span>
            </div>
            <p v-if="flightTimeLabel(booking)" class="booking-flight-time">{{ flightTimeLabel(booking) }}</p>
            <small v-if="booking.airline || booking.flightNumber">{{ [booking.airline, booking.flightNumber].filter(Boolean).join(' ・ ') }}</small>
          </template>

          <small v-if="booking.bookingNumber">{{ booking.type === 'flight' ? '訂位代號' : '訂位／票券編號' }}：{{ booking.bookingNumber }}</small>
          <small v-else-if="booking.bookedBy">由 {{ memberName(booking.bookedBy) }} 預訂</small>
          <p v-if="booking.note" class="booking-note">{{ booking.note }}</p>
        </div>
        <div v-if="canEditTrip || booking.website" class="booking-tools">
          <el-dropdown v-if="canEditTrip" class="booking-actions" trigger="click" @command="handleBookingAction($event, booking)">
            <el-button class="booking-more-button" text circle aria-label="更多票券與預訂操作" title="更多票券與預訂操作"><el-icon><MoreFilled /></el-icon></el-button>
            <template #dropdown><el-dropdown-menu><el-dropdown-item command="edit">編輯紀錄</el-dropdown-item><el-dropdown-item class="booking-delete-menu-item" command="remove">刪除紀錄</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
          <el-tooltip v-if="booking.website" content="開啟票券或預訂網站" placement="top"><a class="booking-link" :href="booking.website" target="_blank" rel="noopener noreferrer" aria-label="開啟票券或預訂網站"><el-icon><TopRight /></el-icon></a></el-tooltip>
        </div>
      </article>
    </div>

    <div v-else class="detail-empty-state">
      <el-icon><Ticket /></el-icon>
      <div><strong>還沒有票券或預訂</strong><p>先記下餐廳訂位、景點票券或去回程機票，出發時就能快速找到。</p></div>
      <el-button v-if="canEditTrip" class="booking-add-button" @click="emit('add')">新增第一筆紀錄</el-button>
    </div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}
.booking-panel{align-self:start;padding:24px}
.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}
.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}
.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}
.booking-heading-copy{margin:4px 0 0;color:#6b7d78;font-size:13px;line-height:1.5}
.booking-add-button{min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}
.booking-add-button:hover,.booking-add-button:focus-visible{background:#1d5a52;color:#fff}
.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}
.booking-list{display:grid;gap:10px;margin-top:16px}
.booking-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:start;gap:10px;padding:13px;border:1px solid #e3ebe7;border-radius:12px;background:#fbfcfa;transition:border-color .16s,box-shadow .16s}
.booking-row:hover,.booking-row:focus-within{border-color:#bed8cd;box-shadow:0 4px 12px rgba(18,63,58,.06)}
.booking-row.is-flight{border-color:#c9dfda;background:#fbfefd}
.booking-type-icon{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#eaf4ef;color:#2f7d70}
.booking-copy{min-width:0}
.booking-title{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
.booking-title strong{overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}
.booking-title>span{padding:2px 7px;border-radius:999px;background:#edf5f0;color:#47776a;font-size:11px;font-weight:700}
.booking-title>.booking-flight-direction{background:#fff4d9;color:#8c651d}
.booking-copy p{display:flex;flex-wrap:wrap;gap:4px 10px;margin:4px 0 0;color:#6b7d78;font-size:12px;line-height:1.45}
.booking-copy p span{display:inline-flex;align-items:center;gap:3px}
.booking-copy .el-icon{font-size:13px}
.booking-copy small{display:block;margin-top:4px;color:#71827c;font-size:12px}
.booking-primary-meta{margin-top:4px!important}
.booking-flight-route{display:flex;align-items:center;gap:7px;max-width:640px;margin-top:8px;padding:7px 9px;border:1px solid #d8e8e1;border-radius:8px;background:#f4f9f6;color:#35665b;font-size:12px;line-height:1.45}
.booking-flight-route span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.booking-flight-route b{flex:0 0 auto;color:#2f7d70;font-size:15px}
.booking-flight-time{margin-top:5px!important;color:#52736a!important}
.booking-note{color:#82918c!important}
.booking-tools{display:flex;align-items:flex-start;gap:2px}
.booking-actions{display:inline-flex;opacity:0;transition:opacity .16s}
.booking-row:hover .booking-actions,.booking-row:focus-within .booking-actions{opacity:1}
.booking-more-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}
.booking-more-button:hover,.booking-more-button:focus-visible{background:#eff6f2;color:#236c59}
.booking-link{display:grid;width:36px;height:36px;place-items:center;border-radius:8px;color:#2f7d70}
.booking-link:hover,.booking-link:focus-visible{background:#eaf4ef;outline:none}
.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}
.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}
.detail-empty-state strong{color:#244a43;font-size:16px}
.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}
@media(max-width:720px){
  .booking-panel{padding:18px}
  .detail-card-heading{gap:10px}
  .booking-heading-copy{display:none}
  .booking-row{position:relative;grid-template-columns:38px minmax(0,1fr);padding-right:96px}
  .booking-tools{position:absolute;top:6px;right:6px;gap:0}
  .booking-actions{opacity:1}
  .booking-more-button,.booking-link{width:40px!important;min-width:40px!important;height:40px!important;margin:0!important}
}
@media(max-width:390px){
  .booking-panel{padding:16px}
  .booking-row{padding:12px 96px 12px 10px}
  .booking-flight-route{gap:5px;padding:6px 7px}
}
@media(max-width:720px){
  .booking-add-button{height:var(--tripmate-mobile-page-button-height);min-height:var(--tripmate-mobile-page-button-height)}
}
</style>
