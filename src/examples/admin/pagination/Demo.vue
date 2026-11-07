// ============================================================
// 案例：pagination 后台分页
// 页码、每页条数、删除后当前页越界自动回退
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Status = 'enabled' | 'disabled'

interface Row {
  id: number
  name: string
  owner: string
  status: Status
}

/** 初始数据：47 条，方便看到 5 页 / 3 页两种分页 */
function createRows(): Row[] {
  return Array.from({ length: 47 }, (_, index) => ({
    id: index + 1,
    name: `数据 ${String(index + 1).padStart(2, '0')}`,
    owner: ['张三', '李四', '王五'][index % 3],
    status: index % 2 === 0 ? 'enabled' : 'disabled',
  }))
}

const users = ref<Row[]>(createRows())
const page = ref(1)
const pageSize = ref(10)
const deleteCount = ref(0)

const sizeOptions = [
  { label: '5 条/页', value: 5 },
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
]

const total = computed(() => users.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pagedRows = computed(() =>
  users.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
const rangeText = computed(() => {
  if (total.value === 0) return '0 / 0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(page.value * pageSize.value, total.value)
  return `${start}-${end} / ${total.value}`
})

/** 每页条数变化：回到第一页，避免停在越界页 */
watch(pageSize, () => {
  page.value = 1
})

/** 总条数变化：当前页超过总页数时自动回退 */
watch(total, () => {
  if (page.value > pageCount.value) page.value = pageCount.value
})

function onPageSizeChange(value: string | number | boolean | undefined): void {
  pageSize.value = value === 5 || value === 20 ? value : 10
}

/** 删除当前页最后一条：顺便演示「删到空页后自动回退」 */
function deleteLast(): void {
  const current = pagedRows.value
  if (current.length === 0) return
  const last = current[current.length - 1]
  users.value = users.value.filter((user) => user.id !== last.id)
  deleteCount.value++
  if (page.value > pageCount.value) page.value = pageCount.value
}

function resetData(): void {
  users.value = createRows()
  page.value = 1
  pageSize.value = 10
  deleteCount.value = 0
}
</script>

<template>
  <div class="pg-demo">
    <p class="hint">
      分页最容易漏的是边界：每页条数一变要回到第一页，删到当前页空了要自动回退，
      最后一页的「下一页」要禁用。翻到第 3 页再删几条试试。
    </p>

    <section class="panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="label">每页</span>
          <n-select
            class="pg-size"
            size="small"
            :value="pageSize"
            :options="sizeOptions"
            @update:value="onPageSizeChange"
          />
          <span
            class="range"
            data-stat="range"
          >{{ rangeText }}</span>
        </div>
        <div class="toolbar-right">
          <n-button
            size="small"
            @click="deleteLast"
          >
            删除当前页最后一条
          </n-button>
          <n-button
            size="small"
            quaternary
            @click="resetData"
          >
            重置数据
          </n-button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>负责人</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in pagedRows"
            :key="user.id"
          >
            <td>{{ user.name }}</td>
            <td>{{ user.owner }}</td>
            <td>
              <span
                class="status"
                :class="`status--${user.status}`"
              >
                {{ user.status === 'enabled' ? '启用' : '停用' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <n-pagination
          v-model:page="page"
          :page-count="pageCount"
          :page-slot="5"
        />
      </div>

      <dl class="metrics">
        <div class="metric">
          <dt>总条数</dt>
          <dd data-stat="total">
            {{ total }}
          </dd>
        </div>
        <div class="metric">
          <dt>当前页</dt>
          <dd data-stat="page">
            {{ page }}
          </dd>
        </div>
        <div class="metric">
          <dt>总页数</dt>
          <dd data-stat="page-count">
            {{ pageCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>当前页条数</dt>
          <dd data-stat="row-count">
            {{ pagedRows.length }}
          </dd>
        </div>
        <div class="metric">
          <dt>删除次数</dt>
          <dd data-stat="delete-count">
            {{ deleteCount }}
          </dd>
        </div>
        <div class="metric metric--wide">
          <dt>首行 / 末行</dt>
          <dd data-stat="first-last">
            {{ pagedRows[0]?.name ?? '—' }} / {{ pagedRows[pagedRows.length - 1]?.name ?? '—' }}
          </dd>
        </div>
      </dl>
    </section>

    <p class="footnote">
      真实项目里分页参数通常跟查询条件一起提交；删除接口成功后，如果当前页只剩一条，
      记得把页码回退，别让用户看到一张空表。
    </p>
  </div>
</template>

<style scoped>
.pg-demo {
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

.toolbar-left,
.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.label {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.range {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.table {
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
    font-size: var(--demo-text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    background-color: var(--bg-subtle);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
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

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.55rem;
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
