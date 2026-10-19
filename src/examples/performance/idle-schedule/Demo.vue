// ============================================================
// 案例：requestIdleCallback 空闲调度（idle-schedule）
// 对比演示：同一任务（200 条数据处理）
//   - 立即执行：同步一口气做完——主线程阻塞，页面卡顿
//   - 空闲执行：分片推进，每片只在 deadline.timeRemaining() > 0 时干活
// 附：取消按钮（cancelIdleCallback）+ Safari 降级（无 ric 时 setTimeout 兜底）
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 展示状态 ----------

/** 任务总条数 */
const TOTAL = 200
/** 已完成条数（进度条与状态都看它） */
const done = ref(0)
/** 最近一次「立即执行」的同步阻塞时长 ms */
const blockingMs = ref(0)
/** 分片日志（最新在前，最多 6 条） */
const logs = ref<string[]>([])
/** 运行中（禁用按钮防重入） */
const running = ref(false)

// ---------- 卡顿指示：rAF 帧间隔监控 ----------

/** 当前帧间隔 ms（>50 视为卡顿，指示灯变红） */
const frameGap = ref(0)
let monitorRafId = 0
let monitorLastTs = 0

/** 连续 rAF 采样帧间隔：主线程被阻塞时帧间隔会骤增 */
function monitorLoop(now: number): void {
  frameGap.value = now - monitorLastTs
  monitorLastTs = now
  monitorRafId = requestAnimationFrame(monitorLoop)
}

// ---------- 空闲调度核心（含 Safari 降级） ----------

/** IdleDeadline 回调签名（与原生一致） */
type IdleCallback = (deadline: IdleDeadline) => void

/**
 * Safari 长期未支持 requestIdleCallback——降级为 setTimeout 兜底：
 * 造一个「假 deadline」（固定给出 8ms 空闲预算），保持代码路径一致
 */
const requestIdle: (cb: IdleCallback, opts?: { timeout: number }) => number =
  window.requestIdleCallback?.bind(window) ??
  ((cb) =>
    window.setTimeout(
      () => cb({ timeRemaining: () => 8, didTimeout: true } as IdleDeadline),
      1,
    ))

const cancelIdle: (id: number) => void =
  window.cancelIdleCallback?.bind(window) ?? window.clearTimeout.bind(window)

/** 空闲回调句柄（取消按钮用） */
let idleHandle = 0
/** 已处理条数（分片闭包内计数） */
let processed = 0
/** 空闲执行起点时间戳（算总用时） */
let idleStartTs = 0

/** 模拟工作单元：一条数据的「处理」（空转少量时间模拟真实计算） */
function work(): void {
  // 消耗约 0.5ms：忙等，模拟解析/计算
  const until = performance.now() + 0.5
  while (performance.now() < until) {
    /* busy */
  }
}

/**
 * 空闲分片回调：
 * 每次被浏览器调用时问 deadline「还有空闲吗」，有就干一批，没了就等下次
 */
function idleSlice(deadline: IdleDeadline): void {
  const sliceStart = performance.now()
  const startDone = processed

  // 核心循环：预算内尽量多干，timeRemaining() <= 2ms 就让出主线程
  // didTimeout 为 true 表示这是 timeout 兜底触发（浏览器等不下去了强制调）
  while (processed < TOTAL && deadline.timeRemaining() > 2) {
    work()
    processed++
  }

  const sliceCost = performance.now() - sliceStart
  const left = deadline.timeRemaining()
  done.value = processed

  // 日志：本片处理量 / 耗时 / 剩余空闲预算（是否超预算一眼可见）
  logs.value.unshift(
    `[空闲片] 处理 ${processed - startDone} 条，耗时 ${sliceCost.toFixed(1)}ms，` +
      `剩余空闲 ${left.toFixed(1)}ms${deadline.didTimeout ? '（timeout 兜底）' : ''}`,
  )
  if (logs.value.length > 6) logs.value.pop()

  // 没做完 → 继续预约下一片（timeout 200ms：保证极端忙碌时也不会饿死）
  if (processed < TOTAL) {
    idleHandle = requestIdle(idleSlice, { timeout: 200 })
  } else {
    running.value = false
    logs.value.unshift(
      `[完成] 空闲执行总用时 ${(performance.now() - idleStartTs).toFixed(0)}ms`,
    )
  }
}

// ---------- 交互 ----------

/** 立即执行：同步一口气做完（阻塞演示） */
function runSync(): void {
  if (running.value) return
  running.value = true
  logs.value = []
  processed = 0
  done.value = 0

  const t0 = performance.now()
  // 同步循环：期间主线程完全被占用——rAF 帧间隔监控会捕捉到卡顿
  for (let i = 0; i < TOTAL; i++) {
    work()
  }
  blockingMs.value = performance.now() - t0
  done.value = TOTAL
  running.value = false
  logs.value.unshift(`[同步] 一口气做完，主线程阻塞 ${blockingMs.value.toFixed(1)}ms`)
}

/** 空闲执行：分片推进 */
function runIdle(): void {
  if (running.value) return
  running.value = true
  logs.value = []
  processed = 0
  done.value = 0
  idleStartTs = performance.now()
  idleHandle = requestIdle(idleSlice, { timeout: 200 })
}

/** 取消空闲调度（cancelIdleCallback 演示） */
function cancel(): void {
  cancelIdle(idleHandle)
  running.value = false
  logs.value.unshift(`[取消] 已处理 ${processed}/${TOTAL} 条，剩余放弃`)
}

// ---------- 生命周期 ----------

onMounted(() => {
  monitorRafId = requestAnimationFrame(monitorLoop)
})

onUnmounted(() => {
  // 兜底清理：监控循环 + 未完成的空闲调度
  cancelAnimationFrame(monitorRafId)
  cancelIdle(idleHandle)
})
</script>

<template>
  <div class="idle-demo">
    <!-- 控制行：两个执行模式 + 取消 -->
    <div class="controls">
      <button
        class="btn-ghost"
        type="button"
        :disabled="running"
        @click="runSync"
      >
        立即执行
      </button>
      <button
        class="btn-primary"
        type="button"
        :disabled="running"
        @click="runIdle"
      >
        空闲执行
      </button>
      <button
        class="btn-ghost"
        type="button"
        :disabled="!running"
        @click="cancel"
      >
        取消
      </button>
    </div>

    <!-- 进度 + 卡顿指示 -->
    <div class="status-row">
      <!-- 进度条 -->
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="done"
        aria-valuemin="0"
        :aria-valuemax="TOTAL"
      >
        <div
          class="progress-bar"
          :style="{ width: `${(done / TOTAL) * 100}%` }"
        />
      </div>
      <span class="done-text">{{ done }} / {{ TOTAL }}</span>

      <!-- 卡顿指示灯：帧间隔 >50ms 变红 -->
      <span
        class="lag-dot"
        :class="{ 'lag-dot--bad': frameGap > 50 }"
        aria-hidden="true"
      />
      <span class="lag-text">主线程 {{ frameGap.toFixed(0) }} ms</span>
    </div>

    <!-- 分片日志（中文，最新在前） -->
    <div class="log-panel">
      <p class="log-title">
        分片日志
      </p>
      <p
        v-if="logs.length === 0"
        class="log-empty"
      >
        点两个按钮对比：「立即执行」看阻塞飙红，「空闲执行」看逐片推进
      </p>
      <ul
        v-else
        class="log-list"
      >
        <li
          v-for="(log, i) in logs"
          :key="i"
        >
          {{ log }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.idle-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

/* ---------- 进度 + 指示 ---------- */

.status-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.progress {
  flex: 1;
  max-width: 16rem;
  height: 8px;
  border-radius: 999px;
  background-color: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--primary);
  transition: width 0.15s ease-out;
}

.done-text {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
  min-width: 4.5rem;
}

/* 卡顿指示灯：绿 = 正常帧；红 = 主线程被阻塞 */
.lag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--success);
  transition: background-color 0.15s;
  margin-left: 0.5rem;
}

.lag-dot--bad {
  background-color: var(--danger);
}

.lag-text {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.65rem 0.9rem;
  background-color: var(--code-bg);
}

.log-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.log-empty {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.8;
}
</style>
