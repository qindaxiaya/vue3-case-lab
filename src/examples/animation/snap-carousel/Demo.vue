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
/** 系统当前是否真的开启了减少动态效果：只用来提示，不夺走演示 */
const systemReduce = ref(false)
/**
 * 是否模拟「系统开启了减少动态效果」
 * 为什么不让系统设置直接决定演示行为：本案例要展示平滑滚动，
 * 系统关掉动画后「平滑」和「直接到位」看起来一模一样，案例就失去意义了
 */
const mockReduce = ref(false)

const trackRef = ref<HTMLElement | null>(null)

/** 滚动停稳后的测量计时器 */
let settleTimer = 0
/** 滚动事件的帧合并编号 */
let scrollFrame = 0
/** 跳转补间的帧编号：新跳转要先取消上一段，避免两段动画抢同一个 scrollLeft */
let scrollRaf = 0
/** 系统「减少动态效果」的媒体查询对象（卸载时移除监听） */
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
  // 补间过程中先保持目标索引高亮，避免经过中间卡片时圆点来回闪；补间结束后再按真实位置校准
  if (!scrollRaf) {
    const raw = track.scrollLeft / step
    index.value = Math.min(SLIDES.length - 1, Math.max(0, Math.round(raw)))
  }

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

/** 取消正在跑的跳转补间（新跳转、重置、卸载都要调用） */
function cancelScrollAnimation(): void {
  if (scrollRaf) window.cancelAnimationFrame(scrollRaf)
  scrollRaf = 0
  trackRef.value?.classList.remove('is-animating')
}

/**
 * 演示用的横向滚动补间
 * 为什么不用原生 smooth：系统开启「减少动态效果」时，部分浏览器会连程序化平滑滚动一起抑制，
 * 案例就看不到「滑过去」的过程。这里用 rAF 自己补间，保证演示始终可见；
 * 真实项目优先用 scrollIntoView / scrollTo 的 behavior: 'smooth'，并跟随系统设置降级。
 */
function animateScrollLeft(track: HTMLElement, target: number): void {
  cancelScrollAnimation()

  // 降级分支：直接到位，吸附仍然生效（吸附是功能，不是装饰动画）
  if (mockReduce.value) {
    track.scrollLeft = target
    readMetrics()
    scheduleSettle()
    return
  }

  const start = track.scrollLeft
  const delta = target - start
  if (Math.abs(delta) < 1) {
    track.scrollLeft = target
    readMetrics()
    scheduleSettle()
    return
  }

  // 动画期间临时关掉吸附：否则浏览器会在每一帧把位置吸回对齐点，补间会一顿一顿
  track.classList.add('is-animating')
  const startedAt = performance.now()
  const duration = 360
  const easeOut = (p: number): number => 1 - (1 - p) ** 3

  const frame = (now: number): void => {
    const progress = Math.min(1, (now - startedAt) / duration)
    track.scrollLeft = start + delta * easeOut(progress)

    if (progress < 1) {
      scrollRaf = window.requestAnimationFrame(frame)
      return
    }

    // 收尾：落回精确目标并恢复吸附，最后再量一次索引与居中误差
    scrollRaf = 0
    track.scrollLeft = target
    track.classList.remove('is-animating')
    readMetrics()
    scheduleSettle()
  }

  scrollRaf = window.requestAnimationFrame(frame)
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

  if (mode.value === 'manual') {
    const step = measureStep()
    const maxLeft = track.scrollWidth - track.clientWidth
    //! 旧做法第 1 处手算：目标距离 = 索引 × 单卡滚动距离
    const wanted = Math.round(step * nextIndex)
    //! 旧做法第 2 处手算：夹到最大可滚动范围，否则最后一张会差一截
    const clamped = Math.max(0, Math.min(wanted, maxLeft))
    handCalc.value = 2
    handTarget.value = `${wanted}px → ${clamped}px`
    animateScrollLeft(track, clamped)
  } else {
    //! 新做法：先让 scrollIntoView 用 auto 算出目标位置，脚本仍然不碰距离
    handCalc.value = 0
    handTarget.value = '浏览器自己算'
    const slide = getSlides()[nextIndex]
    if (!slide) return

    const start = track.scrollLeft
    // 用 auto 让浏览器瞬间算出对齐后的 scrollLeft，再读出来作为补间终点
    slide.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })
    const computedTarget = track.scrollLeft
    // 同步回到起点，下一帧再补间过去；整个过程在同一任务里，不会闪一下
    track.scrollLeft = start
    animateScrollLeft(track, computedTarget)
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

/** Naive 单选组发出的同样是 string | number | boolean，这里收窄回轮播实现方式 */
function onModeChange(next: string | number | boolean | undefined): void {
  if (next === 'manual' || next === 'snap') void setMode(next)
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
  cancelScrollAnimation()
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

/** 切换「模拟减少动态效果」：先停掉等停稳的计时器与帧回调，再把指标清零 */
function toggleMockReduce(): void {
  window.clearTimeout(settleTimer)
  settleTimer = 0
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
  cancelScrollAnimation()
  handCalc.value = 0
  handTarget.value = '—'
  mockReduce.value = !mockReduce.value
}

/** 窗口尺寸变化后卡片宽度会变，重新量索引 */
function onResize(): void {
  readMetrics()
}

/** 系统动态效果偏好变化时只更新提示 */
function onMotionChange(event: MediaQueryListEvent): void {
  systemReduce.value = event.matches
}

// ---------- 生命周期 ----------

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduce.value = motionQuery.matches
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
  cancelScrollAnimation()
  window.removeEventListener('resize', onResize)
  motionQuery?.removeEventListener('change', onMotionChange)
  motionQuery = null
})
</script>

<template>
  <div
    class="snap-demo"
    :class="{ 'no-motion': mockReduce }"
  >
    <div class="bar">
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="轮播实现方式"
        @update:value="onModeChange"
      >
        <n-radio-button
          value="manual"
          data-mode="manual"
        >
          手算 scrollLeft（旧）
        </n-radio-button>
        <n-radio-button
          value="snap"
          data-mode="snap"
        >
          滚动吸附（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        :type="mockReduce ? 'primary' : 'default'"
        :aria-pressed="mockReduce"
        @click="toggleMockReduce"
      >
        {{ mockReduce ? '模拟中：已降级' : '模拟减少动态效果' }}
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <p
      v-if="systemReduce"
      class="system-note"
      role="status"
    >
      系统当前开启了「减少动态效果」。真实项目应当据此降级；本案例为了让动效看得见，仍然播放，点开关可查看降级行为。
    </p>

    <div
      class="stats"
      aria-live="polite"
    >
      <span>当前索引 <b>{{ index + 1 }} / {{ SLIDES.length }}</b></span>
      <span>scrollLeft <b>{{ scrollLeft }}px</b></span>
      <span>本次手算距离 <b>{{ handCalc }} 处</b></span>
      <span>手算结果 <b>{{ handTarget }}</b></span>
      <span>居中误差 <b>{{ centerError }}px</b></span>
      <span>滚动行为 <b>{{ mockReduce ? '直接到位' : '逐帧补间（演示）' }}</b></span>
      <span>动画 <b>{{ mockReduce ? '跳过' : '播放' }}</b></span>
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
        :aria-current="index === slideIndex ? 'true' : undefined"
        @click="goTo(slideIndex)"
      />
    </div>

    <p class="hint">
      旧做法用 scrollLeft 手算：圆点跳转要先算「索引 × 单卡距离」，再夹到最大可滚动范围，两处都算错就会停在半路。
      新做法开滚动吸附，圆点只调 scrollIntoView，索引用滚动位置反推。
      演示用逐帧补间（requestAnimationFrame）保证「减少动态效果」环境下也能看见滑动；真实项目优先用 behavior: 'smooth' 并跟随系统设置降级。
      用手随便向右滑一段再松手：旧做法常停在两张中间（居中误差大于 0），新做法会自动吸到整张卡片。
      点「模拟减少动态效果」可查看降级行为：跳转直接到位，吸附本身仍然生效。
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

/* 系统设置提示：只有检测到「减少动态效果」时才出现 */
.system-note {
  margin: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--warning);
  border-left-width: 3px;
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  line-height: 1.65;
  color: var(--text);
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

  /* rAF 补间期间临时关掉吸附，避免浏览器每帧把位置吸回对齐点 */
  &.is-snap .track.is-animating {
    scroll-snap-type: none;
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

/* 模拟降级：卡片描边与圆点的装饰过渡直接关掉（吸附本身是功能，保持生效） */
.no-motion .slide,
.no-motion .arrow,
.no-motion .dot::after {
  transition: none;
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

  .stats {
    font-size: var(--demo-text-xs);
  }

  .hint {
    font-size: var(--demo-text-xs);
  }
}

/*! 演示优先：系统开启「减少动态效果」时，站点全局规则会把过渡压到 0.01ms，
    而本案例要展示卡片描边与圆点的过渡，所以这里把时长还原。
    真实项目不要照抄这一段，应当像「模拟减少动态效果」打开时那样关掉装饰动画；
    滚动吸附属于功能，不受动态效果偏好影响，保持开启。 */
@media (prefers-reduced-motion: reduce) {
  .slide,
  .arrow,
  .dot::after {
    transition-duration: var(--transition) !important;
  }

  /* 降级状态的优先级更高：开关打开时不做装饰过渡 */
  .no-motion .slide,
  .no-motion .arrow,
  .no-motion .dot::after {
    transition: none !important;
  }
}
</style>
