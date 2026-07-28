<script setup lang="ts">
import { Location, Picture } from '@element-plus/icons-vue'
import type { ItineraryItem } from '../types'

const props = defineProps<{
  modelValue: boolean
  mode: 'form' | 'batch'
  day: string
  days: { date: string; entries: ItineraryItem[] }[]
  entries: ItineraryItem[]
  selectedIds: string[]
  batchCount: number
  formatDate: (date: string) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:day': [value: string]
  toggle: [item: ItineraryItem]
  clear: []
  confirm: []
}>()

function isSelected(entry: ItineraryItem) {
  return props.selectedIds.includes(entry.id)
}

function timeLabel(entry: ItineraryItem) {
  if (!entry.time) return '未排時間'
  return entry.endTime ? `${entry.time}－${entry.endTime}` : entry.time
}

function locationLabel(entry: ItineraryItem) {
  if (entry.type === '交通' && entry.transportDestinationName) {
    return `${entry.location || entry.title} → ${entry.transportDestinationLocation || entry.transportDestinationName}`
  }

  return entry.location || '尚未設定地點'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'batch' ? '將商品加入關聯行程' : '選擇關聯行程'"
    class="shopping-itinerary-picker-dialog"
    width="min(92vw, 720px)"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="days.length" class="shopping-itinerary-picker">
      <div class="shopping-itinerary-day-select">
        <label for="shopping-itinerary-day">選擇旅行天數</label>
        <el-select
          id="shopping-itinerary-day"
          :model-value="day"
          aria-label="選擇旅行天數"
          @update:model-value="emit('update:day', $event)"
        >
          <el-option
            v-for="(item, index) in days"
            :key="item.date"
            :label="`第 ${index + 1} 天・${formatDate(item.date)}`"
            :value="item.date"
          />
        </el-select>
      </div>

      <div class="shopping-itinerary-picker-heading">
        <div>
          <strong>{{ formatDate(day) }}</strong>
          <p>
            {{
              mode === 'batch'
                ? `將 ${batchCount} 項商品加入這一天的行程`
                : '選擇商品要關聯的行程，可同時勾選多個'
            }}
          </p>
        </div>
        <span>{{
          mode === 'batch' ? `${entries.length} 個可加入行程` : `${entries.length} 個可選行程`
        }}</span>
      </div>

      <div class="shopping-itinerary-picker-list">
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          class="shopping-itinerary-picker-row"
          :class="{ 'is-selected': isSelected(entry) }"
          @click="emit('toggle', entry)"
        >
          <img
            v-if="entry.imageUrl"
            :src="entry.imageUrl"
            :alt="`${entry.title} 圖片`"
            class="shopping-itinerary-picker-thumb"
          />
          <span v-else class="shopping-itinerary-picker-placeholder" aria-hidden="true">
            <el-icon><Picture /></el-icon>
          </span>

          <span class="shopping-itinerary-picker-row-copy">
            <strong>{{ entry.title }}</strong>
            <span class="shopping-itinerary-picker-meta">
              <time>{{ timeLabel(entry) }}</time>
              <em>{{ entry.type }}</em>
            </span>
            <small class="shopping-itinerary-picker-location" :class="{ 'is-empty': !entry.location && !entry.transportDestinationName }">
              <el-icon><Location /></el-icon>
              <span>{{ locationLabel(entry) }}</span>
            </small>
          </span>

          <span class="shopping-itinerary-picker-select">
            {{ isSelected(entry) ? '已勾選' : '選擇' }}
          </span>
        </button>
      </div>
    </div>

    <div v-else class="shopping-itinerary-picker-empty">
      <strong>尚未建立可關聯的行程</strong>
      <p>先在每日行程中建立行程後，再回來把商品關聯到對應安排。</p>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button v-if="selectedIds.length" @click="emit('clear')">
        清除{{ mode === 'batch' ? '選取' : '關聯' }}
      </el-button>
      <el-button type="primary" @click="emit('confirm')">
        {{ mode === 'batch' ? '加入關聯行程' : '確認關聯' }}{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.shopping-itinerary-picker-dialog :deep(.el-dialog__body) {
  padding-top: 18px;
}

.shopping-itinerary-picker {
  display: grid;
  gap: 16px;
}

.shopping-itinerary-day-select {
  display: grid;
  gap: 6px;
}

.shopping-itinerary-day-select label {
  color: #52736a;
  font-size: 12px;
  font-weight: 700;
}

.shopping-itinerary-day-select :deep(.el-select) {
  width: 100%;
}

.shopping-itinerary-day-select :deep(.el-select__wrapper) {
  min-height: 44px;
  border-radius: 10px;
}

.shopping-itinerary-picker-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 2px;
}

.shopping-itinerary-picker-heading > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.shopping-itinerary-picker-heading strong {
  color: #244a43;
  font-size: 16px;
}

.shopping-itinerary-picker-heading p {
  margin: 0;
  color: #6f837d;
  font-size: 13px;
  line-height: 1.5;
}

.shopping-itinerary-picker-heading > span {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef5f0;
  color: #47776a;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.shopping-itinerary-picker-list {
  display: grid;
  gap: 10px;
  max-height: min(50vh, 440px);
  overflow: auto;
  padding: 2px;
}

.shopping-itinerary-picker-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px;
  border: 1px solid #e0e9e4;
  border-radius: 14px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.shopping-itinerary-picker-row:hover,
.shopping-itinerary-picker-row:focus-visible {
  border-color: #8ab9a8;
  background: #f8fcf9;
  box-shadow: 0 8px 18px rgba(18, 63, 58, 0.06);
  outline: none;
}

.shopping-itinerary-picker-row.is-selected {
  border-color: #2f7d70;
  background: #eef7f2;
}

.shopping-itinerary-picker-thumb,
.shopping-itinerary-picker-placeholder {
  display: grid;
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  place-items: center;
  border-radius: 12px;
}

.shopping-itinerary-picker-thumb {
  object-fit: cover;
  background: #f4f7f5;
}

.shopping-itinerary-picker-placeholder {
  background: #eaf4ef;
  color: #2f7d70;
  font-size: 22px;
}

.shopping-itinerary-picker-row-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.shopping-itinerary-picker-row-copy strong {
  color: #244a43;
  font-size: 15px;
  line-height: 1.45;
}

.shopping-itinerary-picker-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #5f7770;
  font-size: 12px;
}

.shopping-itinerary-picker-meta em {
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef5f0;
  color: #47776a;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.shopping-itinerary-picker-location {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: #6c817b;
  font-size: 12px;
  line-height: 1.45;
}

.shopping-itinerary-picker-location .el-icon {
  flex: 0 0 auto;
  margin-top: 1px;
}

.shopping-itinerary-picker-location span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.shopping-itinerary-picker-location.is-empty {
  color: #97a5a0;
}

.shopping-itinerary-picker-select {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-radius: 9px;
  background: #eef5f0;
  color: #2f7d70;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.shopping-itinerary-picker-row.is-selected .shopping-itinerary-picker-select {
  background: #2f7d70;
  color: #fff;
}

.shopping-itinerary-picker-empty {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 38px 16px;
  border: 1px dashed #cbded5;
  border-radius: 12px;
  color: #6b7d78;
  text-align: center;
}

.shopping-itinerary-picker-empty strong {
  color: #315c52;
  font-size: 15px;
}

.shopping-itinerary-picker-empty p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .shopping-itinerary-picker-heading {
    flex-direction: column;
  }

  .shopping-itinerary-picker-heading > span {
    align-self: flex-start;
  }

  .shopping-itinerary-picker-row {
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  .shopping-itinerary-picker-thumb,
  .shopping-itinerary-picker-placeholder {
    width: 52px;
    height: 52px;
    flex-basis: 52px;
    border-radius: 10px;
  }

  .shopping-itinerary-picker-select {
    grid-column: 2;
    justify-self: start;
    padding: 5px 9px;
  }
}
</style>
