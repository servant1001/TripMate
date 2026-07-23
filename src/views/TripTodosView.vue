<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripTodoCard from '../components/TripTodoCard.vue'
import type { TodoItem, Trip } from '../types'
import { useTripStore } from '../stores/trip'

const props = defineProps<{ trip: Trip; todos: TodoItem[]; canEdit: boolean; userId: string; memberName: (id: string) => string }>()
const store = useTripStore(); const open = ref(false); const editingId = ref<string | null>(null); const form = reactive({ title: '', scope: 'shared' as TodoItem['scope'], assigneeId: '', dueDate: '', url: '', note: '' })
function openForm(todo?: TodoItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); editingId.value = todo?.id || null; Object.assign(form, todo ? { title: todo.title, scope: todo.scope || 'shared', assigneeId: todo.assigneeId || '', dueDate: todo.dueDate || '', url: todo.url || '', note: todo.note || '' } : { title: '', scope: 'shared', assigneeId: '', dueDate: '', url: '', note: '' }); open.value = true }
async function save() { if (!form.title.trim()) return ElMessage.warning('請填寫待辦事項。'); if (form.scope === 'personal' && !form.assigneeId) return ElMessage.warning('個人待辦請指定負責旅伴。'); const existing = editingId.value ? props.todos.find((item) => item.id === editingId.value) : undefined; const raw = form.url.trim(); const payload = { tripId: props.trip.id, title: form.title.trim(), scope: form.scope, assigneeId: form.assigneeId || '', dueDate: form.dueDate || '', url: raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw, note: form.note.trim() }; try { if (existing) await store.updateTodo({ ...existing, ...payload }); else await store.addTodo(payload); open.value = false; ElMessage.success('待辦已儲存。') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '無法儲存待辦。') } }
async function remove(todo: TodoItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); try { await ElMessageBox.confirm(`確定刪除待辦「${todo.title}」嗎？`, '刪除待辦', { type: 'warning' }); await store.deleteTodo(todo); ElMessage.success('待辦已刪除。') } catch { /* cancelled */ } }
async function toggle(todo: TodoItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看待辦，無法修改。'); await store.toggleTodo(todo) }
</script>

<template>
  <section class="trip-todos-view" aria-label="旅行待辦"><TripTodoCard :trip="trip" :todos="todos" :can-edit-trip="canEdit" :member-name="memberName" @add="openForm()" @toggle="toggle" @edit="openForm" @remove="remove" /><el-dialog v-model="open" :title="editingId ? '編輯待辦' : '新增待辦'" width="min(92vw,460px)"><el-form label-position="top"><el-form-item label="待辦事項"><el-input v-model="form.title" /></el-form-item><el-form-item label="待辦類型"><el-radio-group v-model="form.scope"><el-radio value="shared">共同待辦</el-radio><el-radio value="personal">個人待辦</el-radio></el-radio-group></el-form-item><el-form-item v-if="form.scope === 'personal'" label="負責旅伴"><el-select v-model="form.assigneeId"><el-option v-for="member in trip.members" :key="member.id" :label="member.name" :value="member.id" /></el-select></el-form-item><el-form-item label="到期日"><el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" /></el-form-item><el-form-item label="網址（選填）"><el-input v-model="form.url" /></el-form-item><el-form-item label="備註（選填）"><el-input v-model="form.note" type="textarea" :rows="3" /></el-form-item></el-form><template #footer><el-button @click="open=false">取消</el-button><el-button type="primary" @click="save">儲存待辦</el-button></template></el-dialog></section>
</template>

<style scoped>.trip-todos-view{display:grid;grid-column:1/-1;min-width:0}</style>
