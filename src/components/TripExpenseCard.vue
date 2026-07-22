<script setup lang="ts">
import { CoffeeCup, House, Money, MoreFilled, ShoppingBag, Van, Wallet } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { Expense, Trip } from '../types'

const props = defineProps<{
  trip: Trip
  expenses: Expense[]
  total: number
  myPaid: number
  myBalance: number
  personalBudget: number
  personalSpent: number
  categoryBudgets: { category: string; budget: number; spent: number }[]
  canSetPersonalBudget: boolean
  canManageCategoryBudgets: boolean
  canEditTrip: boolean
  payerLabel: (expense: Expense) => string
  splitLabel: (expense: Expense) => string
  participantCount: (expense: Expense) => number
  share: (expense: Expense) => number
}>()

const emit = defineEmits<{
  add: []
  setPersonalBudget: []
  manageCategoryBudgets: []
  edit: [expense: Expense]
  remove: [expense: Expense]
}>()

function categoryIcon(category: string): Component {
  if (category === '餐飲') return CoffeeCup
  if (category === '交通') return Van
  if (category === '住宿') return House
  if (category === '購物') return ShoppingBag
  return Wallet
}

function settlementLabel() {
  if (props.myBalance > 0.01) return '我應收'
  if (props.myBalance < -0.01) return '我應付'
  return '已結清'
}

function budgetRatio(spent: number, budget: number) { return budget > 0 ? Math.min(1, Math.max(0, spent / budget)) : 0 }
function budgetPercentLabel(spent: number, budget: number) { const percent = budget > 0 ? spent / budget * 100 : 0; if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`; return `${Math.round(percent)}%` }
function handleExpenseAction(command: string | number | object, expense: Expense) { if (command === 'edit') emit('edit', expense); if (command === 'remove') emit('remove', expense) }
</script>

<template>
  <section id="expenses" class="trip-detail-card expense-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">EXPENSES</p>
        <h2>旅行開銷</h2>
      </div>
      <el-button v-if="canEditTrip" class="expense-add-button" @click="emit('add')">＋ 新增支出</el-button>
      <span v-else class="readonly-chip">唯讀</span>
    </div>

    <div class="expense-stats" aria-label="開銷摘要">
      <div class="expense-stat is-total"><span>總支出</span><strong>{{ trip.currency }} {{ total.toLocaleString() }}</strong></div>
      <div class="expense-stat"><span>我已支付</span><strong>{{ trip.currency }} {{ myPaid.toLocaleString() }}</strong></div>
      <div class="expense-stat" :class="{ 'is-negative': myBalance < -0.01, 'is-positive': myBalance > 0.01 }"><span>{{ settlementLabel() }}</span><strong>{{ myBalance ? `${trip.currency} ${Math.abs(myBalance).toLocaleString()}` : '—' }}</strong></div>
    </div>

    <div v-if="trip.budget" class="budget-progress" :aria-label="`旅行預算使用 ${budgetPercentLabel(total, trip.budget)}`"><div><span>旅行預算使用</span><b>{{ budgetPercentLabel(total, trip.budget) }}</b></div><span class="budget-track"><i :style="{ width: `${budgetRatio(total, trip.budget) * 100}%` }"></i></span></div>

    <section class="personal-budget-card" :class="{ 'is-unset': !personalBudget }">
      <div class="personal-budget-heading"><div><span>我的預算</span><small>依我的分攤金額計算</small></div><el-button v-if="canSetPersonalBudget" class="personal-budget-button" @click="emit('setPersonalBudget')">{{ personalBudget ? '調整' : '設定' }}</el-button></div>
      <template v-if="personalBudget">
        <div class="personal-budget-values"><div><span>我的支出</span><strong>{{ trip.currency }} {{ personalSpent.toLocaleString() }}</strong></div><div><span>個人預算</span><strong>{{ trip.currency }} {{ personalBudget.toLocaleString() }}</strong></div><b>{{ budgetPercentLabel(personalSpent, personalBudget) }}</b></div>
        <span class="personal-budget-track"><i :style="{ width: `${budgetRatio(personalSpent, personalBudget) * 100}%` }"></i></span>
      </template>
      <p v-else>設定個人預算後，就能追蹤自己實際分攤的開銷。</p>
    </section>

    <section class="category-budget-card" :class="{ 'is-unset': !categoryBudgets.length }">
      <div class="category-budget-heading">
        <div><span>分類預算</span><small>依全體旅行支出計算</small></div>
        <el-button v-if="canManageCategoryBudgets" class="category-budget-button" @click="emit('manageCategoryBudgets')">{{ categoryBudgets.length ? '調整' : '設定' }}</el-button>
      </div>
      <template v-if="categoryBudgets.length">
        <article v-for="item in categoryBudgets" :key="item.category" class="category-budget-row">
          <div class="category-budget-copy"><strong>{{ item.category }}</strong><span>{{ trip.currency }} {{ item.spent.toLocaleString() }}／{{ item.budget ? item.budget.toLocaleString() : '未設定' }}</span></div>
          <b v-if="item.budget">{{ budgetPercentLabel(item.spent, item.budget) }}</b>
          <em v-else>未設額度</em>
          <span v-if="item.budget" class="category-budget-track"><i :style="{ width: `${budgetRatio(item.spent, item.budget) * 100}%` }"></i></span>
        </article>
      </template>
      <p v-else>建立者設定分類預算後，可在這裡追蹤各類開銷的使用率。</p>
    </section>

    <ul v-if="expenses.length" class="expense-list">
      <li v-for="expense in expenses" :key="expense.id" class="expense-row">
        <span class="expense-category-icon" :aria-label="expense.category"><el-icon><component :is="categoryIcon(expense.category)" /></el-icon></span>
        <div class="expense-copy"><strong>{{ expense.title }}</strong><p>{{ expense.date || '未設定日期' }}・{{ payerLabel(expense) }}・{{ expense.kind === 'shared' ? `${participantCount(expense)} 人${splitLabel(expense)}` : splitLabel(expense) }}</p></div>
        <div class="expense-amount"><b>{{ trip.currency }} {{ expense.amount.toLocaleString() }}</b><small v-if="expense.kind === 'shared'">{{ expense.splitMode === 'equal' || !expense.splitMode ? `每人 ${share(expense).toFixed(0)}` : splitLabel(expense) }}</small></div>
        <el-dropdown v-if="canEditTrip" class="expense-actions" trigger="click" @command="handleExpenseAction($event, expense)">
          <el-button class="expense-more-button" text circle aria-label="更多支出操作" title="更多支出操作"><el-icon><MoreFilled /></el-icon></el-button>
          <template #dropdown><el-dropdown-menu><el-dropdown-item command="edit">編輯支出</el-dropdown-item><el-dropdown-item class="expense-delete-menu-item" command="remove">刪除支出</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </li>
    </ul>
    <div v-else class="detail-empty-state expense-empty"><el-icon><Money /></el-icon><div><strong>尚未記錄支出</strong><p>先新增第一筆共同開銷，分帳會更清楚。</p></div><el-button v-if="canEditTrip" class="expense-add-button" @click="emit('add')">新增第一筆支出</el-button></div>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.expense-panel{align-self:start;padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.expense-add-button{min-height:40px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.expense-add-button:hover,.expense-add-button:focus-visible{background:#1d5a52;color:#fff}.readonly-chip{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:999px;background:#eef5f0;color:#62766f;font-size:13px;font-weight:700}.expense-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:17px}.expense-stat{min-width:0;padding:12px;border:1px solid #e6ece8;border-radius:11px;background:#fbfcfa}.expense-stat span{display:block;color:#6b7d78;font-size:12px;line-height:1.4}.expense-stat strong{display:block;min-width:0;margin-top:5px;overflow:hidden;color:#1f5047;font-size:15px;font-variant-numeric:tabular-nums;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}.expense-stat.is-total{border-color:#d6e6dc;background:#eef5f0}.expense-stat.is-total strong{color:#123f3a}.expense-stat.is-negative{border-color:#f1d7d3;background:#fff7f5}.expense-stat.is-negative strong{color:#d9544d}.expense-stat.is-positive{border-color:#d6e6dc;background:#f2f8f4}.expense-stat.is-positive strong{color:#2f7d70}.budget-progress{display:grid;gap:7px;margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff4d9;color:#805f21}.budget-progress>div{display:flex;justify-content:space-between;font-size:12px}.budget-progress b{font-variant-numeric:tabular-nums}.budget-track,.personal-budget-track,.category-budget-track{display:block;height:5px;overflow:hidden;border-radius:99px}.budget-track{background:#f0dfb2}.budget-track i{display:block;height:100%;border-radius:inherit;background:#d8a536}.personal-budget-card,.category-budget-card{display:grid;gap:10px;margin-top:14px;padding:13px;border:1px solid #dbe9e2;border-radius:12px;background:#f7fbf8}.personal-budget-heading,.category-budget-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.personal-budget-heading>div,.category-budget-heading>div{display:grid;gap:2px}.personal-budget-heading span,.category-budget-heading span{color:#23574d;font-size:14px;font-weight:800}.personal-budget-heading small,.category-budget-heading small{color:#70827b;font-size:12px}.personal-budget-button,.category-budget-button{min-height:32px;padding:0 10px;border-color:#bad5c9;border-radius:8px;background:#fff;color:#2f7d70;font-size:12px;font-weight:700}.personal-budget-button:hover,.personal-budget-button:focus-visible,.category-budget-button:hover,.category-budget-button:focus-visible{border-color:#7eb4a1;background:#eef5f0;color:#123f3a}.personal-budget-values{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:8px}.personal-budget-values>div{display:grid;gap:3px}.personal-budget-values span{color:#6b7d78;font-size:12px}.personal-budget-values strong{color:#1c4d43;font-size:14px;font-variant-numeric:tabular-nums}.personal-budget-values>b{padding:4px 7px;border-radius:999px;background:#e4f2ea;color:#2f7d70;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}.personal-budget-track{background:#dcebe3}.personal-budget-track i{display:block;height:100%;border-radius:inherit;background:#2f7d70}.category-budget-card{background:#fbfcfa}.category-budget-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:9px 0;border-bottom:1px solid #e8efea}.category-budget-row:last-child{padding-bottom:0;border-bottom:0}.category-budget-copy{display:grid;min-width:0;gap:2px}.category-budget-copy strong{color:#244a43;font-size:13px}.category-budget-copy span{overflow:hidden;color:#71827c;font-size:12px;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap}.category-budget-row>b,.category-budget-row>em{align-self:center;color:#2f7d70;font-size:12px;font-style:normal;font-variant-numeric:tabular-nums;white-space:nowrap}.category-budget-row>em{color:#8a9994}.category-budget-track{grid-column:1/-1;background:#dcebe3}.category-budget-track i{display:block;height:100%;border-radius:inherit;background:#2f7d70}.personal-budget-card.is-unset,.category-budget-card.is-unset{border-style:dashed;background:#fbfcfa}.personal-budget-card.is-unset p,.category-budget-card.is-unset p{margin:0;color:#71827c;font-size:13px;line-height:1.5}.expense-list{display:grid;gap:2px;padding:0;margin:16px 0 0;list-style:none}.expense-row{display:grid;grid-template-columns:35px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #edf1ee}.expense-row:last-child{border-bottom:0}.expense-category-icon{display:grid;width:34px;height:34px;place-items:center;border-radius:10px;background:#eef5f0;color:#2f7d70}.expense-copy{min-width:0}.expense-copy strong{display:block;overflow-wrap:anywhere;color:#244a43;font-size:15px;line-height:1.4}.expense-copy p{margin:3px 0 0;color:#6b7d78;font-size:12px;line-height:1.45}.expense-amount{display:grid;min-width:88px;justify-items:end;gap:3px;text-align:right}.expense-amount b{color:#163b37;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}.expense-amount small{color:#84948f;font-size:11px;white-space:nowrap}.expense-actions{display:flex;gap:2px;opacity:0;transition:opacity .16s ease}.expense-row:hover .expense-actions,.expense-row:focus-within .expense-actions{opacity:1}.expense-action-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}.expense-action-button:hover,.expense-action-button:focus-visible{background:#eff6f2;color:#236c59}.expense-action-button.is-danger{color:#c36358}.expense-action-button.is-danger:hover,.expense-action-button.is-danger:focus-visible{background:#fdf0ed;color:#b64237}.detail-empty-state{display:grid;place-items:center;gap:10px;padding:38px 16px;text-align:center;color:#6b7d78}.detail-empty-state>.el-icon{font-size:30px;color:#9db8ae}.detail-empty-state strong{color:#244a43;font-size:16px}.detail-empty-state p{margin:5px 0 8px;font-size:14px;line-height:1.55}@media(max-width:720px){.expense-panel{padding:18px}.expense-stats{gap:6px}.expense-stat{padding:10px}.expense-stat strong{font-size:13px}.personal-budget-values{grid-template-columns:1fr 1fr}.personal-budget-values>b{grid-column:1/-1;justify-self:start}.expense-row{grid-template-columns:35px minmax(0,1fr) auto;gap:9px}.expense-actions{grid-column:2/-1;justify-content:flex-start;margin:0 -4px -4px;opacity:1}.expense-action-button{width:40px!important;min-width:40px!important;height:40px!important}.expense-copy p{font-size:12px}.expense-amount{min-width:76px}}@media(max-width:390px){.expense-panel{padding:16px}.expense-stats{grid-template-columns:1fr}.expense-stat{display:flex;align-items:center;justify-content:space-between;gap:12px}.expense-stat strong{margin-top:0;font-size:15px}.personal-budget-values{grid-template-columns:1fr}.personal-budget-values>b{grid-column:auto}.expense-row{align-items:start;padding:13px 0}.expense-amount{padding-top:2px}}
.expense-actions{display:inline-flex;opacity:0;transition:opacity .16s ease}.expense-more-button{width:36px!important;min-width:36px!important;height:36px!important;margin:0 -4px 0 0;padding:0!important;color:#69847b}.expense-more-button:hover,.expense-more-button:focus-visible{background:#eff6f2;color:#236c59}@media(max-width:720px){.expense-row{position:relative;padding-right:48px}.expense-actions{position:absolute;top:8px;right:0;display:inline-flex;opacity:1}.expense-more-button{width:40px!important;min-width:40px!important;height:40px!important;margin:0!important}}@media(max-width:390px){.expense-actions{top:7px}}
</style>
