// ============================================================
// 案例：PerformanceObserver 性能监控面板
// 订阅浏览器推送的性能指标 entry，实时展示 FP/FCP/LCP/TTFB/CLS，
// 并提供按钮制造「布局偏移」「长任务」观察效果。
// 关键点：
//   - observe({ type, buffered: true }) 进页面即可回放历史指标
//   - 部分类型（longtask/event）旧浏览器不支持，需 try/catch 降级
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'

// ---------- 指标状态 ----------

/** 核心指标（首屏类，取自各类 entry 的关键字段） */
const metrics = reactive({
  fp: null as number | null, // First Paint 首次绘制
  fcp: null as number | null, // First Contentful Paint 首次内容绘制
  lcp: null as number | null, // Largest Contentful Paint 最大内容绘制
  ttfb: null as number | null, // Time To First Byte 首字节时间
  cls: 0, // Cumulative Layout Shift 累计布局偏移（无单位小数）
})

/** longtask 支持情况与观测日志 */
const longTaskSupported = ref(true)
const logEntries = ref<string[]>([])

/** 观察器实例列表（卸载时统一 disconnect，防止内存泄漏） */
const observers: PerformanceObserver[] = []

/** 追加日志（最多保留最近 8 条，避免无限增长） */
function pushLog(msg: string): void {
  const time = new Date().toLocaleTimeString()
  logEntries.value.unshift(`[${time}] ${msg}`)
  if (logEntries.value.length > 8) logEntries.value.pop()
}

/** 统一注册观察器：类型 + 回调；不支持时优雅降级 */
function observe(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
  buffered = true,
): void {
  try {
    const po = new PerformanceObserver((list) => callback(list.getEntries()))
    // observe 可能因不支持的 type 抛 TypeError，必须 try/catch
    po.observe({ type, buffered } as PerformanceObserverInit)
    observers.push(po)
  } catch {
    // 当前浏览器不支持该指标类型：记录但不阻断其他指标
    pushLog(`当前浏览器不支持 ${type} 指标`)
    if (type === 'longtask') longTaskSupported.value = false
  }
}

// ---------- 各指标订阅 ----------

onMounted(() => {
  // 1) paint：FP / FCP。entryType='paint' 的 entry name 为
  //    'first-paint' / 'first-contentful-paint'，startTime 即时间戳
  observe('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-paint') metrics.fp = entry.startTime
      if (entry.name === 'first-contentful-paint') metrics.fcp = entry.startTime
    }
  })

  // 2) largest-contentful-paint：LCP。取最新一条的 startTime
  //    （LCP 会随页面渲染不断更新，最终在用户交互后冻结）
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) metrics.lcp = last.startTime
  })

  // 3) layout-shift：CLS。value 累加（需排除 hadRecentInput 的输入引发偏移）
  observe('layout-shift', (entries) => {
    for (const entry of entries as PerformanceEntry[]) {
      const shift = entry as unknown as {
        value: number
        hadRecentInput: boolean
      }
      // 近期有输入（点击/输入）引发的偏移不计入 CLS（规范要求）
      if (!shift.hadRecentInput) {
        metrics.cls += shift.value
      }
    }
  })

  // 4) navigation：TTFB。responseStart 是响应头到达时间
  observe('navigation', (entries) => {
    const nav = entries[0] as unknown as { responseStart: number }
    if (nav) metrics.ttfb = nav.responseStart
  })

  // 5) longtask：长任务（超过 50ms 的主线程阻塞），仅用于日志展示
  observe(
    'longtask',
    (entries) => {
      for (const entry of entries) {
        pushLog(`长任务 ${entry.duration.toFixed(1)}ms`)
      }
    },
    false, // longtask 不需要 buffered（只要后续产生的任务）
  )
})

// 卸载时断开全部观察器（防止组件销毁后回调仍触发）
onUnmounted(() => {
  observers.forEach((po) => po.disconnect())
})

// ---------- 交互演示 ----------

/** 制造布局偏移：在指标卡上方动态插入块，推挤下方内容产生 CLS */
function makeLayoutShift(): void {
  const host = document.getElementById('shift-zone')
  if (!host) return
  // 动态插入高度 60px 的占位块（无尺寸预留 → 下方内容被推挤 → 产生 shift entry）
  const block = document.createElement('div')
  block.style.cssText =
    'height:60px;border-radius:8px;background:var(--warning-soft);margin-bottom:12px;'
  block.textContent = '布局偏移演示块'
  host.appendChild(block)
  pushLog('已插入偏移块（观察 CLS 增长）')
}

/** 制造长任务：同步阻塞主线程 80ms（超过 50ms 阈值触发 longtask entry） */
function makeLongTask(): void {
  const start = performance.now()
  // 忙等消耗 CPU 时间（模拟重计算；用 setTimeout 0 不会阻塞）
  while (performance.now() - start < 80) {
    // 空转阻塞
  }
  pushLog('已同步阻塞 80ms（观察长任务日志）')
}

/** 格式化毫秒时间戳：保留 1 位小数 + ms 后缀；null 显示占位 */
function fmt(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1)} ms`
}

/** CLS 格式化：3 位小数；按阈值变色（良好 <0.1 / 需改进 <0.25 / 差 ≥0.25） */
function clsLevel(cls: number): string {
  if (cls < 0.1) return 'good'
  if (cls < 0.25) return 'warn'
  return 'bad'
}
</script>

<template>
  <div class="perf-demo">
    <!-- 指标卡网格 -->
    <div class="metric-grid">
      <div class="metric-card">
        <span class="metric-name">FP</span>
        <span class="metric-value">{{ fmt(metrics.fp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">FCP</span>
        <span class="metric-value">{{ fmt(metrics.fcp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">LCP</span>
        <span class="metric-value">{{ fmt(metrics.lcp) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">TTFB</span>
        <span class="metric-value">{{ fmt(metrics.ttfb) }}</span>
      </div>
      <div class="metric-card">
        <span class="metric-name">CLS</span>
        <span
          class="metric-value"
          :class="`cls-${clsLevel(metrics.cls)}`"
        >{{ metrics.cls.toFixed(3) }}</span>
      </div>
    </div>

    <!-- 交互按钮 -->
    <div class="action-row">
      <button
        class="btn-primary"
        type="button"
        @click="makeLayoutShift"
      >
        制造布局偏移
      </button>
      <button
        class="btn-ghost"
        type="button"
        @click="makeLongTask"
      >
        制造长任务
      </button>
    </div>

    <!-- 偏移块挂载点（按钮点击后追加内容） -->
    <div id="shift-zone" />

    <!-- 观测日志 -->
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
        暂无日志，点击上方按钮触发观察
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
  gap: 1.25rem;
}

/* 指标卡网格：5 列自适应 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.75rem;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
}

.metric-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 600;
}

/* CLS 语义色（数值越大越差） */
.cls-good {
  color: var(--success);
}

.cls-warn {
  color: var(--warning);
}

.cls-bad {
  color: var(--danger);
}

.action-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* 日志面板：mono 小字号滚动区 */
.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.75rem 1rem;
  background-color: var(--code-bg);
}

.log-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.log-empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.8;
  color: var(--text);
}
</style>
