// ============================================================
// 案例：useAsyncTask —— 把异步请求的状态收进一个组合式函数
// - 左边（手写）：loading / error / data 三个 ref，取消只能丢弃结果
// - 右边（推荐）：useAsyncTask(task)，状态机 + AbortController + retry / reset
// - 对比点：取消后的状态、AbortError 不算错误、新请求自动取消旧请求
// ============================================================
<script setup lang="ts">
import { computed, onScopeDispose, onUnmounted, reactive, ref } from 'vue'

// ============================================================
// 请求本身：用 setTimeout 模拟一个可取消的接口
// ============================================================

/** 一次请求的参数：延迟多久、是否失败 */
interface RunOptions {
  delay: number
  fail: boolean
}

/** 三种预设，按钮与文案共用，避免数字散落在模板里 */
const PRESETS = {
  normal: { delay: 700, fail: false },
  slow: { delay: 1600, fail: false },
  fail: { delay: 500, fail: true },
} satisfies Record<string, RunOptions>

/**
 * 模拟接口：成功返回一段文字，失败抛错，取消时抛 AbortError
 * @param options 延迟与是否失败
 * @param signal  取消信号，由 AbortController 提供
 */
function fakeRequest(options: RunOptions, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      if (options.fail) {
        reject(new Error('服务端返回 500：这次请求失败了'))
        return
      }
      resolve(`请求成功，耗时 ${options.delay}ms`)
    }, options.delay)

    /** 取消时把定时器清掉，并抛一个名字为 AbortError 的异常 */
    function handleAbort(): void {
      window.clearTimeout(timer)
      reject(new DOMException('已取消', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

// ============================================================
// 组合式函数：状态机 + 取消 + 重试
// ============================================================

/** 任务状态：idle 初始、pending 进行中、success / error / aborted 是三种结束方式 */
type TaskStatus = 'idle' | 'pending' | 'success' | 'error' | 'aborted'

/** 状态对应的中文标签（模板与日志共用） */
const STATUS_LABEL: Record<TaskStatus, string> = {
  idle: '未开始',
  pending: '请求中',
  success: '成功',
  error: '失败',
  aborted: '已取消',
}

/**
 * 把一次异步任务封装成「状态 + 结果 + 取消 + 重试」
 * @param task 真正干活的函数，第二个参数是取消信号
 */
function useAsyncTask<T, P>(task: (payload: P, signal: AbortSignal) => Promise<T>) {
  const status = ref<TaskStatus>('idle')
  const data = ref<T | null>(null)
  const error = ref('')
  const runs = ref(0)
  const aborts = ref(0)

  let controller: AbortController | null = null
  let lastPayload: P | null = null
  let hasLast = false
  let runId = 0

  /** 发起一次请求：会先取消上一次，避免旧响应覆盖新结果 */
  async function execute(payload: P): Promise<void> {
    if (controller) {
      aborts.value++
      controller.abort()
    }

    const id = ++runId
    const current = new AbortController()
    controller = current
    lastPayload = payload
    hasLast = true
    runs.value++
    status.value = 'pending'
    data.value = null
    error.value = ''

    try {
      const result = await task(payload, current.signal)
      //! 请求返回时可能已经被更新的请求取代：这个判断让旧结果直接作废
      if (id !== runId) return
      data.value = result
      status.value = 'success'
    } catch (err) {
      if (id !== runId) return
      //! AbortError 是「主动取消」，不是业务失败：状态要单独区分
      if (current.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        aborts.value++
        status.value = 'aborted'
        return
      }
      error.value = err instanceof Error ? err.message : String(err)
      status.value = 'error'
    } finally {
      if (controller === current) controller = null
    }
  }

  /** 取消当前请求（没有请求时什么也不做） */
  function abort(): void {
    controller?.abort()
  }

  /** 用上一次的参数再发一次 */
  function retry(): Promise<void> {
    if (!hasLast || lastPayload === null) return Promise.resolve()
    return execute(lastPayload)
  }

  /** 回到初始状态，并让仍在路上的结果失效 */
  function reset(): void {
    runId++
    controller?.abort()
    controller = null
    lastPayload = null
    hasLast = false
    status.value = 'idle'
    data.value = null
    error.value = ''
  }

  //! 作用域结束（组件卸载 / effectScope.stop）时取消在途请求，
  //! 否则回调回来还会去改已经没人看的状态
  onScopeDispose(() => {
    controller?.abort()
  })

  return { status, data, error, runs, aborts, execute, abort, retry, reset }
}

// ============================================================
// 左边：手写三件套
// ============================================================

const manual = reactive({
  status: 'idle' as TaskStatus,
  data: '',
  error: '',
  runs: 0,
  stale: 0,
  active: 0,
})

/** 手动版发出的定时器：取消不会清掉，只是让结果作废 */
const manualTimers = new Set<number>()
let manualToken = 0
let manualLast: RunOptions | null = null
let manualHasLast = false

/** 手写版：自己维护三个状态，再靠 token 判断结果是否过期 */
function manualRun(options: RunOptions): void {
  const token = ++manualToken
  manualLast = options
  manualHasLast = true
  manual.runs++
  manual.status = 'pending'
  manual.data = ''
  manual.error = ''
  manual.active++

  const timer = window.setTimeout(() => {
    manualTimers.delete(timer)
    manual.active--
    //! 手写版也能防串台，但需要自己维护 token；忘了这行就会被旧结果覆盖
    if (token !== manualToken) {
      manual.stale++
      return
    }
    if (options.fail) {
      manual.status = 'error'
      manual.error = '服务端返回 500：这次请求失败了'
      return
    }
    manual.status = 'success'
    manual.data = `请求成功，耗时 ${options.delay}ms`
  }, options.delay)

  manualTimers.add(timer)
}

/** 手写版取消：只让结果作废，定时器仍然会跑完 */
function manualCancel(): void {
  manualToken++
  manual.status = 'aborted'
}

/** 手写版重试：自己记住上一次参数 */
function manualRetry(): void {
  if (manualHasLast && manualLast) manualRun(manualLast)
}

/** 手写版重置：状态回到初始，但在途定时器不受影响 */
function manualReset(): void {
  manualToken++
  manual.status = 'idle'
  manual.data = ''
  manual.error = ''
  manualLast = null
  manualHasLast = false
}

// ============================================================
// 右边：useAsyncTask
// ============================================================

const {
  status: autoStatus,
  data: autoData,
  error: autoError,
  runs: autoRuns,
  aborts: autoAborts,
  execute: autoExecute,
  abort: autoAbort,
  retry: autoRetry,
  reset: autoReset,
} = useAsyncTask(fakeRequest)

// ============================================================
// 两边共用的操作
// ============================================================

/** 演示里额外用到的延时器（例如「慢请求后立刻再发」） */
const actionTimers = new Set<number>()

/** 同时触发两边，保证对比条件一致 */
function runBoth(kind: keyof typeof PRESETS): void {
  const options = PRESETS[kind]
  manualRun(options)
  void autoExecute(options)
}

/** 慢请求还没回来就再发一个快的：看旧请求怎么处理 */
function runSlowThenFast(): void {
  const slow = PRESETS.slow
  manualRun(slow)
  void autoExecute(slow)

  const timer = window.setTimeout(() => {
    actionTimers.delete(timer)
    const fast = PRESETS.normal
    manualRun(fast)
    void autoExecute(fast)
  }, 220)
  actionTimers.add(timer)
}

function cancelBoth(): void {
  manualCancel()
  autoAbort()
}

function retryBoth(): void {
  manualRetry()
  void autoRetry()
}

function resetBoth(): void {
  manualReset()
  autoReset()
}

/** 手写版仍在跑的定时器数量，用文案解释「取消不等于中止」 */
const manualActiveText = computed(() => {
  return manual.active > 0 ? `${manual.active} 个定时器还在跑` : '没有在跑的定时器'
})

onUnmounted(() => {
  manualTimers.forEach((timer) => window.clearTimeout(timer))
  manualTimers.clear()
  actionTimers.forEach((timer) => window.clearTimeout(timer))
  actionTimers.clear()
  manualToken++
})
</script>

<template>
  <div class="at-demo">
    <p class="hint">
      两边同时发起同一个请求：左边要自己拼 <b>loading / error / data</b>，
      取消只能让结果作废；右边把状态、取消、重试都收进 <b>useAsyncTask</b>。
    </p>

    <div class="actions">
      <n-button
        type="primary"
        @click="runBoth('normal')"
      >
        正常请求（700ms）
      </n-button>
      <n-button @click="runBoth('slow')">
        慢请求（1600ms）
      </n-button>
      <n-button
        type="error"
        ghost
        @click="runBoth('fail')"
      >
        失败请求
      </n-button>
      <n-button
        type="warning"
        ghost
        @click="cancelBoth"
      >
        取消
      </n-button>
      <n-button @click="retryBoth">
        重试
      </n-button>
      <n-button @click="runSlowThenFast">
        慢请求后立刻再发
      </n-button>
      <n-button
        quaternary
        @click="resetBoth"
      >
        重置
      </n-button>
    </div>

    <div class="cols">
      <!-- 左边：手写三件套 -->
      <section class="col">
        <h3 class="col-title">
          手写 loading / error / data
        </h3>
        <p class="col-sub">
          取消只是让结果作废，请求本身还在跑
        </p>

        <div
          class="status"
          :class="`is-${manual.status}`"
          role="status"
        >
          <span class="badge">{{ STATUS_LABEL[manual.status] }}</span>
          <span
            v-if="manual.status === 'pending'"
            class="status-text"
          >等待接口返回…</span>
          <span
            v-else-if="manual.status === 'success'"
            class="status-text"
          >{{ manual.data }}</span>
          <span
            v-else-if="manual.status === 'error'"
            class="status-text"
          >{{ manual.error }}</span>
          <span
            v-else-if="manual.status === 'aborted'"
            class="status-text"
          >结果已丢弃</span>
          <span
            v-else
            class="status-text"
          >还没有发起请求</span>
        </div>

        <dl class="metrics">
          <div class="metric">
            <dt>请求次数</dt>
            <dd data-stat="manual-runs">
              {{ manual.runs }}
            </dd>
          </div>
          <div class="metric">
            <dt>过期响应</dt>
            <dd data-stat="manual-stale">
              {{ manual.stale }}
            </dd>
          </div>
          <div class="metric">
            <dt>仍在跑</dt>
            <dd data-stat="manual-active">
              {{ manual.active }}
            </dd>
          </div>
        </dl>

        <p
          class="note"
          data-stat="manual-active-text"
        >
          {{ manualActiveText }}
        </p>
      </section>

      <!-- 右边：useAsyncTask -->
      <section class="col col--ok">
        <h3 class="col-title">
          useAsyncTask(task)
        </h3>
        <p class="col-sub">
          状态机 + AbortController，取消是真正中止
        </p>

        <div
          class="status"
          :class="`is-${autoStatus}`"
          role="status"
        >
          <span class="badge">{{ STATUS_LABEL[autoStatus] }}</span>
          <span
            v-if="autoStatus === 'pending'"
            class="status-text"
          >等待接口返回…</span>
          <span
            v-else-if="autoStatus === 'success'"
            class="status-text"
          >{{ autoData }}</span>
          <span
            v-else-if="autoStatus === 'error'"
            class="status-text"
          >{{ autoError }}</span>
          <span
            v-else-if="autoStatus === 'aborted'"
            class="status-text"
          >AbortError 被识别为取消，不是失败</span>
          <span
            v-else
            class="status-text"
          >还没有发起请求</span>
        </div>

        <dl class="metrics">
          <div class="metric">
            <dt>请求次数</dt>
            <dd data-stat="auto-runs">
              {{ autoRuns }}
            </dd>
          </div>
          <div class="metric">
            <dt>取消次数</dt>
            <dd data-stat="auto-aborts">
              {{ autoAborts }}
            </dd>
          </div>
          <div class="metric">
            <dt>状态种类</dt>
            <dd>5</dd>
          </div>
        </dl>

        <p class="note">
          取消会清掉定时器；新请求会先取消旧请求。
        </p>
      </section>
    </div>

    <p class="footnote">
      点「慢请求后立刻再发」：左边慢请求的定时器还在跑，只是结果被 token 丢掉；
      右边慢请求被 AbortController 真正中止，快请求直接成功。
    </p>
  </div>
</template>

<style scoped>
.at-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

/* ---------- 两栏对照 ---------- */

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.col--ok {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background-color: color-mix(in srgb, var(--primary-soft) 55%, var(--bg));
}

.col-title {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.col-sub {
  margin: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

/* ---------- 状态卡 ---------- */

.status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.6rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.badge {
  flex: none;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  background-color: var(--bg-subtle);
}

.status-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.status.is-pending {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
  background-color: var(--warning-soft);

  .badge {
    color: var(--warning);
    background-color: color-mix(in srgb, var(--warning) 14%, transparent);
  }
}

.status.is-success {
  border-color: color-mix(in srgb, var(--success) 45%, var(--border));
  background-color: var(--success-soft);

  .badge {
    color: var(--success);
    background-color: color-mix(in srgb, var(--success) 14%, transparent);
  }
}

.status.is-error {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
  background-color: var(--danger-soft);

  .badge {
    color: var(--danger);
    background-color: color-mix(in srgb, var(--danger) 14%, transparent);
  }
}

.status.is-aborted {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
  background-color: var(--warning-soft);

  .badge {
    color: var(--warning);
    background-color: color-mix(in srgb, var(--warning) 14%, transparent);
  }
}

/* ---------- 指标 ---------- */

.metrics {
  display: flex;
  gap: 1.2rem;
  margin: 0;
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
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text);
  }
}

.col:not(.col--ok) .metric dd {
  color: var(--warning);
}

.col--ok .metric dd {
  color: var(--success);
}

.note {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--text-secondary);
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }

  .metric dd {
    font-size: 1.2rem;
  }
}
</style>
