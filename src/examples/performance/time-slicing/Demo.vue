// ============================================================
// 案例：长列表时间切片（time-slicing）
// 1 万条数据一次渲染会形成长任务（页面卡住）；
// 切片：每帧只追加一批（300 条），首屏先出现、后续边滚边补。
// 指标：首帧耗时、总耗时、已渲染条数、帧数。
// ============================================================
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

const TOTAL = 10000
const BATCH = 300

interface Row {
  id: number
  text: string
}

const rows = ref<Row[]>([])
const rendering = ref(false)
const progress = ref(0)
/** 首批数据出现在屏幕上的耗时 */
const firstPaintMs = ref<number | null>(null)
/** 全部渲染完成耗时 */
const totalMs = ref<number | null>(null)
/** 切片模式用掉的帧数 */
const frames = ref(0)
/** 当前模式 */
const mode = ref<'slice' | 'full'>('slice')

let rafId = 0

/** 生成一段数据 */
function makeRows(count: number, start: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: start + i,
    text: `数据行 #${start + i}：长列表分片渲染演示`,
  }))
}

function reset(): void {
  cancelAnimationFrame(rafId)
  rows.value = []
  progress.value = 0
  firstPaintMs.value = null
  totalMs.value = null
  frames.value = 0
  rendering.value = false
}

// ============================================================
// 方案 A：一次性全量渲染（会卡）
// ============================================================

async function renderFull(): Promise<void> {
  reset()
  mode.value = 'full'
  rendering.value = true

  const t0 = performance.now()
  //! 一次赋值 1 万条：Vue 需要一次性创建 1 万个 vnode + DOM
  rows.value = makeRows(TOTAL, 0)
  progress.value = TOTAL

  await nextTick()
  // nextTick 之后 DOM 才真正更新完成
  totalMs.value = performance.now() - t0
  firstPaintMs.value = totalMs.value
  rendering.value = false
}

// ============================================================
// 方案 B：时间切片（每帧一批）
// ============================================================

function renderSlice(): void {
  reset()
  mode.value = 'slice'
  rendering.value = true

  const t0 = performance.now()
  let produced = 0

  const step = (): void => {
    const batch = makeRows(BATCH, produced)
    //! 每帧只追加一批：把长任务切成几十个小任务
    rows.value.push(...batch)
    produced += BATCH
    frames.value++
    progress.value = Math.min(produced, TOTAL)

    if (firstPaintMs.value === null) {
      firstPaintMs.value = performance.now() - t0
    }

    if (produced < TOTAL) {
      rafId = requestAnimationFrame(step)
    } else {
      totalMs.value = performance.now() - t0
      rendering.value = false
    }
  }

  rafId = requestAnimationFrame(step)
}

// ============================================================
// 交互响应测量（长任务期间点击的延迟）
// ============================================================

const clickLatency = ref<number | null>(null)

/**
 * 点按钮时记录从「用户点击」到「主线程空闲能响应」的延迟。
 * 渲染中点击：延迟会明显变大（主线程被占）。
 */
function ping(): void {
  const t0 = performance.now()
  // setTimeout 0 排到宏任务：前面如果堵着长任务，它就得等
  window.setTimeout(() => {
    clickLatency.value = Math.round(performance.now() - t0)
  }, 0)
}

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="ts-demo">
    <!-- 控制 -->
    <div class="ts-bar">
      <div class="seg">
        <button
          class="seg-btn"
          :class="{ active: mode === 'slice' }"
          :disabled="rendering"
          @click="renderSlice"
        >
          时间切片（300 / 帧）
        </button>
        <button
          class="seg-btn"
          :class="{ active: mode === 'full' }"
          :disabled="rendering"
          @click="renderFull"
        >
          一次性全量
        </button>
      </div>
      <button
        class="btn-reset"
        :disabled="rendering"
        @click="reset"
      >
        清空
      </button>
      <button
        class="btn-act"
        @click="ping"
      >
        测主线程响应
      </button>
    </div>

    <!-- 指标 -->
    <div class="ts-metrics">
      <span>已渲染 <b>{{ progress }}</b> / {{ TOTAL }}</span>
      <span>首帧 <b>{{ firstPaintMs === null ? '—' : Math.round(firstPaintMs) + ' ms' }}</b></span>
      <span>总耗时 <b>{{ totalMs === null ? '—' : Math.round(totalMs) + ' ms' }}</b></span>
      <span>帧数 <b>{{ frames }}</b></span>
      <span>点击响应 <b>{{ clickLatency === null ? '—' : clickLatency + ' ms' }}</b></span>
    </div>

    <!-- 列表 -->
    <div class="ts-list">
      <div
        v-for="row in rows"
        :key="row.id"
        class="ts-row"
      >
        {{ row.text }}
      </div>
      <p
        v-if="!rows.length"
        class="ts-empty"
      >
        点上方按钮开始渲染 1 万条数据
      </p>
    </div>

    <p class="ts-hint">
      切片模式点「测主线程响应」通常只要几毫秒；全量模式渲染期间点，可能吃到几十到几百毫秒的延迟。
      真实项目里切片的目标不是「更快渲染完」，而是「不阻塞交互」。
    </p>
  </div>
</template>

<style scoped>
.ts-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 控制 ---------- */

.ts-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.seg-btn {
  padding: 0.24rem 0.6rem;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.73rem;
  cursor: pointer;

  &.active {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.btn-reset {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-act {
  margin-left: auto;
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

/* ---------- 指标 ---------- */

.ts-metrics {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 列表 ---------- */

.ts-list {
  height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.35rem 0.55rem;
}

.ts-row {
  font-size: 0.72rem;
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ts-empty {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 2rem 0;
}

.ts-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
