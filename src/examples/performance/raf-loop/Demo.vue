// ============================================================
// 案例：requestAnimationFrame 渲染循环（raf-loop）
// - 方块沿轨道匀速循环移动：transform 驱动，不用 CSS animation
// - 启动/暂停按钮控制循环；停止时 cancelAnimationFrame
// - 实时指标（中文）：帧率 FPS（滑动窗口）/ 帧间隔 / 累计帧数
// - onUnmounted 兜底清理，离开页面不留后台循环
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 展示状态（模板绑定） ----------

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
/** 速度 px/s（时间戳驱动位移的系数，与刷新率无关） */
const SPEED = 120

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
 * 2. 时间戳驱动位移（秒 × 速度，与显示器刷新率解耦）
 * 3. 循环回绕（对轨道长度取模）+ 调度下一帧
 */
function loop(now: number): void {
  // ① 帧间隔 = 本帧时间戳 - 上帧时间戳（首帧 lastTs=startTs，间隔≈0 可忽略）
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

  // ③ 时间戳驱动位移：elapsed 秒 × 速度 = 像素
  //    关键：不累加固定步长（那会与刷新率耦合），直接由总耗时算位置
  const elapsed = (now - startTs) / 1000
  //    循环回绕：超出轨道长度取模回到起点
  boxX.value = (elapsed * SPEED) % TRACK_TRAVEL

  // ④ 调度下一帧（暂停后不再续订，循环自然终止）
  if (running.value) {
    rafId = requestAnimationFrame(loop)
  }
}

/** 启动/恢复：重置窗口起点（按当前位移反推 startTs，避免跳变） */
function start(): void {
  if (running.value) return
  running.value = true
  // 从当前 boxX 反推已经走过的秒数，把起点前移——恢复时不闪回
  startTs = performance.now() - (boxX.value / SPEED) * 1000
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

// ---------- 生命周期 ----------

onMounted(() => {
  // 进页面即开跑（演示友好；真实场景通常由用户操作触发）
  start()
})

onUnmounted(() => {
  // 兜底清理：组件销毁（路由离开）时取消循环，防止后台空转
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="raf-demo">
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

    <!-- 控制行：启动/暂停 -->
    <div class="controls">
      <button
        class="btn-primary"
        type="button"
        @click="toggle"
      >
        {{ running ? '暂停' : '启动' }}
      </button>

      <!-- 实时指标（中文名 + mono 数值） -->
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
      时间戳驱动位移：位置 = 已耗时秒 × 速度（与刷新率解耦）；暂停看帧数停增，恢复无跳变
    </p>
  </div>
</template>

<style scoped>
.raf-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ---------- 轨道 ---------- */

/* 轨道：宽度与 JS 的 TRACK_TRAVEL + BOX_SIZE 对应（320 + 48） */
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

/* ---------- 控制行 ---------- */

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
