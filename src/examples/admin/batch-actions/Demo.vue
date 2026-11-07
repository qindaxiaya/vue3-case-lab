// ============================================================
// 案例：batch-actions 后台表格批量操作
// 全选 / 半选 / 批量执行 / 执行后清空选择
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

type Status = 'enabled' | 'disabled'

interface Row {
  id: number
  name: string
  owner: string
  status: Status
}

/** 演示数据：真实项目里来自接口 */
const rows = ref<Row[]>([
  { id: 1, name: '月度报表', owner: '张三', status: 'enabled' },
  { id: 2, name: '季度报表', owner: '李四', status: 'enabled' },
  { id: 3, name: '用户增长', owner: '王五', status: 'disabled' },
  { id: 4, name: '订单明细', owner: '张三', status: 'enabled' },
  { id: 5, name: '库存预警', owner: '李四', status: 'disabled' },
  { id: 6, name: '销售看板', owner: '王五', status: 'enabled' },
  { id: 7, name: '渠道分析', owner: '张三', status: 'disabled' },
  { id: 8, name: '退款记录', owner: '李四', status: 'disabled' },
])

const selectedIds = ref<number[]>([])
const busy = ref(false)
const batchCount = ref(0)
const lastAction = ref('—')

let actionTimer: number | null = null

const allChecked = computed(() => rows.value.length > 0 && selectedIds.value.length === rows.value.length)
const indeterminate = computed(
  () => selectedIds.value.length > 0 && selectedIds.value.length < rows.value.length,
)
const selectedCount = computed(() => selectedIds.value.length)
const enabledCount = computed(() => rows.value.filter((row) => row.status === 'enabled').length)
const disabledCount = computed(() => rows.value.length - enabledCount.value)

/** 全选 / 取消全选：只处理当前页，跨页选择要另存一份 id 集合 */
function toggleAll(checked: boolean): void {
  selectedIds.value = checked ? rows.value.map((row) => row.id) : []
}

/** 单行勾选 */
function toggleRow(id: number, checked: boolean): void {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
  }
}

function clearSelection(): void {
  selectedIds.value = []
}

/** 批量操作：执行中直接忽略，成功后清空选择 */
function runBatch(action: Status): void {
  if (busy.value || selectedIds.value.length === 0) return
  const count = selectedIds.value.length
  const ids = [...selectedIds.value]
  busy.value = true

  actionTimer = window.setTimeout(() => {
    rows.value = rows.value.map((row) =>
      ids.includes(row.id) ? { ...row, status: action } : row,
    )
    batchCount.value++
    lastAction.value = `${action === 'enabled' ? '批量启用' : '批量停用'} ${count} 项`
    selectedIds.value = []
    busy.value = false
    actionTimer = null
  }, 450)
}

onUnmounted(() => {
  if (actionTimer !== null) window.clearTimeout(actionTimer)
})
</script>

<template>
  <div class="ba-demo">
    <p class="hint">
      批量操作最怕三件事：半选状态没显示、执行中还能点、执行完选择没清。
      勾选几行看表头复选框的变化，再执行一次批量操作。
    </p>

    <section class="panel">
      <div class="toolbar">
        <div class="summary">
          已选
          <strong data-stat="selected-count">{{ selectedCount }}</strong>
          项
          <span
            v-if="indeterminate"
            class="badge"
          >半选</span>
          <span
            v-else-if="allChecked"
            class="badge"
          >全选</span>
        </div>
        <div class="actions">
          <n-button
            size="small"
            :disabled="selectedCount === 0 || busy"
            @click="runBatch('enabled')"
          >
            批量启用
          </n-button>
          <n-button
            size="small"
            type="warning"
            :disabled="selectedCount === 0 || busy"
            @click="runBatch('disabled')"
          >
            批量停用
          </n-button>
          <n-button
            size="small"
            quaternary
            :disabled="selectedCount === 0 || busy"
            @click="clearSelection"
          >
            清空选择
          </n-button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th class="check-col">
              <n-checkbox
                class="all-check"
                :checked="allChecked"
                :indeterminate="indeterminate"
                :disabled="busy"
                @update:checked="toggleAll"
              />
            </th>
            <th>名称</th>
            <th>负责人</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="{ 'row--selected': selectedIds.includes(row.id) }"
          >
            <td class="check-col">
              <n-checkbox
                class="row-check"
                :data-row="row.id"
                :checked="selectedIds.includes(row.id)"
                :disabled="busy"
                @update:checked="(checked: boolean) => toggleRow(row.id, checked)"
              />
            </td>
            <td>{{ row.name }}</td>
            <td>{{ row.owner }}</td>
            <td>
              <span
                class="status"
                :class="`status--${row.status}`"
              >
                {{ row.status === 'enabled' ? '启用' : '停用' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <dl class="metrics">
        <div class="metric">
          <dt>启用</dt>
          <dd data-stat="enabled-count">
            {{ enabledCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>停用</dt>
          <dd data-stat="disabled-count">
            {{ disabledCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>批量操作</dt>
          <dd data-stat="batch-count">
            {{ batchCount }}
          </dd>
        </div>
        <div class="metric metric--wide">
          <dt>最近操作</dt>
          <dd data-stat="last-action">
            {{ lastAction }}
          </dd>
        </div>
      </dl>
    </section>

    <p class="footnote">
      真实项目里批量接口通常只返回成功 / 失败 id：成功的行从选择里移除，失败的保留，
      不要一上来就清空全部选择。
    </p>
  </div>
</template>

<style scoped>
.ba-demo {
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

.badge {
  margin-left: 0.35rem;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
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

.status {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.status--enabled {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.status--disabled {
  color: var(--text-secondary);
  background-color: var(--bg-subtle);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.65rem 0 0;
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
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }
}

.metric--wide dd {
  font-size: var(--demo-text-sm);
  font-weight: 500;
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
