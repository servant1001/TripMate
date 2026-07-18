<script setup lang="ts">
import { Delete, Edit, List, User } from '@element-plus/icons-vue'
import type { TodoItem, Trip } from '../types'

const props = defineProps<{
  trip: Trip
  todos: TodoItem[]
  canEditTrip: boolean
  memberName: (memberId: string) => string
}>()

const emit = defineEmits<{
  add: []
  toggle: [todo: TodoItem]
  edit: [todo: TodoItem]
  remove: [todo: TodoItem]
}>()

function dueState(todo: TodoItem) {
  if (!todo.dueDate) return 'unset'
  if (todo.completed) return 'completed'
  const due = new Date(`${todo.dueDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return 'scheduled'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  return 'scheduled'
}

function dueLabel(todo: TodoItem) {
  if (!todo.dueDate) return '未設定期限'
  const due = new Date(`${todo.dueDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return todo.dueDate
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (!todo.completed && days < 0) return `已逾期 ${Math.abs(days)} 天`
  if (!todo.completed && days === 0) return '今天到期'
  return `截止 ${due.getMonth() + 1} 月 ${due.getDate()} 日`
}

const orderedTodos = (todos: TodoItem[]) => [...todos.filter((todo) => !todo.completed), ...todos.filter((todo) => todo.completed)]
const sharedTodos = () => props.todos.filter((todo) => todo.scope !== 'personal')
const personalTodos = () => props.todos.filter((todo) => todo.scope === 'personal')
const openTodos = () => props.todos.filter((todo) => !todo.completed)
const completedTodos = () => props.todos.filter((todo) => todo.completed)
</script>

<template>
  <section id="todos" class="trip-detail-card todo-panel">
    <div class="detail-card-heading">
      <div><p class="section-kicker">TO-DO</p><h2>旅行待辦</h2></div>
      <el-button v-if="canEditTrip" class="todo-add-button" @click="emit('add')">＋ 新增待辦</el-button>
      <span v-else class="readonly-chip">唯讀</span>
    </div>

    <div v-if="todos.length" class="todo-summary"><span><b>{{ openTodos().length }}</b> 項待完成</span><span>{{ completedTodos().length }} 項已完成</span></div>
    <div v-if="todos.length" class="todo-groups">
      <section class="todo-group" aria-labelledby="shared-todos-title">
        <div class="todo-group-heading"><div><strong id="shared-todos-title">共同待辦</strong><span>全體旅伴可一起完成</span></div><b>{{ sharedTodos().length }}</b></div>
        <div v-if="sharedTodos().length" class="todo-list">
          <article v-for="todo in orderedTodos(sharedTodos())" :key="todo.id" class="todo-row" :class="{ 'is-completed': todo.completed }">
            <el-checkbox :model-value="todo.completed" :disabled="!canEditTrip" :aria-label="`${todo.completed ? '標示未完成' : '標示完成'}：${todo.title}`" @change="emit('toggle', todo)"><span class="sr-only">{{ todo.completed ? '標示未完成' : '標示完成' }}</span></el-checkbox>
            <div class="todo-copy"><strong>{{ todo.title }}</strong><p><span><el-icon><User /></el-icon>{{ todo.assigneeId ? memberName(todo.assigneeId) : '尚未指派' }}</span><span :class="['todo-due-badge', `is-${dueState(todo)}`]">{{ dueLabel(todo) }}</span></p></div>
            <div v-if="canEditTrip" class="todo-actions"><el-tooltip content="編輯待辦" placement="top"><el-button class="todo-action-button" text circle aria-label="編輯待辦" @click="emit('edit', todo)"><el-icon><Edit /></el-icon></el-button></el-tooltip><el-tooltip content="刪除待辦" placement="top"><el-button class="todo-action-button is-danger" text circle aria-label="刪除待辦" @click="emit('remove', todo)"><el-icon><Delete /></el-icon></el-button></el-tooltip></div>
          </article>
        </div>
        <p v-else class="todo-group-empty">尚未建立共同待辦。</p>
      </section>
      <section class="todo-group" aria-labelledby="personal-todos-title">
        <div class="todo-group-heading"><div><strong id="personal-todos-title">個人待辦</strong><span>指定旅伴個別完成</span></div><b>{{ personalTodos().length }}</b></div>
        <div v-if="personalTodos().length" class="todo-list">
          <article v-for="todo in orderedTodos(personalTodos())" :key="todo.id" class="todo-row todo-row-personal" :class="{ 'is-completed': todo.completed }">
            <el-checkbox :model-value="todo.completed" :disabled="!canEditTrip" :aria-label="`${todo.completed ? '標示未完成' : '標示完成'}：${todo.title}`" @change="emit('toggle', todo)"><span class="sr-only">{{ todo.completed ? '標示未完成' : '標示完成' }}</span></el-checkbox>
            <div class="todo-copy"><strong>{{ todo.title }}</strong><p><span class="todo-assignee"><el-icon><User /></el-icon>{{ todo.assigneeId ? memberName(todo.assigneeId) : '尚未指派' }}</span><span :class="['todo-due-badge', `is-${dueState(todo)}`]">{{ dueLabel(todo) }}</span></p></div>
            <div v-if="canEditTrip" class="todo-actions"><el-tooltip content="編輯待辦" placement="top"><el-button class="todo-action-button" text circle aria-label="編輯待辦" @click="emit('edit', todo)"><el-icon><Edit /></el-icon></el-button></el-tooltip><el-tooltip content="刪除待辦" placement="top"><el-button class="todo-action-button is-danger" text circle aria-label="刪除待辦" @click="emit('remove', todo)"><el-icon><Delete /></el-icon></el-button></el-tooltip></div>
          </article>
        </div>
        <p v-else class="todo-group-empty">尚未建立個人待辦。</p>
      </section>
    </div>
    <div v-else class="detail-empty-state todo-empty"><el-icon><List /></el-icon><div><strong>還沒有旅行待辦</strong><p>把出發前要準備的事情列下來，旅伴都能一起完成。</p></div><el-button v-if="canEditTrip" class="todo-add-button" @click="emit('add')">新增第一個待辦</el-button></div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.todo-panel{align-self:start;padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.todo-add-button{min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.todo-add-button:hover,.todo-add-button:focus-visible{background:#1d5a52;color:#fff}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.todo-summary{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding:10px 12px;border-radius:10px;background:#eef5f0;color:#658078;font-size:13px}.todo-summary b{color:#123f3a;font-size:15px}.todo-groups{display:grid;gap:18px;margin-top:16px}.todo-group{padding:13px 14px;border:1px solid #e3ebe6;border-radius:12px;background:#fbfcfa}.todo-group-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid #e9efeb}.todo-group-heading>div{display:grid;gap:1px}.todo-group-heading strong{color:#244a43;font-size:14px}.todo-group-heading span{color:#71827c;font-size:12px}.todo-group-heading>b{display:grid;min-width:25px;height:25px;place-items:center;border-radius:999px;background:#e5f1eb;color:#2f7d70;font-size:12px;font-variant-numeric:tabular-nums}.todo-list{display:grid}.todo-row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid #edf1ee}.todo-row:last-child{border-bottom:0}.todo-row-personal{border-left:3px solid #b7ddcf;padding-left:8px}.todo-copy{min-width:0}.todo-copy strong{display:block;overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}.todo-copy p{display:flex;flex-wrap:wrap;gap:4px 12px;margin:4px 0 0;color:#6b7d78;font-size:12px;line-height:1.45}.todo-copy p span{display:inline-flex;align-items:center;gap:3px}.todo-copy .el-icon{font-size:13px}.todo-assignee{color:#2f7d70;font-weight:700}.todo-group-empty{margin:12px 0 2px;color:#87958f;font-size:13px}.todo-due-badge{padding:2px 7px;border-radius:999px;background:#eef5f0;color:#47776a;font-size:12px;font-weight:700;white-space:nowrap}.todo-due-badge.is-overdue{background:#fce9e7;color:#b64237}.todo-due-badge.is-today{background:#fff4d9;color:#8a641c}.todo-due-badge.is-scheduled{background:#eaf4ef;color:#2f7d70}.todo-due-badge.is-unset{padding:0;background:transparent;color:#8a9994;font-weight:500}.todo-due-badge.is-completed{background:#f0f3f1;color:#81908b}.todo-row.is-completed{opacity:.72}.todo-row.is-completed strong{text-decoration:line-through}.todo-actions{display:flex;gap:2px;opacity:0;transition:opacity .16s ease}.todo-row:hover .todo-actions,.todo-row:focus-within .todo-actions{opacity:1}.todo-action-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}.todo-action-button:hover,.todo-action-button:focus-visible{background:#eff6f2;color:#236c59}.todo-action-button.is-danger{color:#c36358}.todo-action-button.is-danger:hover,.todo-action-button.is-danger:focus-visible{background:#fdf0ed;color:#b64237}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap}@media(max-width:720px){.todo-panel{padding:18px}.todo-actions{opacity:1}.todo-action-button{width:40px!important;min-width:40px!important;height:40px!important}}@media(max-width:390px){.todo-panel{padding:16px}.todo-group{padding:12px}.todo-row{grid-template-columns:34px minmax(0,1fr);align-items:start}.todo-actions{grid-column:2;justify-content:flex-start;margin:0 -4px -5px}.todo-summary{font-size:12px}}
</style>
