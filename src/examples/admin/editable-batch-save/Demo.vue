// ============================================================
// 案例：editable-batch-save 可编辑表格批量保存
// 改一格不立刻存，攒脏行统一保存，失败行保留
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type Mode = 'instant' | 'batch'
type Field = 'name' | 'amount'

interface EditableRow {
  id: number
  name: string
  amount: number
  dirty: boolean
  failed: boolean
}

function createRows(): EditableRow[] {
  return [
    { id: 1, name: '机械键盘', amount: 199, dirty: false, failed: false },
    { id: 2, name: '无线鼠标', amount: 89, dirty: false, failed: false },
    { id: 3, name: '显示器', amount: 1299, dirty: false, failed: false },
    { id: 4, name: '降噪耳机', amount: 399, dirty: false, failed: false },
  ]
}

const mode = ref<Mode>('batch')
const rows = ref<EditableRow[]>(createRows())
const saveCount = ref(0)
const statusText = ref('待修改')

const dirtyCount = computed(() => rows.value.filter((row) => row.dirty).length)
const failedCount = computed(() => rows.value.filter((row) => row.failed).length)

function onEdit(row: EditableRow, field: Field, value: string | number): void {
  if (field === 'name') {
    row.name = String(value)
  } else {
    row.amount = Number(value) || 0
  }
  row.dirty = true
  row.failed = false

  if (mode.value === 'instant') {
    //! 即时保存：每改一格就发一次请求，表格里立刻变干净
    saveCount.value++
    row.dirty = false
    statusText.value = '已保存'
  } else {
    statusText.value = '有未保存修改'
  }
}

function saveAll(): void {
  const pending = rows.value.filter((row) => row.dirty)
  if (!pending.length) {
    statusText.value = '没有待保存修改'
    return
  }

  saveCount.value += pending.length
  let failed = 0
  for (const row of pending) {
    if (row.id === 3) {
      //! 失败行保留脏标记，用户改完还能再点保存
      row.failed = true
      failed++
      continue
    }
    row.dirty = false
    row.failed = false
  }

  statusText.value = failed ? `${failed} 行保存失败，已保留` : '全部保存成功'
}

function reset(): void {
  rows.value = createRows()
  saveCount.value = 0
  statusText.value = '待修改'
}

function onModeChange(value: string | number | boolean | undefined): void {
  if (value !== 'instant' && value !== 'batch') return
  mode.value = value
  reset()
}
</script>

<template>
  <div class="ebs-demo">
    <p class="hint">
      批量模式改三格只会标脏，点「保存全部」才发请求；第 3 行固定失败，失败行会保留，
      改完可以再保存一次。
    </p>

    <div class="toolbar">
      <n-radio-group
        :value="mode"
        size="small"
        @update:value="onModeChange"
      >
        <n-radio-button value="batch">
          批量保存
        </n-radio-button>
        <n-radio-button value="instant">
          即时保存
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        type="primary"
        @click="saveAll"
      >
        保存全部
      </n-button>
      <n-button
        size="small"
        quaternary
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <table class="grid">
      <thead>
        <tr>
          <th>商品</th>
          <th>名称</th>
          <th>价格</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          :data-row="row.id"
          :class="{ 'is-dirty': row.dirty, 'is-failed': row.failed }"
        >
          <td>{{ row.id }}</td>
          <td>
            <span data-field="name">
              <n-input
                :value="row.name"
                size="small"
                @update:value="onEdit(row, 'name', $event)"
              />
            </span>
          </td>
          <td>
            <span data-field="amount">
              <n-input
                :value="String(row.amount)"
                size="small"
                @update:value="onEdit(row, 'amount', $event)"
              />
            </span>
          </td>
          <td class="state">
            <span v-if="row.failed">保存失败</span>
            <span v-else-if="row.dirty">待保存</span>
            <span v-else>已保存</span>
          </td>
        </tr>
      </tbody>
    </table>

    <dl class="metrics">
      <div class="metric">
        <dt>待保存</dt>
        <dd data-stat="dirty-count">
          {{ dirtyCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>保存次数</dt>
        <dd data-stat="save-count">
          {{ saveCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>失败行</dt>
        <dd data-stat="failed-count">
          {{ failedCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>状态</dt>
        <dd data-stat="status-text">
          {{ statusText }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped lang="scss">
.ebs-demo {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);

  th,
  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  th {
    color: var(--text-muted);
    font-weight: 500;
    font-size: var(--demo-text-xs);
  }

  tr.is-dirty td {
    background: color-mix(in srgb, var(--warning) 8%, transparent);
  }

  tr.is-failed td {
    background: color-mix(in srgb, var(--danger) 8%, transparent);
  }
}

.state {
  white-space: nowrap;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.metric {
  padding: 0.5rem 0.6rem;
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  text-align: center;

  dt {
    color: var(--text-muted);
    font-size: var(--demo-text-xs);
  }

  dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 640px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
