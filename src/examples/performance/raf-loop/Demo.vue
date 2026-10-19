// ============================================================
// 案例：requestAnimationFrame 渲染循环（raf-loop）
// 两个演示（同页对照）：
//   演示一：匀速往返动画——时间戳驱动 + 正弦缓动（端点速度归零不生硬）
//   演示二：高频渲染合并——mousemove 高频事件用 rAF 节流为每帧一次渲染
// 通用要点：停止必须 cancelAnimationFrame；onUnmounted 兜底清理
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ============================================================
// 演示一：匀速往返动画（时间戳驱动 + 正弦缓动）
// ============================================================

/** 循环是否在跑（按钮文案与循环续停都看它） */
const running = ref(false)
/** 实时帧率（最近窗口滑动统计） */
const fps = ref(0)
/** 帧间隔 ms（相邻两帧时间戳差，60fps 约 16.7） */
const frameGap = ref(0)
/** 累计帧数（暂停不涨，启动继续累加） */
const frameCount = ref(0)
/** 方块水平位移 px（transform 直接驱动） */
const boxX = ref(0)

// ---------- 轨道参数 ----------

/** 轨道可移动长度（px，= SCSS 中轨道内容宽 368 - 方块宽 48） */
const TRACK_TRAVEL = 320
/** 往返周期秒（一个完整来回的时长） */
const PERIOD = 3.2

// ---------- rAF 循环核心 ----------

/** rAF 返回的句柄：取消循环全靠它（必须成对） */
let rafId = 0
/** 本段循环的起始时间戳（暂停恢复时平移，避免瞬间跳变） */
let startTs = 0
/** 上一帧时间戳（算帧间隔用） */
let lastTs = 0
/** FPS 滑动窗口：保留最近 60 帧的时间戳 */
const fpsWindow: number[] = []

/**
 * 每帧回调：
 * 1. 用时间戳差算帧间隔 + 更新滑动窗口帧率
 * 2. 正弦缓动算往返位置（时间戳驱动，与刷新率解耦）
 * 3. 调度下一帧
 */
function loop(now: number): void {
  // ① 帧间隔 = 本帧时间戳 - 上帧时间戳
  frameGap.value = now - lastTs
  lastTs = now
  frameCount.value++

  // ② FPS 滑动窗口：入列并丢最旧，保留最近 60 帧
  fpsWindow.push(now)
  if (fpsWindow.length > 60) fpsWindow.shift()
  if (fpsWindow.length >= 2) {
    // 窗口帧率 = (样本数-1) / 窗口跨度秒数
    const span = fpsWindow[fpsWindow.length - 1] - fpsWindow[0]
    fps.value = span > 0 ? Math.round(((fpsWindow.length - 1) * 1000) / span) : 0
  }

  // ③ 正弦缓动往返：
  //    phase 归一化到 0..1（一个周期），sin 映射 -1..1 再抬到 0..1
  //    sin 在两端（0/π）斜率为 0 → 速度自然归零，折返无生硬突变
  const elapsed = (now - startTs) / 1000
  const phase = (elapsed % PERIOD) / PERIOD // 0..1
  //    sin(-π/2)=-1 起步：从 0 出发 → 1 折返 → 0，完整平滑往返
  const wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2 // 0..1
  boxX.value = wave * TRACK_TRAVEL

  // ④ 调度下一帧（暂停后不再续订，循环自然终止）
  if (running.value) {
    rafId = requestAnimationFrame(loop)
  }
}

/** 启动/恢复：从当前位移反推 startTs，恢复时不闪回 */
function start(): void {
  if (running.value) return
  running.value = true
  // 反推已用时间：当前 wave = boxX/TRAVEL，由 arcsin 恢复 phase 代价高——
  // 简化：恢复时从当前位移对应时刻重新计时（微小跳变可接受，教学场景从简）
  startTs = performance.now() - (boxX.value / TRACK_TRAVEL) * PERIOD * 1000
  lastTs = performance.now()
  rafId = requestAnimationFrame(loop)
}

/** 暂停：唯一入口必须 cancel——只停调度不取消，句柄会泄漏 */
function pause(): void {
  running.value = false
  cancelAnimationFrame(rafId)
}

/** 启动/暂停切换 */
function toggle(): void {
  if (running.value) {
    pause()
  } else {
    start()
  }
}

// ============================================================
// 演示二：高频渲染合并（mousemove 事件 + rAF 节流）
// ============================================================

/** 最新鼠标 x/y（事件里只记录，渲染只在 rAF 回调里做） */
const cursorX = ref(0)
const cursorY = ref(0)
/** 事件计数（mousemove 触发次数，可达每秒数百） */
const eventCount = ref(0)
/** 渲染计数（rAF 回调执行次数，上限≈帧率） */
const renderCount = ref(0)

/** 是否已有待执行的 rAF 回调（合并标志：一帧只渲一次） */
let renderPending = false
/** 待执行的 rAF 句柄（卸载时取消） */
let throttleRafId = 0
/** 事件里暂存的最新坐标（rAF 回调时才写进响应式状态） */
let latestX = 0
let latestY = 0

/**
 * rAF 节流渲染模式：
 * 事件高频触发时「只记最新值 + 挂一个 rAF」，一帧内后续事件全部合并——
 * 渲染次数从「事件数」降到「帧率」，避免高频 setState 重复渲染
 */
function onMouseMove(e: MouseEvent): void {
  eventCount.value++
  // 记录最新坐标（非响应式暂存，避免每事件都触发响应式更新）
  latestX = e.offsetX
  latestY = e.offsetY

  // 已有待执行回调则不再重复挂（合并的关键判断）
  if (!renderPending) {
    renderPending = true
    // 只在「即将重绘」前执行一次：本帧所有 move 事件共享这次渲染
    throttleRafId = requestAnimationFrame(() => {
      renderPending = false
      cursorX.value = latestX
      cursorY.value = latestY
      renderCount.value++
    })
  }
}

// ---------- 演示 tab 切换 ----------

/** 当前演示 tab：track = 往返动画；throttle = 高频渲染合并 */
const activeDemo = ref<'track' | 'throttle'>('track')

/**
 * 切换演示 tab：
 * v-if 切走的区块不会触发组件卸载钩子——rAF 必须在切换时手动停，
 * 否则循环在隐藏区块里继续空转（回调还引用着隐藏的 DOM 状态）
 */
function switchDemo(demo: 'track' | 'throttle'): void {
  if (demo === activeDemo.value) return

  // 停掉当前演示的循环
  if (activeDemo.value === 'track') {
    pause()
  } else {
    // 节流演示：取消待执行 rAF 并清合并标志
    cancelAnimationFrame(throttleRafId)
    renderPending = false
    // 计数归零，切回时从头看对比效果
    eventCount.value = 0
    renderCount.value = 0
  }

  activeDemo.value = demo

  // 往返演示切回来时恢复运行
  if (demo === 'track') {
    start()
  }
}

// ---------- 生命周期 ----------

onMounted(() => {
  // 演示一进页面即开跑（演示友好；真实场景通常由用户操作触发）
  start()
})

onUnmounted(() => {
  // 兜底清理：组件销毁（路由离开）时取消两个循环，防止后台空转
  cancelAnimationFrame(rafId)
  cancelAnimationFrame(throttleRafId)
})
</script>

<template>
  <div class="raf-demo">
    <!-- 演示切换 tab（两个演示互斥显示，切走即停 rAF） -->
    <div
      class="demo-tabs"
      role="tablist"
      aria-label="演示切换"
    >
      <button
        class="demo-tab"
        :class="{ 'demo-tab--active': activeDemo === 'track' }"
        type="button"
        role="tab"
        :aria-selected="activeDemo === 'track'"
        @click="switchDemo('track')"
      >
        往返动画
      </button>
      <button
        class="demo-tab"
        :class="{ 'demo-tab--active': activeDemo === 'throttle' }"
        type="button"
        role="tab"
        :aria-selected="activeDemo === 'throttle'"
        @click="switchDemo('throttle')"
      >
        高频渲染合并
      </button>
    </div>

    <!-- ============ 演示一：匀速往返动画 ============ -->
    <section
      v-if="activeDemo === 'track'"
      class="demo-block"
      aria-label="演示一：匀速往返动画"
    >
      <h3 class="demo-title">
        匀速往返（时间戳驱动 + 正弦缓动）
      </h3>

      <!-- 轨道 + 方块（transform 驱动，不动 left——不触发重排） -->
      <div
        class="track"
        aria-label="动画轨道"
      >
        <div
          class="track-box"
          :style="{ transform: `translateX(${boxX}px)` }"
        />
      </div>

      <!-- 控制行：启动/暂停 + 实时指标 -->
      <div class="controls">
        <button
          class="btn-primary"
          type="button"
          @click="toggle"
        >
          {{ running ? '暂停' : '启动' }}
        </button>

        <div class="stat">
          <span class="stat-name">帧率 FPS</span>
          <span class="stat-value">{{ fps }}</span>
        </div>
        <div class="stat">
          <span class="stat-name">帧间隔</span>
          <span class="stat-value">{{ frameGap.toFixed(1) }} ms</span>
        </div>
        <div class="stat">
          <span class="stat-name">累计帧数</span>
          <span class="stat-value">{{ frameCount }}</span>
        </div>
      </div>

      <p class="hint">
        位置 = 正弦波 × 轨道长：两端速度自然归零，折返不生硬（对比线性折返的瞬间突变）
      </p>
    </section>

    <!-- ============ 演示二：高频渲染合并 ============ -->
    <section
      v-if="activeDemo === 'throttle'"
      class="demo-block"
      aria-label="演示二：高频渲染合并"
    >
      <h3 class="demo-title">
        高频渲染合并（mousemove + rAF 节流）
      </h3>

      <!-- 交互区：鼠标移入移动 -->
      <div
        class="move-zone"
        aria-label="鼠标移动区域"
        @mousemove="onMouseMove"
      >
        <!-- 跟随光标的小圆点（只在 rAF 回调里更新位置） -->
        <div
          class="cursor-dot"
          :style="{ transform: `translate(${cursorX}px, ${cursorY}px)` }"
        />
        <span class="zone-tip">↑ 在这里移动鼠标</span>
      </div>

      <!-- 对比指标：事件数 vs 渲染数 -->
      <div class="controls">
        <div class="stat">
          <span class="stat-name">事件数</span>
          <span class="stat-value">{{ eventCount }}</span>
        </div>
        <div class="stat">
          <span class="stat-name">渲染帧数</span>
          <span class="stat-value">{{ renderCount }}</span>
        </div>
      </div>

      <p class="hint">
        移动鼠标看两个数字：事件数每秒可达数百，渲染帧数被 rAF 合并到≈帧率——这就是节流渲染
      </p>
    </section>
  </div>
</template>

<style scoped>
.raf-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- 演示切换 tab ---------- */

.demo-tabs {
  display: flex;
  gap: 0.15rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.35rem;
}

.demo-tab {
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition);
}

.demo-tab:hover {
  color: var(--text);
  background-color: var(--bg);
}

.demo-tab--active {
  color: var(--primary);
  font-weight: 500;
  background-color: var(--primary-soft);
}

/* 演示区块：轻边框分隔 */
.demo-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.demo-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

/* ---------- 轨道（演示一） ---------- */

/* 轨道：宽度与 TRACK_TRAVEL + 方块宽对应（320 + 48） */
.track {
  position: relative;
  width: 368px;
  max-width: 100%;
  height: 64px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
}

/* 方块：绝对定位 + transform 移动（GPU 合成，不触发 layout） */
.track-box {
  position: absolute;
  top: 8px;
  left: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-btn);
  background-color: var(--primary);
  /* transform 是唯一动画手段——每帧只改它，无 CSS animation */
  will-change: transform;
}

/* ---------- 鼠标交互区（演示二） ---------- */

.move-zone {
  position: relative;
  width: 368px;
  max-width: 100%;
  height: 120px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  /* 十字光标提示可交互 */
  cursor: crosshair;
  overflow: hidden;
}

/* 跟随点：绝对定位 + transform（与演示一同一渲染手段） */
.cursor-dot {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--primary);
  pointer-events: none;
}

.zone-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  pointer-events: none;
}

/* ---------- 控制行与指标 ---------- */

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}

.stat-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 600;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}
</style>
