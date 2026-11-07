// ============================================================
// 案例：query-bar 后台查询条件栏
// 收起多余条件、条件回显、重置干净、查询中防重复提交
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ============================================================
// 数据与类型
// ============================================================

type Status = 'enabled' | 'disabled'
type Owner = '张三' | '李四' | '王五'

interface Row {
  id: number
  name: string
  status: Status
  owner: Owner
}

interface Filters {
  keyword: string
  status: Status | 'all'
  owner: Owner | 'all'
}

/** 演示数据：真实项目里来自接口 */
const rows: Row[] = [
  { id: 1, name: '月度报表', status: 'enabled', owner: '张三' },
  { id: 2, name: '季度报表', status: 'enabled', owner: '李四' },
  { id: 3, name: '用户增长', status: 'disabled', owner: '王五' },
  { id: 4, name: '订单明细', status: 'enabled', owner: '张三' },
  { id: 5, name: '库存预警', status: 'disabled', owner: '李四' },
  { id: 6, name: '销售看板', status: 'enabled', owner: '王五' },
  { id: 7, name: '渠道分析', status: 'enabled', owner: '张三' },
  { id: 8, name: '退款记录', status: 'disabled', owner: '李四' },
  { id: 9, name: '会员分层', status: 'enabled', owner: '王五' },
  { id: 10, name: '活动效果', status: 'disabled', owner: '张三' },
  { id: 11, name: '财务对账', status: 'enabled', owner: '李四' },
  { id: 12, name: '权限审计', status: 'disabled', owner: '王五' },
]

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
]

const ownerOptions = [
  { label: '全部负责人', value: 'all' },
  { label: '张三', value: '张三' },
  { label: '李四', value: '李四' },
  { label: '王五', value: '王五' },
]

/** 当前表单值：用户正在编辑的条件 */
const keyword = ref('')
const status = ref<Status | 'all'>('all')
const owner = ref<Owner | 'all'>('all')

/** 已生效的条件：表格只按这一份过滤 */
const applied = ref<Filters>({ keyword: '', status: 'all', owner: 'all' })

const expanded = ref(true)
const loading = ref(false)
const queryCount = ref(0)
const resetCount = ref(0)

let queryTimer: number | null = null

// ============================================================
// 条件与结果
// ============================================================

/** 把当前表单收成一份快照，避免查询过程中继续编辑影响结果 */
function currentFilters(): Filters {
  return {
    keyword: keyword.value.trim(),
    status: status.value,
    owner: owner.value,
  }
}

/** 已生效的条件标签 */
const activeChips = computed(() => {
  const chips: { key: keyof Filters; label: string }[] = []
  if (applied.value.keyword) chips.push({ key: 'keyword', label: `关键词：${applied.value.keyword}` })
  if (applied.value.status !== 'all') {
    chips.push({
      key: 'status',
      label: `状态：${applied.value.status === 'enabled' ? '启用' : '停用'}`,
    })
  }
  if (applied.value.owner !== 'all') chips.push({ key: 'owner', label: `负责人：${applied.value.owner}` })
  return chips
})

/** 表单和已生效条件不一致时提示用户点查询 */
const dirty = computed(() => {
  const form = currentFilters()
  return (
    form.keyword !== applied.value.keyword ||
    form.status !== applied.value.status ||
    form.owner !== applied.value.owner
  )
})

const filteredRows = computed(() =>
  rows.filter((row) => {
    if (applied.value.status !== 'all' && row.status !== applied.value.status) return false
    if (applied.value.owner !== 'all' && row.owner !== applied.value.owner) return false
    if (applied.value.keyword && !row.name.includes(applied.value.keyword)) return false
    return true
  }),
)

const resultNames = computed(() =>
  filteredRows.value
    .slice(0, 4)
    .map((row) => row.name)
    .join('、'),
)

const statusText = computed(() => {
  if (loading.value) return '查询中…'
  if (dirty.value) return '条件已修改，点查询生效'
  return '已生效'
})

// ============================================================
// 操作
// ============================================================

/** 查询：加载中直接忽略，避免重复请求 */
function runQuery(): void {
  if (loading.value) return
  const snapshot = currentFilters()
  loading.value = true

  // 模拟接口耗时；真实项目这里换成 await request(snapshot)
  queryTimer = window.setTimeout(() => {
    applied.value = snapshot
    loading.value = false
    queryCount.value++
    queryTimer = null
  }, 450)
}

/** 重置：表单和已生效条件一起清空，并取消在途查询 */
function reset(): void {
  if (queryTimer !== null) {
    window.clearTimeout(queryTimer)
    queryTimer = null
  }
  loading.value = false
  keyword.value = ''
  status.value = 'all'
  owner.value = 'all'
  applied.value = { keyword: '', status: 'all', owner: 'all' }
  resetCount.value++
}

/** 点条件标签的 ×：立即移除该条件，并按新条件刷新结果 */
function removeFilter(key: keyof Filters): void {
  if (key === 'keyword') keyword.value = ''
  if (key === 'status') status.value = 'all'
  if (key === 'owner') owner.value = 'all'
  applied.value = currentFilters()
  queryCount.value++
}

function onKeyword(value: string): void {
  keyword.value = value
}

function onStatusChange(value: string | number | boolean | undefined): void {
  status.value = value === 'enabled' || value === 'disabled' ? value : 'all'
}

function onOwnerChange(value: string | number | boolean | undefined): void {
  owner.value = value === '张三' || value === '李四' || value === '王五' ? value : 'all'
}

onUnmounted(() => {
  if (queryTimer !== null) window.clearTimeout(queryTimer)
})
</script>

<template>
  <div class="qb-demo">
    <p class="hint">
      查询条件栏只负责「编辑条件」，表格只认「已生效条件」：查询中按钮锁定，
      重置会清空表单和条件标签，点标签上的 × 可以单独去掉一个条件。
    </p>

    <section class="bar">
      <header class="bar-head">
        <div class="bar-title">
          <h3>查询条件</h3>
          <span
            class="badge"
            data-stat="active-count"
          >{{ activeChips.length }} 项条件</span>
        </div>
        <n-button
          quaternary
          size="small"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起' : '展开' }}
        </n-button>
      </header>

      <div
        v-show="expanded"
        class="fields"
      >
        <label class="field">
          <span>关键词</span>
          <n-input
            class="qb-keyword"
            :value="keyword"
            clearable
            placeholder="按名称搜索"
            @update:value="onKeyword"
          />
        </label>

        <label class="field">
          <span>状态</span>
          <n-select
            class="qb-status"
            :value="status"
            :options="statusOptions"
            @update:value="onStatusChange"
          />
        </label>

        <label class="field">
          <span>负责人</span>
          <n-select
            class="qb-owner"
            :value="owner"
            :options="ownerOptions"
            @update:value="onOwnerChange"
          />
        </label>
      </div>

      <div
        v-if="activeChips.length"
        class="chips"
        data-stat="chips"
      >
        <n-tag
          v-for="chip in activeChips"
          :key="chip.key"
          closable
          size="small"
          @close="removeFilter(chip.key)"
        >
          {{ chip.label }}
        </n-tag>
      </div>

      <div class="actions">
        <n-button
          type="primary"
          :loading="loading"
          :disabled="loading"
          @click="runQuery"
        >
          查询
        </n-button>
        <n-button
          :disabled="loading"
          @click="reset"
        >
          重置
        </n-button>
        <span
          class="status"
          :class="{ 'status--warn': dirty && !loading }"
          data-stat="status-text"
        >
          {{ statusText }}
        </span>
      </div>
    </section>

    <section class="result">
      <div class="result-head">
        <h3>查询结果</h3>
        <span
          class="result-count"
          data-stat="result-count"
        >{{ filteredRows.length }} 条</span>
      </div>

      <p
        class="result-names"
        data-stat="result-names"
      >
        {{ resultNames || '没有匹配的数据' }}
      </p>

      <dl class="metrics">
        <div class="metric">
          <dt>查询次数</dt>
          <dd data-stat="query-count">
            {{ queryCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>重置次数</dt>
          <dd data-stat="reset-count">
            {{ resetCount }}
          </dd>
        </div>
        <div class="metric">
          <dt>已生效条件</dt>
          <dd data-stat="applied-count">
            {{ activeChips.length }}
          </dd>
        </div>
        <div class="metric">
          <dt>折叠状态</dt>
          <dd data-stat="expanded">
            {{ expanded ? '展开' : '收起' }}
          </dd>
        </div>
      </dl>
    </section>

    <p class="footnote">
      真实项目里把 <code>runQuery</code> 换成接口请求，条件快照同时写进 URL 或
      store；表格只读已生效条件，避免「输入框改了但结果没变」的错觉。
    </p>
  </div>
</template>

<style scoped>
.qb-demo {
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

.bar,
.result {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.bar-head,
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.bar-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.bar-title h3,
.result-head h3 {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.badge {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.status {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.status--warn {
  color: var(--warning);
}

.result-head {
  margin-bottom: 0.35rem;
}

.result-count {
  font-family: var(--font-mono);
  font-size: var(--demo-text-sm);
  color: var(--primary);
}

.result-names {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.6rem 0 0;
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

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .fields {
    grid-template-columns: 1fr;
  }

  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
