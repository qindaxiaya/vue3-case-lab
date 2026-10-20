// ============================================================
// 案例：交叉观察器曝光统计（intersection-observer）
// - 同一组卡片，两种可见性判断方式对比
// - 旧做法：滚动帧里逐张 getBoundingClientRect（触发布局读取）
// - 新做法：IntersectionObserver 回调，只处理真正跨过阈值的卡片
// - 自动滚动一轮后对比「布局读取次数」与「相交回调次数」
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, type ComponentPublicInstance } from 'vue'

/** 可见性判断模式：旧滚动方案 / 观察器方案 */
type Mode = 'scroll' | 'observer'

interface Card {
  id: number
  title: string
  desc: string
}

/** 12 张演示卡片（固定数据，方便复现） */
const CARDS: Card[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  title: `商品卡片 ${i + 1}`,
  desc: i % 3 === 0 ? '限时折扣 · 进入视口即曝光' : i % 3 === 1 ? '新品上架 · 半可见算曝光' : '库存紧张 · 观察可见比例',
}))

const mode = ref<Mode>('observer')
/** 每张卡片的可见比例（0~1） */
const ratioMap = reactive<Record<number, number>>({})
/** 已曝光卡片集合（半可见即计入） */
const exposed = reactive(new Set<number>())

const viewportEl = ref<HTMLElement | null>(null)
/** 卡片 DOM 映射，观察器与滚动方案共用 */
const cardEls = new Map<number, HTMLElement>()

const layoutReads = ref(0)
const callbackCount = ref(0)
const scrollFrames = ref(0)
const autoRunning = ref(false)

const exposedCount = computed(() => exposed.size)
const modeLabel = computed(() => (mode.value === 'observer' ? '交叉观察器' : '滚动 + 位置计算'))

let observer: IntersectionObserver | null = null
let rafId = 0

/** 函数 ref：把卡片节点登记到 Map，卸载时移除 */
function setCardRef(el: Element | ComponentPublicInstance | null, id: number): void {
  if (el instanceof HTMLElement) {
    el.dataset.id = String(id)
    cardEls.set(id, el)
  } else {
    cardEls.delete(id)
  }
}

/** 清空统计与可见状态 */
function resetStats(): void {
  layoutReads.value = 0
  callbackCount.value = 0
  scrollFrames.value = 0
  exposed.clear()
  for (const id of Object.keys(ratioMap)) delete ratioMap[Number(id)]
}

/** 建立观察器：root 用滚动容器，阈值覆盖 0 到 1，重点看 50% */
function setupObserver(): void {
  observer?.disconnect()
  const root = viewportEl.value
  if (!root) return

  observer = new IntersectionObserver(
    (entries) => {
      callbackCount.value++
      for (const entry of entries) {
        const id = Number((entry.target as HTMLElement).dataset.id)
        ratioMap[id] = entry.intersectionRatio
        // 半可见即视为一次有效曝光，重复进入不重复计数
        if (entry.intersectionRatio >= 0.5) exposed.add(id)
        // 完全离开后把比例归零，界面上能直接看到进出过程
        if (!entry.isIntersecting) ratioMap[id] = 0
      }
    },
    {
      root,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    },
  )

  for (const el of cardEls.values()) observer.observe(el)
}

/** 切换方式：观察器需要重新挂载，滚动方案只需清空计数 */
async function setMode(next: Mode): Promise<void> {
  if (mode.value === next || autoRunning.value) return
  mode.value = next
  observer?.disconnect()
  observer = null
  resetStats()
  if (next === 'observer') {
    await nextTick()
    setupObserver()
  }
}

/** 旧方案：每帧对全部卡片读一次位置，开销随卡片数量线性增长 */
function measureByScroll(): void {
  const root = viewportEl.value
  if (!root) return

  scrollFrames.value++
  const rootRect = root.getBoundingClientRect()

  for (const [id, el] of cardEls) {
    // 每一次读取都可能触发样式/布局计算，这就是旧方案的主要成本
    layoutReads.value++
    const rect = el.getBoundingClientRect()
    const visibleHeight = Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top)
    const ratio = rect.height > 0 ? Math.max(0, Math.min(1, visibleHeight / rect.height)) : 0
    ratioMap[id] = ratio
    if (ratio >= 0.5) exposed.add(id)
  }
}

function onScroll(): void {
  if (mode.value !== 'scroll') return
  // 高频滚动合并到每帧一次，避免事件本身把页面拖垮
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    measureByScroll()
  })
}

/** 等两帧，让滚动位置与观察器回调都完成结算 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** 自动滚动一轮（到底再回顶），两种方案在相同轨迹下计数 */
async function autoScroll(): Promise<void> {
  const root = viewportEl.value
  if (!root || autoRunning.value) return

  // 固定成非空引用，闭包里才能安全使用
  const scroller = root
  autoRunning.value = true
  scroller.scrollTop = 0
  await nextFrame()
  resetStats()

  const max = scroller.scrollHeight - scroller.clientHeight
  const start = performance.now()
  const duration = 1200

  await new Promise<void>((resolve) => {
    function step(now: number): void {
      const progress = Math.min(1, (now - start) / duration)
      scroller.scrollTop = max * progress
      if (progress < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })

  await new Promise((resolve) => setTimeout(resolve, 120))
  // 回到顶部，确保观察器把离开视口也结算掉
  scroller.scrollTop = 0
  await nextFrame()
  await new Promise((resolve) => setTimeout(resolve, 120))
  autoRunning.value = false
}

onMounted(async () => {
  await nextTick()
  setupObserver()
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  if (rafId) cancelAnimationFrame(rafId)
  cardEls.clear()
})
</script>

<template>
  <div class="io-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="可见性判断方式"
      >
        <button
          class="mode"
          :class="{ active: mode === 'scroll' }"
          :aria-pressed="mode === 'scroll'"
          @click="setMode('scroll')"
        >
          滚动 + 位置计算（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'observer' }"
          :aria-pressed="mode === 'observer'"
          @click="setMode('observer')"
        >
          交叉观察器（推荐）
        </button>
      </div>
      <button
        class="btn"
        :disabled="autoRunning"
        @click="autoScroll"
      >
        {{ autoRunning ? '滚动中…' : '自动滚动一轮' }}
      </button>
      <button
        class="btn ghost"
        :disabled="autoRunning"
        @click="resetStats"
      >
        重置
      </button>
    </div>

    <div class="stats">
      <span>布局读取 <b>{{ layoutReads }}</b> 次</span>
      <span>相交回调 <b>{{ callbackCount }}</b> 次</span>
      <span>滚动帧 <b>{{ scrollFrames }}</b> 帧</span>
      <span>曝光 <b>{{ exposedCount }}</b> / {{ CARDS.length }}</span>
      <span class="mode-tag">{{ modeLabel }}</span>
    </div>

    <div
      ref="viewportEl"
      class="viewport"
      @scroll.passive="onScroll"
    >
      <div class="grid">
        <article
          v-for="card in CARDS"
          :key="card.id"
          :ref="(el) => setCardRef(el, card.id)"
          class="card"
          :class="{ visible: (ratioMap[card.id] ?? 0) > 0.05 }"
        >
          <div class="card-top">
            <span class="index">{{ card.id + 1 }}</span>
            <small>{{ Math.round((ratioMap[card.id] ?? 0) * 100) }}% 可见</small>
          </div>
          <h3>{{ card.title }}</h3>
          <p>{{ card.desc }}</p>
          <div class="ratio">
            <span :style="{ width: `${Math.round((ratioMap[card.id] ?? 0) * 100)}%` }" />
          </div>
        </article>
      </div>
    </div>

    <p class="hint">
      点「自动滚动一轮」后看计数：旧方案每帧对 12 张卡读位置，观察器只在跨过阈值时回调。
      阈值 50% 表示露出一半才算一次曝光。
    </p>
  </div>
</template>

<style scoped>
.io-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
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
  background-color: var(--bg-subtle);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--primary);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--primary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.1rem;
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

.mode-tag {
  margin-left: auto;
  padding: 0.05rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--primary-soft);
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.viewport {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.6rem;
  /* 布局隔离：滚动容器内部的变化不影响页面其他区域 */
  contain: layout paint;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.card {
  height: 132px;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  opacity: 0.55;
  transition: opacity 0.25s var(--ease-out), border-color 0.25s var(--ease-out), transform 0.25s var(--ease-out);

  &.visible {
    opacity: 1;
    border-color: var(--primary);
    transform: translateY(-1px);
  }
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.index {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background-color: var(--primary-soft);
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.card h3 {
  margin: 0.35rem 0 0.15rem;
  font-size: var(--demo-text-md);
  color: var(--text);
}

.card p {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.5;
  color: var(--text-secondary);
}

.ratio {
  height: 4px;
  margin-top: 0.45rem;
  border-radius: 999px;
  background-color: var(--border);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background-color: var(--primary);
    transition: width 0.15s linear;
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .mode-tag {
    margin-left: 0;
  }
}
</style>
