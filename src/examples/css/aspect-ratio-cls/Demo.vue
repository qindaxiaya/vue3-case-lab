// ============================================================
// 案例：aspect-ratio 图片占位防抖动（aspect-ratio-cls）
// - 「触发图片加载」批量插入 8 张占位图，延时串行赋值模拟网络加载
// - 图片本体在本地用 canvas 生成 data URI，不碰外网
// - 旧做法：无占位、加载完成后撑开 → 下方内容被顶来顶去
// - 新做法：外层 aspect-ratio: 16 / 9，先占位后填图 → 纹丝不动
// - PerformanceObserver（layout-shift）实测累计偏移分数与跳动次数
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/** 占位策略：none = 不占位（默认先看问题）/ ratio = 外层 16 比 9 占位 */
type PlaceholderMode = 'none' | 'ratio'

// 默认停在「无占位」：先让用户看到图片加载时内容被顶走，再切到占位看 0 偏移
const mode = ref<PlaceholderMode>('none')

interface ImgItem {
  id: number
  src: string
  /** 该图的模拟网络延迟（毫秒，仅用于打点显示） */
  delay: number
}

/** 演示图片清单（src 为空表示「还在加载」） */
const items = ref<ImgItem[]>([])

/** 图片总数：每批次固定 8 张，方便横向对比 */
const BATCH = 8

/** 已完成加载的张数 */
const loadedCount = ref(0)

/** 累计布局偏移分数（CLS，来自 layout-shift 的 value 累加） */
const clsScore = ref(0)

/** 跳动次数（有正向偏移量的条数） */
const shiftCount = ref(0)

// ---------- 本地图片素材：canvas 画图 → data URI（零外网） ----------

const URIS: string[] = []

/** 画 8 张 320x180 的示例图并转成 data URI（挂载时一次性生成） */
function buildUris(): void {
  for (let i = 0; i < BATCH; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 每张图换个底色，肉眼能分清加载的是哪一张
    const hue = 210 + i * 18
    const grad = ctx.createLinearGradient(0, 0, 320, 180)
    grad.addColorStop(0, `hsl(${hue} 65% 58%)`)
    grad.addColorStop(1, `hsl(${hue + 30} 72% 40%)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 320, 180)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.font = 'bold 22px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(`示例图 ${i + 1}（16 : 9）`, 160, 90)
    // 转成 JPEG data URI：离线可用、无跨域、也杜绝网络抖动干扰测量
    URIS[i] = canvas.toDataURL('image/jpeg', 0.75)
  }
}

// ---------- 触发加载：批量插入 + 逐张延时赋值 ----------

const pendingTimers: number[] = []

/** 延迟清零的定时器：切模式 / 清空列表本身会产生一次偏移，要把这笔账排除掉 */
let counterTimer = 0

/**
 * 把布局偏移计数清零
 * 直接清零不够：切换占位模式、清空图片列表都会让下方内容动一下，
 * 浏览器会记一条偏移并晚于清零回调送达。这里延后 220ms 再清一次，
 * 保证统计到的只有「图片逐张加载」造成的位移。
 */
function resetShiftCounters(): void {
  clsScore.value = 0
  shiftCount.value = 0
  window.clearTimeout(counterTimer)
  counterTimer = window.setTimeout(() => {
    clsScore.value = 0
    shiftCount.value = 0
  }, 220)
}

function triggerLoad(): void {
  // 上一批还剩未完成的图片时先清场，保证每次测量从零开始
  clearPending()
  items.value = []
  loadedCount.value = 0
  resetShiftCounters()

  for (let i = 0; i < BATCH; i++) {
    // 延迟从 600ms 起步并线性递增：拉开加载时序，
    // 也避开「点击后 500ms 内偏移不计入」的输入豁免窗口
    const delay = 600 + i * 180
    const item: ImgItem = { id: i, src: '', delay }
    items.value.push(item)
    pendingTimers.push(
      window.setTimeout(() => {
        item.src = URIS[i]
        loadedCount.value++
      }, delay),
    )
  }
}

/** 清掉还没触发的加载定时器（重置/卸载都要调用） */
function clearPending(): void {
  for (const id of pendingTimers) window.clearTimeout(id)
  pendingTimers.length = 0
}

// ---------- 布局偏移实测：PerformanceObserver ----------

/** layout-shift 条目在标准 lib 里没有完整类型，自行收缩字段 */
interface LayoutShiftEntry {
  hadRecentInput: boolean
  value: number
}

let shiftObserver: PerformanceObserver | null = null

function setupShiftObserver(): void {
  shiftObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as unknown as LayoutShiftEntry
      // 点击/输入 500ms 内发生的偏移由浏览器豁免，不计入分数
      if (shift.hadRecentInput) continue
      if (shift.value <= 0) continue
      clsScore.value += shift.value
      shiftCount.value++
    }
  })
  shiftObserver.observe({ type: 'layout-shift', buffered: false })
}

// ---------- 模式切换与重置 ----------

/** 切换占位策略（n-radio-group 发出的是原始值，收窄后再用） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'none' && next !== 'ratio') return
  if (mode.value === next) return
  mode.value = next
  clearPending()
  items.value = []
  loadedCount.value = 0
  resetShiftCounters()
}

/** 重置 / 重测：清空图片与全部计数，随时可以再来一轮 */
function resetAll(): void {
  clearPending()
  items.value = []
  loadedCount.value = 0
  resetShiftCounters()
}

// ---------- 生命周期 ----------

onMounted(() => {
  buildUris()
  setupShiftObserver()
})

onUnmounted(() => {
  clearPending()
  window.clearTimeout(counterTimer)
  shiftObserver?.disconnect()
  shiftObserver = null
})
</script>

<template>
  <div class="ar-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="mode"
        aria-label="占位策略"
        @update:value="setMode"
      >
        <n-radio-button value="none">
          无占位（旧）
        </n-radio-button>
        <n-radio-button value="ratio">
          aspect-ratio 占位（推荐）
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        ghost
        @click="triggerLoad"
      >
        触发图片加载
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>累计布局偏移分数 <b>{{ clsScore.toFixed(3) }}</b></span>
      <span>跳动次数 <b>{{ shiftCount }}</b> 次</span>
      <span>已加载图片 <b>{{ loadedCount }}</b> / {{ BATCH }} 张</span>
    </div>

    <!-- 图片网格：无占位时空转，占位版先摆好 16:9 底框 -->
    <div class="img-grid">
      <template
        v-for="item in items"
        :key="item.id"
      >
        <div
          v-if="mode === 'ratio'"
          class="ph"
        >
          <img
            v-if="item.src"
            :src="item.src"
            alt=""
          >
        </div>
        <img
          v-else-if="item.src"
          :src="item.src"
          class="plain"
          alt=""
        >
      </template>
    </div>

    <!-- 下方内容：被图片加载顶来顶去的就是它 -->
    <div class="below">
      <p>下方内容区——无占位模式里，图片加载完成时会把你正在阅读的段落顶下来。</p>
      <div class="below-line" />
    </div>

    <p class="hint">
      点「触发图片加载」：8 张图按 600ms 起步逐张就位。无占位模式下看「跳动次数」一路上涨；
      占位模式下外层先占住 16 比 9 的位置，加载只往里填图，分数几乎纹丝不动。
    </p>
  </div>
</template>

<style scoped>
.ar-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--danger);
  }
}

/* ---------- 图片网格 ---------- */

.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 0.5rem;
  min-width: 0;
}

/* 占位版：外层先按 16 比 9 占好位置，加载只往里填内容 */
.ph {
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--border) 45%, transparent);
  overflow: hidden;
  min-width: 0;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

/* 无占位版：加载前高度为 0，加载完成后按原图比例撑开 */
.plain {
  display: block;
  width: 100%;
  height: auto;
  min-width: 0;
  border-radius: var(--radius-sm);
}

/* ---------- 下方内容区 ---------- */

.below {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.6rem;

  p {
    margin: 0 0 0.5rem;
    font-size: var(--demo-text-sm);
    color: var(--text);
  }
}

.below-line {
  height: 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--primary) 30%, transparent);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
