<!-- ============================================================
  回到顶部浮动按钮（详情页 / 案例列表页共用）
  - 滚动超过阈值后浮现，外圈画当前阅读/浏览进度
  - 点击后逐帧缓动回顶（不走 behavior: 'smooth'，见 utils/scroll.ts）
  ============================================================ -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { smoothScrollTo, stopSmoothScroll } from '../utils/scroll'

/** threshold：滚动多少像素后出现，长列表页可按需调小 */
const props = withDefaults(defineProps<{ threshold?: number }>(), {
  threshold: 480,
})

/** 按钮是否显示 */
const showBackTop = ref(false)
/** 当前滚动进度 0..1（画在按钮外圈的进度环） */
const scrollProgress = ref(0)
/** 滚动回调的逐帧节流开关：一帧最多计算一次 */
let scrollTicking = false

/** 滚动监听：passive + 逐帧节流，避免每个滚动事件都触发响应式更新 */
function onWindowScroll(): void {
  if (scrollTicking) return
  scrollTicking = true

  requestAnimationFrame(() => {
    const y = window.scrollY
    showBackTop.value = y > props.threshold

    // 进度 = 已滚距离 / 可滚总距离（内容不足一屏时保持 0）
    const max = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0

    scrollTicking = false
  })
}

/**
 * 平滑回到顶部
 * - 不走 behavior: 'smooth'（会被系统设置或浏览器降级成瞬跳）
 * - 即使用户系统开着「减少动态效果」也保留一段缓动：这是用户主动点的短动作，
 *   瞬移反而更突兀；只把时长缩短一点（460ms → 320ms）减轻不适
 */
function backToTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  smoothScrollTo(0, reduce ? 320 : 460, { ignoreReducedMotion: true })
}

onMounted(() => {
  // 刷新 / 从详情页返回时可能已经在滚动位置，先同步一次
  onWindowScroll()
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  // 路由离开时停掉滚动动画，避免动画持有已销毁组件的闭包
  stopSmoothScroll()
})
</script>

<template>
  <Transition name="back-top">
    <button
      v-if="showBackTop"
      class="back-top"
      type="button"
      aria-label="回到顶部"
      @click="backToTop"
    >
      <svg
        class="back-top-ring"
        viewBox="0 0 44 44"
        aria-hidden="true"
      >
        <circle
          class="back-top-track"
          cx="22"
          cy="22"
          r="20"
        />
        <circle
          class="back-top-bar"
          cx="22"
          cy="22"
          r="20"
          :style="{ strokeDashoffset: `${125.66 * (1 - scrollProgress)}` }"
        />
      </svg>
      <span
        class="back-top-arrow"
        aria-hidden="true"
      >↑</span>
    </button>
  </Transition>
</template>

<style scoped>
.back-top {
  position: fixed;
  right: 1.75rem;
  bottom: 1.75rem;
  z-index: 30;
  width: 2.85rem;
  height: 2.85rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  color: var(--primary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  box-shadow: var(--shadow-soft-lg);
  cursor: pointer;
  transition:
    transform var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition);
}

.back-top:hover {
  transform: translateY(-3px);
  color: var(--primary-hover);
  border-color: var(--primary);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
}

/* 按下回弹：给点击一个明确的触感 */
.back-top:active {
  transform: translateY(-1px) scale(0.92);
}

.back-top:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px var(--primary-soft),
    var(--shadow-soft-lg);
}

/* 进度环：贴按钮内圈，从 12 点方向顺时针补齐 */
.back-top-ring {
  position: absolute;
  inset: 2px;
  transform: rotate(-90deg);
  pointer-events: none;
}

.back-top-track,
.back-top-bar {
  fill: none;
  stroke-width: 2;
}

.back-top-track {
  stroke: var(--border);
}

.back-top-bar {
  stroke: var(--primary);
  stroke-linecap: round;
  /* 圆周长 2πr ≈ 125.66：dashoffset 由进度动态控制 */
  stroke-dasharray: 125.66;
  transition: stroke-dashoffset 0.12s linear;
}

.back-top-arrow {
  position: relative;
  line-height: 1;
  transition: transform var(--transition);
}

.back-top:hover .back-top-arrow {
  transform: translateY(-2px);
}

/* 出现：上浮 + 放大（柔和收尾）；消失：快速收紧 */
.back-top-enter-active {
  transition:
    opacity 0.3s var(--ease-out),
    transform 0.3s var(--ease-out);
}

.back-top-leave-active {
  transition:
    opacity 0.18s ease-in,
    transform 0.18s ease-in;
}

.back-top-enter-from,
.back-top-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.7);
}

/* 移动端：按钮贴近屏幕边缘，少挡内容 */
@media (max-width: 768px) {
  .back-top {
    right: 1rem;
    bottom: 1rem;
    width: 2.6rem;
    height: 2.6rem;
  }
}
</style>
