// ============================================================
// 案例：宏任务与微任务执行顺序（event-loop）
// - 一次点击里同时排入：定时器、Promise 微任务、逐帧回调
// - 「运行」后按浏览器真实执行顺序打印，每行带相对时间戳与类型徽章
// - 「直觉预期」模式展示新手脑补的错误顺序，与真实输出对照
// - 「慢任务」开关让主线程先忙 200ms，观察微任务照样抢在定时器前
// - 输出区文本可选中复制；重置按钮清空日志
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

// ---------- 任务类型（决定徽章文案与颜色） ----------

type TaskKind = 'macro-click' | 'macro-timer' | 'micro-then' | 'micro-qm' | 'frame-raf'

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

// ---------- 展示状态 ----------

/** 对照模式：expect 直觉预期（错） / real 真实输出（对） */
const mode = ref<'expect' | 'real'>('real')
/** 是否插入 200ms 慢任务（让顺序差异更明显） */
const slowTask = ref(false)
/** 真实输出的执行记录（按执行先后追加） */
const logLines = ref<RunLine[]>([])
/** 总结文案：本次运行的一句话结论 */
const summary = ref('')

// ---------- 徽章信息表（统一映射，避免模板里写三元嵌套） ----------

const KIND_META: Record<TaskKind, { badge: string; cls: string }> = {
  'macro-click': { badge: '宏任务', cls: 'tag-macro' },
  'macro-timer': { badge: '宏任务', cls: 'tag-macro' },
  'micro-then': { badge: '微任务', cls: 'tag-micro' },
  'micro-qm': { badge: '微任务', cls: 'tag-micro' },
  'frame-raf': { badge: '渲染前', cls: 'tag-frame' },
}

// ---------- 直觉预期（静态、错误）：先同步后异步的脑补 ----------

const expectLines: ExpectLine[] = [
  { name: '用户点击回调（先同步执行）', kind: 'macro-click' },
  { name: 'setTimeout 0ms 的回调', kind: 'macro-timer' },
  { name: 'setTimeout 200ms 的回调', kind: 'macro-timer' },
  { name: 'Promise.then 回调', kind: 'micro-then' },
  { name: 'queueMicrotask 回调', kind: 'micro-qm' },
  { name: '渲染一帧前的逐帧回调', kind: 'frame-raf' },
]

// ---------- 真实运行 ----------

/** 忙等 ms 毫秒：模拟慢任务拖住主线程（只占当前宏任务，不阻塞其它标签页） */
function busyWait(ms: number): void {
  const end = performance.now() + ms
  while (performance.now() < end) {
    // 空转等待：本案例的教学目的是把主线程固定占满一段时间
  }
}

/** 追加一条执行记录；时间戳起点 = 本次点击那一刻 */
const origin = { value: 0 }

function push(kind: TaskKind, name: string): void {
  const ts = performance.now() - origin.value
  logLines.value.push({ ts, kind, name })
}

/** 「运行」按钮本身就是一个宏任务：最理想的讲解切入点 */
function run(): void {
  logLines.value = []
  summary.value = ''
  origin.value = performance.now()

  push('macro-click', '用户点击回调（本次运行起点）')

  // 排进队列：五个异步任务一次性全部排入，顺序与书写一致
  setTimeout(() => push('macro-timer', 'setTimeout 0ms 的回调'), 0)
  Promise.resolve().then(() => push('micro-then', 'Promise.then 微任务'))
  queueMicrotask(() => push('micro-qm', 'queueMicrotask 微任务'))
  requestAnimationFrame(() => push('frame-raf', '渲染一帧前的逐帧回调（每秒约 60 次）'))
  setTimeout(() => push('macro-timer', 'setTimeout 200ms 的回调'), 200)

  // 慢任务排在排程之后：验证微任务是否被它拖住（不会——宏任务一结束就清微任务）
  if (slowTask.value) busyWait(200)

  // 结论用一句话点破：微任务紧随当前宏任务，不会被慢任务或定时器插队
  setTimeout(() => {
    summary.value = slowTask.value
      ? '主线程忙 200ms 时，微任务在忙完后立刻执行，仍排在定时器前面'
      : '微任务紧随点击回调执行，早于所有定时器'
  }, 300)
}
</script>

<template>
  <div class="el-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="输出对照"
      >
        <button
          class="mode"
          :class="{ active: mode === 'expect' }"
          :aria-pressed="mode === 'expect'"
          @click="mode = 'expect'"
        >
          直觉预期（先同步后异步，错误）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'real' }"
          :aria-pressed="mode === 'real'"
          @click="mode = 'real'"
        >
          真实输出（正确）
        </button>
      </div>
      <button
        class="btn"
        :aria-pressed="slowTask"
        @click="slowTask = !slowTask"
      >
        {{ slowTask ? '慢任务：主线程忙 200ms（开）' : '慢任务：主线程忙 200ms（关）' }}
      </button>
      <button
        class="btn run"
        @click="run"
      >
        运行
      </button>
      <button
        class="btn ghost"
        @click="logLines = []; summary = ''"
      >
        重置
      </button>
    </div>

    <div class="stats">
      <span>已打印 <b>{{ logLines.length }}</b> 行</span>
      <span>慢任务 <b>{{ slowTask ? '开' : '关' }}</b></span>
      <span v-if="summary">结论 <b>{{ summary }}</b></span>
    </div>

    <!-- 直觉预期视图：静态错误序列 -->
    <div
      v-if="mode === 'expect'"
      class="log"
    >
      <p class="log-note">
        这是「所有同步先跑完，再按 setTimeout → 微任务 → 渲染」的脑补顺序。
        点「真实输出」运行一次，对照差在哪：
      </p>
      <ol
        class="lines"
        aria-label="直觉预期顺序"
      >
        <li
          v-for="(line, i) in expectLines"
          :key="line.name"
          class="line"
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
      微任务永远在「下一个宏任务」之前执行；慢任务只拖住当前宏任务，清微任务的时机不变。
      渲染前的逐帧回调与 setTimeout 的相对位置以本机实测为准。
    </p>
  </div>
</template>

<style scoped>
.el-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle, var(--bg));
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
}

.mode.active {
  background-color: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-soft);
}

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;
}

.btn[aria-pressed='true'] {
  border-color: var(--primary);
  color: var(--primary);
}

.btn.run {
  border-color: var(--primary);
  color: var(--primary);
}

.btn.run:hover,
.btn:hover {
  background-color: var(--primary-soft);
  color: var(--primary);
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-secondary);
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
