// ============================================================
// 案例：长列表时间切片（time-slicing）
// 默认 3 万条：一次性全量会形成长任务，切片每帧只追加一批。
// 指标：首帧（nextTick + 双 rAF）、最大阻塞（每批计时）、总耗时、点击响应。
// 面板保留最近一次「全量 / 切片」结果，参数一致时可直接对比。
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import DemoButton from '../../../components/demo/DemoButton.vue'
import DemoSegmented from '../../../components/demo/DemoSegmented.vue'
import type { SegmentedOption } from '../../../components/demo/types'

type Mode = 'slice' | 'full'

interface Row {
  id: number
  text: string
}

interface RunResult {
  total: number
  batch: number | null
  firstPaint: number | null
  block: number | null
  totalMs: number | null
  frames: number
  click: number | null
}

const TOTAL_OPTIONS = [10000, 30000, 50000]
const BATCH_OPTIONS = [100, 300, 1000]

/** 当前参数：默认 3 万条、每批 300 条 */
const totalCount = ref(30000)
const batchSize = ref(300)

const rows = ref<Row[]>([])
const rendering = ref(false)
const progress = ref(0)
/** 当前模式 */
const mode = ref<Mode>('slice')
/** 渲染方式也是互斥模式，交给共享分段控件统一渲染 */
const modeOptions = computed<readonly SegmentedOption[]>(() => [
  { value: 'slice', label: `时间切片（${batchSize.value} / 帧）` },
  { value: 'full', label: '一次性全量' },
])
/** 首批数据真正出现在屏幕上的耗时 */
const firstPaintMs = ref<number | null>(null)
/** 单个任务占住主线程的最长时间 */
const maxBlockMs = ref<number | null>(null)
/** 全部渲染完成耗时 */
const totalMs = ref<number | null>(null)
/** 切片模式用掉的批次数 */
const frames = ref(0)
/** 最近一次手动点击到主线程能响应的延迟 */
const clickLatency = ref<number | null>(null)

/** 最近一次全量 / 切片结果：同一组参数下可直接对照 */
const results = reactive<{ full: RunResult | null; slice: RunResult | null }>({
  full: null,
  slice: null,
})

let rafId = 0
/** 运行令牌：参数变化 / 重新运行 / 卸载后，旧回调不再改状态 */
let runToken = 0

/** 生成一段数据 */
function makeRows(count: number, start: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: start + i,
    text: `数据行 #${start + i}：长列表分片渲染演示`,
  }))
}

function stopRaf(): void {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

/** 只清当前这次渲染的读数，保留另一模式的结果用于对比 */
function clearCurrent(): void {
  runToken++
  stopRaf()
  rows.value = []
  progress.value = 0
  firstPaintMs.value = null
  maxBlockMs.value = null
  totalMs.value = null
  frames.value = 0
  clickLatency.value = null
  rendering.value = false
}

/** 清空列表与两张结果卡 */
function resetAll(): void {
  clearCurrent()
  results.full = null
  results.slice = null
}

/** 改数据量 / 每批数量后，旧结果不再可比，直接清空 */
watch([totalCount, batchSize], () => {
  if (!rendering.value) resetAll()
})

/** 双 rAF：等浏览器真正完成一次绘制，再记首帧 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function formatMs(value: number | null): string {
  if (value === null) return '—'
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ms`
}

function formatCount(value: number): string {
  return value.toLocaleString('zh-CN')
}

function saveResult(kind: Mode): void {
  results[kind] = {
    total: totalCount.value,
    batch: kind === 'slice' ? batchSize.value : null,
    firstPaint: firstPaintMs.value,
    block: maxBlockMs.value,
    totalMs: totalMs.value,
    frames: frames.value,
    click: clickLatency.value,
  }
}

// ============================================================
// 方案 A：一次性全量渲染（会卡）
// ============================================================

async function renderFull(): Promise<void> {
  clearCurrent()
  const token = runToken
  mode.value = 'full'
  rendering.value = true

  const t0 = performance.now()
  //! 一次赋值几万条：Vue 需要一次性创建几万个 vnode + DOM
  rows.value = makeRows(totalCount.value, 0)
  progress.value = totalCount.value

  await nextTick()
  if (token !== runToken) return
  const block = performance.now() - t0
  maxBlockMs.value = block

  // 等一次真正的绘制，再记首帧；全量的总耗时是主线程挂载时间
  await nextFrame()
  if (token !== runToken) return
  firstPaintMs.value = performance.now() - t0
  totalMs.value = block
  frames.value = 0
  rendering.value = false
  saveResult('full')
}

// ============================================================
// 方案 B：时间切片（每帧一批）
// ============================================================

function renderSlice(): void {
  clearCurrent()
  const token = runToken
  mode.value = 'slice'
  rendering.value = true

  const t0 = performance.now()
  let produced = 0

  const step = async (): Promise<void> => {
    if (token !== runToken) return

    //! 每批单独计时：push + nextTick 里的 DOM 更新就是这一批占住主线程的时间
    const batchStart = performance.now()
    const batch = makeRows(
      Math.min(batchSize.value, totalCount.value - produced),
      produced,
    )
    rows.value.push(...batch)
    produced += batch.length
    progress.value = produced
    frames.value++

    await nextTick()
    if (token !== runToken) return

    const block = performance.now() - batchStart
    maxBlockMs.value =
      maxBlockMs.value === null ? block : Math.max(maxBlockMs.value, block)

    // 第一批渲染完再等双 rAF，记录真正的首帧；后续批次不再重复等
    if (firstPaintMs.value === null) {
      await nextFrame()
      if (token !== runToken) return
      firstPaintMs.value = performance.now() - t0
    }

    if (produced < totalCount.value) {
      rafId = requestAnimationFrame(step)
    } else {
      totalMs.value = performance.now() - t0
      rendering.value = false
      saveResult('slice')
    }
  }

  rafId = requestAnimationFrame(step)
}

// ============================================================
// 交互响应测量
// ============================================================

/**
 * 点按钮时记录「用户点击」到「主线程空闲能响应」的延迟。
 * 用 event.timeStamp 而不是处理函数里的 performance.now()：
 * 主线程被长任务占住时，处理函数本身就会晚执行，从那时再计时会漏掉等待。
 */
function ping(event: MouseEvent): void {
  const start = event.timeStamp > 0 ? event.timeStamp : performance.now()
  window.setTimeout(() => {
    const latency = Math.round(performance.now() - start)
    clickLatency.value = latency
    const current = results[mode.value]
    if (current) current.click = latency
  }, 0)
}

/** 互斥的渲染方式用 radio 语义：方向键切换，Tab 只停当前项 */
function onModeChange(next: string | number): void {
  if (next === 'slice') renderSlice()
  else if (next === 'full') renderFull()
}

onBeforeUnmount(() => {
  // 卸载时让令牌失效并取消 rAF，避免回调继续追加数据
  runToken++
  stopRaf()
})
</script>

<template>
  <div class="ts-demo">
    <!-- 控制 -->
    <div class="ts-bar">
      <DemoSegmented
        class="seg"
        :model-value="mode"
        :options="modeOptions"
        label="渲染方式"
        :disabled="rendering"
        @update:model-value="onModeChange"
      />
      <DemoButton
        variant="ghost"
        :disabled="rendering"
        @click="resetAll"
      >
        清空结果
      </DemoButton>
      <DemoButton
        class="btn-act"
        variant="primary"
        @click="ping"
      >
        测主线程响应
      </DemoButton>
    </div>

    <!-- 参数 -->
    <div class="ts-config">
      <label class="ts-field">
        数据量
        <select
          v-model.number="totalCount"
          class="ts-select ts-total"
          :disabled="rendering"
        >
          <option
            v-for="option in TOTAL_OPTIONS"
            :key="option"
            :value="option"
          >
            {{ formatCount(option) }} 条
          </option>
        </select>
      </label>
      <label class="ts-field">
        每批
        <select
          v-model.number="batchSize"
          class="ts-select ts-batch"
          :disabled="rendering"
        >
          <option
            v-for="option in BATCH_OPTIONS"
            :key="option"
            :value="option"
          >
            {{ option }} 条
          </option>
        </select>
      </label>
      <span class="ts-config-note">改参数会清空对比结果</span>
    </div>

    <!-- 指标 -->
    <div class="ts-metrics">
      <span>已渲染 <b>{{ formatCount(progress) }}</b> / {{ formatCount(totalCount) }}</span>
      <span>首帧 <b>{{ formatMs(firstPaintMs) }}</b></span>
      <span>最大阻塞 <b>{{ formatMs(maxBlockMs) }}</b></span>
      <span>总耗时 <b>{{ formatMs(totalMs) }}</b></span>
      <span>批次数 <b>{{ frames }}</b></span>
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
        选择数据量后点上方按钮开始渲染
      </p>
    </div>

    <!-- 结果对比表 -->
    <div class="ts-table-wrap">
      <table class="ts-table">
        <caption>最近一次运行对比（同一组参数）</caption>
        <thead>
          <tr>
            <th scope="col">
              指标
            </th>
            <th scope="col">
              一次性全量
            </th>
            <th scope="col">
              时间切片{{ results.slice ? `（${results.slice.batch} / 帧）` : '' }}
            </th>
            <th scope="col">
              怎么看
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              数据量
            </th>
            <td data-result="full-total">
              {{ results.full ? `${formatCount(results.full.total)} 条` : '未运行' }}
            </td>
            <td data-result="slice-total">
              {{ results.slice ? `${formatCount(results.slice.total)} 条` : '未运行' }}
            </td>
            <td>同一次对比应保持一致</td>
          </tr>
          <tr>
            <th scope="row">
              首帧
            </th>
            <td data-result="full-first">
              {{ formatMs(results.full?.firstPaint ?? null) }}
            </td>
            <td data-result="slice-first">
              {{ formatMs(results.slice?.firstPaint ?? null) }}
            </td>
            <td>第一帧出现的时间</td>
          </tr>
          <tr>
            <th scope="row">
              最大阻塞
            </th>
            <td data-result="full-block">
              {{ formatMs(results.full?.block ?? null) }}
            </td>
            <td data-result="slice-block">
              {{ formatMs(results.slice?.block ?? null) }}
            </td>
            <td>单个任务占住主线程的时长</td>
          </tr>
          <tr>
            <th scope="row">
              总耗时
            </th>
            <td data-result="full-duration">
              {{ formatMs(results.full?.totalMs ?? null) }}
            </td>
            <td data-result="slice-duration">
              {{ formatMs(results.slice?.totalMs ?? null) }}
            </td>
            <td>全部挂载完成</td>
          </tr>
          <tr>
            <th scope="row">
              批次数
            </th>
            <td data-result="full-frames">
              {{ results.full ? '1 次全量' : '—' }}
            </td>
            <td data-result="slice-frames">
              {{ results.slice ? results.slice.frames : '—' }}
            </td>
            <td>切片每批一帧</td>
          </tr>
          <tr>
            <th scope="row">
              点击响应
            </th>
            <td data-result="full-click">
              {{ results.full?.click == null ? '—' : `${results.full.click} ms` }}
            </td>
            <td data-result="slice-click">
              {{ results.slice?.click == null ? '—' : `${results.slice.click} ms` }}
            </td>
            <td>最近一次手动测量</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="ts-hint">
      切片的目标不是「更快渲染完」，而是「不阻塞交互」。首帧用 nextTick + 双 rAF 采样，
      最大阻塞按每批 push + DOM 更新计时；全量渲染期间主线程被占，按钮点不动，
      所以全量的点击响应通常为空，切片模式可以在渲染中点击测量。
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

.btn-act {
  margin-left: auto;
}

.ts-select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ---------- 参数 ---------- */

.ts-config {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.ts-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.ts-select {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
}

.ts-config-note {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* ---------- 指标 ---------- */

.ts-metrics {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
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
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ts-empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 2rem 0;
}

/* ---------- 对比表 ---------- */

.ts-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
}

.ts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  white-space: nowrap;

  caption {
    padding: 0.45rem 0.6rem;
    text-align: left;
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  th,
  td {
    padding: 0.4rem 0.6rem;
    border-top: 1px solid var(--border);
    text-align: left;
  }

  thead th {
    color: var(--text-secondary);
    font-weight: 600;
    background-color: var(--code-bg);
  }

  tbody th {
    color: var(--text);
    font-weight: 500;
  }

  td {
    font-family: var(--font-mono);
    color: var(--primary);
  }

  td:last-child {
    font-family: var(--font-sans);
    color: var(--text-secondary);
    white-space: normal;
  }
}

.ts-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
