// ============================================================
// 案例：请求竞态与取消（request-race）
// - 模拟接口：v 慢 900ms、vu 600ms、vue 快 300ms
// - 不取消：旧响应晚到，覆盖新结果（搜索框和结果不一致）
// - 取消：每次发新请求前 abort 上一条，只让最后一次生效
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'

type Mode = 'naive' | 'abort'
type LogStatus = 'pending' | 'ok' | 'aborted' | 'stale'

interface LogEntry {
  id: number
  query: string
  status: LogStatus
  detail: string
}

interface SearchResult {
  forQuery: string
  items: string[]
}

const SUGGESTIONS = ['vue', 'vue3', 'vuetify', 'vite', 'vitest', 'typescript', 'router', 'pinia']

const mode = ref<Mode>('naive')
const query = ref('')
const result = ref<SearchResult | null>(null)
const logs = ref<LogEntry[]>([])
const running = ref(false)

const stats = reactive({
  requests: 0,
  ok: 0,
  aborted: 0,
  stale: 0,
})

let seq = 0
let controller: AbortController | null = null
// 重置代数：重置后旧请求即使晚到也不允许再写结果或计数
let generation = 0

const finalMatched = computed(() => result.value !== null && result.value.forQuery === query.value)
const finalStale = computed(() => result.value !== null && result.value.forQuery !== query.value)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 模拟接口：延迟按关键词固定，保证竞态可复现 */
function fakeSearch(keyword: string, signal?: AbortSignal): Promise<string[]> {
  const delay = keyword === 'v' ? 900 : keyword === 'vu' ? 600 : keyword === 'vue' ? 300 : 400

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(SUGGESTIONS.filter((item) => item.includes(keyword)).map((item) => `${item} · ${delay}ms 返回`))
    }, delay)

    function onAbort(): void {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    }

    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

/** 更新一条日志（日志是响应式数组里的对象，直接改字段即可） */
function patchLog(id: number, patch: Partial<LogEntry>): void {
  const entry = logs.value.find((item) => item.id === id)
  if (entry) Object.assign(entry, patch)
}

/** 发一次请求；不取消模式故意保留“旧响应直接覆盖”的错误写法 */
async function run(keyword: string): Promise<void> {
  if (!keyword.trim()) return

  const id = ++seq
  const gen = generation
  stats.requests++
  logs.value.unshift({
    id,
    query: keyword,
    status: 'pending',
    detail: keyword === 'v' ? '900ms 后返回' : keyword === 'vu' ? '600ms 后返回' : '300ms 后返回',
  })

  let activeController: AbortController | undefined
  if (mode.value === 'abort') {
    // 新请求发出前先终止旧请求，旧请求不会再写结果
    controller?.abort()
    controller = new AbortController()
    activeController = controller
  }

  try {
    const items = await fakeSearch(keyword, activeController?.signal)
    // 重置后回来的请求直接丢弃，避免污染新一轮演示
    if (gen !== generation) return
    // 无论模式如何都直接写结果：这正是竞态出问题的根源
    result.value = { forQuery: keyword, items }

    if (keyword === query.value) {
      stats.ok++
      patchLog(id, { status: 'ok', detail: `返回 ${items.length} 条` })
    } else {
      // 晚到的旧响应覆盖了新结果
      stats.stale++
      patchLog(id, { status: 'stale', detail: '旧响应，已覆盖新结果' })
    }
  } catch (error) {
    if (gen !== generation) return
    if (error instanceof DOMException && error.name === 'AbortError') {
      stats.aborted++
      patchLog(id, { status: 'aborted', detail: '被新请求取消' })
      return
    }
    patchLog(id, { status: 'stale', detail: '请求失败' })
  }
}

/** 手动输入：清空时取消在途请求 */
function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  query.value = value
  if (!value.trim()) {
    controller?.abort()
    result.value = null
    return
  }
  void run(value)
}

/** 固定发送 v → vu → vue，三次请求的返回顺序与发送顺序相反 */
async function simulate(): Promise<void> {
  if (running.value) return
  reset()
  running.value = true

  const pending: Promise<void>[] = []
  for (const keyword of ['v', 'vu', 'vue']) {
    query.value = keyword
    pending.push(run(keyword))
    await sleep(90)
  }
  await Promise.all(pending)
  running.value = false
}

/** 清空输入、结果、日志与计数，并取消在途请求 */
function reset(): void {
  if (running.value) return
  generation++
  controller?.abort()
  controller = null
  query.value = ''
  result.value = null
  logs.value = []
  stats.requests = 0
  stats.ok = 0
  stats.aborted = 0
  stats.stale = 0
}

/** 单选组回调：把 Naive 抛出的联合类型收窄成 Mode */
function onModeChange(next: string | number | boolean | undefined): void {
  if (next === 'naive' || next === 'abort') setMode(next)
}

/** 切换模式时重置，避免两种模式的日志混在一起 */
function setMode(next: Mode): void {
  if (mode.value === next || running.value) return
  mode.value = next
  reset()
}

onUnmounted(() => {
  controller?.abort()
})
</script>

<template>
  <div class="rr-demo">
    <div class="bar">
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="请求处理模式"
        @update:value="onModeChange"
      >
        <n-radio-button value="naive">
          不取消旧请求
        </n-radio-button>
        <n-radio-button value="abort">
          取消旧请求（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        :disabled="running"
        @click="simulate"
      >
        {{ running ? '请求中…' : '模拟快速输入' }}
      </n-button>
      <n-button
        :disabled="running"
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <label class="search">
      <span class="sr-only">搜索关键词</span>
      <input
        :value="query"
        class="input"
        type="search"
        placeholder="输入 v / vu / vue 试试…"
        autocomplete="off"
        @input="onInput"
      >
    </label>

    <div class="stats">
      <span>请求 <b>{{ stats.requests }}</b></span>
      <span>成功 <b>{{ stats.ok }}</b></span>
      <span>取消 <b>{{ stats.aborted }}</b></span>
      <span>旧响应覆盖 <b :class="{ bad: stats.stale > 0 }">{{ stats.stale }}</b></span>
      <span
        class="final"
        :class="{ good: finalMatched, bad: finalStale }"
      >
        最终结果 {{ finalMatched ? '正确' : finalStale ? '串台' : '—' }}
      </span>
    </div>

    <div class="panels">
      <section
        class="panel"
        aria-label="搜索结果"
      >
        <header class="panel-head">
          <span>搜索结果</span>
          <b v-if="result">来自「{{ result.forQuery }}」</b>
        </header>
        <div
          v-if="result"
          class="result"
          :class="{ stale: finalStale }"
        >
          <p
            v-if="finalStale"
            class="warn"
          >
            当前输入是「{{ query }}」，结果却来自更早的「{{ result.forQuery }}」——旧请求晚到，覆盖了新结果。
          </p>
          <ul>
            <li
              v-for="item in result.items"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>
        <p
          v-else
          class="empty"
        >
          还没有结果。点「模拟快速输入」或直接打字。
        </p>
      </section>

      <section
        class="panel"
        aria-label="请求日志"
      >
        <header class="panel-head">
          <span>请求日志</span>
          <b>{{ logs.length }} 条</b>
        </header>
        <ul
          v-if="logs.length"
          class="logs"
        >
          <li
            v-for="log in logs"
            :key="log.id"
            class="log"
            :class="`log--${log.status}`"
          >
            <span class="log-query">「{{ log.query }}」</span>
            <span class="log-detail">{{ log.detail }}</span>
          </li>
        </ul>
        <p
          v-else
          class="empty"
        >
          请求状态会实时出现在这里：等待、成功、取消、旧响应覆盖。
        </p>
      </section>
    </div>

    <p class="hint">
      模拟接口故意让 v 最慢、vue 最快：不取消时，最后回来的是旧请求；
      取消后，旧请求在日志里变成「被新请求取消」，不会再碰结果。
    </p>
  </div>
</template>

<style scoped>
.rr-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

/* 只留排列，观感交给 Naive 单选组 */
.modes {
  display: inline-flex;
}

.search {
  display: block;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.input {
  width: 100%;
  height: var(--demo-control-h);
  padding: 0 var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  color: var(--text);
  font-size: var(--demo-text-md);
  outline: none;

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
  }
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

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }

  .bad {
    color: var(--danger);
  }
}

.final {
  margin-left: auto;
  padding: 0.05rem 0.5rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);

  &.good {
    background-color: var(--success-soft);
    color: var(--success);
  }

  &.bad {
    background-color: var(--danger-soft);
    color: var(--danger);
  }
}

.panels {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 0.7rem;
}

.panel {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--border);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.result {
  padding: 0.65rem 0.75rem;

  &.stale {
    background-color: color-mix(in srgb, var(--danger) 7%, transparent);
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  li {
    font-family: var(--font-mono);
    font-size: var(--demo-text-sm);
    color: var(--text);
  }
}

.warn {
  margin: 0 0 0.5rem;
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--danger);
}

.logs {
  margin: 0;
  padding: 0.4rem 0.55rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 180px;
  overflow-y: auto;
}

.log {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0.45rem;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.log-query {
  font-family: var(--font-mono);
  color: var(--text);
}

.log--pending .log-detail {
  color: var(--primary);
}

.log--ok .log-detail {
  color: var(--success);
}

.log--aborted .log-detail {
  color: var(--warning);
}

.log--stale {
  background-color: var(--danger-soft);

  .log-detail {
    color: var(--danger);
  }
}

.empty {
  margin: 0;
  padding: 1.2rem 0.8rem;
  text-align: center;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 760px) {
  .panels {
    grid-template-columns: 1fr;
  }

  .final {
    margin-left: 0;
  }
}
</style>
