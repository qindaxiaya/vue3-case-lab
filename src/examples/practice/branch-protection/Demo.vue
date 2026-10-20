// ============================================================
// 案例：合并门禁（branch-protection）
// 模拟「规则集 + 必需检查」：直接 push、红灯 PR、绿灯 PR 三种结局；
// 可以关闭规则集，观察同一操作立刻变得「能进 main」。
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type LogKind = 'info' | 'ok' | 'error'
type CheckState = 'idle' | 'running' | 'pass' | 'fail'
type PrState = 'none' | 'open' | 'merged'

interface LogEntry {
  id: number
  kind: LogKind
  text: string
}

/** 规则集开关：关闭后模拟「只跑检查、不设门禁」 */
const rulesOn = ref(true)
/** 下一次检查的结果：用来对比红灯 / 绿灯 */
const checkWillPass = ref(true)
/** 合并请求状态 */
const prState = ref<PrState>('none')
/** 必需检查状态 */
const checkState = ref<CheckState>('idle')
/** main 是否被写入 */
const mainUpdated = ref(false)
/** 检查运行中：按钮暂时禁用，避免重复点击 */
const busy = ref(false)
/** 操作日志（最多保留 6 条） */
const logs = ref<LogEntry[]>([])
let logId = 0
let timer: number | undefined

function addLog(text: string, kind: LogKind = 'info'): void {
  logs.value.push({ id: ++logId, kind, text })
  if (logs.value.length > 6) logs.value.shift()
}

function reset(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
  rulesOn.value = true
  checkWillPass.value = true
  prState.value = 'none'
  checkState.value = 'idle'
  mainUpdated.value = false
  busy.value = false
  logs.value = []
  logId = 0
  addLog('规则集开启：main 只接受通过必需检查的 PR。')
}

/** 直接推 main：规则集开启时由服务端拒绝 */
function directPush(): void {
  if (busy.value) return

  if (rulesOn.value) {
    addLog('✕ GH013：Changes must be made through a pull request.', 'error')
    addLog('✕ Required status check "Type check, lint, test, build" is expected.', 'error')
    return
  }

  mainUpdated.value = true
  prState.value = 'none'
  checkState.value = 'idle'
  addLog('✓ 规则关闭：直接 push 成功，main 已更新。', 'ok')
}

/** 创建 PR 并模拟跑一次必需检查 */
function createPr(): void {
  if (busy.value || prState.value === 'merged') return

  prState.value = 'open'
  checkState.value = 'running'
  mainUpdated.value = false
  busy.value = true
  addLog('→ 已创建 PR，等待必需检查…')

  timer = window.setTimeout(() => {
    timer = undefined
    checkState.value = checkWillPass.value ? 'pass' : 'fail'
    busy.value = false
    addLog(
      checkWillPass.value
        ? '✓ 必需检查通过，合并按钮可用。'
        : '✕ 必需检查失败，红灯 PR 不应被合并。',
      checkWillPass.value ? 'ok' : 'error',
    )
  }, 550)
}

/** 合并 PR：规则集开启时，检查不过就拒绝 */
function mergePr(): void {
  if (busy.value) return

  if (prState.value !== 'open') {
    addLog('✕ 没有待合并的 PR，先创建 PR。', 'error')
    return
  }

  if (checkState.value === 'running') {
    addLog('… 必需检查还在运行，稍等。')
    return
  }

  if (rulesOn.value && checkState.value !== 'pass') {
    addLog('✕ 合并被拒绝：必需检查未通过。', 'error')
    addLog('规则集开启时，红灯 PR 无法合并进 main。', 'info')
    return
  }

  prState.value = 'merged'
  mainUpdated.value = true
  addLog(
    rulesOn.value
      ? '✓ 检查通过，PR 已 squash 合并进 main。'
      : '✓ 规则关闭：红灯 PR 也被合并进了 main。',
    rulesOn.value ? 'ok' : 'error',
  )
}

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearTimeout(timer)
})

reset()

const checkLabel = computed(() => {
  const map: Record<CheckState, string> = {
    idle: '未运行',
    running: '运行中',
    pass: '通过',
    fail: '失败',
  }
  return map[checkState.value]
})

const prLabel = computed(() => {
  const map: Record<PrState, string> = {
    none: '未创建',
    open: '待合并',
    merged: '已合并',
  }
  return map[prState.value]
})
</script>

<template>
  <div class="bp-demo">
    <div class="bp-toolbar">
      <div
        class="bp-switches"
        role="group"
        aria-label="模拟条件"
      >
        <button
          class="bp-chip"
          :class="{ 'bp-chip--on': rulesOn }"
          type="button"
          :aria-pressed="rulesOn"
          @click="rulesOn = !rulesOn"
        >
          规则集：{{ rulesOn ? '开启' : '关闭' }}
        </button>
        <button
          class="bp-chip"
          :class="{ 'bp-chip--on': checkWillPass }"
          type="button"
          :aria-pressed="checkWillPass"
          @click="checkWillPass = !checkWillPass"
        >
          检查结果：{{ checkWillPass ? '通过' : '失败' }}
        </button>
      </div>
      <button
        class="bp-reset"
        type="button"
        @click="reset"
      >
        重置
      </button>
    </div>

    <div class="bp-branch">
      <span class="bp-branch-name">main</span>
      <span
        class="bp-badge"
        :class="rulesOn ? 'bp-badge--protected' : 'bp-badge--open'"
      >
        {{ rulesOn ? '受保护' : '未保护' }}
      </span>
      <span
        class="bp-main-state"
        :class="{ 'bp-main-state--done': mainUpdated }"
      >
        {{ mainUpdated ? '已更新' : '未更新' }}
      </span>
    </div>

    <div class="bp-actions">
      <button
        class="bp-action bp-action--danger"
        type="button"
        :disabled="busy"
        @click="directPush"
      >
        直接 push main
      </button>
      <button
        class="bp-action"
        type="button"
        :disabled="busy || prState === 'merged'"
        @click="createPr"
      >
        创建 PR 并跑检查
      </button>
      <button
        class="bp-action bp-action--primary"
        type="button"
        :disabled="busy || prState !== 'open'"
        @click="mergePr"
      >
        合并 PR
      </button>
    </div>

    <div class="bp-flow">
      <div
        class="bp-step"
        :class="{ 'bp-step--done': prState !== 'none' || mainUpdated }"
      >
        <span class="bp-step-no">1</span>
        <span class="bp-step-label">改动</span>
        <span class="bp-step-state">{{ prState !== 'none' || mainUpdated ? '已提交' : '等待' }}</span>
      </div>
      <div
        class="bp-step"
        :class="{ 'bp-step--done': prState !== 'none' }"
      >
        <span class="bp-step-no">2</span>
        <span class="bp-step-label">PR</span>
        <span class="bp-step-state">{{ prLabel }}</span>
      </div>
      <div
        class="bp-step"
        :class="`bp-step--${checkState}`"
      >
        <span class="bp-step-no">3</span>
        <span class="bp-step-label">必需检查</span>
        <span class="bp-step-state">{{ checkLabel }}</span>
      </div>
      <div
        class="bp-step"
        :class="{ 'bp-step--done': mainUpdated }"
      >
        <span class="bp-step-no">4</span>
        <span class="bp-step-label">main</span>
        <span class="bp-step-state">{{ mainUpdated ? '已写入' : '未写入' }}</span>
      </div>
    </div>

    <div
      class="bp-log"
      role="status"
      aria-live="polite"
    >
      <p
        v-for="entry in logs"
        :key="entry.id"
        class="bp-log-line"
        :class="`bp-log-line--${entry.kind}`"
      >
        {{ entry.text }}
      </p>
    </div>

    <p class="bp-hint">
      规则集只认两件事：<b>改动是否来自 PR</b>、<b>必需检查是否通过</b>。
      检查名必须和 Actions 里的 job 名完全一致；单人仓库审批数设 1 会导致自己的 PR 永远合不进去。
    </p>
  </div>
</template>

<style scoped>
.bp-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.bp-switches {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.bp-chip,
.bp-reset,
.bp-action {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s;
}

.bp-chip {
  padding: 0.28rem 0.55rem;

  &::before {
    content: '○ ';
    color: var(--text-secondary);
  }

  &.bp-chip--on {
    border-color: var(--primary);
    background-color: var(--primary-soft);
    color: var(--primary);

    &::before {
      content: '● ';
    }
  }
}

.bp-reset {
  padding: 0.26rem 0.55rem;

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.bp-branch {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
}

.bp-branch-name {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text);
}

.bp-badge {
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 600;

  &.bp-badge--protected {
    background-color: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  &.bp-badge--open {
    background-color: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }
}

.bp-main-state {
  margin-left: auto;
  font-size: 0.68rem;
  color: var(--text-secondary);

  &.bp-main-state--done {
    color: var(--success);
  }
}

.bp-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.bp-action {
  flex: 1 1 8rem;
  padding: 0.38rem 0.5rem;

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  &.bp-action--primary {
    border-color: var(--primary);
    color: var(--primary);

    &:hover:not(:disabled) {
      background-color: var(--primary);
      color: #fff;
    }
  }

  &.bp-action--danger {
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
    color: var(--danger);

    &:hover:not(:disabled) {
      background-color: var(--danger);
      color: #fff;
    }
  }
}

.bp-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
}

.bp-step {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  padding: 0.4rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  min-width: 0;

  &.bp-step--done {
    border-color: color-mix(in srgb, var(--success) 40%, transparent);
  }

  &.bp-step--running {
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }

  &.bp-step--pass {
    border-color: color-mix(in srgb, var(--success) 55%, transparent);
  }

  &.bp-step--fail {
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
    background-color: color-mix(in srgb, var(--danger) 7%, transparent);
  }
}

.bp-step-no {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.bp-step-label {
  font-size: 0.7rem;
  color: var(--text);
  white-space: nowrap;
}

.bp-step-state {
  font-size: 0.62rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-log {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-height: 4.2rem;
  max-height: 7rem;
  overflow: auto;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
}

.bp-log-line {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  line-height: 1.55;
  color: var(--text-secondary);
  overflow-wrap: anywhere;

  &.bp-log-line--ok {
    color: var(--success);
  }

  &.bp-log-line--error {
    color: var(--danger);
  }
}

.bp-hint {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.6;
  color: var(--text-secondary);

  b {
    color: var(--text);
  }
}

@media (max-width: 520px) {
  .bp-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bp-action {
    flex-basis: 100%;
  }
}
</style>
