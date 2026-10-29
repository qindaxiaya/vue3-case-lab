// ============================================================
// 案例：Web Worker 主线程解冻（web-worker）
// - 同样一份重计算：主线程跑 → 页面彻底卡死；Worker 跑 → 主线程心跳不断
// - Worker 用 Blob URL 内联（案例自包含，不额外建文件）
// - 心跳可视化：rAF 帧计数 + CSS 脉冲——卡顿时两者同时冻住，一眼可见
// - onUnmounted terminate() + revokeObjectURL 释放
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ============================================================
// 重计算任务（同一份代码，两条执行路径）
// ============================================================

/** 计算量：约 4000 万次开方累加（主线程跑一次约 1~2 秒，卡顿明显） */
const WORK_UNITS = 40_000_000

/** 重计算本体：返回累加结果（纯 CPU，无可避免的同步占用） */
function heavyCompute(units: number): number {
  let acc = 0
  for (let i = 0; i < units; i++) {
    acc += Math.sqrt(i)
  }
  return Math.round(acc)
}

// ============================================================
// Worker：Blob URL 内联创建（零额外文件，自包含）
// ============================================================

/** Worker 源码字符串：与主线程 heavyCompute 逻辑一致 */
const WORKER_SOURCE = `
  // Worker 内部同样一份重计算
  function heavyCompute(units) {
    let acc = 0
    for (let i = 0; i < units; i++) acc += Math.sqrt(i)
    return Math.round(acc)
  }
  // 收到消息 → 计算 → 回传（不阻塞页面主线程）
  self.onmessage = (e) => {
    const t0 = performance.now()
    const result = heavyCompute(e.data.units)
    self.postMessage({ result, cost: Math.round(performance.now() - t0) })
  }
`

let worker: Worker | null = null
let workerUrl = ''

onMounted(() => {
  workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'application/javascript' }))
  worker = new Worker(workerUrl)
  // 收到 worker 结果：主线程全程未卡，此时帧计数照涨
  worker.onmessage = (e: MessageEvent<{ result: number; cost: number }>) => {
    workerResult.value = e.data.result
    workerCost.value = e.data.cost
    workerRunning.value = false
  }
})

// ============================================================
// 心跳：rAF 帧计数 + 帧间隔（卡顿时两者停摆）
// ============================================================

/** rAF 累计帧数（主线程自由时持续增长） */
const frameCount = ref(0)
/** 心跳是否在跳（每帧自增） */
const heartPulse = ref(0)

let rafId = 0
function beat(): void {
  frameCount.value++
  heartPulse.value = (heartPulse.value + 1) % 1000
  rafId = requestAnimationFrame(beat)
}

onMounted(() => {
  rafId = requestAnimationFrame(beat)
})

// ============================================================
// 路径一：主线程同步计算
// ============================================================

const mainRunning = ref(false)
const mainCost = ref<number | null>(null)
/** 卡顿期间心跳冻结的实测帧差 */
const mainFrozenFrames = ref<number | null>(null)

function runOnMain(): void {
  if (mainRunning.value) return
  mainRunning.value = true
  // 记录计算前帧数——用 setTimeout 让 UI 先刷出「计算中」状态
  requestAnimationFrame(() => {
    const before = frameCount.value
    const t0 = performance.now()
    //! 同步重计算：这段执行期间主线程被独占——页面不响应任何输入、动画全停
    const r = heavyCompute(WORK_UNITS)
    mainCost.value = Math.round(performance.now() - t0)
    // 卡顿期间 rAF 最多跳 1~2 帧（对比 Worker 路径的几十帧）
    mainFrozenFrames.value = frameCount.value - before
    mainResult.value = r
    mainRunning.value = false
  })
}

const mainResult = ref<number | null>(null)

// ============================================================
// 路径二：Worker 计算
// ============================================================

const workerRunning = ref(false)
const workerCost = ref<number | null>(null)
const workerResult = ref<number | null>(null)

function runOnWorker(): void {
  if (workerRunning.value || !worker) return
  workerRunning.value = true
  workerCost.value = null
  //! postMessage 立刻返回——主线程继续跑 rAF，计算在 worker 线程并行
  worker.postMessage({ units: WORK_UNITS })
}

// ============================================================
// 清理
// ============================================================

onUnmounted(() => {
  // 释放：先停 rAF，再终止 worker 并回收 Blob URL
  cancelAnimationFrame(rafId)
  worker?.terminate()
  worker = null
  if (workerUrl) URL.revokeObjectURL(workerUrl)
})
</script>

<template>
  <div class="ww-demo">
    <!-- 心跳监视器 -->
    <div class="heartbeat">
      <span
        class="heart-dot"
        :style="{ opacity: 0.35 + (heartPulse % 10) / 15 }"
        aria-hidden="true"
      />
      <span class="heart-label">
        主线程心跳 · 帧计数 <b>{{ frameCount }}</b>
      </span>
      <span class="heart-hint">主线程一旦被占满，这个数字与心跳都会冻住</span>
    </div>

    <div class="body">
      <!-- 主线程路径 -->
      <section
        class="path"
        aria-label="主线程计算"
      >
        <header class="path-head">
          <h3>① 主线程直接算</h3>
          <span
            v-if="mainRunning"
            class="badge badge--busy"
          >页面卡死中…</span>
        </header>
        <p class="path-desc">
          同步执行 4000 万次运算。期间<b>页面完全无响应</b>——点按钮、滚动、动画全部冻结。
        </p>
        <n-button
          type="error"
          class="path-btn"
          :disabled="mainRunning || workerRunning"
          @click="runOnMain"
        >
          {{ mainRunning ? '计算中（界面已冻结）' : '在主线程计算' }}
        </n-button>
        <ul
          v-if="mainCost !== null"
          class="result-list"
        >
          <li>耗时 <b>{{ mainCost }}ms</b></li>
          <li>卡顿期间仅跳 <b>{{ mainFrozenFrames }}</b> 帧</li>
          <li>结果 <b>{{ mainResult }}</b></li>
        </ul>
      </section>

      <!-- Worker 路径 -->
      <section
        class="path"
        aria-label="Worker 计算"
      >
        <header class="path-head">
          <h3>② 丢给 Worker 算</h3>
          <span
            v-if="workerRunning"
            class="badge badge--ok"
          >主线程流畅</span>
        </header>
        <p class="path-desc">
          同一份计算放 Worker 线程。<b>主线程继续跑</b>——心跳照跳、界面照点，完成后回传结果。
        </p>
        <n-button
          type="primary"
          class="path-btn"
          :disabled="workerRunning || mainRunning"
          @click="runOnWorker"
        >
          {{ workerRunning ? 'Worker 计算中（界面照常）' : '丢给 Worker 计算' }}
        </n-button>
        <ul
          v-if="workerCost !== null"
          class="result-list"
        >
          <li>耗时 <b>{{ workerCost }}ms</b>（worker 线程计时）</li>
          <li>期间帧计数持续增长（对比左侧）</li>
          <li>结果 <b>{{ workerResult }}</b></li>
        </ul>
      </section>
    </div>

    <p class="footnote">
      两条路径耗时接近，差别只在<b>谁被占用</b>：主线程算 = 用户干等；Worker 算 = 用户无感。
      适用场景：大数组排序/图像处理/JSON 大文件解析/加密计算。
    </p>
  </div>
</template>

<style scoped>
.ww-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ---------- 心跳监视器 ---------- */

.heartbeat {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--code-bg);
  flex-wrap: wrap;
}

.heart-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--success);
  transition: opacity 0.1s linear;
}

.heart-label {
  font-size: 0.9375rem;
  color: var(--text);

  b {
    font-family: var(--font-mono);
    color: var(--success);
  }
}

.heart-hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* ---------- 两条路径 ---------- */

.body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.path {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.8rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.path-head {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }
}

.badge {
  font-size: 0.875rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.badge--busy {
  background-color: color-mix(in srgb, var(--danger) 16%, transparent);
  color: var(--danger);
}

.badge--ok {
  background-color: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.path-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-secondary);

  b {
    color: var(--text);
  }
}

/* 只留布局：按钮靠左对齐，观感交给 Naive 按钮 */
.path-btn {
  align-self: flex-start;
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  font-size: 0.875rem;
  line-height: 1.9;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.footnote {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
