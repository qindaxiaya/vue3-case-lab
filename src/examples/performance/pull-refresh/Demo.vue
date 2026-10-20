// ============================================================
// 案例：下拉刷新 + 触底加载（pull-refresh）
// 指针下拉时按阻尼系数位移，超过阈值松手触发刷新；
// 列表滚到底部自动加载下一页；含「刷新中禁止重复触发」状态。
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

const PAGE_SIZE = 12
/** 当前数据 */
const list = ref<number[]>(Array.from({ length: PAGE_SIZE }, (_, i) => i + 1))
/** 下拉位移（px） */
const pull = ref(0)
/** 是否正在拖拽 */
const dragging = ref(false)
/** 是否正在刷新 */
const refreshing = ref(false)
/** 是否正在加载更多 */
const loadingMore = ref(false)
/** 是否已到底 */
const finished = ref(false)
/** 触发阈值 */
const THRESHOLD = 64

let startY = 0
let scroller: HTMLElement | null = null

function setScroller(el: unknown): void {
  scroller = el instanceof HTMLElement ? el : null
}

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))

// ============================================================
// 下拉刷新
// ============================================================

function onPointerDown(e: PointerEvent): void {
  if (refreshing.value) return
  //! 只有滚到顶部时才允许下拉，否则会和正常滚动打架
  if (scroller && scroller.scrollTop > 0) return
  startY = e.clientY
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  const dy = e.clientY - startY
  if (dy <= 0) {
    pull.value = 0
    return
  }
  //! 阻尼：手指移动 100px，界面只走 45px，避免「拉过头」
  pull.value = Math.min(110, dy * 0.45)
}

async function onPointerUp(): Promise<void> {
  if (!dragging.value) return
  dragging.value = false

  if (pull.value >= THRESHOLD && !refreshing.value) {
    await refresh()
  } else {
    pull.value = 0
  }
}

async function refresh(): Promise<void> {
  refreshing.value = true
  pull.value = THRESHOLD
  await sleep(900)
  // 模拟刷新：换成新一批数据
  const base = Math.max(...list.value)
  list.value = Array.from({ length: PAGE_SIZE }, (_, i) => base + i + 1)
  finished.value = false
  refreshing.value = false
  pull.value = 0
}

// ============================================================
// 触底加载
// ============================================================

async function onScroll(): Promise<void> {
  if (!scroller || loadingMore.value || refreshing.value || finished.value) return
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48
  if (!nearBottom) return

  loadingMore.value = true
  await sleep(700)
  const base = Math.max(...list.value)
  list.value.push(...Array.from({ length: PAGE_SIZE }, (_, i) => base + i + 1))
  // 模拟：超过 5 页就没有更多了
  if (list.value.length >= PAGE_SIZE * 5) finished.value = true
  loadingMore.value = false
}

function reset(): void {
  list.value = Array.from({ length: PAGE_SIZE }, (_, i) => i + 1)
  finished.value = false
  pull.value = 0
  refreshing.value = false
  loadingMore.value = false
  if (scroller) scroller.scrollTop = 0
}
</script>

<template>
  <div class="pr-demo">
    <!-- 状态 -->
    <div class="pr-bar">
      <span class="pr-stat">
        共 <b>{{ list.length }}</b> 条
      </span>
      <span class="pr-stat">
        下拉 <b>{{ Math.round(pull) }}</b> / {{ THRESHOLD }} px
      </span>
      <span
        class="pr-state"
        :class="{ active: refreshing || loadingMore }"
      >
        {{ refreshing ? '刷新中…' : loadingMore ? '加载中…' : finished ? '没有更多了' : '就绪' }}
      </span>
      <button
        class="btn-reset"
        @click="reset"
      >
        重置
      </button>
    </div>

    <!-- 列表 -->
    <div
      :ref="setScroller"
      class="pr-scroller"
      @scroll="onScroll"
    >
      <!-- 下拉提示 -->
      <div
        class="pr-indicator"
        :style="{ height: `${pull}px` }"
      >
        <span v-if="refreshing">⟳ 正在刷新…</span>
        <span v-else-if="pull >= THRESHOLD">松手刷新</span>
        <span v-else-if="pull > 0">下拉刷新</span>
      </div>

      <div
        class="pr-content"
        :style="{ transform: `translateY(${pull}px)` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div
          v-for="n in list"
          :key="n"
          class="pr-row"
        >
          <span class="pr-idx">#{{ n }}</span>
          <span class="pr-txt">列表项内容 {{ n }}（共 {{ PAGE_SIZE }} 条 / 页）</span>
        </div>

        <p class="pr-footer">
          {{ finished ? '— 已经到底了 —' : loadingMore ? '加载更多…' : '继续下滑加载更多' }}
        </p>
      </div>
    </div>

    <p class="pr-hint">
      按住列表向下拖动（鼠标也可以）：超过 {{ THRESHOLD }}px 松手触发刷新；滚到底部自动加载下一页。
      真实移动端建议用 <code>overscroll-behavior: contain</code> 防止整页回弹。
    </p>
  </div>
</template>

<style scoped>
.pr-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 状态栏 ---------- */

.pr-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.pr-stat {
  font-size: 0.875rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.pr-state {
  font-size: 0.875rem;
  color: var(--text-secondary);

  &.active {
    color: var(--primary);
  }
}

.btn-reset {
  margin-left: auto;
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

/* ---------- 列表 ---------- */

.pr-scroller {
  height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  overscroll-behavior: contain;
  position: relative;
}

.pr-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.875rem;
  color: var(--primary);
  transition: height 0.15s ease-out;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  background-color: var(--bg);
}

.pr-content {
  padding: 0 0.5rem 0.5rem;
  touch-action: pan-y;
}

.pr-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.3rem;
  border-bottom: 1px solid var(--border);
}

.pr-idx {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--primary);
}

.pr-txt {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pr-footer {
  margin: 0;
  padding: 0.7rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pr-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
