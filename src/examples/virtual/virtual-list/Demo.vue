// ============================================================
// 案例：定高虚拟列表（virtual-list）
// - 10 万行数据，只渲染视口 ±5 行缓冲（DOM 行数恒定 ≈ 20~30）
// - 视口固定 400px、行高 32px；内容层 transform: translateY 定位
// - 滚动处理 rAF 节流（每帧最多更新一次索引）
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ---------- 常量与数据 ----------

/** 总行数 */
const TOTAL = 100_000
/** 行高 px（定高是本简化版的前提） */
const ROW_H = 32
/** 可视区高度 px */
const VIEW_H = 400
/** 上下缓冲行数（防快速滚动白屏） */
const BUFFER = 5

/** 预生成 10 万行数据（一次性 Array.from；文本用确定性拼接省内存） */
const rows = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  text: `第 ${i + 1} 行 · 文案-${(i * 7) % 13}`,
}))

// ---------- 滚动索引计算 ----------

/** 容器 scrollTop（rAF 节流更新） */
const scrollTop = ref(0)

/** 当前渲染的起始行（含缓冲，下取整再减 BUFFER） */
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / ROW_H) - BUFFER),
)

/** 当前渲染的结束行（含缓冲，不越界） */
const endIndex = computed(() =>
  Math.min(TOTAL - 1, Math.floor((scrollTop.value + VIEW_H) / ROW_H) + BUFFER),
)

/** 视口内可见的行（不含缓冲）——顶部统计用 */
const visibleCount = computed(() => Math.ceil(VIEW_H / ROW_H))

/** 当前渲染的 DOM 行切片 */
const renderedRows = computed(() => rows.slice(startIndex.value, endIndex.value + 1))

/** 内容层偏移：从列表顶部到第一个渲染行的距离（占位高度） */
const offsetStyle = computed(() => ({ transform: `translateY(${startIndex.value * ROW_H}px)` }))

// ---------- rAF 节流滚动 ----------

let scrollRafId = 0
let pendingTop = 0

/** 直接写 scrollTop 会在一帧内多次触发计算；rAF 合并到每帧一次 */
function onScroll(e: Event): void {
  pendingTop = (e.target as HTMLElement).scrollTop
  // 已有待处理帧就跳过（合并高频 scroll 事件）
  if (scrollRafId) return
  scrollRafId = requestAnimationFrame(() => {
    scrollTop.value = pendingTop
    scrollRafId = 0
  })
}

onUnmounted(() => {
  // 兜底取消未执行的帧
  if (scrollRafId) cancelAnimationFrame(scrollRafId)
})
</script>

<template>
  <div class="vl-demo">
    <!-- 顶部统计条 -->
    <div class="stats">
      <span>总行数 <b>{{ TOTAL.toLocaleString() }}</b></span>
      <span>渲染节点 <b>{{ renderedRows.length }}</b></span>
      <span>可视行 <b>{{ visibleCount }}</b></span>
      <span>滚动位置 <b>{{ Math.round(scrollTop) }}px</b></span>
    </div>

    <!-- 视口容器（固定高度，内部滚动） -->
    <div
      class="viewport"
      @scroll.passive="onScroll"
    >
      <!-- 占位层：撑出 10 万行的总高度，让滚动条比例正确 -->
      <div
        class="spacer"
        :style="{ height: `${TOTAL * ROW_H}px` }"
      >
        <!-- 内容层：只挂当前切片，transform 定位到真实位置 -->
        <div
          class="content"
          :style="offsetStyle"
        >
          <div
            v-for="row in renderedRows"
            :key="row.id"
            class="row"
            :class="{ 'row--alt': row.id % 2 === 1 }"
          >
            {{ row.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vl-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ---------- 统计条 ---------- */

.stats {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  font-size: 0.82rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* ---------- 视口与行 ---------- */

.viewport {
  height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  contain: strict; /* 布局隔离：滚动/重排不外溢 */
}

.spacer {
  position: relative;
}

.content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  /* transform 定位：比 top 定位少一次重排（合成层直接偏移） */
  will-change: transform;
}

.row {
  height: 32px;
  line-height: 32px;
  padding: 0 1rem;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--text);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.row--alt {
  background-color: var(--bg-subtle);
}
</style>
