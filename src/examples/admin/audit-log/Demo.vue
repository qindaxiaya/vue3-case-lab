// ============================================================
// 案例：audit-log 审计日志
// 成功失败都留痕，敏感字段脱敏，详情可还原变更前后
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 类型与数据
// ============================================================

type AuditResult = 'success' | 'failed'
type Filter = 'all' | AuditResult

interface AuditEntry {
  id: number
  actor: string
  action: string
  target: string
  result: AuditResult
  reason?: string
  before: Record<string, string>
  after: Record<string, string>
  phone: string
  time: string
}

const MASKED_PHONE = '138****8000'

const simpleLog = ref<string[]>([])
const auditLog = ref<AuditEntry[]>([])
const filter = ref<Filter>('all')
const expandedId = ref<number | null>(null)

let nextId = 1

const visibleAudit = computed(() => {
  if (filter.value === 'all') return auditLog.value
  return auditLog.value.filter((entry) => entry.result === filter.value)
})

const failedCount = computed(
  () => auditLog.value.filter((entry) => entry.result === 'failed').length,
)
const maskedCount = computed(
  () => auditLog.value.filter((entry) => entry.phone === MASKED_PHONE).length,
)

// ============================================================
// 追加日志
// ============================================================

function nowText(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function append(entry: Omit<AuditEntry, 'id' | 'time'>): void {
  //! 审计日志只追加，不覆盖旧记录
  auditLog.value = [
    {
      ...entry,
      id: nextId++,
      time: nowText(),
      phone: MASKED_PHONE,
    },
    ...auditLog.value,
  ]
}

function createOrder(): void {
  append({
    actor: '张三（运营）',
    action: '新增订单',
    target: '订单 #A1024',
    result: 'success',
    before: {},
    after: { 金额: '¥299', 状态: '待付款' },
    phone: MASKED_PHONE,
  })
  simpleLog.value = ['新增订单 · 订单 #A1024 · 成功', ...simpleLog.value]
}

function updateAmount(): void {
  append({
    actor: '张三（运营）',
    action: '修改金额',
    target: '订单 #A1024',
    result: 'success',
    before: { 金额: '¥299' },
    after: { 金额: '¥199' },
    phone: MASKED_PHONE,
  })
  simpleLog.value = ['修改金额 · 订单 #A1024 · 成功', ...simpleLog.value]
}

function removeOrder(): void {
  //! 失败操作也要写审计日志，否则出事时只看到成功记录
  append({
    actor: '张三（运营）',
    action: '删除订单',
    target: '订单 #A1024',
    result: 'failed',
    reason: '订单已发货，不能删除',
    before: { 状态: '已发货' },
    after: { 状态: '已发货（未删除）' },
    phone: MASKED_PHONE,
  })
}

function onFilterChange(value: string | number | boolean | undefined): void {
  if (value === 'all' || value === 'success' || value === 'failed') {
    filter.value = value
    expandedId.value = null
  }
}

function toggleDetail(id: number): void {
  expandedId.value = expandedId.value === id ? null : id
}

function reset(): void {
  simpleLog.value = []
  auditLog.value = []
  filter.value = 'all'
  expandedId.value = null
  nextId = 1
}
</script>

<template>
  <div class="al-demo">
    <p class="hint">
      左侧是常见的「只记成功操作」日志，右侧把失败也记下来，并在详情里保留变更前后和脱敏手机号。
    </p>

    <div class="toolbar">
      <n-button
        size="small"
        type="primary"
        @click="createOrder"
      >
        新增订单
      </n-button>
      <n-button
        size="small"
        @click="updateAmount"
      >
        修改金额
      </n-button>
      <n-button
        size="small"
        type="error"
        ghost
        @click="removeOrder"
      >
        删除订单（失败）
      </n-button>
      <n-radio-group
        :value="filter"
        size="small"
        @update:value="onFilterChange"
      >
        <n-radio-button value="all">
          全部
        </n-radio-button>
        <n-radio-button value="success">
          成功
        </n-radio-button>
        <n-radio-button value="failed">
          失败
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        quaternary
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="panels">
      <section class="panel al-simple">
        <div class="panel-head">
          <h3>简易日志</h3>
          <span class="badge">只记成功</span>
        </div>
        <ul
          v-if="simpleLog.length"
          class="log-list"
        >
          <li
            v-for="item in simpleLog"
            :key="item"
            data-simple
          >
            {{ item }}
          </li>
        </ul>
        <p
          v-else
          class="empty"
        >
          还没有成功操作
        </p>
        <p class="note">
          失败操作没写进来：用户说「删不掉」，日志里却只有成功记录，排查时看不到现场。
        </p>
      </section>

      <section class="panel al-audit">
        <div class="panel-head">
          <h3>审计日志</h3>
          <span class="badge">{{ visibleAudit.length }} 条</span>
        </div>
        <ul
          v-if="visibleAudit.length"
          class="log-list"
        >
          <li
            v-for="entry in visibleAudit"
            :key="entry.id"
            class="audit-item"
            data-audit
            :data-result="entry.result"
            @click="toggleDetail(entry.id)"
          >
            <div class="audit-row">
              <span class="audit-action">{{ entry.action }}</span>
              <span
                class="audit-result"
                :class="entry.result"
              >
                {{ entry.result === 'success' ? '成功' : '失败' }}
              </span>
            </div>
            <div class="audit-meta">
              {{ entry.actor }} · {{ entry.target }} · {{ entry.time }}
            </div>
            <div
              v-if="expandedId === entry.id"
              class="audit-detail"
              data-detail
            >
              <dl>
                <div>
                  <dt>变更前</dt>
                  <dd>{{ Object.entries(entry.before).map(([key, value]) => `${key}：${value}`).join('；') || '—' }}</dd>
                </div>
                <div>
                  <dt>变更后</dt>
                  <dd>{{ Object.entries(entry.after).map(([key, value]) => `${key}：${value}`).join('；') }}</dd>
                </div>
                <div>
                  <dt>手机号</dt>
                  <dd>{{ entry.phone }}</dd>
                </div>
              </dl>
              <p
                v-if="entry.reason"
                class="reason"
              >
                失败原因：{{ entry.reason }}
              </p>
            </div>
          </li>
        </ul>
        <p
          v-else
          class="empty"
        >
          当前筛选下没有记录
        </p>
      </section>
    </div>

    <dl class="metrics">
      <div class="metric">
        <dt>全部记录</dt>
        <dd data-stat="total-count">
          {{ auditLog.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>失败记录</dt>
        <dd data-stat="failed-count">
          {{ failedCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>当前可见</dt>
        <dd data-stat="visible-count">
          {{ visibleAudit.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>脱敏字段</dt>
        <dd data-stat="masked-count">
          {{ maskedCount }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped lang="scss">
.al-demo {
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

.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.panel {
  min-width: 0;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;

  h3 {
    margin: 0;
    font-size: var(--demo-text-md);
  }
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 18rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.al-simple .log-list li {
  padding: 0.35rem 0.45rem;
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-muted);
  font-size: var(--demo-text-sm);
}

.audit-item {
  padding: 0.45rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--bg);
  cursor: pointer;

  &:hover {
    border-color: var(--border);
  }
}

.audit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.audit-action {
  font-size: var(--demo-text-sm);
  font-weight: 600;
}

.audit-result {
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);

  &.success {
    color: #15803d;
    background: rgb(21 128 61 / 12%);
  }

  &.failed {
    color: #b91c1c;
    background: rgb(185 28 28 / 12%);
  }
}

.audit-meta {
  margin-top: 0.2rem;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
}

.audit-detail {
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--border);

  dl {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    font-size: var(--demo-text-xs);
  }

  dl > div {
    display: grid;
    grid-template-columns: 3.2rem minmax(0, 1fr);
    gap: 0.4rem;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
}

.reason {
  margin: 0.4rem 0 0;
  color: #b91c1c;
  font-size: var(--demo-text-xs);
}

.empty,
.note {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
  line-height: 1.7;
}

.note {
  margin-top: 0.6rem;
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
  }
}

@media (max-width: 640px) {
  .panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
