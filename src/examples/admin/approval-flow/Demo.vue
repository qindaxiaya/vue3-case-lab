// ============================================================
// 案例：approval-flow 审批流
// 角色、状态、步骤、时间线必须一起变
// ============================================================

<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 类型与初始申请
// ============================================================

type Role = 'manager' | 'finance' | 'applicant'
type Status = 'pending' | 'approved' | 'rejected'
type Step = 'manager' | 'finance' | 'done'

interface HistoryItem {
  actor: string
  action: string
  note: string
}

interface Application {
  id: string
  title: string
  amount: number
  applicant: string
  status: Status
  step: Step
  history: HistoryItem[]
}

/** 每次重置都新建一份，避免时间线数组被上一次操作继续追加 */
function createApplication(): Application {
  return {
    id: 'A-1024',
    title: '差旅报销申请',
    amount: 3280,
    applicant: '李雷',
    status: 'pending',
    step: 'manager',
    history: [{ actor: '申请人', action: '提交申请', note: '等待主管审批' }],
  }
}

const application = ref<Application>(createApplication())
const currentRole = ref<Role>('manager')
const actionCount = ref(0)

const roleLabels: Record<Role, string> = {
  manager: '主管',
  finance: '财务',
  applicant: '申请人',
}

const statusLabels: Record<Status, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

const stepLabels: Record<Step, string> = {
  manager: '主管审批',
  finance: '财务审批',
  done: '完成',
}

const roleLabel = computed(() => roleLabels[currentRole.value])
const statusText = computed(() => statusLabels[application.value.status])
const stepText = computed(() => stepLabels[application.value.step])

// ============================================================
// 状态机与权限
// ============================================================

/** 通过和驳回都只允许当前步骤对应的角色操作，避免主管替财务点通过 */
const canApprove = computed(() => {
  if (application.value.status !== 'pending') return false
  if (application.value.step === 'manager') return currentRole.value === 'manager'
  if (application.value.step === 'finance') return currentRole.value === 'finance'
  return false
})

const canReject = computed(() => canApprove.value)

/** 转交只发生在主管审批阶段，而且只有主管能转交 */
const canTransfer = computed(
  () =>
    application.value.status === 'pending' &&
    application.value.step === 'manager' &&
    currentRole.value === 'manager',
)

const hint = computed(() => {
  if (application.value.status === 'approved') return '审批已通过，操作已锁定'
  if (application.value.status === 'rejected') return '审批已驳回，操作已锁定'
  if (currentRole.value === 'applicant') return '申请人只能查看进度'
  if (application.value.step === 'manager' && currentRole.value === 'finance') {
    return '当前在主管审批，财务暂时不能操作'
  }
  if (application.value.step === 'finance' && currentRole.value === 'manager') {
    return '已转交财务，请切换财务角色继续'
  }
  return '按当前步骤操作，审批通过或驳回后不可再改'
})

/** 每次成功操作只追加一条历史，并累计操作次数 */
function pushHistory(actor: string, action: string, note: string): void {
  application.value.history.push({ actor, action, note })
  actionCount.value += 1
}

function approve(): void {
  if (!canApprove.value) return
  if (application.value.step === 'manager') {
    application.value.step = 'finance'
    pushHistory(roleLabel.value, '通过', '转交财务审批')
    return
  }
  if (application.value.step === 'finance') {
    application.value.status = 'approved'
    application.value.step = 'done'
    pushHistory(roleLabel.value, '通过', '审批完成')
  }
}

function reject(): void {
  if (!canReject.value) return
  application.value.status = 'rejected'
  pushHistory(
    roleLabel.value,
    '驳回',
    currentRole.value === 'manager' ? '金额说明不完整' : '发票信息有误',
  )
}

function transfer(): void {
  if (!canTransfer.value) return
  application.value.step = 'finance'
  pushHistory(roleLabel.value, '转交', '转交财务处理')
}

function reset(): void {
  application.value = createApplication()
  currentRole.value = 'manager'
  actionCount.value = 0
}
</script>

<template>
  <div class="af-demo">
    <div class="af-head">
      <div class="af-title">
        <h3>{{ application.title }} #{{ application.id }}</h3>
        <p>申请人：{{ application.applicant }} · 金额 ¥{{ application.amount }}</p>
      </div>
      <div class="af-role-wrap">
        <span>当前角色</span>
        <n-radio-group
          v-model:value="currentRole"
          class="af-role"
          size="small"
        >
          <n-radio-button value="manager">
            主管
          </n-radio-button>
          <n-radio-button value="finance">
            财务
          </n-radio-button>
          <n-radio-button value="applicant">
            申请人
          </n-radio-button>
        </n-radio-group>
      </div>
    </div>

    <div class="af-status-row">
      <span
        class="af-status"
        :class="application.status"
      >{{ statusText }}</span>
      <span class="af-step">{{ stepText }}</span>
      <span class="af-meta">
        当前角色
        <b data-stat="current-role">{{ roleLabel }}</b>
      </span>
      <span class="af-meta">
        时间线
        <b data-stat="history-count">{{ application.history.length }}</b>
        条
      </span>
      <span class="af-meta">
        操作
        <b data-stat="action-count">{{ actionCount }}</b>
        次
      </span>
    </div>

    <div class="af-body">
      <div class="af-card">
        <div class="af-card-row">
          <span>申请事项</span>
          <strong>{{ application.title }}</strong>
        </div>
        <div class="af-card-row">
          <span>报销金额</span>
          <strong>¥{{ application.amount }}</strong>
        </div>
        <div class="af-card-row">
          <span>当前状态</span>
          <strong data-stat="status-text">{{ statusText }}</strong>
        </div>
        <div class="af-card-row">
          <span>当前步骤</span>
          <strong data-stat="step-text">{{ stepText }}</strong>
        </div>
      </div>

      <div class="af-actions">
        <n-button
          data-action="approve"
          type="primary"
          :disabled="!canApprove"
          @click="approve"
        >
          通过
        </n-button>
        <n-button
          data-action="reject"
          type="error"
          ghost
          :disabled="!canReject"
          @click="reject"
        >
          驳回
        </n-button>
        <n-button
          data-action="transfer"
          :disabled="!canTransfer"
          @click="transfer"
        >
          转交财务
        </n-button>
        <n-button
          data-action="reset"
          @click="reset"
        >
          重置
        </n-button>
        <p class="af-hint">
          {{ hint }}
        </p>
      </div>
    </div>

    <ol class="af-history">
      <li
        v-for="(item, index) in application.history"
        :key="index"
      >
        <span class="af-dot" />
        <div>
          <strong>{{ item.actor }}</strong>
          <span>{{ item.action }}</span>
          <em>{{ item.note }}</em>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped lang="scss">
.af-demo {
  display: grid;
  gap: 0.75rem;
}

.af-head,
.af-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.af-head {
  justify-content: space-between;
}

.af-title h3 {
  margin: 0 0 0.2rem;
  font-size: var(--demo-text-lg);
}

.af-title p {
  margin: 0;
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.af-role-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.af-status-row {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  font-size: var(--demo-text-sm);
}

.af-status {
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-tag);
  background: color-mix(in srgb, var(--warning) 14%, var(--bg));
  color: var(--warning);
  font-weight: 600;
}

.af-status.approved {
  background: color-mix(in srgb, var(--success) 14%, var(--bg));
  color: var(--success);
}

.af-status.rejected {
  background: color-mix(in srgb, var(--danger) 14%, var(--bg));
  color: var(--danger);
}

.af-step {
  color: var(--text);
  font-weight: 600;
}

.af-meta {
  color: var(--text-soft);
}

.af-meta b {
  color: var(--text);
}

.af-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13rem;
  gap: 0.75rem;
  align-items: start;
}

.af-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
}

.af-card-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px dashed var(--border);
  font-size: var(--demo-text-sm);
}

.af-card-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.af-card-row span {
  color: var(--text-soft);
}

.af-actions {
  display: grid;
  gap: 0.4rem;
}

.af-hint {
  margin: 0.2rem 0 0;
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
}

.af-history {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  list-style: none;
}

.af-history li {
  display: flex;
  gap: 0.55rem;
  font-size: var(--demo-text-sm);
}

.af-history li > div {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.af-history strong {
  color: var(--text);
}

.af-history span {
  color: var(--text);
}

.af-history em {
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  font-style: normal;
}

.af-dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: var(--primary);
}

@media (max-width: 760px) {
  .af-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
