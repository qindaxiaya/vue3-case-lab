// ============================================================
// 案例：column-settings 表格列设置
// 列的显示 / 隐藏 / 排序 / 持久化 / 恢复默认
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// ============================================================
// 列定义与演示数据
// ============================================================

type ColumnKey = 'name' | 'status' | 'owner' | 'updated' | 'amount'

interface Column {
  key: ColumnKey
  label: string
  /** 固定列不允许隐藏：表格至少要有能识别行的字段 */
  fixed?: boolean
}

interface Row {
  id: number
  name: string
  status: 'enabled' | 'disabled'
  owner: string
  updated: string
  amount: number
}

const allColumns: Column[] = [
  { key: 'name', label: '名称', fixed: true },
  { key: 'status', label: '状态' },
  { key: 'owner', label: '负责人' },
  { key: 'updated', label: '更新时间' },
  { key: 'amount', label: '金额' },
]

const allKeys = allColumns.map((column) => column.key)
const STORAGE_KEY = 'demo-admin-columns'

const rows: Row[] = [
  { id: 1, name: '月度报表', status: 'enabled', owner: '张三', updated: '11-01 09:12', amount: 12800 },
  { id: 2, name: '季度报表', status: 'enabled', owner: '李四', updated: '11-02 14:30', amount: 35600 },
  { id: 3, name: '用户增长', status: 'disabled', owner: '王五', updated: '11-03 10:05', amount: 8900 },
  { id: 4, name: '订单明细', status: 'enabled', owner: '张三', updated: '11-04 16:48', amount: 52100 },
  { id: 5, name: '库存预警', status: 'disabled', owner: '李四', updated: '11-05 08:20', amount: 6700 },
]

/** 当前列顺序：只影响显示顺序，不影响数据本身 */
const order = ref<ColumnKey[]>([...allKeys])

/** 当前显隐：用普通对象而不是 Set，方便模板直接读、也方便整体替换 */
const visible = ref<Record<ColumnKey, boolean>>({
  name: true,
  status: true,
  owner: true,
  updated: true,
  amount: true,
})

const resetCount = ref(0)
const lastAction = ref('默认配置')
let skipNextSave = false

// ============================================================
// 读取 / 保存配置
// ============================================================

/** 从 localStorage 读取上次的列配置；字段缺失或脏数据就退回默认 */
function loadConfig(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { order?: unknown; visible?: unknown }

    if (Array.isArray(data.order)) {
      const valid = data.order.filter(
        (key): key is ColumnKey => typeof key === 'string' && allKeys.includes(key as ColumnKey),
      )
      // 旧版本删掉过列时，缺的列补在末尾，避免表格少列
      order.value = [...valid, ...allKeys.filter((key) => !valid.includes(key))]
    }

    if (data.visible && typeof data.visible === 'object') {
      const saved = data.visible as Record<string, unknown>
      for (const key of allKeys) {
        if (typeof saved[key] === 'boolean') visible.value[key] = saved[key]
      }
    }
    lastAction.value = '已恢复上次配置'
  } catch {
    // 配置坏了就清掉，下一次改动会重新写一份合法的
    localStorage.removeItem(STORAGE_KEY)
  }
}

loadConfig()

/** 任何改动都自动落盘；重置时跳过一次，避免刚清掉又写回默认值 */
watch(
  [order, visible],
  () => {
    if (skipNextSave) {
      skipNextSave = false
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: order.value, visible: visible.value }))
    lastAction.value = '已保存到本地'
  },
  { deep: true },
)

// ============================================================
// 派生状态与操作
// ============================================================

const visibleColumns = computed(() =>
  order.value
    .filter((key) => visible.value[key])
    .map((key) => allColumns.find((column) => column.key === key)!)
    .filter(Boolean),
)

const visibleCount = computed(() => visibleColumns.value.length)
const hiddenCount = computed(() => allKeys.length - visibleCount.value)
const columnOrderText = computed(() => visibleColumns.value.map((column) => column.label).join(' / '))

/** 隐藏最后一列没有意义；固定列也不允许隐藏 */
function setVisible(key: ColumnKey, checked: boolean): void {
  const column = allColumns.find((item) => item.key === key)
  if (!column || column.fixed) return
  if (!checked && visibleCount.value <= 1) return
  visible.value = { ...visible.value, [key]: checked }
}

/** 上移 / 下移：交换相邻两项，越界直接忽略 */
function move(key: ColumnKey, delta: -1 | 1): void {
  const index = order.value.indexOf(key)
  const target = index + delta
  if (index < 0 || target < 0 || target >= order.value.length) return
  const next = [...order.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  order.value = next
}

/** 恢复默认：顺序、显隐、本地存储一起回到初始状态 */
function reset(): void {
  skipNextSave = true
  order.value = [...allKeys]
  visible.value = { name: true, status: true, owner: true, updated: true, amount: true }
  localStorage.removeItem(STORAGE_KEY)
  resetCount.value++
  lastAction.value = '已恢复默认'
  // 没有实际改动时 watch 不会触发，这里手动把标记放回去
  queueMicrotask(() => {
    skipNextSave = false
  })
}

function cellText(row: Row, key: ColumnKey): string {
  if (key === 'status') return row.status === 'enabled' ? '启用' : '停用'
  if (key === 'amount') return `¥${row.amount.toLocaleString('zh-CN')}`
  return String(row[key])
}
</script>

<template>
  <div class="cs-demo">
    <p class="hint">
      表格列不该写死：用户按自己的习惯隐藏不关心的列、调整顺序，下次打开还能记住。
      名称列固定显示，避免把表格改到「认不出是哪一行」。
    </p>

    <section class="settings">
      <header class="settings-head">
        <div>
          <h3>列设置</h3>
          <p class="sub">
            显示 {{ visibleCount }} / {{ allKeys.length }} 列，隐藏 {{ hiddenCount }} 列
          </p>
        </div>
        <n-button
          size="small"
          @click="reset"
        >
          恢复默认
        </n-button>
      </header>

      <ul class="column-list">
        <li
          v-for="column in allColumns"
          :key="column.key"
          class="column-row"
          :data-column="column.key"
        >
          <n-checkbox
            :checked="visible[column.key]"
            :disabled="column.fixed"
            @update:checked="(checked: boolean) => setVisible(column.key, checked)"
          >
            {{ column.label }}
            <span
              v-if="column.fixed"
              class="fixed-tag"
            >固定</span>
          </n-checkbox>

          <div class="column-actions">
            <n-button
              size="tiny"
              :disabled="order.indexOf(column.key) === 0"
              @click="move(column.key, -1)"
            >
              上移
            </n-button>
            <n-button
              size="tiny"
              :disabled="order.indexOf(column.key) === order.length - 1"
              @click="move(column.key, 1)"
            >
              下移
            </n-button>
          </div>
        </li>
      </ul>

      <p class="order-text">
        当前顺序：<span data-stat="column-order">{{ columnOrderText }}</span>
      </p>
    </section>

    <section class="table-wrap">
      <div class="table-head">
        <h3>报表列表</h3>
        <span
          class="badge"
          data-stat="visible-count"
        >{{ visibleCount }} 列</span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th
                v-for="column in visibleColumns"
                :key="column.key"
                :data-col="column.key"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
            >
              <td
                v-for="column in visibleColumns"
                :key="column.key"
              >
                <n-tag
                  v-if="column.key === 'status'"
                  size="small"
                  :type="row.status === 'enabled' ? 'success' : 'default'"
                >
                  {{ cellText(row, column.key) }}
                </n-tag>
                <template v-else>
                  {{ cellText(row, column.key) }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dl class="metrics">
      <div class="metric">
        <dt>隐藏列</dt>
        <dd data-stat="hidden-count">
          {{ hiddenCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>恢复默认</dt>
        <dd data-stat="reset-count">
          {{ resetCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>最近操作</dt>
        <dd data-stat="last-action">
          {{ lastAction }}
        </dd>
      </div>
    </dl>

    <p class="footnote">
      配置只存列 key，不存整个列对象：改标题、改宽度时不会把旧配置顶掉；
      读取时过滤掉不认识的 key，删列、改名都不会把表格弄崩。
    </p>
  </div>
</template>

<style scoped>
.cs-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint,
.footnote {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.footnote {
  font-size: var(--demo-text-xs);
}

.settings,
.table-wrap {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.settings-head,
.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.settings-head h3,
.table-head h3 {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.sub {
  margin: 0.1rem 0 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.column-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.8rem;
  margin: 0.55rem 0 0;
  padding: 0;
  list-style: none;
}

.column-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
}

.fixed-tag {
  margin-left: 0.25rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.column-actions {
  display: inline-flex;
  gap: 0.2rem;
}

.order-text {
  margin: 0.5rem 0 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

.badge {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.table-scroll {
  margin-top: 0.5rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);
}

th,
td {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

th {
  background-color: var(--bg-subtle);
  font-weight: 600;
  color: var(--text);
}

td {
  color: var(--text-secondary);
}

tbody tr:last-child td {
  border-bottom: 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--demo-text-sm);
    font-weight: 600;
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .column-list {
    grid-template-columns: 1fr;
  }

  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
