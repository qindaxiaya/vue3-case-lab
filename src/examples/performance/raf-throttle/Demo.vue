// ============================================================
// 案例：逐帧合并高频渲染（requestAnimationFrame）
// 鼠标移动只暂存坐标，用「本帧是否已预约」标志合并成一帧一次渲染
// 通用要点：卸载时取消待执行回调，防止操作已销毁的元素
// ============================================================
<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

/** 圆点当前 x / y（只在逐帧回调里更新） */
const cursorX = ref(0)
const cursorY = ref(0)
/** 鼠标事件触发次数（每秒可达数百） */
const eventCount = ref(0)
/** 实际渲染次数（每帧最多一次） */
const renderCount = ref(0)

/** 是否已有待执行的逐帧回调（合并标志：一帧只渲一次） */
let renderPending = false
/** 待执行回调的句柄（卸载时取消） */
let rafId = 0
/** 事件里暂存的最新坐标（普通变量，不触发响应式更新） */
let latestX = 0
let latestY = 0

/**
 * 鼠标移动：
 * 事件高频触发时「只记最新值 + 挂一个逐帧回调」，一帧内后续事件全部合并——
 * 渲染次数从「事件数」降到「帧率」，避免高频重复渲染
 */
function onMouseMove(e: MouseEvent): void {
  eventCount.value++
  // 记录最新坐标（非响应式暂存，避免每个事件都触发更新）
  latestX = e.offsetX
  latestY = e.offsetY

  // 已有待执行回调则不再重复挂（合并的关键判断）
  if (!renderPending) {
    renderPending = true
    // 只在「即将重绘」前执行一次：本帧所有移动事件共享这次渲染
    rafId = requestAnimationFrame(() => {
      renderPending = false
      cursorX.value = latestX
      cursorY.value = latestY
      renderCount.value++
    })
  }
}

// 路由离开时若有挂起的回调，必须取消，否则回调会操作已销毁的元素
onUnmounted(() => {
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="throttle-demo">
    <!-- 交互区：鼠标移入并移动 -->
    <div
      class="move-zone"
      aria-label="鼠标移动区域"
      @mousemove="onMouseMove"
    >
      <!-- 跟随光标的小圆点（只在逐帧回调里更新位置） -->
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
      移动鼠标看两个数字：事件数每秒可达数百，渲染帧数被合并到接近刷新率——这就是逐帧节流
    </p>
  </div>
</template>

<style scoped>
.throttle-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 鼠标交互区：虚线框提示可交互 */
.move-zone {
  position: relative;
  width: 420px;
  max-width: 100%;
  height: 140px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  cursor: crosshair;
  overflow: hidden;
}

/* 跟随点：绝对定位 + 位移变换，不触发布局 */
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
