// ============================================================
// 案例：虚拟列表（不定行高，virtual-variable）
// 每行高度不同：维护前缀和 offsets，滚动时二分查找起始行，
// 只渲染视口 + overscan 的行；对比「全量渲染 2000 行」的 DOM 数差异。
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 数据：2000 条不定高消息（高度 48~107px 循环）
// ============================================================

interface Msg {
  id: number
  text: string
  height: number
}

const TOTAL = 2000
const rows: Msg[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  text: `消息 #${i}：这是一条长度不固定的内容，用来模拟真实聊天流/评论区。`,
  // 44~108px：高度由内容行数决定
  height: 44 + ((i * 37) % 65),
}))

/** 前缀和：offsets[i] = 前 i 行总高度（offsets[0] = 0） */
const offsets: number[] = [0]
for (const row of rows) {
  offsets.push(offsets[offsets.length - 1] + row.height)
}
/** 总高度 */
const totalHeight = offsets[rows.length]

/** 视口高度与 overscan */
const VIEWPORT_H = 340
const OVERSCAN = 3

// ============================================================
// 滚动与区间计算
// ============================================================

const scrollTop = ref(0)
const mode = ref<'virtual' | 'full'>('virtual')

/** 切换渲染模式（n-radio-group 发出的是原始值，收窄后再用） */
function setMode(next: string | number | boolean | undefined): void {
  if (next !== 'virtual' && next !== 'full') return
  mode.value = next
}

function onScroll(e: Event): void {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

/**
 * //! 二分查找：找到第一个「底边超过 scrollTop」的行
 * 不定高不能像定高那样直接 scrollTop / rowHeight
 */
function findStart(top: number): number {
  let lo = 0
  let hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid + 1] <= top) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** 起始索引（含 overscan） */
const start = computed(() => Math.max(0, findStart(scrollTop.value) - OVERSCAN))

/** 结束索引（视口底部 + overscan） */
const end = computed(() => {
  const bottom = scrollTop.value + VIEWPORT_H
  let i = start.value
  while (i < rows.length && offsets[i] < bottom) i++
  return Math.min(rows.length, i + OVERSCAN)
})

/** 当前渲染的行 */
const visibleRows = computed(() => rows.slice(start.value, end.value))

/** 偏移：整块内容 translateY，保持滚动条长度正确 */
const offsetY = computed(() => offsets[start.value])

/** 渲染的 DOM 行数 */
const renderedCount = computed(() => (mode.value === 'full' ? rows.length : end.value - start.value))

function resetScroll(): void {
  scrollTop.value = 0
  const scroller = document.querySelector<HTMLElement>('.vv-scroller')
  if (scroller) scroller.scrollTop = 0
}
</script>

<template>
  <div class="vv-demo">
    <!-- 控制 -->
    <div class="vv-bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="seg"
        :value="mode"
        aria-label="渲染模式"
        @update:value="setMode"
      >
        <n-radio-button value="virtual">
          虚拟渲染
        </n-radio-button>
        <n-radio-button value="full">
          全量渲染 {{ TOTAL }} 行
        </n-radio-button>
      </n-radio-group>
      <span class="vv-stat">
        DOM 行数 <b>{{ renderedCount }}</b> / {{ TOTAL }}
      </span>
      <span class="vv-stat">
        区间 <b>{{ start }} – {{ end }}</b>
      </span>
      <n-button
        class="btn-reset"
        @click="resetScroll"
      >
        回到顶部
      </n-button>
    </div>

    <!-- 滚动容器 -->
    <div
      class="vv-scroller"
      :style="{ height: `${VIEWPORT_H}px` }"
      @scroll="onScroll"
    >
      <!-- 全量模式 -->
      <div v-if="mode === 'full'">
        <div
          v-for="row in rows"
          :key="row.id"
          class="vv-row"
          :style="{ height: `${row.height}px` }"
        >
          <span class="vv-id">#{{ row.id }}</span>
          <span class="vv-text">{{ row.text }}</span>
        </div>
      </div>

      <!-- 虚拟模式：撑起总高度 + 可视区绝对定位 -->
      <div
        v-else
        class="vv-phantom"
        :style="{ height: `${totalHeight}px` }"
      >
        <div
          class="vv-window"
          :style="{ transform: `translateY(${offsetY}px)` }"
        >
          <div
            v-for="row in visibleRows"
            :key="row.id"
            class="vv-row"
            :style="{ height: `${row.height}px` }"
          >
            <span class="vv-id">#{{ row.id }}</span>
            <span class="vv-text">{{ row.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="vv-hint">
      切到「全量渲染」滚一下能感到卡顿；虚拟模式只保留视口内约 8~10 行。
      不定高的关键是：<code>offsets</code> 前缀和 + 二分查找，而不是除法。
    </p>
  </div>
</template>

<style scoped>
.vv-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 控制 ---------- */

.vv-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
}

.vv-stat {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

/* 只留布局：把「回到顶部」推到右侧，观感交给 Naive 按钮 */
.btn-reset {
  margin-left: auto;
}

/* ---------- 滚动区 ---------- */

.vv-scroller {
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  position: relative;
  contain: strict;
}

.vv-phantom {
  position: relative;
  width: 100%;
}

.vv-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.vv-row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--border);
  box-sizing: border-box;
  overflow: hidden;
}

.vv-id {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--primary);
  flex-shrink: 0;
}

.vv-text {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.vv-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
