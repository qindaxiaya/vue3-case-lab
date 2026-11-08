// ============================================================
// 案例：cross-page-selection 跨页选择
// 翻页 / 筛选只改变可见行，已选集合不丢
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type Status = 'pending' | 'done'
type FilterStatus = 'all' | Status

interface Row {
  id: number
  name: string
  status: Status
  owner: string
}

/** 演示数据：真实项目里来自接口，id 才是选择的稳定标识 */
const rows: Row[] = [
  { id: 1, name: '月度报表', status: 'pending', owner: '张三' },
  { id: 2, name: '季度报表', status: 'pending', owner: '李四' },
  { id: 3, name: '用户增长', status: 'pending', owner: '王五' },
  { id: 4, name: '订单明细', status: 'pending', owner: '张三' },
  { id: 5, name: '库存预警', status: 'pending', owner: '李四' },
  { id: 6, name: '销售看板', status: 'pending', owner: '王五' },
  { id: 7, name: '渠道分析', status: 'done', owner: '张三' },
  { id: 8, name: '退款记录', status: 'done', owner: '李四' },
  { id: 9, name: '权限配置', status: 'done', owner: '王五' },
  { id: 10, name: '审计日志', status: 'done', owner: '张三' },
]

const PAGE_SIZE = 5

const status = ref<FilterStatus>('all')
const page = ref(1)
/**! 用 Set 存跨页选择：翻页、筛选只改可见行，不清空它 */
const selectedIds = ref<Set<number>>(new Set())

const filteredRows = computed(() =>
  status.value === 'all' ? rows : rows.filter((row) => row.status === status.value),
)

const filteredCount = computed(() => filteredRows.value.length)

const pageCount = computed(() => Math.max(1, Math.ceil(filteredCount.value / PAGE_SIZE)))

const pageRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

const selectedCount = computed(() => selectedIds.value.size)

/**! 本页全选只由本页行派生，跨页已选不影响它 */
const pageAllSelected = computed(
  () => pageRows.value.length > 0 && pageRows.value.every((row) => selectedIds.value.has(row.id)),
)

/**! 半选 = 本页选了但没选满，和全选不是互斥的两个布尔值 */
const pageIndeterminate = computed(
  () =>
    !pageAllSelected.value && pageRows.value.some((row) => selectedIds.value.has(row.id)),
)

const statusText = computed(() => {
  if (status.value === 'pending') return '待处理'
  if (status.value === 'done') return '已完成'
  return '全部'
})

/** 单行勾选：复制一份 Set 再改，保证视图拿到新引用 */
function toggleRow(id: number): void {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

/** 本页全选 / 取消本页：只并入或移除当前页的 id */
function togglePage(): void {
  const next = new Set(selectedIds.value)
  if (pageAllSelected.value) {
    pageRows.value.forEach((row) => next.delete(row.id))
  } else {
    pageRows.value.forEach((row) => next.add(row.id))
  }
  selectedIds.value = next
}

/**! 选择全部筛选结果：范围是筛选后的全部行，不是当前页 */
function selectFiltered(): void {
  const next = new Set(selectedIds.value)
  filteredRows.value.forEach((row) => next.add(row.id))
  selectedIds.value = next
}

function clearSelection(): void {
  selectedIds.value = new Set()
}

/** 切筛选回到第 1 页，但保留已选集合 */
function setStatus(value: string | number | boolean | undefined): void {
  if (value !== 'all' && value !== 'pending' && value !== 'done') return
  status.value = value
  page.value = 1
}

function prevPage(): void {
  if (page.value > 1) page.value--
}

function nextPage(): void {
  if (page.value < pageCount.value) page.value++
}

function reset(): void {
  selectedIds.value = new Set()
  status.value = 'all'
  page.value = 1
}
</script>

<template>
  <div class="cps-demo">
    <p class="hint">
      翻页和筛选只改变看得见的行，已选集合要一直留着。
      先勾第 1 行再翻页，看看已选数量会不会归零。
    </p>

    <section class="panel">
      <div class="toolbar">
        <n-radio-group
          class="cps-filter"
          :value="status"
          size="small"
          @update:value="setStatus"
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

        <div class="actions">
          <n-button
            size="small"
            data-action="select-page"
            @click="togglePage"
          >
            选择本页
          </n-button>
          <n-button
            size="small"
            data-action="select-filtered"
            @click="selectFiltered"
          >
            选择全部筛选结果
          </n-button>
          <n-button
            size="small"
            quaternary
            :disabled="selectedCount === 0"
            data-action="clear"
            @click="clearSelection"
          >
            清空选择
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

      <div class="summary">
        <span>
          已选
          <strong data-stat="selected-count">{{ selectedCount }}</strong>
          项
          <span class="badge">跨页保留</span>
        </span>
        <span>
          当前筛选
          <strong data-stat="filtered-count">{{ filteredCount }}</strong>
          行 · 第
          <strong data-stat="page-index">{{ page }}</strong>
          /
          <strong data-stat="page-count">{{ pageCount }}</strong>
          页 · 筛选
          <strong data-stat="filter-status">{{ statusText }}</strong>
        </span>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th class="check-col">
              <n-checkbox
                data-stat="page-all"
                :checked="pageAllSelected"
                :indeterminate="pageIndeterminate"
                :disabled="pageRows.length === 0"
                aria-label="选择本页"
                @update:checked="togglePage"
              />
            </th>
            <th>名称</th>
            <th class="owner-col">
              负责人
            </th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pageRows"
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
            <td>
              <span
                class="status"
                :class="`status--${row.status}`"
              >
                {{ row.status === 'pending' ? '待处理' : '已完成' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <n-button
          size="small"
          :disabled="page <= 1"
          data-action="prev"
          @click="prevPage"
        >
          上一页
        </n-button>
        <span class="pager-text">第 {{ page }} / {{ pageCount }} 页</span>
        <n-button
          size="small"
          :disabled="page >= pageCount"
          data-action="next"
          @click="nextPage"
        >
          下一页
        </n-button>
      </div>
    </section>

    <p class="footnote">
      「选择本页」和「选择全部筛选结果」是两个范围：前者只碰当前页 id，
      后者并入选中的全部行。按钮文案写清楚范围，用户才不会误以为全选了整张表。
    </p>
  </div>
</template>

<style scoped>
.cps-demo {
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

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.8rem;
  margin-bottom: 0.55rem;
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

.status--pending {
  color: var(--warning);
  background-color: color-mix(in srgb, var(--warning) 12%, transparent);
}

.status--done {
  color: var(--success);
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.pager-text {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
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
}
</style>
