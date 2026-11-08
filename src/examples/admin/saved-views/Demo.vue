// ============================================================
// 案例：saved-views 保存视图
// 把查询条件、排序、列显隐存成视图，一键切回
// ============================================================

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

// ============================================================
// 类型与演示数据
// ============================================================

type Status = 'all' | 'pending' | 'done'
type Sort = 'created-desc' | 'amount-desc'

interface QueryState {
  keyword: string
  status: Status
  sort: Sort
  /** 最低金额：0 表示不限制，视图可以保存金额门槛 */
  minAmount: number
  columns: {
    owner: boolean
    amount: boolean
  }
}

interface SavedView {
  id: string
  name: string
  query: QueryState
  isDefault: boolean
}

interface Order {
  id: number
  name: string
  status: Exclude<Status, 'all'>
  amount: number
  owner: string
  createdAt: number
}

const orders: Order[] = [
  { id: 1, name: '订单 A', status: 'pending', amount: 199, owner: '张三', createdAt: 6 },
  { id: 2, name: '订单 B', status: 'done', amount: 899, owner: '李四', createdAt: 5 },
  { id: 3, name: '订单 C', status: 'pending', amount: 1299, owner: '王五', createdAt: 4 },
  { id: 4, name: '订单 D', status: 'pending', amount: 399, owner: '赵六', createdAt: 3 },
  { id: 5, name: '订单 E', status: 'done', amount: 1599, owner: '张三', createdAt: 2 },
  { id: 6, name: '订单 F', status: 'done', amount: 299, owner: '李四', createdAt: 1 },
]

// ============================================================
// 视图与当前查询
// ============================================================

/** 复制一份查询条件，避免视图和当前状态共用同一个对象 */
function cloneQuery(source: QueryState): QueryState {
  return {
    keyword: source.keyword,
    status: source.status,
    sort: source.sort,
    minAmount: source.minAmount,
    columns: { ...source.columns },
  }
}

/** 把视图条件写回当前查询；列显隐也要整体替换，不能直接改引用 */
function applyQuery(source: QueryState): void {
  query.keyword = source.keyword
  query.status = source.status
  query.sort = source.sort
  query.minAmount = source.minAmount
  query.columns = { ...source.columns }
}

const query = reactive<QueryState>({
  keyword: '',
  status: 'all',
  sort: 'created-desc',
  minAmount: 0,
  columns: { owner: true, amount: true },
})

const views = ref<SavedView[]>([
  {
    id: 'all',
    name: '全部订单',
    query: cloneQuery(query),
    isDefault: true,
  },
  {
    id: 'pending',
    name: '待处理',
    query: {
      keyword: '',
      status: 'pending',
      sort: 'created-desc',
      minAmount: 0,
      columns: { owner: true, amount: true },
    },
    isDefault: true,
  },
  {
    id: 'high-amount',
    name: '高金额',
    query: {
      keyword: '',
      status: 'all',
      sort: 'amount-desc',
      minAmount: 1000,
      columns: { owner: false, amount: true },
    },
    isDefault: true,
  },
])

const currentViewId = ref('all')
const newViewName = ref('')
let nextViewId = 1

const currentView = computed(() =>
  views.value.find((view) => view.id === currentViewId.value),
)

/** 当前状态和当前视图快照是否一致：字符串比较最直接，也方便显示脏标记 */
function serialize(source: QueryState): string {
  return JSON.stringify([
    source.keyword.trim(),
    source.status,
    source.sort,
    source.minAmount,
    source.columns.owner,
    source.columns.amount,
  ])
}

const dirty = computed(() => {
  if (!currentView.value) return false
  return serialize(query) !== serialize(currentView.value.query)
})

const visibleColumnCount = computed(
  () => 2 + Number(query.columns.owner) + Number(query.columns.amount),
)

const results = computed(() => {
  const keyword = query.keyword.trim().toLowerCase()
  const filtered = orders.filter((order) => {
    const matchStatus = query.status === 'all' || order.status === query.status
    const matchAmount = order.amount >= query.minAmount
    const matchKeyword =
      !keyword ||
      order.name.toLowerCase().includes(keyword) ||
      order.owner.toLowerCase().includes(keyword)
    return matchStatus && matchAmount && matchKeyword
  })

  return [...filtered].sort((left, right) =>
    query.sort === 'amount-desc'
      ? right.amount - left.amount
      : right.createdAt - left.createdAt,
  )
})

const statusText = computed(() => (dirty.value ? '有未保存修改' : '与当前视图一致'))

// ============================================================
// 视图操作
// ============================================================

/** 切换视图：先复制条件再应用，之后改筛选不会污染原视图 */
function switchView(id: string): void {
  const target = views.value.find((view) => view.id === id)
  if (!target) return
  currentViewId.value = id
  applyQuery(target.query)
  newViewName.value = ''
}

function saveAsNew(): void {
  const name = newViewName.value.trim() || `视图 ${views.value.length + 1}`
  const id = `view-${nextViewId++}`
  views.value.push({
    id,
    name,
    query: cloneQuery(query),
    isDefault: false,
  })
  currentViewId.value = id
  newViewName.value = ''
}

/** 更新当前视图：默认视图不允许改，避免用户把系统预设改坏 */
function updateCurrent(): void {
  const target = currentView.value
  if (!target || target.isDefault) return
  target.query = cloneQuery(query)
}

function deleteCurrent(): void {
  const target = currentView.value
  if (!target || target.isDefault) return
  views.value = views.value.filter((view) => view.id !== target.id)
  switchView('all')
}

function restoreDefault(): void {
  switchView('all')
}
</script>

<template>
  <div class="sv-demo">
    <div class="sv-toolbar">
      <n-input
        v-model:value="query.keyword"
        data-field="keyword"
        class="sv-keyword"
        clearable
        placeholder="搜索订单或负责人"
      />
      <span class="sv-amount-label">金额 ≥</span>
      <n-input-number
        :value="query.minAmount"
        data-field="minAmount"
        class="sv-amount"
        :min="0"
        :step="100"
        placeholder="最低金额"
        @update:value="query.minAmount = Number($event ?? 0)"
      />
      <n-radio-group
        v-model:value="query.status"
        class="sv-status"
        size="small"
      >
        <n-radio-button value="all">
          全部
        </n-radio-button>
        <n-radio-button value="pending">
          待处理
        </n-radio-button>
        <n-radio-button value="done">
          已完成
        </n-radio-button>
      </n-radio-group>
      <n-radio-group
        v-model:value="query.sort"
        class="sv-sort"
        size="small"
      >
        <n-radio-button value="created-desc">
          最新优先
        </n-radio-button>
        <n-radio-button value="amount-desc">
          金额从高到低
        </n-radio-button>
      </n-radio-group>
    </div>

    <div class="sv-columns">
      <span class="sv-columns-label">显示列</span>
      <n-checkbox
        :checked="query.columns.owner"
        @update:checked="query.columns.owner = $event"
      >
        负责人
      </n-checkbox>
      <n-checkbox
        :checked="query.columns.amount"
        @update:checked="query.columns.amount = $event"
      >
        金额
      </n-checkbox>
    </div>

    <div class="sv-body">
      <div class="sv-table-wrap">
        <table class="sv-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>状态</th>
              <th v-if="query.columns.owner">
                负责人
              </th>
              <th v-if="query.columns.amount">
                金额
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in results"
              :key="order.id"
            >
              <td>{{ order.name }}</td>
              <td>
                <span
                  class="sv-status-dot"
                  :class="order.status"
                >
                  {{ order.status === 'pending' ? '待处理' : '已完成' }}
                </span>
              </td>
              <td v-if="query.columns.owner">
                {{ order.owner }}
              </td>
              <td v-if="query.columns.amount">
                ¥{{ order.amount }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!results.length"
          class="sv-empty"
        >
          没有符合条件的订单
        </p>
      </div>

      <aside class="sv-side">
        <div class="sv-side-head">
          <strong>我的视图</strong>
          <span data-stat="view-count">{{ views.length }}</span>
        </div>

        <button
          v-for="view in views"
          :key="view.id"
          :data-view="view.id"
          class="sv-view"
          :class="{ active: view.id === currentViewId }"
          type="button"
          @click="switchView(view.id)"
        >
          <span>{{ view.name }}</span>
          <span
            v-if="view.isDefault"
            class="sv-default"
          >默认</span>
        </button>

        <n-input
          v-model:value="newViewName"
          data-field="viewName"
          size="small"
          placeholder="新视图名称"
        />

        <div class="sv-actions">
          <n-button
            size="small"
            type="primary"
            @click="saveAsNew"
          >
            保存为新视图
          </n-button>
          <n-button
            size="small"
            :disabled="Boolean(currentView?.isDefault)"
            @click="updateCurrent"
          >
            更新当前视图
          </n-button>
          <n-button
            size="small"
            type="error"
            ghost
            :disabled="Boolean(currentView?.isDefault)"
            @click="deleteCurrent"
          >
            删除当前视图
          </n-button>
          <n-button
            size="small"
            @click="restoreDefault"
          >
            恢复默认
          </n-button>
        </div>

        <p class="sv-hint">
          默认视图不可删除；改筛选、排序或列显隐后，点「更新当前视图」才会覆盖快照。
        </p>
      </aside>
    </div>

    <div class="sv-stats">
      <span class="sv-stat">
        <em>当前视图</em>
        <b data-stat="current-view">{{ currentView?.name ?? '—' }}</b>
      </span>
      <span class="sv-stat">
        <em>结果</em>
        <b data-stat="result-count">{{ results.length }}</b>
      </span>
      <span class="sv-stat">
        <em>可见列</em>
        <b data-stat="visible-columns">{{ visibleColumnCount }}</b>
      </span>
      <span class="sv-stat">
        <em>未保存</em>
        <b data-stat="dirty">{{ dirty ? 1 : 0 }}</b>
      </span>
      <span class="sv-stat sv-stat-wide">
        <em>状态</em>
        <b data-stat="status-text">{{ statusText }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sv-demo {
  display: grid;
  gap: 0.75rem;
}

.sv-toolbar,
.sv-columns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.sv-keyword {
  width: 15rem;
  max-width: 100%;
}

.sv-amount-label {
  color: var(--text-2);
  font-size: var(--demo-text-sm);
  line-height: 36px;
}

.sv-amount {
  width: 9rem;
  max-width: 100%;
}

.sv-columns {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.sv-columns-label {
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.sv-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15rem;
  gap: 0.75rem;
  align-items: start;
}

.sv-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
}

.sv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);
}

.sv-table th,
.sv-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.sv-table th {
  color: var(--text-soft);
  font-weight: 600;
  background: var(--bg-subtle);
}

.sv-table tbody tr:last-child td {
  border-bottom: 0;
}

.sv-status-dot {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--demo-text-xs);
}

.sv-status-dot::before {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--warning);
  content: '';
}

.sv-status-dot.done::before {
  background: var(--success);
}

.sv-empty {
  margin: 0;
  padding: 1rem;
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
  text-align: center;
}

.sv-side {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.sv-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--demo-text-sm);
}

.sv-side-head span {
  min-width: 1.5rem;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  background: var(--bg);
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  text-align: center;
}

.sv-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid transparent;
  border-radius: var(--demo-radius);
  background: transparent;
  color: var(--text);
  font-size: var(--demo-text-sm);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.18s var(--ease-out),
    border-color 0.18s var(--ease-out);
}

.sv-view:hover,
.sv-view.active {
  border-color: color-mix(in srgb, var(--primary) 32%, var(--border));
  background: color-mix(in srgb, var(--primary) 9%, var(--bg));
}

.sv-default {
  flex: none;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  background: color-mix(in srgb, var(--primary) 14%, var(--bg));
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.sv-actions {
  display: grid;
  gap: 0.4rem;
}

.sv-hint {
  margin: 0;
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
}

.sv-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.sv-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: var(--demo-text-sm);
}

.sv-stat em {
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  font-style: normal;
}

.sv-stat b {
  color: var(--text);
  font-weight: 600;
}

.sv-stat-wide {
  margin-left: auto;
}

@media (max-width: 760px) {
  .sv-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .sv-stat-wide {
    margin-left: 0;
  }
}
</style>
