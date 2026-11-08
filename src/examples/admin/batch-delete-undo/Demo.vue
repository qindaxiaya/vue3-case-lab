// ============================================================
// 案例：batch-delete-undo 批量删除撤销
// 删除先移除行，3 秒内可撤销，超时入口消失
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

interface Row {
  id: number
  name: string
  owner: string
}

interface PendingDelete {
  ids: number[]
  expiresAt: number
}

interface RemovedRow {
  row: Row
  index: number
}

/** 演示数据：重置时从这里复制，避免改到原始数组 */
const initialRows: Row[] = [
  { id: 1, name: '月度报表', owner: '张三' },
  { id: 2, name: '季度报表', owner: '李四' },
  { id: 3, name: '用户增长', owner: '王五' },
  { id: 4, name: '订单明细', owner: '张三' },
  { id: 5, name: '库存预警', owner: '李四' },
  { id: 6, name: '销售看板', owner: '王五' },
  { id: 7, name: '渠道分析', owner: '张三' },
  { id: 8, name: '退款记录', owner: '李四' },
]

const UNDO_MS = 3000

const rows = ref<Row[]>(initialRows.map((row) => ({ ...row })))
const selectedIds = ref<Set<number>>(new Set())
/**! 待撤销批次只存 id、过期时间，真正恢复顺序靠 removedRows 里的原索引 */
const pending = ref<PendingDelete | null>(null)
const removedRows = ref<RemovedRow[]>([])
const remaining = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

const selectedCount = computed(() => selectedIds.value.size)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.has(row.id)),
)
const undoCount = computed(() => pending.value?.ids.length ?? 0)
const statusText = computed(() =>
  pending.value ? `已删除 ${pending.value.ids.length} 条，可撤销` : '—',
)

function toggleRow(id: number): void {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleAll(): void {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(rows.value.map((row) => row.id))
}

/** 结束上一批撤销窗口：只清状态，不动已经删掉的行 */
function finalizePending(): void {
  pending.value = null
  removedRows.value = []
  remaining.value = 0
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/**! 每 100ms 刷新剩余秒数，到 0 就把撤销入口收掉 */
function startCountdown(expiresAt: number): void {
  if (timer !== null) window.clearInterval(timer)
  timer = window.setInterval(() => {
    const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    remaining.value = left
    if (left <= 0) finalizePending()
  }, 100)
}

/**! 删除时记下原索引，撤销才能插回原来的位置 */
function deleteSelected(): void {
  if (selectedIds.value.size === 0) return
  if (pending.value) finalizePending()

  const ids = [...selectedIds.value]
  const snapshot: RemovedRow[] = []
  rows.value.forEach((row, index) => {
    if (selectedIds.value.has(row.id)) snapshot.push({ row, index })
  })

  const expiresAt = Date.now() + UNDO_MS
  rows.value = rows.value.filter((row) => !selectedIds.value.has(row.id))
  removedRows.value = snapshot
  pending.value = { ids, expiresAt }
  selectedIds.value = new Set()
  remaining.value = Math.ceil(UNDO_MS / 1000)
  startCountdown(expiresAt)
}

/** 按原索引升序插回，多行删除也能恢复成删除前的顺序 */
function undoDelete(): void {
  if (!pending.value) return
  const snapshot = [...removedRows.value].sort((a, b) => a.index - b.index)
  snapshot.forEach(({ row, index }) => {
    rows.value.splice(index, 0, row)
  })
  finalizePending()
}

function reset(): void {
  finalizePending()
  rows.value = initialRows.map((row) => ({ ...row }))
  selectedIds.value = new Set()
}

onUnmounted(() => {
  //! 卸载时清定时器，避免回调去改已经销毁的页面状态
  if (timer !== null) window.clearInterval(timer)
})
</script>

<template>
  <div class="bdu-demo">
    <p class="hint">
      删除先真的把行移除，再给 3 秒撤销窗口。
      勾两行删掉，趁倒计时没结束点「撤销删除」，看它们能不能回到原来的位置。
    </p>

    <section class="panel">
      <div class="toolbar">
        <div class="summary">
          已选
          <strong data-stat="selected-count">{{ selectedCount }}</strong>
          项 · 共
          <strong data-stat="row-count">{{ rows.length }}</strong>
          行
        </div>
        <div class="actions">
          <n-button
            size="small"
            type="error"
            :disabled="selectedCount === 0"
            data-action="delete"
            @click="deleteSelected"
          >
            删除所选
          </n-button>
          <n-button
            size="small"
            quaternary
            data-action="reset"
            @click="reset"
          >
            重置
          </n-button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th class="check-col">
              <n-checkbox
                :checked="allSelected"
                :indeterminate="selectedCount > 0 && !allSelected"
                :disabled="rows.length === 0"
                aria-label="全选"
                @update:checked="toggleAll"
              />
            </th>
            <th>名称</th>
            <th class="owner-col">
              负责人
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :data-row="row.id"
            :class="{ 'row--selected': selectedIds.has(row.id) }"
          >
            <td class="check-col">
              <n-checkbox
                :data-row-check="row.id"
                :checked="selectedIds.has(row.id)"
                :aria-label="`选择 ${row.name}`"
                @update:checked="toggleRow(row.id)"
              />
            </td>
            <td>{{ row.name }}</td>
            <td class="owner-col">
              {{ row.owner }}
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td
              class="empty"
              colspan="3"
            >
              列表已清空
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 撤销槽位始终占位，撤销条出现时不会把表格往下推 -->
      <div class="undo-slot">
        <div
          v-if="pending"
          class="undo-bar"
        >
          <span class="undo-text">
            已删除
            <strong data-stat="undo-count">{{ undoCount }}</strong>
            条
            <span
              class="undo-status"
              data-stat="status-text"
            >{{ statusText }}</span>
          </span>
          <span class="undo-time">
            <strong data-stat="remaining">{{ remaining }}</strong>
            秒后不可撤销
          </span>
          <n-button
            size="tiny"
            type="primary"
            data-action="undo"
            @click="undoDelete"
          >
            撤销删除
          </n-button>
        </div>
      </div>
    </section>

    <p class="footnote">
      撤销窗口结束前只清掉撤销入口，不要重新请求列表：行已经删掉了，刷新反而会让用户
      看到「删了又回来」的假象。再次删除时先结束上一批，避免两个撤销条打架。
    </p>
  </div>
</template>

<style scoped>
.bdu-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
}

.summary {
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);

  th,
  td {
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    font-size: var(--demo-text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    background-color: var(--bg-subtle);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.check-col {
  width: 2.5rem;
}

.row--selected {
  background-color: color-mix(in srgb, var(--primary) 8%, transparent);
}

.empty {
  padding: 1.2rem 0.5rem;
  text-align: center;
  color: var(--text-secondary);
}

.undo-slot {
  min-height: 2.6rem;
  margin-top: 0.6rem;
}

.undo-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  border-radius: var(--demo-radius);
  background-color: color-mix(in srgb, var(--warning) 8%, var(--bg));
  font-size: var(--demo-text-sm);
}

.undo-text {
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.undo-status {
  margin-left: 0.25rem;
  color: var(--warning);
}

.undo-time {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    color: var(--warning);
  }
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .owner-col {
    display: none;
  }

  .undo-time {
    margin-left: 0;
  }
}
</style>
