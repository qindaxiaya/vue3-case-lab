// ============================================================
// 案例：滚动吸附轮播（snap-carousel）
// - 旧做法：自己监听 scroll 算索引，圆点用 scrollLeft 手算终点与边界
// - 新做法：scroll-snap-type 负责吸附，scrollIntoView 负责跳转，
//   索引仍用 scrollLeft / (卡片宽 + 间距) 四舍五入换算
// - 指标：圆点跳转需要手算的距离个数（旧 2 处 / 新 0 处）、居中误差
// - 375px：卡片宽度用百分比，页面不横向溢出，轮播自己横向滚动
// ============================================================
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

/** 轮播实现方式：manual = 手算 scrollLeft（旧）/ snap = 滚动吸附（新） */
type CarouselMode = 'manual' | 'snap'

/** 卡片配色：只用站点语义色变量，不引入新颜色 */
type SlideTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

interface Slide {
  id: string
  title: string
  desc: string
  tone: SlideTone
}

/** 五张卡片：文案与数量足够暴露「停在两张中间」的问题 */
const SLIDES: Slide[] = [
  {
    id: 'snap-1',
    title: '滚动吸附',
    desc: '松手后自动停到整张卡片，不会卡在两张中间',
    tone: 'primary',
  },
  {
    id: 'snap-2',
    title: '圆点跳转',
    desc: '交给 scrollIntoView，脚本不再手算距离',
    tone: 'success',
  },
  {
    id: 'snap-3',
    title: '索引换算',
    desc: '滚动位置除以「卡片宽 + 间距」，四舍五入',
    tone: 'warning',
  },
  {
    id: 'snap-4',
    title: '键盘切换',
    desc: '聚焦轮播后按左右方向键，同样能换卡',
    tone: 'danger',
  },
  {
    id: 'snap-5',
    title: '居中留白',
    desc: '首尾留出半张卡片的空位，最后一张也能居中',
    tone: 'neutral',
  },
]

const mode = ref<CarouselMode>('manual')
/** 当前卡片索引：由滚动位置换算得到 */
const index = ref(0)
/** 当前滚动位置（px） */
const scrollLeft = ref(0)
/** 当前卡片中心与容器中心的偏差（px）：旧做法手滑停下时不为 0 */
const centerError = ref(0)
/** 最近一次圆点跳转需要手算的距离个数：旧 2 处 / 新 0 处 */
const handCalc = ref(0)
/** 最近一次手算的中间结果，方便看清「目标 → 夹取后」 */
const handTarget = ref('—')
/** 系统是否开启减少动态效果：开启时用瞬间滚动 */
const reducedMotion = ref(false)

const trackRef = ref<HTMLElement | null>(null)

/** 滚动停稳后的测量计时器 */
let settleTimer = 0
/** 滚动事件的帧合并编号 */
let scrollFrame = 0
/** 动态效果偏好的媒体查询对象（卸载时移除监听） */
let motionQuery: MediaQueryList | null = null

/** 取轮播的横向滚动容器 */
function getTrack(): HTMLElement | null {
  return trackRef.value
}

/** 取全部卡片节点：用页面节点查询而不是逐个 ref，索引与顺序天然一致 */
function getSlides(): HTMLElement[] {
  const track = getTrack()
  if (!track) return []
  return Array.from(track.querySelectorAll<HTMLElement>('.slide'))
}

/** 一张卡片占用的滚动距离 = 卡片宽 + 间距 */
function measureStep(): number {
  const track = getTrack()
  const first = getSlides()[0]
  if (!track || !first) return 0

  // 间距从计算样式读，不写死数值：样式里改 gap 也不用改脚本
  const styles = window.getComputedStyle(track)
  const gap =
    Number.parseFloat(styles.columnGap) || Number.parseFloat(styles.gap) || 0
  return first.getBoundingClientRect().width + gap
}

/** 按滚动位置换算索引，并量当前卡片的居中误差 */
function readMetrics(): void {
  const track = getTrack()
  if (!track) return

  scrollLeft.value = Math.round(track.scrollLeft)
  const step = measureStep()
  if (step <= 0) return

  //! 索引不靠维护一个「上一张 / 下一张」变量，而是从滚动位置反推
  const raw = track.scrollLeft / step
  index.value = Math.min(SLIDES.length - 1, Math.max(0, Math.round(raw)))

  const slide = getSlides()[index.value]
  if (!slide) return
  const trackRect = track.getBoundingClientRect()
  const slideRect = slide.getBoundingClientRect()
  const slideCenter = slideRect.left + slideRect.width / 2
  const trackCenter = trackRect.left + trackRect.width / 2
  centerError.value = Math.round(Math.abs(slideCenter - trackCenter))
}

/** 等滚动停稳再量一次：平滑滚动过程中量到的是中间位置 */
function scheduleSettle(): void {
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    settleTimer = 0
    readMetrics()
  }, 160)
}

/** 滚动事件：先合并到一帧再读位置，避免每次事件都强制结算布局 */
function onScroll(): void {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    readMetrics()
  })
  scheduleSettle()
}

// ---------- 跳转 ----------

/**
 * 跳到第 target 张卡片
 * 旧做法自己算距离并夹边界；新做法把定位交给浏览器
 */
function goTo(target: number): void {
  const track = getTrack()
  if (!track) return

  const nextIndex = Math.min(SLIDES.length - 1, Math.max(0, target))
  const behavior: ScrollBehavior = reducedMotion.value ? 'auto' : 'smooth'

  if (mode.value === 'manual') {
    const step = measureStep()
    const maxLeft = track.scrollWidth - track.clientWidth
    //! 旧做法第 1 处手算：目标距离 = 索引 × 单卡滚动距离
    const wanted = Math.round(step * nextIndex)
    //! 旧做法第 2 处手算：夹到最大可滚动范围，否则最后一张会差一截
    const clamped = Math.max(0, Math.min(wanted, maxLeft))
    handCalc.value = 2
    handTarget.value = `${wanted}px → ${clamped}px`
    track.scrollTo({ left: clamped, behavior })
  } else {
    //! 新做法：吸附负责对齐，scrollIntoView 负责滚动，脚本不碰任何距离
    handCalc.value = 0
    handTarget.value = '浏览器自己算'
    const slide = getSlides()[nextIndex]
    slide?.scrollIntoView({ block: 'nearest', inline: 'center', behavior })
  }

  index.value = nextIndex
  scheduleSettle()
}

/** 上一张 / 下一张：两侧箭头与键盘共用 */
function goStep(delta: number): void {
  goTo(index.value + delta)
}

/** 键盘左右键切换：在轮播容器上监听，不影响页面其他区域 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goStep(-1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    goStep(1)
  }
}

// ---------- 模式切换与重置 ----------

/** 切换实现方式：等样式生效后重新对齐当前卡片 */
async function setMode(next: CarouselMode): Promise<void> {
  if (mode.value === next) return
  mode.value = next
  handCalc.value = 0
  handTarget.value = '—'

  // 吸附模式会改变滚动容器的对齐方式，等新样式挂上去再跳一次
  await nextTick()
  goTo(index.value)
}

/** 重置：回到第一张、旧做法模式，指标清零 */
function resetAll(): void {
  mode.value = 'manual'
  index.value = 0
  scrollLeft.value = 0
  centerError.value = 0
  handCalc.value = 0
  handTarget.value = '—'

  const track = getTrack()
  track?.scrollTo({ left: 0, behavior: 'auto' })
  scheduleSettle()
}

/** 窗口尺寸变化后卡片宽度会变，重新量索引 */
function onResize(): void {
  readMetrics()
}

/** 系统动态效果偏好变化时同步 */
function onMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  window.addEventListener('resize', onResize)
  readMetrics()
})

onUnmounted(() => {
  //! 计时器与帧回调必须清掉：否则离开页面后仍会读已经卸载的节点
  window.clearTimeout(settleTimer)
  settleTimer = 0
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
  window.removeEventListener('resize', onResize)
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div class="snap-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="轮播实现方式"
      >
        <button
          class="mode"
          :class="{ active: mode === 'manual' }"
          :aria-pressed="mode === 'manual'"
          @click="setMode('manual')"
        >
          手算 scrollLeft（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'snap' }"
          :aria-pressed="mode === 'snap'"
          @click="setMode('snap')"
        >
          滚动吸附（推荐）
        </button>
      </div>
      <button
        class="btn ghost"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>当前索引 <b>{{ index + 1 }} / {{ SLIDES.length }}</b></span>
      <span>scrollLeft <b>{{ scrollLeft }}px</b></span>
      <span>本次手算距离 <b>{{ handCalc }} 处</b></span>
      <span>手算结果 <b>{{ handTarget }}</b></span>
      <span>居中误差 <b>{{ centerError }}px</b></span>
    </div>

    <div
      class="carousel"
      :class="mode === 'snap' ? 'is-snap' : 'is-manual'"
    >
      <button
        class="arrow"
        type="button"
        aria-label="上一张"
        :disabled="index === 0"
        @click="goStep(-1)"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <!--
        轮播容器本身可横向滚动，页面不会因此横向溢出。
        旧模式没有吸附；新模式由 scroll-snap-type 接管对齐。
      -->
      <div
        ref="trackRef"
        class="track"
        role="group"
        aria-label="卡片轮播，可用左右方向键切换"
        tabindex="0"
        @scroll.passive="onScroll"
        @keydown="onKeydown"
      >
        <article
          v-for="(slide, slideIndex) in SLIDES"
          :key="slide.id"
          class="slide"
          :class="[`tone-${slide.tone}`, { active: index === slideIndex }]"
        >
          <span class="slide-no">{{ slideIndex + 1 }}</span>
          <h3 class="slide-title">
            {{ slide.title }}
          </h3>
          <p class="slide-desc">
            {{ slide.desc }}
          </p>
        </article>
      </div>

      <button
        class="arrow"
        type="button"
        aria-label="下一张"
        :disabled="index === SLIDES.length - 1"
        @click="goStep(1)"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>

    <div
      class="dots"
      role="group"
      aria-label="跳到指定卡片"
    >
      <button
        v-for="(slide, slideIndex) in SLIDES"
        :key="slide.id"
        class="dot"
        :class="{ active: index === slideIndex }"
        type="button"
        :aria-label="`跳到第 ${slideIndex + 1} 张：${slide.title}`"
        :aria-pressed="index === slideIndex"
        @click="goTo(slideIndex)"
      />
    </div>

    <p class="hint">
      旧做法用 scrollLeft 手算：圆点跳转要先算「索引 × 单卡距离」，再夹到最大可滚动范围，两处都算错就会停在半路。
      新做法开滚动吸附，圆点只调 scrollIntoView，索引用滚动位置反推。
      用手随便向右滑一段再松手：旧做法常停在两张中间（居中误差大于 0），新做法会自动吸到整张卡片。
    </p>
  </div>
</template>

<style scoped>
.snap-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  /* 演示根节点永远不超过容器宽度，内部横向滚动不外溢 */
  max-width: 100%;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn.ghost {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;
  transition: background-color var(--transition), color var(--transition);

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 轮播 ---------- */

.carousel {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;

  /* 只有新做法才开启吸附：旧做法保持自由滚动，才能停在两张中间 */
  &.is-snap .track {
    scroll-snap-type: x mandatory;
  }
}

.track {
  --gap: 0.75rem;
  /* 窄屏用百分比：卡片宽度跟着容器走，375px 下也留出两侧空白 */
  --card-w: 76%;

  display: flex;
  flex: 1 1 auto;
  gap: var(--gap);
  min-width: 0;
  max-width: 100%;
  padding-block: 0.3rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  /* 隐藏原生滚动条：圆点与箭头已经是主要操作入口 */
  scrollbar-width: none;

  &::-webkit-scrollbar {
    height: 0;
  }
}

/*! 首尾留白 = (容器宽 - 卡片宽) / 2 - 间距：保证第一张与最后一张也能居中 */
.track::before,
.track::after {
  content: '';
  flex: 0 0 calc((100% - var(--card-w)) / 2 - var(--gap));
}

.slide {
  display: flex;
  flex: 0 0 var(--card-w);
  flex-direction: column;
  gap: 0.3rem;
  min-height: 9.5rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  /*! 吸附对齐点写在子项上：容器负责方向，子项负责对齐方式 */
  scroll-snap-align: center;
  transition: box-shadow var(--transition), border-color var(--transition);

  &.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-soft);
  }
}

.slide-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.slide-title {
  margin: 0;
  font-size: var(--demo-text-md);
  color: var(--text);
}

.slide-desc {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

/* 五张卡片各用一套语义色，切换时能立刻看出换到了哪一张 */
.slide.tone-success .slide-no {
  background-color: var(--success-soft);
  color: var(--success);
}

.slide.tone-warning .slide-no {
  background-color: var(--warning-soft);
  color: var(--warning);
}

.slide.tone-danger .slide-no {
  background-color: var(--danger-soft);
  color: var(--danger);
}

.slide.tone-neutral .slide-no {
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

/* ---------- 箭头与圆点 ---------- */

.arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  /* 覆盖演示区按钮基线，保证圆形不被拉成椭圆 */
  min-height: 2.25rem;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background-color: var(--surface);
  color: var(--text);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--transition), border-color var(--transition),
    color var(--transition), opacity var(--transition);

  &:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
}

.dots {
  display: flex;
  justify-content: center;
  gap: 0.2rem;
  padding-top: 0.1rem;
}

.dot {
  position: relative;
  width: 1.6rem;
  height: 1.6rem;
  /* 圆点视觉很小，点击区放大到 25px；同时覆盖演示区按钮最小高度 */
  min-height: 1.6rem;
  padding: 0;
  border: none;
  background-color: transparent;
  cursor: pointer;

  /* 用伪元素画圆点：按钮本体只负责点击区，缩放不会影响布局 */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background-color: var(--border);
    transform: translate(-50%, -50%);
    transition: background-color var(--transition), transform var(--transition);
  }

  &.active::after {
    background-color: var(--primary);
    transform: translate(-50%, -50%) scale(1.3);
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (min-width: 640px) {
  .track {
    /* 宽屏固定卡片宽度，两侧留白由公式自动算 */
    --card-w: 18rem;
  }
}

@media (max-width: 520px) {
  .modes {
    flex: 1 1 100%;
  }

  .mode {
    flex: 1;
  }

  .stats {
    font-size: var(--demo-text-xs);
  }

  .hint {
    font-size: var(--demo-text-xs);
  }
}

/* 减少动态效果：吸附保留（它是布局行为），滚动直接到位 */
@media (prefers-reduced-motion: reduce) {
  .slide,
  .arrow,
  .dot {
    transition: none;
  }
}
</style>
