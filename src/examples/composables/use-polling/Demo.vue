// ============================================================
// 案例：usePolling —— 轮询要「等上一次跑完再排下一次」
// - 左边（手写）：setInterval 固定每 800ms 发一次，慢接口会叠出并发
// - 右边（推荐）：usePolling 用 setTimeout 链，跑完才排下一次，并在后台暂停
// - 对比点：并发重叠次数、后台期间请求数、停止/卸载后的定时器清理
// ============================================================
<script setup lang="ts">
import { computed, onScopeDispose, onUnmounted, reactive, ref, watch } from 'vue'

// ============================================================
// 参数与模拟接口
// ============================================================

/** 轮询间隔：两次「开始」之间至少隔 800ms */
const INTERVAL = 800
/** 正常接口耗时 */
const FAST_DELAY = 350
/** 慢接口耗时：比间隔还长，setInterval 就会叠出并发 */
const SLOW_DELAY = 1300

/** 是否模拟慢接口 */
const slow = ref(false)
/** 是否模拟「页面切到后台」 */
const simulatedHidden = ref(false)

/**
 * 模拟一次轮询请求：成功返回当前时间，取消时抛 AbortError
 * @param signal 取消信号
 */
function fakePoll(signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }

    const delay = slow.value ? SLOW_DELAY : FAST_DELAY
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve(Date.now())
    }, delay)

    function handleAbort(): void {
      window.clearTimeout(timer)
      reject(new DOMException('已取消', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

// ============================================================
// 组合式函数：setTimeout 链 + 后台暂停
// ============================================================

/** 轮询选项 */
interface PollingOptions {
  /** 是否立即执行第一次（默认 true） */
  immediate?: boolean
  /** 页面隐藏时是否暂停（默认 false） */
  pauseOnHidden?: boolean
  /** 自定义「是否隐藏」，默认读 document.hidden（演示里用模拟开关覆盖） */
  isHidden?: () => boolean
}

/**
 * 轮询：上一次任务结束后才安排下一次，避免慢接口叠出并发
 * @param task     每次轮询要做的事，收到取消信号
 * @param interval 两次任务之间的间隔
 * @param options  立即执行 / 后台暂停 / 自定义隐藏判断
 */
function usePolling(
  task: (signal: AbortSignal) => Promise<void>,
  interval: number,
  options: PollingOptions = {},
) {
  const running = ref(false)
  const paused = ref(false)
  const count = ref(0)
  const errors = ref(0)
  const active = ref(0)

  let timer: number | null = null
  let controller: AbortController | null = null
  let generation = 0

  /** 当前是否处于「后台」：演示里由模拟开关覆盖，真实项目默认看 document.hidden */
  function hidden(): boolean {
    return options.isHidden?.() ?? (typeof document !== 'undefined' && document.hidden)
  }

  function clearTimer(): void {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  /** 排下一次：只排一次，不递归堆定时器 */
  function schedule(): void {
    clearTimer()
    if (!running.value) return
    timer = window.setTimeout(() => {
      void tick()
    }, interval)
  }

  /** 执行一次轮询，结束后再排下一次 */
  async function tick(): Promise<void> {
    if (!running.value) return
    if (options.pauseOnHidden && hidden()) {
      paused.value = true
      return
    }
    paused.value = false

    controller?.abort()
    const current = new AbortController()
    controller = current
    const id = ++generation
    count.value++
    active.value++

    try {
      await task(current.signal)
    } catch {
      //! 取消不是错误：只有「这一轮仍然有效且不是主动取消」才计错误
      if (id === generation && !current.signal.aborted) {
        errors.value++
      }
    } finally {
      // 每个 tick 只加一次、只减一次；即使被 abort，也要把并发数还回去
      active.value = Math.max(0, active.value - 1)
    }

    if (!running.value || id !== generation) return
    if (options.pauseOnHidden && hidden()) {
      paused.value = true
      return
    }
    schedule()
  }

  /** 开始轮询：默认立即执行第一次 */
  function start(): void {
    if (running.value) return
    running.value = true
    paused.value = false
    if (options.immediate === false) schedule()
    else void tick()
  }

  /** 停止轮询：清掉下一次定时器，并中止在途请求 */
  function stop(): void {
    running.value = false
    paused.value = false
    generation++
    clearTimer()
    controller?.abort()
    controller = null
  }

  /** 后台 / 前台切换时手动同步一次（真实项目由 visibilitychange 触发） */
  function sync(): void {
    if (!running.value || !options.pauseOnHidden) return
    if (hidden()) {
      paused.value = true
      clearTimer()
      return
    }
    if (paused.value) {
      paused.value = false
      void tick()
    }
  }

  /** 停止并把计数清零 */
  function reset(): void {
    stop()
    count.value = 0
    errors.value = 0
  }

  //! 真实项目靠这个监听自动暂停 / 恢复；演示里同时暴露 sync 给模拟开关用
  if (typeof document !== 'undefined' && options.pauseOnHidden) {
    document.addEventListener('visibilitychange', sync)
  }

  onScopeDispose(() => {
    stop()
    if (typeof document !== 'undefined' && options.pauseOnHidden) {
      document.removeEventListener('visibilitychange', sync)
    }
  })

  return { running, paused, count, errors, active, start, stop, sync, reset }
}

// ============================================================
// 左边：setInterval 固定节拍
// ============================================================

const manual = reactive({
  running: false,
  count: 0,
  active: 0,
  overlaps: 0,
  hiddenPolls: 0,
})

let manualTimer: number | null = null
const manualPending = new Set<number>()

/** 手写版：不管上一次有没有跑完，到点就再发一个 */
function manualStart(): void {
  if (manual.running) return
  manual.running = true

  manualTimer = window.setInterval(() => {
    manual.count++
    if (simulatedHidden.value) manual.hiddenPolls++
    manual.active++
    if (manual.active > 1) manual.overlaps++

    const delay = slow.value ? SLOW_DELAY : FAST_DELAY
    const timer = window.setTimeout(() => {
      manualPending.delete(timer)
      manual.active--
    }, delay)
    manualPending.add(timer)
  }, INTERVAL)
}

/** 停止：只清 interval，已经发出去的请求还会继续跑完 */
function manualStop(): void {
  manual.running = false
  if (manualTimer !== null) {
    window.clearInterval(manualTimer)
    manualTimer = null
  }
}

/** 重置：停掉定时器、清掉所有在途请求、计数归零 */
function manualReset(): void {
  manualStop()
  manualPending.forEach((timer) => window.clearTimeout(timer))
  manualPending.clear()
  manual.count = 0
  manual.active = 0
  manual.overlaps = 0
  manual.hiddenPolls = 0
}

// ============================================================
// 右边：usePolling
// ============================================================

const {
  running: autoRunning,
  paused: autoPaused,
  count: autoCount,
  errors: autoErrors,
  active: autoActive,
  start: autoStart,
  stop: autoStop,
  sync: autoSync,
  reset: autoReset,
} = usePolling(
  async (signal) => {
    await fakePoll(signal)
  },
  INTERVAL,
  {
    immediate: true,
    pauseOnHidden: true,
    //! 演示里用开关模拟后台；真实项目删掉这一行，默认读 document.hidden
    isHidden: () => simulatedHidden.value || document.hidden,
  },
)

/** 封装版在「后台」期间新增的轮询次数（暂停后不再增加） */
const autoHiddenPolls = ref(0)
watch(autoCount, () => {
  if (simulatedHidden.value) autoHiddenPolls.value++
})

/** 模拟后台开关变化时，通知封装版暂停 / 恢复 */
watch(simulatedHidden, () => {
  autoSync()
})

// ============================================================
// 两边共用的操作
// ============================================================

function startBoth(): void {
  manualStart()
  autoStart()
}

function stopBoth(): void {
  manualStop()
  autoStop()
}

function resetBoth(): void {
  manualReset()
  autoReset()
  autoHiddenPolls.value = 0
}

/** 手写版状态文案 */
const manualStateLabel = computed(() => {
  if (!manual.running) return '已停止'
  return manual.active > 1 ? '运行中（有并发）' : '运行中'
})

onUnmounted(() => {
  manualPending.forEach((timer) => window.clearTimeout(timer))
  manualPending.clear()
  manualStop()
})
</script>

<template>
  <div class="up-demo">
    <p class="hint">
      打开「模拟慢接口（1300ms）」再开始：左边每 800ms 固定发一次，请求会叠在一起；
      右边等上一次跑完才排下一次，并且切到后台会暂停。
    </p>

    <div class="toolbar">
      <n-button
        type="primary"
        @click="startBoth"
      >
        开始轮询
      </n-button>
      <n-button
        type="warning"
        ghost
        @click="stopBoth"
      >
        停止
      </n-button>
      <n-button @click="resetBoth">
        重置
      </n-button>

      <label class="toggle">
        <n-switch
          v-model:value="slow"
          size="small"
        />
        <span>模拟慢接口（1300ms）</span>
      </label>

      <label class="toggle">
        <n-switch
          v-model:value="simulatedHidden"
          size="small"
        />
        <span>模拟切到后台</span>
      </label>
    </div>

    <div class="cols">
      <!-- 左边：setInterval -->
      <section class="col">
        <h3 class="col-title">
          setInterval 固定节拍
        </h3>
        <p class="col-sub">
          到点就发，不管上一次有没有跑完
        </p>

        <div
          class="state"
          :class="{ on: manual.running, warn: manual.overlaps > 0 }"
          role="status"
        >
          <span class="dot" />
          {{ manualStateLabel }}
        </div>

        <dl class="metrics">
          <div class="metric">
            <dt>轮询次数</dt>
            <dd data-stat="manual-count">
              {{ manual.count }}
            </dd>
          </div>
          <div class="metric">
            <dt>当前并发</dt>
            <dd data-stat="manual-active">
              {{ manual.active }}
            </dd>
          </div>
          <div class="metric">
            <dt>并发重叠</dt>
            <dd data-stat="manual-overlaps">
              {{ manual.overlaps }}
            </dd>
          </div>
          <div class="metric">
            <dt>后台期间轮询</dt>
            <dd data-stat="manual-hidden">
              {{ manual.hiddenPolls }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- 右边：usePolling -->
      <section class="col col--ok">
        <h3 class="col-title">
          usePolling（setTimeout 链）
        </h3>
        <p class="col-sub">
          跑完才排下一次，后台自动暂停
        </p>

        <div
          class="state"
          :class="{ on: autoRunning, paused: autoPaused }"
          role="status"
        >
          <span class="dot" />
          {{ autoRunning ? (autoPaused ? '已暂停（后台）' : '运行中') : '已停止' }}
        </div>

        <dl class="metrics">
          <div class="metric">
            <dt>轮询次数</dt>
            <dd data-stat="auto-count">
              {{ autoCount }}
            </dd>
          </div>
          <div class="metric">
            <dt>当前并发</dt>
            <dd data-stat="auto-active">
              {{ autoActive }}
            </dd>
          </div>
          <div class="metric">
            <dt>错误次数</dt>
            <dd data-stat="auto-errors">
              {{ autoErrors }}
            </dd>
          </div>
          <div class="metric">
            <dt>后台期间轮询</dt>
            <dd data-stat="auto-hidden">
              {{ autoHiddenPolls }}
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <p class="footnote">
      手写版停止时只清 interval，已经发出的请求还会跑完；封装版停止会连在途请求一起中止。
      切到后台后，左边继续轮询，右边把下一次定时器清掉。
    </p>
  </div>
</template>

<style scoped>
.up-demo {
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

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  cursor: pointer;
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

/* ---------- 状态 ---------- */

.state {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.2rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background-color: var(--text-secondary);
}

.state.on {
  border-color: color-mix(in srgb, var(--success) 45%, var(--border));
  background-color: var(--success-soft);
  color: var(--success);

  .dot {
    background-color: var(--success);
  }
}

.state.warn {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
  background-color: var(--warning-soft);
  color: var(--warning);

  .dot {
    background-color: var(--warning);
  }
}

.state.paused {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
  background-color: var(--warning-soft);
  color: var(--warning);

  .dot {
    background-color: var(--warning);
  }
}

/* ---------- 指标 ---------- */

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 0.8rem;
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
