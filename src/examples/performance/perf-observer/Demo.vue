// ============================================================
// 案例：PerformanceObserver 性能监控面板（2026-10-19 实时化重设计）
// 打开即有实时数据流：
//   - FPS（rAF 滚动窗口统计）/ JS 堆内存（Chrome）每秒刷新
//   - 指标 sparkline 历史曲线（FP/FCP/LCP/TTFB/CLS）
//   - Event Timing 实测每次点击交互的 INP 类延迟
// 交互实验：
//   - 卡顿强度滑块（16–200ms 阻塞）实时制造 longtask
//   - 布局偏移注入（CLS 实时增长）
// 兼容要点：部分指标类型旧浏览器不支持，observe 需 try/catch 降级
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'

// ---------- 指标状态 ----------

/** 加载类指标（buffered 回放，基本不变但保留实时面板完整性） */
const metrics = reactive({
  fp: null as number | null,
  fcp: null as number | null,
  lcp: null as number | null,
  ttfb: null as number | null,
  cls: 0,
})

/** 实时指标（每秒刷新——打开就在动） */
const live = reactive({
  fps: 0, // 实时帧率（rAF 采样）
  heap: null as number | null, // JS 堆占用 MB（Chrome non-standard）
  lastClickInp: null as number | null, // 最近一次点击的交互延迟 ms
})

/** 长任务观测支持情况 */
const longTaskSupported = ref(true)

// ---------- sparkline 历史（最近 30 个采样） ----------

/** FPS 历史（每秒采样一次） */
const fpsHistory = ref<number[]>([])
/** CLS 历史（每次变化时采样） */
const clsHistory = ref<number[]>([])

/** 采样入列，超过 30 个丢弃最旧（滚动窗口） */
function pushSample(list: number[], value: number): void {
  list.push(value)
  if (list.length > 30) list.shift()
}

/**
 * 生成 sparkline 折线的 SVG polyline points 字符串
 * @param data 采样序列
 * @param max  纵轴上限（动态取序列最大值与传入下限的较大者）
 */
function sparkPoints(data: number[], max: number): string {
  if (data.length < 2) return ''
  const ceiling = Math.max(max, ...data)
  const w = 100
  const h = 24
  const step = w / (data.length - 1)
  return data
    .map((v, i) => {
      const x = i * step
      // 归一化到 0–24 像素高度（y 轴向下，值大在上方）
      const y = h - (ceiling === 0 ? 0 : (v / ceiling) * h)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// ---------- 日志 ----------

const logEntries = ref<string[]>([])

function pushLog(msg: string): void {
  const time = new Date().toLocaleTimeString()
  logEntries.value.unshift(`[${time}] ${msg}`)
  if (logEntries.value.length > 8) logEntries.value.pop()
}

// ---------- PerformanceObserver 注册 ----------

const observers: PerformanceObserver[] = []

/** 统一注册观察器（try/catch 兼容不支持的类型） */
function observe(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
  buffered = true,
): void {
  try {
    const po = new PerformanceObserver((list) => callback(list.getEntries()))
    po.observe({ type, buffered } as PerformanceObserverInit)
    observers.push(po)
  } catch {
    pushLog(`当前浏览器不支持 ${type} 指标`)
    if (type === 'longtask') longTaskSupported.value = false
  }
}

// ---------- 实时循环（FPS 采样 + 每秒刷新内存） ----------

let rafId = 0
/** rAF 帧计数（每秒窗口内累加） */
let frameCount = 0
let fpsWindowStart = 0
/** 每秒一次的内存/重渲染定时器 */
let secondTimer: ReturnType<typeof setInterval> | null = null

/** FPS 循环：每帧计数，整秒窗口结算一次帧率 */
function fpsLoop(now: number): void {
  frameCount++
  // 整秒窗口：结算上一秒帧率并重开窗口
  if (now - fpsWindowStart >= 1000) {
    live.fps = Math.round((frameCount * 1000) / (now - fpsWindowStart))
    pushSample(fpsHistory.value, live.fps)
    frameCount = 0
    fpsWindowStart = now
  }
  rafId = requestAnimationFrame(fpsLoop)
}

// ---------- 挂载 / 卸载 ----------

onMounted(() => {
  // 1) paint：FP / FCP
  observe('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-paint') metrics.fp = entry.startTime
      if (entry.name === 'first-contentful-paint') metrics.fcp = entry.startTime
    }
  })

  // 2) LCP：取最新一条
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) metrics.lcp = last.startTime
  })

  // 3) CLS：排除输入引发偏移，实时入 sparkline
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as unknown as { value: number; hadRecentInput: boolean }
      if (!shift.hadRecentInput) {
        metrics.cls += shift.value
        pushSample(clsHistory.value, metrics.cls)
      }
    }
  })

  // 4) navigation：TTFB
  observe('navigation', (entries) => {
    const nav = entries[0] as unknown as { responseStart: number }
    if (nav) metrics.ttfb = nav.responseStart
  })

  // 5) longtask：日志 + 实时反映卡顿
  observe(
    'longtask',
    (entries) => {
      for (const entry of entries) {
        pushLog(`长任务 ${entry.duration.toFixed(0)}ms`)
      }
    },
    false,
  )

  // 6) event：Event Timing 实测交互延迟（INP 的原始数据来源）
  //    durationThreshold 16ms：观察所有超过 16ms 的交互（INP 规范建议值）
  observe(
    'event',
    (entries) => {
      for (const entry of entries) {
        const evt = entry as unknown as {
          name: string
          duration: number
          interactionId: number
        }
        // 只关心点击类交互；duration = 从输入到下一帧渲染完成
        if (evt.name === 'click' && evt.interactionId) {
          live.lastClickInp = evt.duration
          pushLog(`点击交互耗时 ${evt.duration.toFixed(1)}ms`)
        }
      }
    },
    false,
  )

  // FPS 采样循环启动
  rafId = requestAnimationFrame(fpsLoop)
  fpsWindowStart = performance.now()

  // 每秒刷新内存指标（Chrome 才有 performance.memory）
  secondTimer = setInterval(() => {
    const mem = (
      performance as unknown as {
        memory?: { usedJSHeapSize: number }
      }
    ).memory
    if (mem) {
      // 字节 → MB，保留 1 位小数
      live.heap = mem.usedJSHeapSize / 1024 / 1024
    }
  }, 1000)
})

onUnmounted(() => {
  // 清理：rAF / 定时器 / 全部观察器（防泄漏）
  cancelAnimationFrame(rafId)
  if (secondTimer) clearInterval(secondTimer)
  observers.forEach((po) => po.disconnect())
})

// ---------- 交互实验 ----------

/** 卡顿强度（ms）：滑块控制 16–200 */
const blockMs = ref(80)

/** 按滑块强度同步阻塞主线程（制造 longtask） */
function makeLongTask(): void {
  const start = performance.now()
  const target = blockMs.value
  while (performance.now() - start < target) {
    // 忙等阻塞
  }
  pushLog(`已同步阻塞 ${target}ms（FPS 骤降可见）`)
}

/** 制造布局偏移：动态插入块推挤下方内容（CLS 实时增长） */
function makeLayoutShift(): void {
  const host = document.getElementById('shift-zone')
  if (!host) return
  const block = document.createElement('div')
  block.style.cssText =
    'height:60px;border-radius:8px;background:var(--warning-soft);margin-bottom:12px;display:flex;align-items:center;justify-content:center;color:var(--warning);font-size:0.9375rem;'
  block.textContent = '布局偏移演示块（CLS +）'
  host.appendChild(block)
  pushLog('已注入偏移块（CLS 上升）')
}

// ---------- 展示格式化 ----------

/** 毫秒格式化（null 显示占位） */
function fmt(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)} ms`
}

/** 堆内存格式化 */
function fmtHeap(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)} MB`
}

/** CLS 等级（良好 <0.1 / 需改进 <0.25 / 差 ≥0.25） */
function clsLevel(cls: number): string {
  if (cls < 0.1) return 'good'
  if (cls < 0.25) return 'warn'
  return 'bad'
}

/** FPS 等级（≥50 绿 / ≥30 黄 / <30 红） */
function fpsLevel(fps: number): string {
  if (fps >= 50) return 'good'
  if (fps >= 30) return 'warn'
  return 'bad'
}
</script>

<template>
  <div class="perf-demo">
    <!-- 实时区：FPS + 内存 + 最近点击交互（打开就在跳动） -->
    <div class="live-row">
      <div class="live-card">
        <span class="live-name">帧率 FPS</span>
        <span
          class="live-value"
          :class="`lvl-${fpsLevel(live.fps)}`"
        >
          {{ live.fps }}
        </span>
        <!-- FPS sparkline（最近 30s） -->
        <svg
          class="spark"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-if="fpsHistory.length > 1"
            :points="sparkPoints(fpsHistory, 60)"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </div>

      <div class="live-card">
        <span class="live-name">堆内存（JS）</span>
        <span class="live-value">{{ fmtHeap(live.heap) }}</span>
        <span class="live-sub">{{ live.heap === null ? '浏览器不支持' : '每秒采样' }}</span>
      </div>

      <div class="live-card">
        <span class="live-name">最近点击交互</span>
        <span class="live-value">{{ live.lastClickInp === null ? '点击试试' : fmt(live.lastClickInp) }}</span>
        <span class="live-sub">Event Timing 实测</span>
      </div>
    </div>

    <!-- 加载指标 + CLS sparkline -->
    <div class="metric-grid">
      <div class="metric-card">
        <span class="metric-name">首次绘制 FP</span>
        <span class="metric-value">{{ fmt(metrics.fp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">首次内容绘制 FCP</span>
        <span class="metric-value">{{ fmt(metrics.fcp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">最大内容绘制 LCP</span>
        <span class="metric-value">{{ fmt(metrics.lcp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">首字节时间 TTFB</span>
        <span class="metric-value">{{ fmt(metrics.ttfb) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">布局偏移 CLS</span>
        <span
          class="metric-value"
          :class="`lvl-${clsLevel(metrics.cls)}`"
        >{{ metrics.cls.toFixed(3) }}</span>
        <!-- CLS sparkline -->
        <svg
          class="spark spark--cls"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            v-if="clsHistory.length > 1"
            :points="sparkPoints(clsHistory, 0.25)"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </div>
    </div>

    <!-- 交互实验区（操作引导小标题，VueUse demo 风格） -->
    <div class="actions">
      <p class="actions-hint">
        试试：拖动滑块调卡顿强度 → 点「制造长任务」看 FPS 骤降；点「制造偏移」看 CLS 曲线上扬
      </p>

      <div class="action-row">
        <label class="block-slider">
          卡顿强度
          <input
            v-model.number="blockMs"
            type="range"
            min="16"
            max="200"
            step="4"
          >
          <span class="block-ms">{{ blockMs }}ms</span>
        </label>

        <button
          class="btn-ghost"
          type="button"
          @click="makeLongTask"
        >
          制造长任务
        </button>
        <button
          class="btn-primary"
          type="button"
          @click="makeLayoutShift"
        >
          制造布局偏移
        </button>
      </div>
    </div>

    <!-- 偏移块挂载点 -->
    <div id="shift-zone" />

    <!-- 日志面板 -->
    <div class="log-panel">
      <p class="log-title">
        观测日志
        <span
          v-if="!longTaskSupported"
          class="tag tag--warning"
        >
          长任务类型不受支持
        </span>
      </p>
      <p
        v-if="logEntries.length === 0"
        class="log-empty"
      >
        暂无日志——点击按钮或直接点击页面任意处，观察交互指标
      </p>
      <ul
        v-else
        class="log-list"
      >
        <li
          v-for="(log, i) in logEntries"
          :key="i"
        >
          {{ log }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.perf-demo {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

/* ---------- 实时区（FPS/内存/点击交互） ---------- */

.live-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.live-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  overflow: hidden;
}

.live-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* 实时大数字：mono 字体（每秒在跳） */
.live-value {
  font-family: var(--font-mono);
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.3;
}

.live-sub {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* sparkline：右下角小折线 */
.spark {
  position: absolute;
  right: 0.6rem;
  bottom: 0.5rem;
  width: 5rem;
  height: 1.4rem;
  color: var(--primary);
  opacity: 0.7;
}

.spark--cls {
  position: static;
  width: 100%;
  height: 1.1rem;
  margin-top: 0.2rem;
  color: var(--warning);
}

/* 语义色等级 */
.lvl-good {
  color: var(--success);
}

.lvl-warn {
  color: var(--warning);
}

.lvl-bad {
  color: var(--danger);
}

/* ---------- 加载指标网格 ---------- */

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.6rem;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--surface);
}

.metric-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 600;
}

/* ---------- 交互实验区 ---------- */

.actions {
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  padding: 0.8rem 1rem;
}

.actions-hint {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin-bottom: 0.65rem;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.block-slider {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  color: var(--text);

  input[type='range'] {
    width: 8rem;
    accent-color: var(--primary);
  }
}

.block-ms {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  color: var(--primary);
  min-width: 3rem;
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.65rem 0.9rem;
  background-color: var(--code-bg);
}

.log-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.log-empty {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.8;
}

/* 小屏：实时区降单列 */
@media (max-width: 768px) {
  .live-row,
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
