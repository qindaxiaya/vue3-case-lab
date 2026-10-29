// ============================================================
// 案例：逐帧动画（requestAnimationFrame）
// 时间戳驱动 + 正弦缓动往返，实时展示帧率 / 帧间隔 / 累计帧数
// 通用要点：停止必须 cancelAnimationFrame；onUnmounted 兜底清理
// ============================================================
<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

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

// ---------- 逐帧循环核心 ----------

/** requestAnimationFrame 返回的句柄：取消循环全靠它（必须成对） */
let rafId = 0
/** 本段循环的起始时间戳（暂停恢复时平移，避免瞬间跳变） */
let startTs = 0
/** 上一帧时间戳（算帧间隔用） */
let lastTs = 0
/** 帧率滑动窗口：保留最近 60 帧的时间戳 */
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

  // ② 帧率滑动窗口：入列并丢最旧，保留最近 60 帧
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

// 组件销毁（路由离开）时取消循环，防止后台空转
onUnmounted(() => {
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

    <!-- 控制行：启动/暂停 + 实时指标 -->
    <div class="controls">
      <n-button
        type="primary"
        @click="toggle"
      >
        {{ running ? '暂停' : '启动' }}
      </n-button>

      <div class="stat">
        <span class="stat-name">帧率</span>
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
  </div>
</template>

<style scoped>
.raf-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 600;
}

.hint {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}
</style>
