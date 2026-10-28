// ============================================================
// 案例：宏任务与微任务执行顺序（event-loop）
// - 预设场景 + 任务开关：只把勾选的任务排进队列，再点「运行」
// - 「直觉预期」按书写顺序动态生成（错误），与真实输出逐行对照
// - 真实输出带相对时间戳与类型徽章；慢任务开关验证微任务优先级
// - 重复运行会取消上一轮未完成的定时器 / rAF，避免日志串台
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ---------- 任务类型（决定徽章文案与颜色） ----------

type TaskKind =
  | 'macro-click'
  | 'macro-timer'
  | 'micro-then'
  | 'micro-qm'
  | 'frame-raf'
  | 'sync-busy'

type TaskId = 'timer0' | 'timer200' | 'then' | 'micro' | 'raf' | 'slow'
type Mode = 'expect' | 'real'

/** 一条真实执行记录：相对毫秒时间戳 + 类型 + 名字 */
interface RunLine {
  ts: number
  kind: TaskKind
  name: string
}

/** 直觉预期序列的条目（没有时间戳，只有想象中的先后） */
interface ExpectLine {
  name: string
  kind: TaskKind
}

/** 可勾选的任务：order 只用于生成「按书写顺序」的直觉预期 */
interface TaskDef {
  id: TaskId
  label: string
  expectName: string
  kind: TaskKind
  order: number
}

interface Preset {
  id: string
  label: string
  tasks: TaskId[]
}

// ---------- 任务与预设 ----------

const TASKS: TaskDef[] = [
  {
    id: 'timer0',
    label: 'setTimeout 0ms',
    expectName: 'setTimeout 0ms 的回调',
    kind: 'macro-timer',
    order: 10,
  },
  {
    id: 'timer200',
    label: 'setTimeout 200ms',
    expectName: 'setTimeout 200ms 的回调',
    kind: 'macro-timer',
    order: 20,
  },
  {
    id: 'then',
    label: 'Promise.then',
    expectName: 'Promise.then 微任务',
    kind: 'micro-then',
    order: 30,
  },
  {
    id: 'micro',
    label: 'queueMicrotask',
    expectName: 'queueMicrotask 微任务',
    kind: 'micro-qm',
    order: 40,
  },
  {
    id: 'raf',
    label: 'requestAnimationFrame',
    expectName: '渲染一帧前的逐帧回调',
    kind: 'frame-raf',
    order: 50,
  },
  {
    id: 'slow',
    label: '主线程忙 200ms（同步）',
    expectName: '主线程忙 200ms（同步代码）',
    kind: 'sync-busy',
    order: 5,
  },
]

/** 预设只是替用户勾选一组任务，不是互斥模式 */
const PRESETS: Preset[] = [
  { id: 'basic', label: '入门三件套', tasks: ['timer0', 'then', 'micro'] },
  {
    id: 'interview',
    label: '面试常考',
    tasks: ['timer0', 'timer200', 'then', 'micro', 'raf'],
  },
  { id: 'slow', label: '慢任务', tasks: ['timer0', 'then', 'micro', 'slow'] },
  { id: 'frame', label: '渲染前', tasks: ['timer0', 'then', 'raf'] },
]

// ---------- 展示状态 ----------

/** 对照模式：expect 直觉预期（错） / real 真实输出（对） */
const mode = ref<Mode>('real')
/** 当前勾选的任务；顺序不重要，生成预期时按 TASKS 的 order 排序 */
const selected = ref<TaskId[]>(['timer0', 'then', 'micro'])
/** 真实输出的执行记录（按执行先后追加） */
const logLines = ref<RunLine[]>([])
/** 总结文案：本次运行的一句话结论 */
const summary = ref('')

/** 当前勾选数量（统计栏展示） */
const selectedCount = computed(() => selected.value.length)
/** 是否勾了慢任务 */
const slowOn = computed(() => isOn('slow'))

// ---------- 徽章信息表 ----------

const KIND_META: Record<TaskKind, { badge: string; cls: string }> = {
  'macro-click': { badge: '宏任务', cls: 'tag-macro' },
  'macro-timer': { badge: '宏任务', cls: 'tag-macro' },
  'micro-then': { badge: '微任务', cls: 'tag-micro' },
  'micro-qm': { badge: '微任务', cls: 'tag-micro' },
  'frame-raf': { badge: '渲染前', cls: 'tag-frame' },
  'sync-busy': { badge: '同步', cls: 'tag-sync' },
}

// ---------- 选择与预设 ----------

function isOn(id: TaskId): boolean {
  return selected.value.includes(id)
}

function toggleTask(id: TaskId): void {
  selected.value = isOn(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
  // 选择变了，旧输出就不再对应本次任务，直接清掉避免误读
  clearOutput()
}

function applyPreset(preset: Preset): void {
  selected.value = [...preset.tasks]
  clearOutput()
}

/** 当前勾选是否正好等于某个预设（用于高亮预设按钮） */
function isPresetActive(preset: Preset): boolean {
  return (
    preset.tasks.length === selected.value.length &&
    preset.tasks.every((id) => selected.value.includes(id))
  )
}

// ---------- 直觉预期（动态、错误） ----------

/**
 * 按「书写顺序」生成直觉预期：点击回调 → 慢任务 → 定时器 → 微任务 → rAF
 * 这正是新手常见的错误排序；真实输出会把它推翻。
 */
const expectLines = computed<ExpectLine[]>(() => {
  const lines: ExpectLine[] = [
    { name: '用户点击回调（先同步执行）', kind: 'macro-click' },
  ]

  if (isOn('slow')) {
    lines.push({ name: '主线程忙 200ms（同步代码）', kind: 'sync-busy' })
  }

  const ordered = TASKS.filter((task) => task.id !== 'slow' && isOn(task.id)).sort(
    (a, b) => a.order - b.order,
  )
  for (const task of ordered) {
    lines.push({ name: task.expectName, kind: task.kind })
  }

  return lines
})

// ---------- 真实运行 ----------

/** 忙等 ms 毫秒：模拟慢任务拖住主线程（只占当前宏任务，不阻塞其它标签页） */
function busyWait(ms: number): void {
  const end = performance.now() + ms
  while (performance.now() < end) {
    // 空转等待：本案例的教学目的是把主线程固定占满一段时间
  }
}

/** 本次运行的起点时间；每次运行重设 */
let origin = 0
/** 运行令牌：重复运行 / 清空后，旧定时器与旧 rAF 的回调不再写入日志 */
let runToken = 0
/** 当前所有待执行的定时器（任务 + 总结），清空时统一取消 */
const timerIds = new Set<number>()
let rafId = 0

function stopPending(): void {
  timerIds.forEach((id) => window.clearTimeout(id))
  timerIds.clear()
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function clearOutput(): void {
  // 令牌自增：已经排入但还没执行的回调会看到 token 不匹配，直接放弃
  runToken++
  stopPending()
  logLines.value = []
  summary.value = ''
}

/** 追加一条执行记录；只有当前这一轮运行才能写日志 */
function push(token: number, kind: TaskKind, name: string): void {
  if (token !== runToken) return
  logLines.value.push({
    ts: performance.now() - origin,
    kind,
    name,
  })
}

/** 统一排定时器：登记 id，清空时能一次性取消 */
function schedule(fn: () => void, delay: number): void {
  const id = window.setTimeout(() => {
    timerIds.delete(id)
    fn()
  }, delay)
  timerIds.add(id)
}

function buildSummary(active: TaskId[]): string {
  if (active.length === 0) return '本次只执行了点击回调，没有排入异步任务'

  const parts: string[] = []
  const hasMicro = active.includes('then') || active.includes('micro')
  const hasTimer = active.includes('timer0') || active.includes('timer200')
  const hasRaf = active.includes('raf')
  const hasSlow = active.includes('slow')

  if (hasSlow) parts.push('主线程忙 200ms 只拖住当前宏任务')
  if (hasMicro) parts.push('微任务在点击回调结束后立刻清空')
  if (hasTimer) parts.push(hasMicro ? '仍排在所有定时器前面' : '定时器按排队顺序执行')
  if (hasRaf) parts.push('逐帧回调在下一帧渲染前执行')

  return parts.join('；') || '本次只执行了点击回调'
}

/** 「运行」按钮本身就是一个宏任务：最理想的讲解切入点 */
function run(): void {
  clearOutput()
  const token = runToken
  const active = [...selected.value]
  origin = performance.now()

  push(token, 'macro-click', '用户点击回调（本次运行起点）')

  // 按固定顺序排入当前勾选的任务；顺序与书写一致
  if (active.includes('timer0')) {
    schedule(() => push(token, 'macro-timer', 'setTimeout 0ms 的回调'), 0)
  }
  if (active.includes('timer200')) {
    schedule(() => push(token, 'macro-timer', 'setTimeout 200ms 的回调'), 200)
  }
  if (active.includes('then')) {
    Promise.resolve().then(() => push(token, 'micro-then', 'Promise.then 微任务'))
  }
  if (active.includes('micro')) {
    queueMicrotask(() => push(token, 'micro-qm', 'queueMicrotask 微任务'))
  }
  if (active.includes('raf')) {
    rafId = requestAnimationFrame(() => {
      rafId = 0
      push(token, 'frame-raf', '渲染一帧前的逐帧回调')
    })
  }

  // 慢任务放在排程之后：证明它只拖住当前宏任务，不会改变微任务的清空时机
  if (active.includes('slow')) {
    push(token, 'sync-busy', '主线程忙 200ms（同步代码）')
    busyWait(200)
  }

  // 等队列走完再总结，避免抢跑；定时器统一登记，清空时会被取消
  schedule(() => {
    if (token !== runToken) return
    summary.value = buildSummary(active)
  }, 340)
}

/** Naive 单选组发出的同样是 string | number | boolean，这里收窄回对照模式 */
function onModeChange(next: string | number | boolean | undefined): void {
  if (next === 'expect' || next === 'real') mode.value = next
}

onUnmounted(() => {
  // 卸载时让令牌失效并取消所有待执行回调，避免回调去改已销毁的组件状态
  runToken++
  stopPending()
})
</script>

<template>
  <!-- 演示区共享主题上下文：Naive 控件的浅暗主题与 token 映射从这儿来 -->
  <DemoNaive>
    <div class="el-demo">
      <!-- 预设：一键勾选一组常见任务 -->
      <div
        class="presets"
        role="group"
        aria-label="预设场景"
      >
        <span class="presets-label">预设</span>
        <!-- Naive 单选预设按钮：size/type 语义与原 EP 等价 -->
        <n-button
          v-for="preset in PRESETS"
          :key="preset.id"
          size="small"
          :type="isPresetActive(preset) ? 'primary' : 'default'"
          :data-preset="preset.id"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </n-button>
      </div>

      <!-- 任务开关：勾选哪些，运行时就只排哪些 -->
      <div
        class="tasks"
        role="group"
        aria-label="选择要排入的任务"
      >
        <label
          v-for="task in TASKS"
          :key="task.id"
          class="task-toggle"
          :data-task="task.id"
        >
          <input
            type="checkbox"
            :checked="isOn(task.id)"
            @change="toggleTask(task.id)"
          >
          <span>{{ task.label }}</span>
          <span
            class="tag"
            :class="KIND_META[task.kind].cls"
          >{{ KIND_META[task.kind].badge }}</span>
        </label>
      </div>

      <div class="bar">
        <!-- 输出对照：n-radio-group 受控用法（:value + @update:value） -->
        <n-radio-group
          class="modes"
          :value="mode"
          aria-label="输出对照"
          @update:value="onModeChange"
        >
          <n-radio-button
            value="expect"
            data-mode="expect"
          >
            直觉预期（错误）
          </n-radio-button>
          <n-radio-button
            value="real"
            data-mode="real"
          >
            真实输出（正确）
          </n-radio-button>
        </n-radio-group>
        <n-button
          type="primary"
          data-action="run"
          @click="run"
        >
          运行
        </n-button>
        <n-button @click="clearOutput">
          清空
        </n-button>
      </div>

      <div class="stats">
        <span>已打印 <b>{{ logLines.length }}</b> 行</span>
        <span>已选任务 <b>{{ selectedCount }}</b> 个</span>
        <span>慢任务 <b>{{ slowOn ? '开' : '关' }}</b></span>
        <span v-if="summary">结论 <b>{{ summary }}</b></span>
      </div>

      <!-- 直觉预期视图：随勾选动态生成 -->
      <div
        v-if="mode === 'expect'"
        class="log"
      >
        <p class="log-note">
          下面是按「书写顺序」脑补的直觉排序（错误），只包含当前勾选的任务。
          点「运行」看真实输出差在哪：
        </p>
        <ol
          class="lines"
          aria-label="直觉预期顺序"
        >
          <li
            v-for="(line, i) in expectLines"
            :key="`${line.kind}-${i}`"
            class="line"
            :data-kind="line.kind"
          >
            <span class="idx">{{ i + 1 }}.</span>
            <span
              class="tag"
              :class="KIND_META[line.kind].cls"
            >{{ KIND_META[line.kind].badge }}</span>
            <span class="name">{{ line.name }}</span>
          </li>
        </ol>
      </div>

      <!-- 真实输出视图：运行结果按时间戳排列，文本可以直接选中复制 -->
      <div
        v-else
        class="log"
      >
        <p
          v-if="logLines.length === 0"
          class="log-note"
        >
          点「运行」后这里会按真实执行顺序逐行打印。文本可直接选中复制。
        </p>
        <ol
          v-else
          class="lines"
          aria-label="真实执行顺序"
        >
          <li
            v-for="(line, i) in logLines"
            :key="i"
            class="line"
            :data-kind="line.kind"
          >
            <span class="ts">{{ line.ts.toFixed(1) }} ms</span>
            <span
              class="tag"
              :class="KIND_META[line.kind].cls"
            >{{ KIND_META[line.kind].badge }}</span>
            <span class="name">{{ line.name }}</span>
          </li>
        </ol>
      </div>

      <p class="hint">
        勾选不同任务再运行，直觉顺序会跟着变；真实顺序以浏览器为准。
        微任务永远在「下一个宏任务」之前执行；慢任务只拖住当前宏任务，清微任务的时机不变。
      </p>
    </div>
  </DemoNaive>
</template>

<style scoped>
.el-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

/* ---------- 预设与任务开关 ---------- */

.presets {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.presets-label {
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.task-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  font-size: var(--demo-text-sm);
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.task-toggle:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.stats b {
  font-family: var(--font-mono);
  color: var(--primary);
}

.log {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  padding: 0.7rem 0.8rem;
  overflow-x: auto;
  user-select: text;
  min-height: 180px;
}

.log-note {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  white-space: nowrap;
}

.line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.idx {
  color: var(--text-secondary);
  width: 1.4rem;
  text-align: right;
}

.ts {
  color: var(--primary);
  width: 4.4rem;
  flex-shrink: 0;
}

.tag {
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.tag-macro {
  background-color: var(--primary-soft);
  color: var(--primary);
}

.tag-micro {
  background-color: var(--success-soft);
  color: var(--success);
}

.tag-frame {
  background-color: var(--warning-soft);
  color: var(--warning);
}

.tag-sync {
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

.name {
  font-family: var(--font-sans);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
