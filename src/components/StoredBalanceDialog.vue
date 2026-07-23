<script setup lang="ts">
export type StoredBalanceDraft = {
  initialBalance: number
  currency: string
}

const props = defineProps<{
  open: boolean
  form: StoredBalanceDraft
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
}>()
</script>

<template>
  <el-dialog
    :model-value="props.open"
    title="設定儲值工具初始餘額"
    width="min(92vw, 420px)"
    @update:model-value="emit('update:open', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="初始餘額">
        <el-input-number v-model="props.form.initialBalance" :min="0" controls-position="right" />
      </el-form-item>
      <el-form-item label="幣別">
        <el-input v-model="props.form.currency" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:open', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">儲存餘額</el-button>
    </template>
  </el-dialog>
</template>
