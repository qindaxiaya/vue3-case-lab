// ============================================================
// 案例：useEventListener / useRafFn 封装范式（use-event-listener）
// - 组合式函数核心价值：生命周期自动清理（组件卸载零泄漏）
// - useEventListener：任意目标事件监听，组件卸载自动 remove
// - useRafFn：rAF 循环封装，可 pause/resume，卸载自动 cancel
// - 演示：跟随鼠标的光晕 + 可暂停的呼吸动画，实时显示活跃监听器数
// ============================================================
<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

// ============================================================
// useEventListener：事件监听自动清理
// ============================================================

/**
 * 事件监听组合式函数
 * @param target  事件目标（元素/窗口/document）
 * @param type    事件名
 * @param handler 处理函数
 */
function useEventListener(
  target: EventTarget,
  type: string,
  handler: (e: Event) => void,
): void {
  //! 关键：addEventListener 与 removeEventListener 必须成对——
  //! 组合式函数把「配对责任」收进自己生命周期，调用方永远不用记得清理
  target.addEventListener(type, handler)
  onUnmounted(() => {
    target.removeEventListener(type, handler)
  })
}

// ============================================================
// useRafFn：rAF 循环封装（可暂停/恢复）
// ============================================================

/**
 * rAF 循环组合式函数
 * @param fn 每帧回调（入参为时间戳）
 * @returns pause 停止 / resume 恢复
 */
function useRafFn(fn: (t: number) => void): {
  pause: () => void
  resume: () => void
} {
  let rafId = 0
  let active = false

  function loop(t: number): void {
    fn(t)
    rafId = requestAnimationFrame(loop)
  }

  function resume(): void {
    if (active) return // 幂等：已运行就不重复启动
    active = true
    rafId = requestAnimationFrame(loop)
  }

  function pause(): void {
    active = false
    cancelAnimationFrame(rafId)
  }

  resume() // 立即启动

  //! 卸载自动取消——忘记 pause 也不会泄漏 rAF 循环
  onUnmounted(pause)

  return { pause, resume }
}

// ============================================================
// Demo 数据
// ============================================================

/** 鼠标位置（光晕跟随） */
const mouseX = ref(-100)
const mouseY = ref(-100)
/** 活跃事件监听器计数（每次监听创建 +1，卸载清理 -1） */
const listenerCount = ref(0)

//! 监听 window 鼠标移动——组件卸载自动解绑（观察 listenerCount 归零）
useEventListener(window, 'mousemove', (e) => {
  mouseX.value = (e as MouseEvent).clientX
  mouseY.value = (e as MouseEvent).clientY
})
listenerCount.value++
onUnmounted(() => {
  listenerCount.value--
})

// ---------- 呼吸动画（useRafFn） ----------

/** 动画是否运行 */
const running = ref(true)
/** 每帧计数 */
const frameCount = ref(0)
/** 当前呼吸缩放（sin 波） */
const breathScale = ref(1)

const rafCtl = useRafFn((t) => {
  frameCount.value++
  // sin 波：0.8 ~ 1.2 之间呼吸
  breathScale.value = 1 + 0.2 * Math.sin(t / 400)
})

function toggleRaf(): void {
  if (running.value) {
    rafCtl.pause()
  } else {
    rafCtl.resume()
  }
  running.value = !running.value
}

/** 重置计数 */
function resetCounters(): void {
  frameCount.value = 0
}
</script>

<template>
  <div class="uel-demo">
    <!-- 统计条 -->
    <div class="stats">
      <span>活跃监听器 <b>{{ listenerCount }}</b></span>
      <span>rAF 状态 <b :class="{ paused: !running }">{{ running ? '运行中' : '已暂停' }}</b></span>
      <span>帧计数 <b>{{ frameCount }}</b></span>
    </div>

    <div class="body">
      <!-- 光晕舞台：mousemove 跟随 -->
      <div class="stage">
        <p class="stage-title">
          useEventListener(window, 'mousemove')
        </p>
        <!-- 光晕：位置由 mousemove 实时驱动 -->
        <div
          class="glow"
          :style="{
            transform: `translate(${mouseX}px, ${mouseY}px)`,
          }"
          aria-hidden="true"
        />
        <p class="stage-hint">
          移动鼠标（组件卸载后监听自动清理——切走页面再回来 listenerCount 归零重建）
        </p>
      </div>

      <!-- 呼吸动画 + 控制 -->
      <div class="panel">
        <p class="panel-title">
          useRafFn（可暂停 rAF 循环）
        </p>
        <div class="breath-wrap">
          <div
            class="breath"
            :style="{ transform: `scale(${breathScale})` }"
            aria-hidden="true"
          />
        </div>
        <div class="actions">
          <n-button
            type="primary"
            @click="toggleRaf"
          >
            {{ running ? '暂停' : '恢复' }}
          </n-button>
          <n-button
            @click="resetCounters"
          >
            重置帧计数
          </n-button>
        </div>
        <p class="panel-note">
          封装要点：pause/resume 幂等保护；onUnmounted 挂 pause——调用方忘记暂停也不泄漏。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uel-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.stats {
  display: flex;
  gap: 1.1rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);

    &.paused {
      color: var(--danger);
    }
  }
}

.body {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 0.75rem;
}

/* ---------- 光晕舞台 ---------- */

.stage {
  position: relative;
  height: 260px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  overflow: hidden;
}

.stage-title {
  position: absolute;
  top: 0.7rem;
  left: 0.9rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.stage-hint {
  position: absolute;
  bottom: 0.7rem;
  left: 0.9rem;
  right: 0.9rem;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* 光晕圆：translate 跟随鼠标（视口坐标 → 舞台内需减舞台偏移，教学简化直接用） */
.glow {
  position: absolute;
  left: 0;
  top: 0;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--primary) 55%, transparent) 0%, transparent 70%);
  pointer-events: none;
  will-change: transform;
}

/* ---------- 呼吸面板 ---------- */

.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.75rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.breath-wrap {
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.breath {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--primary) 40%, transparent);
  border: 2px solid var(--primary);
  will-change: transform;
}

.actions {
  display: flex;
  gap: 0.45rem;
}

.panel-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
