// ============================================================
// 案例：虚拟网格（virtual-grid）
// - 5000 张卡片、每行 4 张；全量模式真的渲染 5000 个节点
// - 虚拟模式只渲染可视区上下各 2 行，用总高度撑滚动条
// - 滚动时按 scrollTop / 行高 换算出窗口，绝对定位到对应位置
// ============================================================
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

interface Cell {
  id: number
  hue: number
}

const TOTAL = 5000
const COLUMNS = 4
const ROW_HEIGHT = 90
const VIEWPORT_HEIGHT = 480
const BUFFER = 2

const cells: Cell[] = Array.from({ length: TOTAL }, (_, id) => ({
  id,
  hue: (id * 47) % 360,
}))

const enabled = ref(true)
const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const renderMs = ref<number | null>(null)
const measuring = ref(false)

const totalRows = Math.ceil(TOTAL / COLUMNS)
const totalHeight = totalRows * ROW_HEIGHT
/** 一屏能放下的行数，多算一行避免底部露白 */
const screenRows = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 1

const startRow = computed(() => {
  if (!enabled.value) return 0
  return Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER)
})

const endRow = computed(() => {
  if (!enabled.value) return totalRows
  return Math.min(totalRows, startRow.value + screenRows + BUFFER * 2)
})

interface VisibleRow {
  row: number
  items: Cell[]
}

/** 当前要渲染的行窗口；每行再切出 4 张卡片 */
const visibleRows = computed<VisibleRow[]>(() => {
  const rows: VisibleRow[] = []
  for (let row = startRow.value; row < endRow.value; row++) {
    rows.push({
      row,
      items: cells.slice(row * COLUMNS, (row + 1) * COLUMNS),
    })
  }
  return rows
})

const renderedCount = computed(() =>
  enabled.value ? visibleRows.value.reduce((sum, item) => sum + item.items.length, 0) : TOTAL,
)

/** 只更新滚动偏移，窗口由 computed 自动重算 */
function onScroll(): void {
  if (!viewport.value) return
  scrollTop.value = viewport.value.scrollTop
}

/** 等两帧，把渲染与绘制都算进耗时 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** 切换模式并测一次重建耗时 */
async function setMode(next: boolean): Promise<void> {
  if (measuring.value || enabled.value === next) return
  measuring.value = true
  const startedAt = performance.now()

  enabled.value = next
  await nextTick()
  await nextFrame()

  renderMs.value = Math.round((performance.now() - startedAt) * 10) / 10
  if (!next) {
    // 退出虚拟模式后如果停在底部，仍保持当前位置，便于观察节点数
    scrollTop.value = viewport.value?.scrollTop ?? 0
  }
  measuring.value = false
}

/** 回到顶部并清空测量 */
function backToTop(): void {
  viewport.value?.scrollTo({ top: 0 })
  scrollTop.value = 0
  renderMs.value = null
}

/** 滚到中间位置，方便快速观察窗口变化 */
function jumpToMiddle(): void {
  if (!viewport.value) return
  const top = Math.floor(totalHeight / 2)
  viewport.value.scrollTop = top
  scrollTop.value = top
}
</script>

<template>
  <div class="vg-demo">
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="渲染模式"
      >
        <button
          class="mode"
          :class="{ active: enabled }"
          :aria-pressed="enabled"
          @click="setMode(true)"
        >
          虚拟网格（推荐）
        </button>
        <button
          class="mode"
          :class="{ active: !enabled }"
          :aria-pressed="!enabled"
          @click="setMode(false)"
        >
          全量渲染 5000 张
        </button>
      </div>
      <button
        class="btn ghost"
        :disabled="measuring"
        @click="jumpToMiddle"
      >
        跳到中间
      </button>
      <button
        class="btn ghost"
        @click="backToTop"
      >
        回到顶部
      </button>
    </div>

    <div class="stats">
      <span>数据 <b>{{ TOTAL }}</b></span>
      <span>已渲染 <b>{{ renderedCount }}</b></span>
      <span>行窗口 <b>{{ enabled ? `${startRow + 1}–${endRow} / ${totalRows}` : '全部' }}</b></span>
      <span>scrollTop <b>{{ Math.round(scrollTop) }}</b></span>
      <span>重建耗时 <b>{{ renderMs ?? '—' }}</b> ms</span>
    </div>

    <div
      ref="viewport"
      class="viewport"
      :style="{ height: `${VIEWPORT_HEIGHT}px` }"
      @scroll="onScroll"
    >
      <div
        class="spacer"
        :style="{ height: `${totalHeight}px` }"
      >
        <div
          v-if="enabled"
          class="window"
          :style="{ transform: `translateY(${startRow * ROW_HEIGHT}px)` }"
        >
          <div
            v-for="row in visibleRows"
            :key="row.row"
            class="row"
            :style="{ height: `${ROW_HEIGHT - 6}px` }"
          >
            <article
              v-for="cell in row.items"
              :key="cell.id"
              class="cell"
              :style="{ backgroundColor: `hsl(${cell.hue} 58% 86%)` }"
            >
              <span class="no">{{ String(cell.id + 1).padStart(4, '0') }}</span>
              <span class="label">图片卡片</span>
            </article>
          </div>
        </div>

        <div
          v-else
          class="all-grid"
        >
          <article
            v-for="cell in cells"
            :key="cell.id"
            class="cell"
            :style="{ backgroundColor: `hsl(${cell.hue} 58% 86%)` }"
          >
            <span class="no">{{ String(cell.id + 1).padStart(4, '0') }}</span>
            <span class="label">图片卡片</span>
          </article>
        </div>
      </div>
    </div>

    <p class="hint">
      两种模式滚动条高度完全一样，因为外层始终用 1250 行 × 90px 撑开；
      虚拟模式只把当前窗口的行绝对定位到正确位置。点「全量渲染」再滚动，能明显感到节点多带来的压力。
    </p>
  </div>
</template>

<style scoped>
.vg-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
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
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
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

.viewport {
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  contain: strict;
}

.spacer {
  position: relative;
}

.window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.row,
.all-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 0 6px;
}

.row {
  margin-bottom: 6px;
}

.cell {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.15rem;
  min-width: 0;
  height: 84px;
  padding: 0.55rem 0.65rem;
  border-radius: var(--demo-radius);
  color: #1f2937;
  box-shadow: inset 0 0 0 1px rgb(15 23 42 / 6%);
}

.no {
  font-family: var(--font-mono);
  font-size: var(--demo-text-md);
  font-weight: 600;
}

.label {
  font-size: var(--demo-text-xs);
  opacity: 0.72;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .row,
  .all-grid {
    gap: 4px;
    padding: 0 4px;
  }

  .cell {
    padding: 0.35rem;
  }

  .label {
    display: none;
  }
}
</style>
