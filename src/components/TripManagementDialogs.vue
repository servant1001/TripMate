<script setup lang="ts">
import { computed } from 'vue'
import { tripCurrencyOptions } from '../constants/tripCurrencies'

type TripFormModel = {
  name: string
  country: string
  city: string
  startDate: string
  endDate: string
  currency: string
  budget: number
  coverUrl?: string
}

const props = defineProps<{
  showJoin: boolean
  showCreate: boolean
  showEdit: boolean
  inviteCode: string
  createForm: TripFormModel
  editForm: TripFormModel
  editCoverPreview: string
  savingTrip: boolean
}>()

const emit = defineEmits<{
  'update:showJoin': [value: boolean]
  'update:showCreate': [value: boolean]
  'update:showEdit': [value: boolean]
  'update:inviteCode': [value: string]
  selectCreateCover: [event: Event]
  selectEditCover: [event: Event]
  removeEditCover: []
  joinTrip: []
  createTrip: []
  saveTrip: []
  removeTrip: []
}>()

const joinModel = computed({
  get: () => props.showJoin,
  set: (value: boolean) => emit('update:showJoin', value),
})

const createModel = computed({
  get: () => props.showCreate,
  set: (value: boolean) => emit('update:showCreate', value),
})

const editModel = computed({
  get: () => props.showEdit,
  set: (value: boolean) => emit('update:showEdit', value),
})

const inviteCodeModel = computed({
  get: () => props.inviteCode,
  set: (value: string) => emit('update:inviteCode', value),
})
</script>

<template>
  <el-dialog v-model="joinModel" title="使用邀請碼加入旅行" width="min(92vw, 430px)">
    <p class="muted">請向旅行建立者索取邀請碼。加入前需先完成登入。</p>
    <el-input v-model="inviteCodeModel" placeholder="例如：AB12CD" maxlength="12" />
    <template #footer>
      <el-button @click="joinModel = false">取消</el-button>
      <el-button type="primary" @click="emit('joinTrip')">加入旅行</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="createModel" title="建立旅行" width="min(92vw, 560px)">
    <el-form label-position="top">
      <el-form-item label="旅行名稱">
        <el-input v-model="createForm.name" placeholder="例如：東京楓葉散策" />
      </el-form-item>

      <div class="two-col">
        <el-form-item label="國家">
          <el-input v-model="createForm.country" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="createForm.city" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="開始日期">
          <el-date-picker v-model="createForm.startDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker v-model="createForm.endDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="當地幣別">
          <el-select
            v-model="createForm.currency"
            filterable
            allow-create
            default-first-option
            placeholder="例如：JPY、KRW、EUR"
          >
            <el-option
              v-for="option in tripCurrencyOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <small class="field-help">請依旅遊國家設定當地幣別，之後會顯示當日對 TWD 匯率。</small>
        </el-form-item>
        <el-form-item label="總預算">
          <el-input-number v-model="createForm.budget" :min="0" />
        </el-form-item>
      </div>

      <el-form-item label="旅行封面（Cloudinary 簽名上傳）">
        <input type="file" accept="image/*" @change="emit('selectCreateCover', $event)" />
        <small>未設定簽名服務時可先略過；Cloudinary API Secret 永不會出現在前端。</small>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="createModel = false">取消</el-button>
      <el-button type="primary" @click="emit('createTrip')">建立旅行</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="editModel" title="編輯旅行" width="min(92vw, 560px)">
    <el-form label-position="top">
      <el-form-item label="旅行名稱">
        <el-input v-model="editForm.name" />
      </el-form-item>

      <div class="two-col">
        <el-form-item label="國家">
          <el-input v-model="editForm.country" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="editForm.city" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="開始日期">
          <el-date-picker v-model="editForm.startDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker v-model="editForm.endDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="當地幣別">
          <el-select
            v-model="editForm.currency"
            filterable
            allow-create
            default-first-option
            placeholder="例如：JPY、KRW、EUR"
          >
            <el-option
              v-for="option in tripCurrencyOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <small class="field-help">修改後會同步更新旅行預算顯示與當日對 TWD 匯率。</small>
        </el-form-item>
        <el-form-item label="總預算">
          <el-input-number v-model="editForm.budget" :min="0" />
        </el-form-item>
      </div>

      <el-form-item label="旅行封面">
        <div class="edit-cover-control">
          <img v-if="editCoverPreview || editForm.coverUrl" :src="editCoverPreview || editForm.coverUrl" alt="旅行封面預覽" />
          <div v-else class="edit-cover-placeholder" aria-hidden="true">✦</div>
          <div class="edit-cover-actions">
            <label class="edit-cover-file-button" for="edit-cover-file">
              {{ editCoverPreview || editForm.coverUrl ? '更換照片' : '上傳照片' }}
            </label>
            <input id="edit-cover-file" type="file" accept="image/*" @change="emit('selectEditCover', $event)" />
            <el-button v-if="editCoverPreview || editForm.coverUrl" class="edit-cover-remove-button" text @click="emit('removeEditCover')">移除封面</el-button>
            <small>支援圖片檔；儲存變更時才會上傳。</small>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button type="danger" plain :disabled="savingTrip" @click="emit('removeTrip')">刪除旅行</el-button>
      <el-button :disabled="savingTrip" @click="editModel = false">取消</el-button>
      <el-button type="primary" :loading="savingTrip" :disabled="savingTrip" @click="emit('saveTrip')">儲存變更</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field-help{display:block;margin-top:6px;color:#6b7d78;font-size:12px;line-height:1.55}
.edit-cover-control{display:flex;align-items:center;gap:14px}
.edit-cover-control>img,.edit-cover-placeholder{width:112px;height:72px;flex:0 0 auto;border:1px solid #dbe6e0;border-radius:10px;object-fit:cover}
.edit-cover-placeholder{display:grid;place-items:center;background:#eef5f0;color:#5d9385;font-size:25px}
.edit-cover-actions{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:6px 10px}
.edit-cover-actions input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.edit-cover-file-button{display:inline-flex;min-height:36px;padding:0 11px;align-items:center;border:1px solid #bad5c9;border-radius:8px;background:#fff;color:#2f7d70;font-size:13px;font-weight:700;cursor:pointer}
.edit-cover-file-button:hover,.edit-cover-file-button:focus-within{border-color:#7eb4a1;background:#eef5f0;color:#123f3a}
.edit-cover-remove-button{min-height:36px;color:#b7574d}
.edit-cover-actions small{flex-basis:100%;color:#71827c;font-size:12px;line-height:1.45}
@media(max-width:600px){.two-col{grid-template-columns:1fr}.edit-cover-control{align-items:flex-start;flex-direction:column}.edit-cover-control>img,.edit-cover-placeholder{width:100%;height:150px}}
</style>
